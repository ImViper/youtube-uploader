import { Worker, Job } from 'bullmq';
import { Browser } from 'puppeteer';
import pino from 'pino';
import { upload } from '../upload';
import { getDatabase } from '../database/connection';
import { AccountManager } from '../accounts/manager';
import { BitBrowserManager } from '../bitbrowser/manager';
import { BrowserInstance } from '../bitbrowser/manager';

const logger = pino({
  name: 'upload-worker-v2',
  level: process.env.LOG_LEVEL || 'info'
});

export interface UploadJobData {
  taskId: string;
  accountId?: string;
}

export interface UploadJobResult {
  success: boolean;
  videoId?: string;
  error?: string;
  uploadDuration?: number;
  accountId?: string;
  windowName?: string;
}

export interface UploadWorkerConfig {
  accountManager: AccountManager;
  bitBrowserManager: BitBrowserManager;
  maxUploadTime?: number;
  maxRetries?: number;
}

export class UploadWorkerV2 extends Worker<UploadJobData, UploadJobResult> {
  private config: UploadWorkerConfig;
  private db = getDatabase();

  constructor(config: UploadWorkerConfig) {
    super('youtube:upload', async (job: Job<UploadJobData>) => {
      return this.processUpload(job);
    }, {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
      concurrency: parseInt(process.env.UPLOAD_CONCURRENCY || '5'),
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
    });

    this.config = {
      maxUploadTime: 1800000, // 30 minutes
      maxRetries: 3,
      ...config
    };

    logger.info('Upload Worker V2 initialized');
  }

  private async processUpload(job: Job<UploadJobData>): Promise<UploadJobResult> {
    const { taskId, accountId: requestedAccountId } = job.data;
    const startTime = Date.now();

    logger.info({ 
      jobId: job.id, 
      taskId, 
      accountId: requestedAccountId 
    }, 'Processing upload task');

    let browserInstance: BrowserInstance | null = null;
    let accountProfile;
    let browser: Browser | undefined;

    try {
      // Update job progress
      await job.updateProgress({ status: 'fetching_task_details', progress: 10 });

      // Get task details
      const taskResult = await this.db.query(
        'SELECT * FROM upload_tasks WHERE id = $1',
        [taskId]
      );

      if (taskResult.rows.length === 0) {
        throw new Error(`Task not found: ${taskId}`);
      }

      const task = taskResult.rows[0];
      const videoData = task.video_data;

      // Update job progress
      await job.updateProgress({ status: 'selecting_account', progress: 15 });

      // Get account (use requested account or find a healthy one)
      if (requestedAccountId) {
        accountProfile = await this.config.accountManager.getAccount(requestedAccountId);
        if (!accountProfile) {
          throw new Error(`Account not found: ${requestedAccountId}`);
        }
      } else {
        accountProfile = await this.config.accountManager.getHealthyAccount();
        if (!accountProfile) {
          throw new Error('No healthy accounts available');
        }
      }

      const accountId = accountProfile.id;
      logger.info({ accountId, email: accountProfile.email }, 'Account selected');

      // Update task with assigned account
      await this.db.query(
        'UPDATE upload_tasks SET account_id = $1, started_at = CURRENT_TIMESTAMP WHERE id = $2',
        [accountId, taskId]
      );

      // Update job progress
      await job.updateProgress({ status: 'acquiring_browser', progress: 20 });

      // Get browser window name from account
      const windowName = accountProfile.bitbrowserWindowName;
      if (!windowName) {
        throw new Error(`Account ${accountProfile.email} has no browser window assigned`);
      }

      logger.info({ windowName, accountId }, 'Opening browser window');

      // Open browser by window name
      browserInstance = await this.config.bitBrowserManager.openBrowserByName(windowName);
      logger.info({ 
        windowId: browserInstance.windowId,
        windowName: browserInstance.windowName,
        debugUrl: browserInstance.debugUrl
      }, 'Browser instance acquired');

      // Connect to browser
      browser = browserInstance.browser;
      if (!browser) {
        throw new Error('Browser connection not available');
      }

      // Update job progress
      await job.updateProgress({ status: 'uploading', progress: 30 });

      // Create upload history record
      const historyResult = await this.db.query(
        `INSERT INTO upload_history (task_id, account_id, started_at) 
         VALUES ($1, $2, CURRENT_TIMESTAMP) 
         RETURNING id`,
        [taskId, accountId]
      );
      const historyId = historyResult.rows[0].id;

      // Mock credentials since browser is already logged in
      const mockCredentials = {
        email: accountProfile.email,
        pass: '',
        recoveryemail: accountProfile.credentials.recoveryEmail
      };

      // Execute upload with progress tracking
      const uploadPromise = upload(
        mockCredentials,
        [videoData],
        {
          browser: browser,
          onProgress: (progress) => {
            if (typeof progress === 'number') {
              job.updateProgress({ 
                status: 'uploading', 
                progress: 30 + (progress * 0.6) // 30-90%
              });
            }
          },
          onLog: (message) => {
            logger.debug({ taskId, message }, 'Upload log');
          }
        }
      );

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Upload timeout')), this.config.maxUploadTime!);
      });

      // Wait for upload or timeout
      const uploadResults = await Promise.race([uploadPromise, timeoutPromise]) as any;
      const uploadResult = uploadResults?.[0];

      if (!uploadResult || !uploadResult.link) {
        throw new Error('Upload failed - no video link returned');
      }

      // Update upload history
      const uploadDuration = Date.now() - startTime;
      await this.db.query(
        `UPDATE upload_history 
         SET success = true, 
             video_id = $1, 
             upload_duration = $2,
             completed_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [uploadResult.link, uploadDuration, historyId]
      );

      // Update account health and stats
      await this.config.accountManager.updateAccountHealth(accountId, true);

      logger.info({ 
        jobId: job.id,
        taskId,
        videoId: uploadResult.link,
        duration: uploadDuration 
      }, 'Upload completed successfully');

      return {
        success: true,
        videoId: uploadResult.link,
        uploadDuration,
        accountId,
        windowName
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const uploadDuration = Date.now() - startTime;

      logger.error({ 
        jobId: job.id,
        taskId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      }, 'Upload failed');

      // Update account health if we have one
      if (accountProfile) {
        await this.config.accountManager.updateAccountHealth(accountProfile.id, false);
      }

      // Update upload history if we have it
      if (accountProfile) {
        await this.db.query(
          `INSERT INTO upload_history (task_id, account_id, success, error_details, started_at, completed_at) 
           VALUES ($1, $2, false, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [taskId, accountProfile.id, { error: errorMessage }]
        );
      }

      return {
        success: false,
        error: errorMessage,
        uploadDuration,
        accountId: accountProfile?.id,
        windowName: accountProfile?.bitbrowserWindowName
      };

    } finally {
      // Disconnect browser (keep window open)
      if (browserInstance && browserInstance.browser) {
        await browserInstance.browser.disconnect();
        logger.debug({ windowId: browserInstance.windowId }, 'Browser disconnected');
      }

      // Update task status
      if (taskId) {
        const finalStatus = job.returnvalue?.success ? 'completed' : 'failed';
        await this.db.query(
          'UPDATE upload_tasks SET status = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2',
          [finalStatus, taskId]
        );
      }
    }
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    logger.info('Starting Upload Worker V2');
    await this.run();
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    logger.info('Stopping Upload Worker V2');
    await this.close();
  }
}