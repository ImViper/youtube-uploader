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
    super('youtube-uploads', async (job: Job<UploadJobData>) => {
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
    
    // Enhanced retry logic with account switching
    let retryCount = 0;
    const maxRetries = this.config.maxRetries || 3;
    let lastError: Error | null = null;
    let triedAccountIds: Set<string> = new Set();
    
    while (retryCount < maxRetries) {
      try {
        const result = await this.attemptUpload(job, requestedAccountId, triedAccountIds);
        return result;
      } catch (error) {
        lastError = error as Error;
        retryCount++;
        
        logger.warn({ 
          jobId: job.id,
          taskId,
          attempt: retryCount,
          maxRetries,
          error: lastError.message 
        }, 'Upload attempt failed, considering retry');
        
        // Check if we should retry with a different account
        const shouldSwitchAccount = lastError.message.toLowerCase().includes('login') ||
                                   lastError.message.toLowerCase().includes('authentication') ||
                                   lastError.message.toLowerCase().includes('suspended');
        
        if (shouldSwitchAccount && retryCount < maxRetries) {
          logger.info({ jobId: job.id }, 'Will retry with a different account');
          await job.updateProgress({ 
            status: 'switching_account', 
            progress: 10 + (retryCount * 5) 
          });
          // Small delay before retry
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else if (retryCount < maxRetries) {
          // Regular retry with same account
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
    
    // All retries exhausted
    throw lastError || new Error('Upload failed after all retries');
  }
  
  private async attemptUpload(
    job: Job<UploadJobData>, 
    requestedAccountId: string | undefined,
    triedAccountIds: Set<string>
  ): Promise<UploadJobResult> {
    const { taskId } = job.data;
    const startTime = Date.now();

    logger.info({ 
      jobId: job.id, 
      taskId, 
      requestedAccountId,
      triedAccounts: Array.from(triedAccountIds),
      attempt: triedAccountIds.size + 1
    }, 'Processing upload attempt');

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
      if (requestedAccountId && !triedAccountIds.has(requestedAccountId)) {
        accountProfile = await this.config.accountManager.getAccount(requestedAccountId);
        if (!accountProfile) {
          throw new Error(`Account not found: ${requestedAccountId}`);
        }
      } else {
        // Find a healthy account that hasn't been tried yet
        const allHealthyAccounts = await this.config.accountManager.getAllHealthyAccounts();
        const untried = allHealthyAccounts.filter(acc => !triedAccountIds.has(acc.id));
        
        if (untried.length === 0) {
          throw new Error('No more healthy accounts available to try');
        }
        
        accountProfile = untried[0];
        logger.info({ 
          accountId: accountProfile.id, 
          email: accountProfile.email,
          isRetry: triedAccountIds.size > 0 
        }, 'Selected alternative account');
      }
      
      // Mark this account as tried
      triedAccountIds.add(accountProfile.id);

      const accountId = accountProfile.id;
      logger.info({ accountId, email: accountProfile.email }, 'Account selected');

      // Update task with assigned account (with transaction)
      await this.db.transaction(async (client) => {
        // Verify task is still in pending state
        const taskCheck = await client.query(
          'SELECT status FROM upload_tasks WHERE id = $1 FOR UPDATE',
          [taskId]
        );
        
        if (taskCheck.rows[0]?.status !== 'pending') {
          throw new Error(`Task ${taskId} is no longer pending (status: ${taskCheck.rows[0]?.status})`);
        }
        
        // Update task
        await client.query(
          'UPDATE upload_tasks SET account_id = $1, status = $2, started_at = CURRENT_TIMESTAMP WHERE id = $3',
          [accountId, 'active', taskId]
        );
      });

      // Update job progress
      await job.updateProgress({ status: 'acquiring_browser', progress: 20 });

      // Get browser window name from account
      const windowName = accountProfile.bitbrowser_window_name;
      if (!windowName) {
        throw new Error(`Account ${accountProfile.email} has no browser window assigned`);
      }

      logger.info({ windowName, accountId }, 'Opening browser window');

      // Open browser by window name
      try {
        browserInstance = await this.config.bitBrowserManager.openBrowserByName(windowName);
        logger.info({ 
          windowId: browserInstance.windowId,
          windowName: browserInstance.windowName,
          debugUrl: browserInstance.debugUrl
        }, 'Browser instance acquired');
      } catch (openError) {
        const errorMessage = openError instanceof Error ? openError.message : String(openError);
        logger.warn({ windowName, error: errorMessage }, 'Failed to open window by name, trying with profile_id');
        
        // Fallback: try to open by profile_id if available
        if (accountProfile.browserProfileId) {
          try {
            browserInstance = await this.config.bitBrowserManager.openBrowser(accountProfile.browserProfileId);
            logger.info({ 
              windowId: browserInstance.windowId,
              profileId: accountProfile.browserProfileId,
              debugUrl: browserInstance.debugUrl
            }, 'Browser instance acquired via profile_id fallback');
          } catch (fallbackError) {
            throw new Error(`Failed to open browser window: ${errorMessage} (fallback also failed)`);
          }
        } else {
          throw new Error(`Failed to open browser window by name: ${errorMessage}`);
        }
      }

      // Connect to browser
      browser = browserInstance.browser;
      if (!browser) {
        throw new Error('Browser connection not available');
      }

      // Update job progress
      await job.updateProgress({ status: 'uploading', progress: 30 });

      // Create upload history record with proper defaults
      const historyResult = await this.db.query(
        `INSERT INTO upload_history (task_id, account_id, started_at, success) 
         VALUES ($1, $2, CURRENT_TIMESTAMP, NULL) 
         RETURNING id`,
        [taskId, accountId]
      );
      const historyId = historyResult.rows[0].id;

      // Mock credentials since browser is already logged in
      const mockCredentials = {
        email: accountProfile.email,
        pass: '',
        recoveryemail: accountProfile.credentials?.recoveryEmail || ''
      };

      // Execute upload with progress tracking
      const uploadPromise = upload(
        mockCredentials,
        [videoData],
        {
          browser: browser,
          onProgress: (progress) => {
            if (typeof progress === 'number') {
              const adjustedProgress = Math.floor(30 + (progress * 0.6)); // 30-90%
              logger.info({ taskId, progress, adjustedProgress }, 'Upload progress update');
              job.updateProgress({ 
                status: 'uploading', 
                progress: adjustedProgress
              });
            } else if (progress && typeof progress === 'object') {
              logger.info({ taskId, progress }, 'Upload progress object');
              job.updateProgress(progress);
            }
          },
          onLog: (message) => {
            logger.info({ taskId, message }, 'Upload log');
          }
        }
      );

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Upload timeout')), this.config.maxUploadTime!);
      });

      // Wait for upload or timeout
      let uploadResults;
      try {
        uploadResults = await Promise.race([uploadPromise, timeoutPromise]) as string[];
      } catch (uploadError) {
        logger.error({ taskId, error: uploadError }, 'Upload process error');
        throw uploadError;
      }
      
      const videoLink = uploadResults?.[0];

      if (!videoLink) {
        logger.error({ taskId, uploadResults }, 'Upload failed - no video link returned');
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
        [videoLink, uploadDuration, historyId]
      );

      // Update account health and stats
      await this.config.accountManager.updateAccountHealth(accountId, true);

      logger.info({ 
        jobId: job.id,
        taskId,
        videoId: videoLink,
        duration: uploadDuration 
      }, 'Upload completed successfully');

      return {
        success: true,
        videoId: videoLink,
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
        stack: error instanceof Error ? error.stack : undefined,
        accountId: accountProfile?.id,
        windowName: accountProfile?.bitbrowser_window_name
      }, 'Upload failed');

      // Enhanced error handling
      const isLoginError = errorMessage.toLowerCase().includes('login') || 
                          errorMessage.toLowerCase().includes('sign in') ||
                          errorMessage.toLowerCase().includes('authentication');
      
      const isAccountError = errorMessage.toLowerCase().includes('suspended') ||
                            errorMessage.toLowerCase().includes('terminated') ||
                            errorMessage.toLowerCase().includes('disabled');

      // Update account health and status if we have one
      if (accountProfile) {
        await this.config.accountManager.updateAccountHealth(accountProfile.id, false);
        
        // Mark account as needs_attention for login errors or account issues
        if (isLoginError || isAccountError) {
          try {
            await this.db.query(
              `UPDATE accounts 
               SET status = 'needs_attention',
                   last_error = $1,
                   error_count = COALESCE(error_count, 0) + 1,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $2`,
              [errorMessage, accountProfile.id]
            );
            logger.warn({ accountId: accountProfile.id }, 'Account marked as needs_attention');
          } catch (updateError) {
            logger.error({ error: updateError }, 'Failed to update account status');
          }
        }
      }

      // Update upload history if we have it
      if (accountProfile) {
        await this.db.query(
          `INSERT INTO upload_history (task_id, account_id, success, error_details, started_at, completed_at) 
           VALUES ($1, $2, false, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [taskId, accountProfile.id, { error: errorMessage }]
        );
      }

      // Rollback task status if upload failed after it was started
      if (taskId && accountProfile) {
        try {
          await this.db.query(
            `UPDATE upload_tasks 
             SET status = 'pending',
                 account_id = NULL,
                 started_at = NULL,
                 error = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND status = 'active'`,
            [errorMessage, taskId]
          );
          logger.info({ taskId }, 'Task status rolled back to pending');
        } catch (rollbackError) {
          logger.error({ error: rollbackError }, 'Failed to rollback task status');
        }
      }

      return {
        success: false,
        error: errorMessage,
        uploadDuration,
        accountId: accountProfile?.id,
        windowName: accountProfile?.bitbrowser_window_name
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