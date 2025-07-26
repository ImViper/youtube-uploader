import { Video, Credentials, MessageTransport } from '../types';
import { ProgressHandler } from '../types/missing-types';
import { BitBrowserManager } from '../bitbrowser/manager';
import { BrowserPool } from '../bitbrowser/pool';
import { AccountManager } from '../accounts/manager';
import { AccountSelector, HealthScoreStrategy } from '../accounts/selector';
import { AccountMonitor } from '../accounts/monitor';
import { QueueManager, UploadTask } from '../queue/manager';
import { UploadWorker } from '../workers/upload-worker';
import { RetryHandler } from '../queue/retry-handler';
import { Queue } from 'bullmq';
import { getDatabase } from '../database/connection';
import { getRedis } from '../redis/connection';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { upload as originalUpload } from '../upload';

const logger = pino({
  name: 'matrix-manager',
  level: process.env.LOG_LEVEL || 'info'
});

export interface MatrixManagerConfig {
  browserPool?: {
    minInstances?: number;
    maxInstances?: number;
  };
  queue?: {
    concurrency?: number;
    rateLimit?: {
      max: number;
      duration: number;
    };
  };
  accountSelector?: {
    strategy?: 'health-score' | 'round-robin' | 'least-used';
    minHealthScore?: number;
  };
  monitoring?: {
    enabled?: boolean;
    checkInterval?: number;
  };
  bitBrowserUrl?: string;
  redisUrl?: string;
  databaseUrl?: string;
}

export interface MatrixUploadOptions extends MessageTransport {
  priority?: number;
  accountId?: string; // specific account to use
  scheduledAt?: Date;
  metadata?: Record<string, any>;
}

export interface MatrixUploadResult {
  taskId: string;
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  videoId?: string;
  error?: string;
}

export class MatrixManager {
  private config: MatrixManagerConfig;
  private bitBrowserManager!: BitBrowserManager;
  private browserPool!: BrowserPool;
  private accountManager!: AccountManager;
  private accountSelector!: AccountSelector;
  private accountMonitor!: AccountMonitor;
  private queueManager!: QueueManager;
  private uploadWorker!: UploadWorker;
  private retryHandler!: RetryHandler;
  private deadLetterQueue!: Queue<UploadTask>;
  private isInitialized = false;
  private db = getDatabase();

  constructor(config: MatrixManagerConfig = {}) {
    this.config = {
      browserPool: {
        minInstances: 2,
        maxInstances: 10,
        ...config.browserPool
      },
      queue: {
        concurrency: 5,
        ...config.queue
      },
      accountSelector: {
        strategy: 'health-score',
        minHealthScore: 50,
        ...config.accountSelector
      },
      monitoring: {
        enabled: true,
        checkInterval: 60000,
        ...config.monitoring
      },
      bitBrowserUrl: config.bitBrowserUrl || 'http://localhost:54345',
      ...config
    };
  }

  /**
   * Initialize all components
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Matrix manager already initialized');
      return;
    }

    logger.info('Initializing matrix manager');

    try {
      // Initialize BitBrowser manager
      this.bitBrowserManager = new BitBrowserManager({
        apiUrl: this.config.bitBrowserUrl!
      });

      // Initialize browser pool
      this.browserPool = new BrowserPool(this.bitBrowserManager, {
        minInstances: this.config.browserPool!.minInstances,
        maxInstances: this.config.browserPool!.maxInstances
      });
      await this.browserPool.initialize();

      // Initialize account manager
      this.accountManager = new AccountManager();

      // Initialize account selector
      const strategy = this.getSelectionStrategy();
      this.accountSelector = new AccountSelector(this.accountManager, {
        strategy,
        minHealthScore: this.config.accountSelector!.minHealthScore
      });

      // Initialize account monitor if enabled
      if (this.config.monitoring!.enabled) {
        this.accountMonitor = new AccountMonitor(this.accountManager, {
          checkInterval: this.config.monitoring!.checkInterval
        });
        this.accountMonitor.start();
      }

      // Initialize queue manager
      this.queueManager = new QueueManager('youtube-uploads', {
        concurrency: this.config.queue!.concurrency,
        rateLimit: this.config.queue!.rateLimit
      });

      // Initialize dead letter queue
      this.deadLetterQueue = new Queue<UploadTask>('youtube-uploads-dlq', {
        connection: getRedis().getClient()
      });

      // Initialize retry handler
      this.retryHandler = new RetryHandler(this.deadLetterQueue);

      // Initialize upload worker
      this.uploadWorker = new UploadWorker('youtube-uploads', {
        concurrency: this.config.queue!.concurrency,
        browserPool: this.browserPool,
        accountSelector: this.accountSelector,
        accountManager: this.accountManager
      });

      // Start the worker
      await this.uploadWorker.start();

      // Setup event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      logger.info('Matrix manager initialized successfully');

    } catch (error) {
      logger.error({ error }, 'Failed to initialize matrix manager');
      throw error;
    }
  }

  /**
   * Get selection strategy based on config
   */
  private getSelectionStrategy() {
    switch (this.config.accountSelector!.strategy) {
      case 'health-score':
        return new HealthScoreStrategy();
      case 'round-robin':
        // Import would be needed
        throw new Error('Round-robin strategy not implemented');
      case 'least-used':
        // Import would be needed
        throw new Error('Least-used strategy not implemented');
      default:
        return new HealthScoreStrategy();
    }
  }

