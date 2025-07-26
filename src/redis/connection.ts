import Redis, { RedisOptions } from 'ioredis';
import pino from 'pino';
import { getErrorMessage } from '../utils/error-utils';

const logger = pino({
  name: 'redis',
  level: process.env.LOG_LEVEL || 'info'
});

export interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  retryStrategy?: (times: number) => number | void;
  maxRetriesPerRequest?: number;
  enableReadyCheck?: boolean;
  enableOfflineQueue?: boolean;
}

export class RedisConnection {
  private client: Redis;
  private subscriber: Redis | null = null;
  private publisher: Redis | null = null;
  private isConnected: boolean = false;

  constructor(config?: RedisConfig) {
    const redisOptions: RedisOptions = {
      host: config?.host || process.env.REDIS_HOST || 'localhost',
      port: config?.port || parseInt(process.env.REDIS_PORT || '5988'),
      password: config?.password || process.env.REDIS_PASSWORD,
      db: config?.db || parseInt(process.env.REDIS_DB || '0'),
      keyPrefix: config?.keyPrefix || 'youtube-uploader:',
      retryStrategy: config?.retryStrategy || this.defaultRetryStrategy,
      maxRetriesPerRequest: config?.maxRetriesPerRequest || 3,
      enableReadyCheck: config?.enableReadyCheck !== false,
      enableOfflineQueue: config?.enableOfflineQueue !== false,
    };

    this.client = new Redis(redisOptions);
    this.setupEventHandlers(this.client, 'main');
  }

  /**
   * Default retry strategy with exponential backoff
   */
  private defaultRetryStrategy(times: number): number | void {
    if (times > 10) {
      logger.error('Redis connection failed after 10 retries');
      return undefined; // Stop retrying
    }
    const delay = Math.min(times * 100, 3000);
    logger.warn(`Retrying Redis connection in ${delay}ms (attempt ${times})`);
    return delay;
  }

  /**
   * Setup event handlers for Redis client
   */
  private setupEventHandlers(client: Redis, name: string): void {
    client.on('connect', () => {
      logger.info(`Redis ${name} client connected`);
    });

    client.on('ready', () => {
      logger.info(`Redis ${name} client ready`);
      if (name === 'main') {
        this.isConnected = true;
      }
    });

    client.on('error', (err) => {
      logger.error(`Redis ${name} client error:`, err);
    });

    client.on('close', () => {
      logger.warn(`Redis ${name} client connection closed`);
      if (name === 'main') {
        this.isConnected = false;
      }
    });

    client.on('reconnecting', (delay: number) => {
      logger.info(`Redis ${name} client reconnecting in ${delay}ms`);
    });
  }

  /**
   * Get the main Redis client
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Get or create subscriber client for pub/sub
   */
  getSubscriber(): Redis {
    if (!this.subscriber) {
      this.subscriber = this.client.duplicate();
      this.setupEventHandlers(this.subscriber, 'subscriber');
    }
    return this.subscriber;
  }

  /**
   * Get or create publisher client for pub/sub
   */
  getPublisher(): Redis {
    if (!this.publisher) {
      this.publisher = this.client.duplicate();
      this.setupEventHandlers(this.publisher, 'publisher');
    }
    return this.publisher;
  }

  /**
   * Test Redis connection
   */
  async connect(): Promise<void> {
    try {
      await this.client.ping();
      this.isConnected = true;
      logger.info('Successfully connected to Redis');
    } catch (error) {
      logger.error('Failed to connect to Redis', error);
      throw new Error(`Redis connection failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Health check for Redis
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis health check failed', error);
      return false;
    }
  }

  /**
   * Get Redis info
   */
  async getInfo(section?: string): Promise<string> {
    try {
      return section ? await this.client.info(section) : await this.client.info();
    } catch (error) {
      logger.error('Failed to get Redis info', error);
      throw error;
    }
  }

  /**
   * Set a key with optional TTL
   */
  async set(key: string, value: string | Buffer, ttl?: number): Promise<'OK'> {
    if (ttl) {
      return await this.client.set(key, value, 'EX', ttl);
    }
    return await this.client.set(key, value);
  }

  /**
   * Get a value by key
   */
  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  /**
   * Delete keys
   */
  async del(...keys: string[]): Promise<number> {
    return await this.client.del(...keys);
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<number> {
    return await this.client.exists(key);
  }

  /**
   * Set expiration on a key
   */
  async expire(key: string, seconds: number): Promise<number> {
    return await this.client.expire(key, seconds);
  }

  /**
   * Get TTL of a key
   */
  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  /**
   * Close all Redis connections
   */
  async close(): Promise<void> {
    try {
      await this.client.quit();
      if (this.subscriber) await this.subscriber.quit();
      if (this.publisher) await this.publisher.quit();
      this.isConnected = false;
      logger.info('All Redis connections closed');
    } catch (error) {
      logger.error('Error closing Redis connections', error);
      throw error;
    }
  }

  /**
   * Get connection status
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Clear all keys with the configured prefix
   */
  async flushPrefix(): Promise<void> {
    const prefix = this.client.options.keyPrefix || '';
    if (!prefix) {
      logger.warn('No key prefix configured, skipping flush');
      return;
    }

    try {
      const keys = await this.client.keys(`${prefix}*`);
      if (keys.length > 0) {
        // Remove prefix from keys before deleting
        const unprefixedKeys = keys.map(k => k.replace(prefix, ''));
        await this.client.del(...unprefixedKeys);
        logger.info(`Flushed ${keys.length} keys with prefix ${prefix}`);
      } else {
        logger.info(`No keys found with prefix ${prefix}`);
      }
    } catch (error) {
      logger.error('Failed to flush keys', error);
      throw error;
    }
  }
}

// Singleton instance
let redisInstance: RedisConnection | null = null;

/**
 * Get or create Redis connection instance
 */
export function getRedis(config?: RedisConfig): RedisConnection {
  if (!redisInstance) {
    redisInstance = new RedisConnection(config);
  }
  return redisInstance;
}

/**
 * Close Redis connection and reset singleton
 */
export async function closeRedis(): Promise<void> {
  if (redisInstance) {
    await redisInstance.close();
    redisInstance = null;
  }
}