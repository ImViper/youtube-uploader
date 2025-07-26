import { ConnectionOptions, QueueOptions, WorkerOptions } from 'bullmq';
import { getRedis } from './connection';
import pino from 'pino';

const logger = pino({
  name: 'queue-config',
  level: process.env.LOG_LEVEL || 'info'
});

/**
 * Get BullMQ connection options from our Redis instance
 */
export function getBullMQConnection(): ConnectionOptions {
  const redis = getRedis();
  const client = redis.getClient();
  
  return {
    host: client.options.host,
    port: client.options.port,
    password: client.options.password,
    db: client.options.db,
  };
}

/**
 * Default queue options for upload tasks
 */
export const defaultQueueOptions: QueueOptions = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000,    // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
};

/**
 * Queue options with rate limiting
 */
export function getRateLimitedQueueOptions(maxJobs: number, duration: number): QueueOptions {
  return {
    ...defaultQueueOptions,
    defaultJobOptions: {
      ...defaultQueueOptions.defaultJobOptions,
    },
    // Rate limiter configuration
    limiter: {
      max: maxJobs,
      duration: duration,
    },
  };
}

/**
 * Default worker options
 */
export const defaultWorkerOptions: WorkerOptions = {
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
  lockDuration: 30000, // 30 seconds
  stalledInterval: 30000,
  maxStalledCount: 3,
};

/**
 * Worker options for specific queue types
 */
export const workerOptionsMap = {
  upload: {
    ...defaultWorkerOptions,
    concurrency: parseInt(process.env.UPLOAD_CONCURRENCY || '3'),
    lockDuration: 600000, // 10 minutes for uploads
  },
  update: {
    ...defaultWorkerOptions,
    concurrency: parseInt(process.env.UPDATE_CONCURRENCY || '5'),
    lockDuration: 300000, // 5 minutes for updates
  },
  comment: {
    ...defaultWorkerOptions,
    concurrency: parseInt(process.env.COMMENT_CONCURRENCY || '10'),
    lockDuration: 60000, // 1 minute for comments
  },
};

/**
 * Queue names
 */
export const QUEUE_NAMES = {
  UPLOAD: 'upload-queue',
  UPDATE: 'update-queue',
  COMMENT: 'comment-queue',
  HEALTH_CHECK: 'health-check-queue',
} as const;

/**
 * Job priorities
 */
export const JOB_PRIORITIES = {
  LOW: 10,
  NORMAL: 5,
  HIGH: 1,
  CRITICAL: 0,
} as const;

/**
 * Job events for monitoring
 */
export const JOB_EVENTS = {
  COMPLETED: 'completed',
  FAILED: 'failed',
  PROGRESS: 'progress',
  STALLED: 'stalled',
  ACTIVE: 'active',
  WAITING: 'waiting',
  DELAYED: 'delayed',
  REMOVED: 'removed',
} as const;

/**
 * Create queue name with environment prefix
 */
export function getQueueName(name: string): string {
  const env = process.env.NODE_ENV || 'development';
  return `${env}:${name}`;
}

/**
 * Parse job data with validation
 */
export function parseJobData<T>(data: any): T {
  try {
    // Ensure data is valid
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid job data');
    }
    return data as T;
  } catch (error) {
    logger.error('Failed to parse job data', { error, data });
    throw error;
  }
}

/**
 * Format job error for storage
 */
export function formatJobError(error: any): object {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
      timestamp: new Date().toISOString(),
    };
  }
  return {
    message: String(error),
    timestamp: new Date().toISOString(),
  };
}