  /**
   * Upload a single video with matrix management
   */
  async upload(
    credentials: Credentials,
    videos: Video[],
    options?: MatrixUploadOptions
  ): Promise<MatrixUploadResult[]> {
    // For backward compatibility, if credentials are provided,
    // ensure the account exists in the system
    if (credentials.email) {
      await this.ensureAccount(credentials);
    }

    // Convert to matrix upload tasks
    const results: MatrixUploadResult[] = [];

    for (const video of videos) {
      try {
        const result = await this.uploadVideo(video, options);
        results.push(result);
      } catch (error) {
        logger.error({ video: video.path, error }, 'Failed to queue video upload');
        results.push({
          taskId: uuidv4(),
          jobId: '',
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Upload a single video
   */
  async uploadVideo(
    video: Video,
    options?: MatrixUploadOptions
  ): Promise<MatrixUploadResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const taskId = uuidv4();

    try {
      // Create upload task record
      await this.db.query(
        `INSERT INTO upload_tasks (id, video_metadata, priority, status)
         VALUES ($1, $2, $3, 'queued')`,
        [taskId, JSON.stringify(video), options?.priority || 0]
      );

      // Create queue task
      const task: UploadTask = {
        id: taskId,
        accountId: options?.accountId || '',
        video,
        priority: options?.priority || 0,
        scheduledAt: options?.scheduledAt,
        metadata: options?.metadata
      };

      // Add to queue
      const job = await this.queueManager.addUploadTask(task);

      logger.info({ taskId, jobId: job.id }, 'Video upload queued');

      return {
        taskId,
        jobId: job.id!,
        status: 'queued'
      };

    } catch (error) {
      logger.error({ taskId, error }, 'Failed to queue upload');
      throw error;
    }
  }

  /**
   * Ensure account exists in the system
   */
  private async ensureAccount(credentials: Credentials): Promise<void> {
    try {
      // Check if account exists
      const accounts = await this.accountManager.listAccounts();
      const exists = accounts.some(a => a.email === credentials.email);

      if (!exists) {
        // Add account
        await this.accountManager.addAccount(
          credentials.email,
          credentials.pass,
          { recoveryEmail: credentials.recoveryemail }
        );
        logger.info({ email: credentials.email }, 'Account added to matrix');
      }
    } catch (error) {
      logger.error({ email: credentials.email, error }, 'Failed to ensure account');
    }
  }

  /**
   * Get upload task status
   */
  async getTaskStatus(taskId: string): Promise<MatrixUploadResult | null> {
    try {
      // Get task from database
      const taskResult = await this.db.query(
        'SELECT * FROM upload_tasks WHERE id = $1',
        [taskId]
      );

      if (taskResult.rows.length === 0) {
        return null;
      }

      const task = taskResult.rows[0];

      // Get job from queue if exists
      const jobs = await this.queueManager.getJobs('waiting');
      const job = jobs.find(j => j.data.id === taskId);

      return {
        taskId,
        jobId: job?.id || task.job_id || '',
        status: task.status,
        videoId: task.video_id,
        error: task.error_message
      };

    } catch (error) {
      logger.error({ taskId, error }, 'Failed to get task status');
      return null;
    }
  }

  /**
   * Batch upload videos
   */
  async batchUpload(
    videos: Video[],
    options?: MatrixUploadOptions
  ): Promise<MatrixUploadResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const tasks: UploadTask[] = [];
    const results: MatrixUploadResult[] = [];

    // Create tasks
    for (const video of videos) {
      const taskId = uuidv4();
      tasks.push({
        id: taskId,
        accountId: options?.accountId || '',
        video,
        priority: options?.priority || 0,
        scheduledAt: options?.scheduledAt,
        metadata: options?.metadata
      });
    }

    // Add to queue in batch
    const jobs = await this.queueManager.addBatch(tasks);

    // Create results
    for (let i = 0; i < tasks.length; i++) {
      results.push({
        taskId: tasks[i].id,
        jobId: jobs[i]?.id || '',
        status: jobs[i] ? 'queued' : 'failed'
      });
    }

    return results;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Queue events
    this.queueManager.on('jobCompleted', async ({ jobId, result }) => {
      try {
        await this.db.query(
          `UPDATE upload_tasks 
           SET status = 'completed', 
               video_id = $1,
               completed_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [result.videoId, result.taskId]
        );
      } catch (error) {
        logger.error({ jobId, error }, 'Failed to update task status');
      }
    });

    this.queueManager.on('jobFailed', async ({ jobId, reason }) => {
      logger.error({ jobId, reason }, 'Job failed');
      // Retry handler will handle this
    });

    // Account monitor events
    if (this.accountMonitor) {
      this.accountMonitor.on('alert', (alert) => {
        logger.warn({ alert }, 'Account alert');
      });
    }

    // Browser pool events
    this.browserPool.on('instanceError', (instance) => {
      logger.error({ instance }, 'Browser instance error');
    });
  }

  /**
   * Get system status
   */
  async getSystemStatus() {
    const [queueStats, poolStats, accountStats] = await Promise.all([
      this.queueManager.getStats(),
      this.browserPool.getStats(),
      this.accountManager.getAccountStats()
    ]);

    const systemMetrics = this.accountMonitor ? 
      await this.accountMonitor.getSystemMetrics() : null;

    return {
      queue: queueStats,
      browserPool: poolStats,
      accounts: accountStats,
      metrics: systemMetrics,
      initialized: this.isInitialized,
      timestamp: new Date()
    };
  }

  /**
   * Pause all operations
   */
  async pause(): Promise<void> {
    logger.info('Pausing matrix operations');
    
    await Promise.all([
      this.queueManager.pause(),
      this.uploadWorker.pause()
    ]);

    logger.info('Matrix operations paused');
  }

  /**
   * Resume all operations
   */
  async resume(): Promise<void> {
    logger.info('Resuming matrix operations');
    
    await Promise.all([
      this.queueManager.resume(),
      this.uploadWorker.resume()
    ]);

    logger.info('Matrix operations resumed');
  }

  /**
   * Shutdown the matrix manager
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down matrix manager');

    try {
      // Stop monitoring
      if (this.accountMonitor) {
        this.accountMonitor.stop();
      }

      // Shutdown worker
      await this.uploadWorker.shutdown();

      // Shutdown queue
      await this.queueManager.shutdown();

      // Shutdown browser pool
      await this.browserPool.shutdown();

      this.isInitialized = false;
      logger.info('Matrix manager shutdown complete');

    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
      throw error;
    }
  }

  /**
   * Add accounts in batch
   */
  async addAccounts(accounts: { email: string; password: string }[]): Promise<void> {
    for (const account of accounts) {
      try {
        await this.accountManager.addAccount(account.email, account.password);
        logger.info({ email: account.email }, 'Account added');
      } catch (error) {
        logger.error({ email: account.email, error }, 'Failed to add account');
      }
    }
  }

  /**
   * Get account manager instance
   */
  getAccountManager(): AccountManager {
    return this.accountManager;
  }

  /**
   * Get queue manager instance
   */
  getQueueManager(): QueueManager {
    return this.queueManager;
  }
}