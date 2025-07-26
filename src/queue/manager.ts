import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import { getRedis } from '../redis/connection';
import { Video } from '../types';
import pino from 'pino';
import { EventEmitter } from 'events';

const logger = pino({
  name: 'queue-manager',
  level: process.env.LOG_LEVEL || 'info'
});

export interface UploadTask {
  id: string;
  accountId: string;
  video: Video;
  priority: number;
  retryCount?: number;
  scheduledAt?: Date;
  metadata?: Record<string, any>;
}

export interface QueueManagerConfig {
  defaultPriority?: number;
  maxRetries?: number;
  retryDelay?: number; // ms
  rateLimit?: {
    max: number;
    duration: number; // ms
  };
  concurrency?: number;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  rateLimit?: {
    max: number;
    duration: number;
    current: number;
  };
}

export class QueueManager extends EventEmitter {
  private uploadQueue: Queue<UploadTask>;
  private queueEvents: QueueEvents;
  // Note: QueueScheduler has been removed in BullMQ v5
  private config: QueueManagerConfig;
  private redis = getRedis();
  private rateLimitPrefix = 'queue:ratelimit:';
  private accountRateLimitPrefix = 'queue:account:ratelimit:';

  constructor(queueName: string = 'youtube-uploads', config: QueueManagerConfig = {}) {
    super();

    this.config = {
      defaultPriority: config.defaultPriority || 0,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 60000, // 1 minute
      concurrency: config.concurrency || 5,
      ...config
    };

    // BullMQ requires a Redis connection without keyPrefix
    // Create a new connection specifically for BullMQ
    const connection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '5988'),
      password: process.env.REDIS_PASSWORD
    };

    // Create queue with configuration
    this.uploadQueue = new Queue<UploadTask>(queueName, {
      connection,
      defaultJobOptions: {
        attempts: this.config.maxRetries,
        backoff: {
          type: 'exponential',
          delay: this.config.retryDelay
        },
        removeOnComplete: 100,
        removeOnFail: 1000
      }
    });

    // Create queue events for monitoring with same connection config
    this.queueEvents = new QueueEvents(queueName, { 
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '5988'),
        password: process.env.REDIS_PASSWORD
      }
    });
    
    // Note: QueueScheduler has been removed in BullMQ v5
    // Delayed jobs are now handled automatically by the Queue

    this.setupEventListeners();

    logger.info({ queueName, config: this.config }, 'Queue manager initialized');
  }

  /**
   * Add upload task to queue
   */
  async addUploadTask(task: UploadTask): Promise<Job<UploadTask>> {
    logger.info({ taskId: task.id, accountId: task.accountId }, 'Adding upload task');

    try {
      // Check rate limit
      if (this.config.rateLimit) {
        const allowed = await this.checkRateLimit();
        if (!allowed) {
          throw new Error('Queue rate limit exceeded');
        }
      }

      // Check account rate limit
      const accountAllowed = await this.checkAccountRateLimit(task.accountId);
      if (!accountAllowed) {
        throw new Error(`Account ${task.accountId} rate limit exceeded`);
      }

      // Add to queue with priority
      const job = await this.uploadQueue.add(
        `upload-${task.id}`,
        task,
        {
          priority: task.priority || this.config.defaultPriority,
          delay: task.scheduledAt ? task.scheduledAt.getTime() - Date.now() : 0
        }
      );

      logger.info({ 
        jobId: job.id, 
        taskId: task.id,
        priority: job.opts.priority,
        delay: job.opts.delay 
      }, 'Upload task added to queue');

      this.emit('taskAdded', { job, task });
      return job;

    } catch (error) {
      logger.error({ taskId: task.id, error }, 'Failed to add upload task');
      throw error;
    }
  }

  /**
   * Batch add multiple tasks
   */
  async addBatch(tasks: UploadTask[]): Promise<Job<UploadTask>[]> {
    logger.info({ count: tasks.length }, 'Adding batch upload tasks');

    const jobs: Job<UploadTask>[] = [];
    
    for (const task of tasks) {
      try {
        const job = await this.addUploadTask(task);
        jobs.push(job);
      } catch (error) {
        logger.error({ taskId: task.id, error }, 'Failed to add task in batch');
      }
    }

    return jobs;
  }

  /**
   * Remove a task from queue
   */
  async removeTask(jobId: string): Promise<void> {
    try {
      const job = await this.uploadQueue.getJob(jobId);
      if (job) {
        await job.remove();
        logger.info({ jobId }, 'Task removed from queue');
        this.emit('taskRemoved', { jobId });
      }
    } catch (error) {
      logger.error({ jobId, error }, 'Failed to remove task');
      throw error;
    }
  }

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    await this.uploadQueue.pause();
    logger.info('Queue paused');
    this.emit('queuePaused');
  }

  /**
   * Resume the queue
   */
  async resume(): Promise<void> {
    await this.uploadQueue.resume();
    logger.info('Queue resumed');
    this.emit('queueResumed');
  }

  /**
   * Check global rate limit
   */
  private async checkRateLimit(): Promise<boolean> {
    if (!this.config.rateLimit) return true;

    const key = `${this.rateLimitPrefix}global`;
    const current = await this.redis.getClient().incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, Math.ceil(this.config.rateLimit.duration / 1000));
    }

    return current <= this.config.rateLimit.max;
  }

  /**
   * Check account-specific rate limit
   */
  private async checkAccountRateLimit(accountId: string): Promise<boolean> {
    // Default: 10 uploads per hour per account
    const maxPerHour = 10;
    const duration = 3600000; // 1 hour in ms

    const key = `${this.accountRateLimitPrefix}${accountId}`;
    const current = await this.redis.getClient().incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, Math.ceil(duration / 1000));
    }

    return current <= maxPerHour;
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      this.uploadQueue.getWaitingCount(),
      this.uploadQueue.getActiveCount(),
      this.uploadQueue.getCompletedCount(),
      this.uploadQueue.getFailedCount(),
      this.uploadQueue.getDelayedCount(),
      this.uploadQueue.isPaused()
    ]);

    const stats: QueueStats = {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused
    };

    if (this.config.rateLimit) {
      const key = `${this.rateLimitPrefix}global`;
      const current = await this.redis.get(key);
      stats.rateLimit = {
        max: this.config.rateLimit.max,
        duration: this.config.rateLimit.duration,
        current: parseInt(current || '0')
      };
    }

    return stats;
  }

  /**
   * Get jobs by status
   */
  async getJobs(status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed', limit = 100): Promise<Job<UploadTask>[]> {
    switch (status) {
      case 'waiting':
        return this.uploadQueue.getWaiting(0, limit);
      case 'active':
        return this.uploadQueue.getActive(0, limit);
      case 'completed':
        return this.uploadQueue.getCompleted(0, limit);
      case 'failed':
        return this.uploadQueue.getFailed(0, limit);
      case 'delayed':
        return this.uploadQueue.getDelayed(0, limit);
      default:
        return [];
    }
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job<UploadTask> | undefined> {
    return this.uploadQueue.getJob(jobId);
  }

  /**
   * Retry failed job
   */
  async retryJob(jobId: string): Promise<void> {
    const job = await this.uploadQueue.getJob(jobId);
    if (job) {
      await job.retry();
      logger.info({ jobId }, 'Job retry scheduled');
      this.emit('jobRetry', { jobId });
    }
  }

  /**
   * Clean old jobs
   */
  async clean(grace: number = 3600000): Promise<void> {
    const [completed, failed] = await Promise.all([
      this.uploadQueue.clean(grace, 100, 'completed'),
      this.uploadQueue.clean(grace, 100, 'failed')
    ]);

    logger.info({ completed, failed }, 'Cleaned old jobs');
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Queue events
    this.queueEvents.on('completed', ({ jobId, returnvalue }) => {
      logger.info({ jobId }, 'Job completed');
      this.emit('jobCompleted', { jobId, result: returnvalue });
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error({ jobId, reason: failedReason }, 'Job failed');
      this.emit('jobFailed', { jobId, reason: failedReason });
    });

    this.queueEvents.on('progress', ({ jobId, data }) => {
      logger.debug({ jobId, progress: data }, 'Job progress');
      this.emit('jobProgress', { jobId, progress: data });
    });

    this.queueEvents.on('active', ({ jobId }) => {
      logger.debug({ jobId }, 'Job active');
      this.emit('jobActive', { jobId });
    });

    this.queueEvents.on('stalled', ({ jobId }) => {
      logger.warn({ jobId }, 'Job stalled');
      this.emit('jobStalled', { jobId });
    });
  }

  /**
   * Get queue instance (for workers)
   */
  getQueue(): Queue<UploadTask> {
    return this.uploadQueue;
  }

  /**
   * Shutdown queue manager
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down queue manager');

    await Promise.all([
      this.uploadQueue.close(),
      this.queueEvents.close()
    ]);

    this.removeAllListeners();
    logger.info('Queue manager shutdown complete');
  }

  /**
   * Set rate limit dynamically
   */
  setRateLimit(max: number, duration: number): void {
    this.config.rateLimit = { max, duration };
    logger.info({ max, duration }, 'Rate limit updated');
  }

  /**
   * Get account upload count
   */
  async getAccountUploadCount(accountId: string): Promise<number> {
    const key = `${this.accountRateLimitPrefix}${accountId}`;
    const count = await this.redis.get(key);
    return parseInt(count || '0');
  }

  /**
   * Reset account rate limit
   */
  async resetAccountRateLimit(accountId: string): Promise<void> {
    const key = `${this.accountRateLimitPrefix}${accountId}`;
    await this.redis.del(key);
    logger.info({ accountId }, 'Account rate limit reset');
  }

  /**
   * Get queue metrics for monitoring
   */
  async getMetrics() {
    const stats = await this.getStats();
    const jobs = await this.uploadQueue.getJobs(['waiting', 'active', 'delayed', 'failed']);
    
    const accountDistribution: Record<string, number> = {};
    for (const job of jobs) {
      const accountId = job.data.accountId;
      accountDistribution[accountId] = (accountDistribution[accountId] || 0) + 1;
    }

    return {
      ...stats,
      accountDistribution,
      oldestWaitingJob: jobs.find(j => j.opts.delay === 0)?.timestamp,
      averagePriority: jobs.reduce((sum, j) => sum + (j.opts.priority || 0), 0) / (jobs.length || 1),
      timestamp: new Date()
    };
  }
}