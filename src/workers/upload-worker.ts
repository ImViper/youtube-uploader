import { Worker, Job } from 'bullmq';
import { getRedis } from '../redis/connection';
import { UploadTask, QueueManager } from '../queue/manager';
import { BrowserPool } from '../bitbrowser/pool';
import { AccountSelector } from '../accounts/selector';
import { AccountManager } from '../accounts/manager';
import { upload as originalUpload } from '../upload';
import { getDatabase } from '../database/connection';
import pino from 'pino';
import { Browser } from 'puppeteer';

const logger = pino({
  name: 'upload-worker',
  level: process.env.LOG_LEVEL || 'info'
});

export interface UploadWorkerConfig {
  concurrency?: number;
  browserPool: BrowserPool;
  accountSelector: AccountSelector;
  accountManager: AccountManager;
  maxUploadTime?: number; // ms
}

export interface UploadResult {
  success: boolean;
  videoId?: string;
  error?: string;
  uploadDuration?: number;
  accountId?: string;
  browserPoolId?: string;
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
   * Process upload job
   */
  private async processUpload(job: Job<UploadTask>): Promise<UploadResult> {
    const startTime = Date.now();
    const { id: taskId, accountId: requestedAccountId, video } = job.data;
    
    logger.info({ 
      jobId: job.id, 
      taskId, 
      accountId: requestedAccountId 
    }, 'Processing upload task');

    let browserInstance;
    let accountProfile;
    let browser: Browser | undefined;

    try {
      // Update job progress
      await job.updateProgress({ status: 'acquiring_account', progress: 10 });

      // Select account (may be different from requested if that one is unavailable)
      accountProfile = requestedAccountId 
        ? await this.config.accountManager.getAccount(requestedAccountId)
        : await this.config.accountSelector.selectAccount(taskId);

      if (!accountProfile) {
        throw new Error('No available account for upload');
      }

      const accountId = accountProfile.id;
      logger.info({ accountId, email: accountProfile.email }, 'Account selected for upload');

      // Update job progress
      await job.updateProgress({ status: 'acquiring_browser', progress: 20 });

      // Acquire browser instance
      browserInstance = await this.config.browserPool.acquire(taskId);
      logger.info({ 
        poolId: browserInstance.poolId,
        windowId: browserInstance.windowId 
      }, 'Browser instance acquired');

      // Connect to browser
      browser = browserInstance.browser;
      if (!browser) {
        throw new Error('Browser connection not available');
      }

      // Update job progress
      await job.updateProgress({ status: 'uploading', progress: 30 });

      // Get account credentials
      const credentials = await this.config.accountManager.getAccountCredentials(accountId);
      if (!credentials) {
        throw new Error('Failed to get account credentials');
      }

      // Create upload history record
      const historyResult = await this.db.query(
        `INSERT INTO upload_history (account_id, task_id, video_metadata, started_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         RETURNING id`,
        [accountId, taskId, JSON.stringify(video)]
      );
      const historyId = historyResult.rows[0].id;

      // Perform upload with timeout
      const uploadPromise = originalUpload(
        credentials,
        [video],
        {
          onSuccess: (video: any) => {
            logger.info({ videoId: video.link, taskId }, 'Upload successful');
            job.updateProgress({ status: 'completed', progress: 100 });
          },
          onError: (error: any) => {
            logger.error({ error, taskId }, 'Upload error callback');
          }
        } as any
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

      // Update browser instance stats
      browserInstance.uploadCount++;
      (browserInstance as any).lastUploadTime = new Date();

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
        browserPoolId: browserInstance.poolId
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

      // Update browser error count if we got that far
      if (browserInstance) {
        browserInstance.errorCount++;
      }

      // Update upload history if we have it
      if (accountProfile) {
        await this.db.query(
          `UPDATE upload_history 
           SET success = false, 
               error_message = $1,
               upload_duration = $2,
               completed_at = CURRENT_TIMESTAMP
           WHERE task_id = $3 AND account_id = $4`,
          [errorMessage, uploadDuration, taskId, accountProfile.id]
        );
      }

      return {
        success: false,
        error: errorMessage,
        uploadDuration,
        accountId: accountProfile?.id,
        browserPoolId: browserInstance?.poolId
      };

    } finally {
      // Release resources
      if (browserInstance) {
        await this.config.browserPool.release(browserInstance.poolId);
        logger.debug({ poolId: browserInstance.poolId }, 'Browser instance released');
      }

      if (accountProfile) {
        await this.config.accountSelector.releaseAccount(accountProfile.id, taskId);
        logger.debug({ accountId: accountProfile.id }, 'Account released');
      }
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
    });

    this.worker.on('failed', (job, error) => {
      logger.error({ 
        jobId: job?.id, 
        error: error.message 
      }, 'Job failed');
    });

    this.worker.on('active', (job) => {
      logger.debug({ jobId: job.id }, 'Job started');
    });

    this.worker.on('stalled', (jobId) => {
      logger.warn({ jobId }, 'Job stalled');
    });

    this.worker.on('error', (error) => {
      logger.error({ error }, 'Worker error');
    });
  }

  /**
   * Pause the worker
   */
  async pause(): Promise<void> {
    await this.worker.pause();
    logger.info('Worker paused');
  }

  /**
   * Resume the worker
   */
  async resume(): Promise<void> {
    await this.worker.resume();
    logger.info('Worker resumed');
  }

  /**
   * Get worker metrics
   */
  async getMetrics() {
    const isPaused = await this.worker.isPaused();
    const isRunning = await this.worker.isRunning();

    return {
      isPaused,
      isRunning,
      concurrency: this.config.concurrency,
      processedCount: (this.worker as any).processed || 0,
      failedCount: (this.worker as any).failed || 0
    };
  }

  /**
   * Shutdown the worker
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    logger.info('Shutting down upload worker');
    this.isShuttingDown = true;

    await this.worker.close();
    
    logger.info('Upload worker shutdown complete');
  }
}