import { AccountManager } from '../accounts/manager';
import { QueueManager } from '../queue/manager';
import { getDatabase } from '../database/connection';
import { getRedis } from '../redis/connection';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';

const logger = pino({
  name: 'matrix-manager-lite',
  level: process.env.LOG_LEVEL || 'info'
});

/**
 * Lite version of MatrixManager that works without BitBrowser
 * Used for testing and basic operations
 */
export class MatrixManagerLite {
  private accountManager: AccountManager;
  private queueManager: QueueManager | null = null;
  private db = getDatabase();

  constructor() {
    this.accountManager = new AccountManager();
    // Don't initialize queue manager in constructor to avoid Redis dependency
  }

  async initialize(): Promise<void> {
    logger.info('Initializing MatrixManager Lite (without BitBrowser)');
    // Try to initialize queue manager, but don't fail if Redis is unavailable
    try {
      this.queueManager = new QueueManager('youtube-uploads', {
        concurrency: 5
      });
      logger.info('Queue manager initialized');
    } catch (error) {
      logger.warn({ error }, 'Failed to initialize queue manager - queue features will be unavailable');
    }
    logger.info('MatrixManager Lite initialized successfully');
  }

  getAccountManager(): AccountManager {
    return this.accountManager;
  }

  getQueueManager(): QueueManager {
    if (!this.queueManager) {
      throw new Error('Queue manager not available - Redis connection required');
    }
    return this.queueManager;
  }

  async getSystemStatus(): Promise<any> {
    try {
      // Get account stats
      const accounts = await this.accountManager.listAccounts({});
      const activeAccounts = accounts.filter(a => a.status === 'active').length;
      
      // Get queue stats if available
      let queueStats = {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0
      };
      
      if (this.queueManager) {
        try {
          queueStats = await this.queueManager.getStats();
        } catch (error) {
          logger.warn('Failed to get queue stats');
        }
      }
      
      return {
        status: 'running',
        mode: 'lite',
        activeAccounts,
        totalAccounts: accounts.length,
        queuedJobs: queueStats.waiting || 0,
        activeJobs: queueStats.active || 0,
        completedJobs: queueStats.completed || 0,
        failedJobs: queueStats.failed || 0,
        systemHealth: 'healthy',
        timestamp: new Date().toISOString(),
        note: 'Running in lite mode without BitBrowser integration'
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get system status');
      return {
        status: 'error',
        error: 'Failed to get system status',
        timestamp: new Date().toISOString()
      };
    }
  }

  async uploadVideo(video: any, options: any): Promise<any> {
    if (!this.queueManager) {
      throw new Error('Upload service not available - Redis connection required');
    }
    
    try {
      // Create a task in the queue
      const taskId = uuidv4();
      const task = await this.queueManager.addUploadTask({
        id: taskId,
        accountId: options.accountId || null,
        video: video,
        priority: options.priority || 0,
        scheduledAt: options.scheduledAt,
        metadata: options.metadata || {}
      });

      return {
        taskId: task.id,
        jobId: task.id,
        status: 'queued',
        accountId: options.accountId,
        videoId: `pending-${task.id}`
      };
    } catch (error) {
      logger.error({ error }, 'Failed to queue upload');
      throw error;
    }
  }

  async batchUpload(videos: any[], options: any): Promise<any[]> {
    const results = [];
    for (const video of videos) {
      try {
        const result = await this.uploadVideo(video, options);
        results.push(result);
      } catch (error) {
        results.push({
          error: 'Failed to queue video',
          video
        });
      }
    }
    return results;
  }

  async getTaskStatus(taskId: string): Promise<any> {
    try {
      const task = await this.db.query(
        'SELECT * FROM upload_tasks WHERE id = $1',
        [taskId]
      );

      if (task.rows.length === 0) {
        return null;
      }

      const taskData = task.rows[0];
      return {
        id: taskData.id,
        status: taskData.status,
        progress: taskData.status === 'completed' ? 100 : 
                 taskData.status === 'active' ? 50 : 0,
        result: taskData.result,
        error: taskData.error
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get task status');
      throw error;
    }
  }

  async pause(): Promise<void> {
    if (this.queueManager) {
      await this.queueManager.pause();
    }
  }

  async resume(): Promise<void> {
    if (this.queueManager) {
      await this.queueManager.resume();
    }
  }
}