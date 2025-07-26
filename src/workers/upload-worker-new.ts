import { Worker, Job } from 'bullmq';
import { getRedis } from '../redis/connection';
import { UploadTask, QueueManager } from '../queue/manager';
import { BitBrowserManager } from '../bitbrowser/manager';
import { AccountManager } from '../accounts/manager';
import { getDatabase } from '../database/connection';
import { getWebSocketManager } from '../api/websocket';
import pino from 'pino';
import { Page } from 'puppeteer';
import { Video } from '../types';

const logger = pino({
  name: 'upload-worker',
  level: process.env.LOG_LEVEL || 'info'
});

export interface UploadWorkerConfig {
  concurrency?: number;
  bitBrowserManager: BitBrowserManager;
  accountManager: AccountManager;
  maxUploadTime?: number; // ms
}

export interface UploadResult {
  success: boolean;
  videoId?: string;
  error?: string;
  uploadDuration?: number;
  accountId?: string;
  windowId?: string;
}

export class UploadWorker {
  private worker: Worker<UploadTask, UploadResult>;
  private config: UploadWorkerConfig;
  private db = getDatabase();
  private isShuttingDown = false;

  constructor(queueName: string = 'youtube-uploads', config: UploadWorkerConfig) {
    this.config = {
      concurrency: config.concurrency || 5,
      maxUploadTime: config.maxUploadTime || 1800000, // 30 minutes
      ...config
    };

    const connection = getRedis().getClient();

    // Create worker
    this.worker = new Worker<UploadTask, UploadResult>(
      queueName,
      async (job) => this.processUpload(job),
      {
        connection,
        concurrency: this.config.concurrency,
        autorun: false
      }
    );

    this.setupEventHandlers();

    logger.info({ 
      queueName, 
      concurrency: this.config.concurrency 
    }, 'Upload worker initialized');
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('Worker is shutting down');
    }

