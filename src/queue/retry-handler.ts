import { Job, Queue } from 'bullmq';
import { UploadTask } from './manager';
import { getDatabase } from '../database/connection';
import pino from 'pino';

const logger = pino({
  name: 'retry-handler',
  level: process.env.LOG_LEVEL || 'info'
});

export interface RetryConfig {
  maxRetries?: number;
  retryDelays?: number[]; // ms delays for each retry
  backoffType?: 'fixed' | 'exponential' | 'custom';
  exponentialBase?: number;
  maxRetryDelay?: number; // ms
}

export interface ErrorCategory {
  name: string;
  patterns: RegExp[];
  retryable: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export class RetryHandler {
  private config: RetryConfig;
  private errorCategories: ErrorCategory[];
  private db = getDatabase();
  private deadLetterQueue: Queue<UploadTask>;

  constructor(deadLetterQueue: Queue<UploadTask>, config: RetryConfig = {}) {
    this.deadLetterQueue = deadLetterQueue;
    this.config = {
      maxRetries: config.maxRetries || 3,
      retryDelays: config.retryDelays || [60000, 300000, 900000], // 1min, 5min, 15min
      backoffType: config.backoffType || 'exponential',
      exponentialBase: config.exponentialBase || 2,
      maxRetryDelay: config.maxRetryDelay || 3600000, // 1 hour
      ...config
    };

    // Define error categories
    this.errorCategories = [
      {
        name: 'network_error',
        patterns: [
          /ECONNREFUSED/i,
          /ETIMEDOUT/i,
          /ENOTFOUND/i,
          /network/i,
          /timeout/i
        ],
        retryable: true,
        maxRetries: 5,
        retryDelay: 30000 // 30 seconds
      },
      {
        name: 'rate_limit',
        patterns: [
          /rate limit/i,
          /too many requests/i,
          /429/,
          /quota exceeded/i
        ],
        retryable: true,
        maxRetries: 3,
        retryDelay: 3600000 // 1 hour
      },
      {
        name: 'auth_error',
        patterns: [
          /unauthorized/i,
          /authentication/i,
          /invalid credentials/i,
          /401/
        ],
        retryable: false
      },
      {
        name: 'browser_error',
        patterns: [
          /browser/i,
          /puppeteer/i,
          /navigation/i,
          /page crash/i
        ],
        retryable: true,
        maxRetries: 2,
        retryDelay: 60000 // 1 minute
      },
      {
        name: 'account_suspended',
        patterns: [
          /account suspended/i,
          /account disabled/i,
          /terms of service/i
        ],
        retryable: false
      },
      {
        name: 'video_processing',
        patterns: [
          /video processing/i,
          /invalid video/i,
          /unsupported format/i
        ],
        retryable: false
      },
      {
        name: 'temporary_error',
        patterns: [
          /temporary/i,
          /please try again/i,
          /service unavailable/i,
          /503/
        ],
        retryable: true,
        maxRetries: 4,
        retryDelay: 120000 // 2 minutes
      }
    ];
  }

  /**
   * Handle job failure
   */
  async handleFailure(job: Job<UploadTask>, error: Error): Promise<void> {
    const errorMessage = error.message || 'Unknown error';
    const category = this.categorizeError(errorMessage);
    
    logger.error({
      jobId: job.id,
      taskId: job.data.id,
      error: errorMessage,
      category: category?.name || 'unknown',
      attemptsMade: job.attemptsMade
    }, 'Job failed');

    // Log error to database
    await this.logError(job, error, category);

    // Determine if retry is possible
    const shouldRetry = await this.shouldRetry(job, category);

    if (shouldRetry) {
      const retryDelay = this.calculateRetryDelay(job, category);
      
      logger.info({
        jobId: job.id,
        taskId: job.data.id,
        retryDelay,
        attemptsMade: job.attemptsMade,
        maxAttempts: job.opts.attempts
      }, 'Scheduling job retry');

      // Update job options for retry
      await job.moveToDelayed(Date.now() + retryDelay);
      
    } else {
      // Move to dead letter queue
      await this.moveToDeadLetter(job, error, category);
    }
  }

  /**
   * Categorize error based on patterns
   */
  private categorizeError(errorMessage: string): ErrorCategory | null {
    for (const category of this.errorCategories) {
      for (const pattern of category.patterns) {
        if (pattern.test(errorMessage)) {
          return category;
        }
      }
    }
    return null;
  }

  /**
   * Determine if job should be retried
   */
  private async shouldRetry(job: Job<UploadTask>, category: ErrorCategory | null): Promise<boolean> {
    // Check if category allows retry
    if (!category || !category.retryable) {
      return false;
    }

    // Check max retries for category
    const maxRetries = category.maxRetries || this.config.maxRetries!;
    if (job.attemptsMade >= maxRetries) {
      return false;
    }

    // Check if account is still active
    const accountStatus = await this.checkAccountStatus(job.data.accountId);
    if (accountStatus !== 'active') {
      logger.warn({
        jobId: job.id,
        accountId: job.data.accountId,
        status: accountStatus
      }, 'Account not active, skipping retry');
      return false;
    }

    return true;
  }

  /**
   * Calculate retry delay
   */
  private calculateRetryDelay(job: Job<UploadTask>, category: ErrorCategory | null): number {
    // Use category-specific delay if available
    if (category?.retryDelay) {
      return category.retryDelay;
    }

    // Use configured delays
    if (this.config.retryDelays && job.attemptsMade < this.config.retryDelays.length) {
      return this.config.retryDelays[job.attemptsMade];
    }

    // Calculate based on backoff type
    let delay: number;
    switch (this.config.backoffType) {
      case 'fixed':
        delay = this.config.retryDelays?.[0] || 60000;
        break;
      
      case 'exponential':
        delay = Math.min(
          Math.pow(this.config.exponentialBase!, job.attemptsMade) * 1000,
          this.config.maxRetryDelay!
        );
        break;
      
      default:
        delay = 60000; // 1 minute default
    }

    return delay;
  }

  /**
   * Log error to database
   */
  private async logError(job: Job<UploadTask>, error: Error, category: ErrorCategory | null): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO upload_errors (
          job_id, task_id, account_id, error_message, 
          error_category, attempt_number, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          job.id,
          job.data.id,
          job.data.accountId,
          error.message,
          category?.name || 'unknown',
          job.attemptsMade,
          JSON.stringify({
            stack: error.stack,
            timestamp: new Date(),
            jobData: job.data
          })
        ]
      );
    } catch (dbError) {
      logger.error({ dbError, jobId: job.id }, 'Failed to log error to database');
    }
  }

  /**
   * Move job to dead letter queue
   */
  private async moveToDeadLetter(job: Job<UploadTask>, error: Error, category: ErrorCategory | null): Promise<void> {
    logger.warn({
      jobId: job.id,
      taskId: job.data.id,
      category: category?.name || 'unknown'
    }, 'Moving job to dead letter queue');

    try {
      // Add to dead letter queue with error metadata
      await this.deadLetterQueue.add(
        `dead-${job.data.id}`,
        {
          ...job.data,
          metadata: {
            ...job.data.metadata,
            originalJobId: job.id,
            failedAt: new Date(),
            error: error.message,
            errorCategory: category?.name || 'unknown',
            attemptsMade: job.attemptsMade
          }
        },
        {
          removeOnComplete: false,
          removeOnFail: false
        }
      );

      // Update task status in database
      await this.db.query(
        `UPDATE upload_tasks 
         SET status = 'failed', 
             error_message = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [error.message, job.data.id]
      );

    } catch (dlqError) {
      logger.error({ dlqError, jobId: job.id }, 'Failed to move job to dead letter queue');
    }
  }

  /**
   * Check account status
   */
  private async checkAccountStatus(accountId: string): Promise<string> {
    try {
      const result = await this.db.query(
        'SELECT status FROM accounts WHERE id = $1',
        [accountId]
      );
      return result.rows[0]?.status || 'unknown';
    } catch (error) {
      logger.error({ error, accountId }, 'Failed to check account status');
      return 'error';
    }
  }

  /**
   * Get retry statistics
   */
  async getRetryStats(timeRange: '1h' | '24h' | '7d' = '24h'): Promise<any> {
    const intervals = {
      '1h': '1 hour',
      '24h': '24 hours',
      '7d': '7 days'
    };

    try {
      const result = await this.db.query(`
        SELECT 
          error_category,
          COUNT(*) as error_count,
          AVG(attempt_number) as avg_attempts,
          COUNT(DISTINCT task_id) as unique_tasks,
          COUNT(DISTINCT account_id) as affected_accounts
        FROM upload_errors
        WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${intervals[timeRange]}'
        GROUP BY error_category
        ORDER BY error_count DESC
      `);

      return {
        byCategory: result.rows,
        totalErrors: result.rows.reduce((sum, row) => sum + parseInt(row.error_count), 0),
        timeRange,
        timestamp: new Date()
      };

    } catch (error) {
      logger.error({ error }, 'Failed to get retry stats');
      throw error;
    }
  }

  /**
   * Process dead letter queue items
   */
  async processDeadLetterQueue(processor: (task: UploadTask) => Promise<boolean>): Promise<void> {
    const jobs = await this.deadLetterQueue.getJobs(['waiting', 'active', 'delayed']);
    
    for (const job of jobs) {
      try {
        const shouldRetry = await processor(job.data);
        
        if (shouldRetry) {
          // Remove from DLQ and add back to main queue
          await job.remove();
          logger.info({ jobId: job.id, taskId: job.data.id }, 'Removed from dead letter queue for retry');
        }
      } catch (error) {
        logger.error({ error, jobId: job.id }, 'Failed to process dead letter queue item');
      }
    }
  }
}