    await this.worker.run();
    logger.info('Upload worker started');
  }

  /**
   * Process upload task
   */
  private async processUpload(job: Job<UploadTask>): Promise<UploadResult> {
    const startTime = Date.now();
    const { video, id: taskId, accountId: requestedAccountId } = job.data;

    logger.info({ 
      jobId: job.id, 
      taskId, 
      accountId: requestedAccountId 
    }, 'Processing upload task');

    let browserInstance;
    let accountProfile;

    try {
      // Update job progress
      await job.updateProgress({ status: 'acquiring_account', progress: 10 });
      
      // Emit WebSocket event for task progress
      const wsManager = getWebSocketManager();
      if (wsManager) {
        wsManager.emitUploadProgress({
          taskId,
          accountId: requestedAccountId || '',
          videoTitle: video.title || 'Untitled',
          progress: 10,
          stage: 'acquiring_account',
          timestamp: new Date().toISOString()
        });
      }

      // Get a healthy account with pre-logged browser window
      accountProfile = await this.config.accountManager.getHealthyAccount();

      if (!accountProfile || !accountProfile.bitbrowserWindowId) {
        throw new Error('No available account with logged-in browser window');
      }

      const accountId = accountProfile.id;
      logger.info({ 
        accountId, 
        email: accountProfile.email,
        windowId: accountProfile.bitbrowserWindowId,
        windowName: accountProfile.bitbrowserWindowName
      }, 'Account selected for upload');

      // Update job progress
      await job.updateProgress({ status: 'acquiring_browser', progress: 20 });

      // Get persistent browser instance
      browserInstance = await this.config.bitBrowserManager.getOrCreatePersistentBrowser(
        accountProfile.bitbrowserWindowName!
      );
      
      logger.info({ 
        windowId: browserInstance.windowId,
        windowName: browserInstance.windowName,
        isLoggedIn: browserInstance.isLoggedIn
      }, 'Browser instance acquired');

      // Verify browser is still logged in
      if (!browserInstance.isLoggedIn) {
        const isLoggedIn = await this.config.bitBrowserManager.checkYouTubeLogin(browserInstance.id);
        if (!isLoggedIn) {
          await this.config.accountManager.updateWindowLoginStatus(accountId, false);
          throw new Error('Browser window is not logged into YouTube');
        }
      }

      // Update browser status
      this.config.bitBrowserManager.updateInstanceStatus(browserInstance.id, 'busy');

      // Create upload history record
      const historyResult = await this.db.query(
        `INSERT INTO upload_history (account_id, task_id, browser_instance_id, video_url, started_at)
         VALUES ($1, $2, $3, '', CURRENT_TIMESTAMP)
         RETURNING id`,
        [accountId, taskId, browserInstance.id]
      );
      const historyId = historyResult.rows[0].id;

      // Update job progress
      await job.updateProgress({ status: 'uploading', progress: 30 });

      // Perform upload
      const videoUrl = await this.performYouTubeUpload(browserInstance.page!, video, job);

      // Update upload history
      const uploadDuration = Date.now() - startTime;
      await this.db.query(
        `UPDATE upload_history 
         SET success = true, 
             video_url = $1, 
             upload_duration = $2,
             completed_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [videoUrl, uploadDuration, historyId]
      );

      // Update account health and stats
      await this.config.accountManager.updateAccountHealth(accountId, true);

      // Update browser instance stats
      browserInstance.uploadCount++;
      browserInstance.lastActivity = new Date();
      this.config.bitBrowserManager.updateInstanceStatus(browserInstance.id, 'idle');

      logger.info({ 
        jobId: job.id,
        taskId,
        videoUrl,
        duration: uploadDuration 
      }, 'Upload completed successfully');

      return {
        success: true,
        videoId: videoUrl,
        uploadDuration,
        accountId,
        windowId: browserInstance.windowId
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const uploadDuration = Date.now() - startTime;

      logger.error({ 
        jobId: job.id,
        taskId,
        error: errorMessage,
        duration: uploadDuration 
      }, 'Upload failed');

      // Update account health if we got that far
      if (accountProfile) {
        await this.config.accountManager.updateAccountHealth(accountProfile.id, false);
      }

      // Update browser status if we got that far
      if (browserInstance) {
        browserInstance.errorCount++;
        this.config.bitBrowserManager.updateInstanceStatus(browserInstance.id, 'idle');
      }

      // Update task status to failed
      await this.db.query(
        `UPDATE upload_tasks 
         SET status = 'failed', 
             error = $1,
             retry_count = retry_count + 1,
             completed_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [errorMessage, taskId]
      );

      return {
        success: false,
        error: errorMessage,
        uploadDuration,
        accountId: accountProfile?.id
      };

    } finally {
      // Always mark browser as idle if we acquired one
      if (browserInstance) {
        this.config.bitBrowserManager.updateInstanceStatus(browserInstance.id, 'idle');
      }
    }
  }

  /**
   * Perform the actual YouTube upload
   */
  private async performYouTubeUpload(page: Page, video: Video, job: Job): Promise<string> {
    try {
      // Navigate to YouTube Studio
      await page.goto('https://studio.youtube.com', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await job.updateProgress({ status: 'navigating_to_upload', progress: 40 });

      // Click on Create button
      await page.waitForSelector('[aria-label="Create"]', { timeout: 10000 });
      await page.click('[aria-label="Create"]');

      // Click on Upload videos
      await page.waitForSelector('tp-yt-paper-item[test-id="upload-beta"]', { timeout: 5000 });
      await page.click('tp-yt-paper-item[test-id="upload-beta"]');

      await job.updateProgress({ status: 'uploading_file', progress: 50 });

      // Upload file
      const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 5000 });
      await fileInput!.uploadFile(video.path);

      // Wait for upload to process
      await page.waitForSelector('#textbox', { timeout: 30000 });

      await job.updateProgress({ status: 'filling_details', progress: 60 });

      // Set title
      const titleInput = await page.$('#textbox');
      await titleInput!.click({ clickCount: 3 }); // Select all
      await titleInput!.type(video.title);

      // Set description
      const descriptionInput = await page.$('div[aria-label="Tell viewers about your video (type @ to mention a channel)"]');
      if (descriptionInput && video.description) {
        await descriptionInput.click();
        await descriptionInput.type(video.description);
      }

      await job.updateProgress({ status: 'setting_options', progress: 70 });

      // Select "Not made for kids"
      await page.waitForSelector('tp-yt-paper-radio-button[name="NOT_MADE_FOR_KIDS"]', { timeout: 5000 });
      await page.click('tp-yt-paper-radio-button[name="NOT_MADE_FOR_KIDS"]');

      // Click Next button multiple times
      for (let i = 0; i < 3; i++) {
        await page.waitForSelector('#next-button', { timeout: 5000 });
        await page.click('#next-button');
        await page.waitForTimeout(2000);
      }

      await job.updateProgress({ status: 'publishing', progress: 80 });

      // Select visibility
      if (video.publishType === 'PUBLIC') {
        await page.waitForSelector('tp-yt-paper-radio-button[name="PUBLIC"]', { timeout: 5000 });
        await page.click('tp-yt-paper-radio-button[name="PUBLIC"]');
      } else if (video.publishType === 'UNLISTED') {
        await page.waitForSelector('tp-yt-paper-radio-button[name="UNLISTED"]', { timeout: 5000 });
        await page.click('tp-yt-paper-radio-button[name="UNLISTED"]');
      } else {
        await page.waitForSelector('tp-yt-paper-radio-button[name="PRIVATE"]', { timeout: 5000 });
        await page.click('tp-yt-paper-radio-button[name="PRIVATE"]');
      }

      // Click done button
      await page.waitForSelector('#done-button', { timeout: 5000 });
      await page.click('#done-button');

      await job.updateProgress({ status: 'finalizing', progress: 90 });

      // Wait for and extract video URL
      await page.waitForSelector('a.style-scope.ytcp-video-info', { timeout: 30000 });
      const videoUrl = await page.evaluate(() => {
        const link = document.querySelector('a.style-scope.ytcp-video-info') as HTMLAnchorElement;
        return link?.href || '';
      });

      if (!videoUrl) {
        throw new Error('Could not extract video URL after upload');
      }

      await job.updateProgress({ status: 'completed', progress: 100 });

      return videoUrl;

    } catch (error) {
      logger.error({ error }, 'Error during YouTube upload');
      throw error;
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.worker.on('completed', (job, result) => {
      logger.info({ 
        jobId: job.id, 
        result 
      }, 'Job completed');

      // Emit WebSocket event
      const wsManager = getWebSocketManager();
      if (wsManager && result.success) {
        wsManager.emitUploadComplete({
          taskId: job.data.id,
          accountId: result.accountId || '',
          videoId: result.videoId || '',
          videoTitle: job.data.video.title || 'Untitled',
          videoUrl: `https://www.youtube.com/watch?v=${result.videoId}`,
          timestamp: new Date().toISOString()
        });
      }
    });

    this.worker.on('failed', (job, err) => {
      if (job) {
        logger.error({ 
          jobId: job.id, 
          error: err.message 
        }, 'Job failed');

        // Emit WebSocket event
        const wsManager = getWebSocketManager();
        if (wsManager) {
          wsManager.emitUploadError({
            taskId: job.data.id,
            accountId: job.data.accountId || '',
            videoTitle: job.data.video.title || 'Untitled',
            error: err.message,
            timestamp: new Date().toISOString()
          });
        }
      }
    });

    this.worker.on('error', (error) => {
      logger.error({ error }, 'Worker error');
    });
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info('Stopping upload worker...');

    await this.worker.close();
    logger.info('Upload worker stopped');
  }
}