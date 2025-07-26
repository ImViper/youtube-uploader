import { getRedis } from '../redis/connection';
import pino from 'pino';

const logger = pino({
  name: 'cache-service',
  level: process.env.LOG_LEVEL || 'info'
});

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Key prefix
}

export class CacheService {
  private redis = getRedis();
  private defaultTTL = 300; // 5 minutes default
  private keyPrefix = 'cache:';

  constructor(private options: CacheOptions = {}) {
    if (options.ttl) {
      this.defaultTTL = options.ttl;
    }
    if (options.prefix) {
      this.keyPrefix = options.prefix;
    }
  }

  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.keyPrefix + key;
      const value = await this.redis.get(fullKey);
      
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      logger.error({ error, key }, 'Failed to get cache value');
      return null;
    }
  }

  /**
   * Set cached value
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const fullKey = this.keyPrefix + key;
      const serialized = JSON.stringify(value);
      const expiry = ttl || this.defaultTTL;
      
      await this.redis.set(fullKey, serialized, expiry);
      
      logger.debug({ key, ttl: expiry }, 'Cache value set');
    } catch (error) {
      logger.error({ error, key }, 'Failed to set cache value');
    }
  }

  /**
   * Delete cached value
   */
  async delete(key: string): Promise<void> {
    try {
      const fullKey = this.keyPrefix + key;
      await this.redis.getClient().del(fullKey);
      
      logger.debug({ key }, 'Cache value deleted');
    } catch (error) {
      logger.error({ error, key }, 'Failed to delete cache value');
    }
  }

  /**
   * Clear cache by pattern
   */
  async clearPattern(pattern: string): Promise<number> {
    try {
      const fullPattern = this.keyPrefix + pattern;
      const keys = await this.redis.getClient().keys(fullPattern);
      
      if (keys.length === 0) {
        return 0;
      }

      await this.redis.getClient().del(...keys);
      logger.info({ pattern, count: keys.length }, 'Cache cleared by pattern');
      
      return keys.length;
    } catch (error) {
      logger.error({ error, pattern }, 'Failed to clear cache by pattern');
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    try {
      await this.clearPattern('*');
      logger.info('All cache cleared');
    } catch (error) {
      logger.error({ error }, 'Failed to clear all cache');
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const fullKey = this.keyPrefix + key;
      const exists = await this.redis.getClient().exists(fullKey);
      return exists === 1;
    } catch (error) {
      logger.error({ error, key }, 'Failed to check cache existence');
      return false;
    }
  }

  /**
   * Get remaining TTL
   */
  async ttl(key: string): Promise<number> {
    try {
      const fullKey = this.keyPrefix + key;
      const ttl = await this.redis.getClient().ttl(fullKey);
      return ttl;
    } catch (error) {
      logger.error({ error, key }, 'Failed to get TTL');
      return -1;
    }
  }

  /**
   * Extend TTL
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const fullKey = this.keyPrefix + key;
      const result = await this.redis.getClient().expire(fullKey, ttl);
      return result === 1;
    } catch (error) {
      logger.error({ error, key }, 'Failed to extend TTL');
      return false;
    }
  }

  /**
   * Get or set cache (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string, 
    factory: () => Promise<T>, 
    ttl?: number
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      logger.debug({ key }, 'Cache hit');
      return cached;
    }

    // Cache miss, compute value
    logger.debug({ key }, 'Cache miss');
    const value = await factory();
    
    // Store in cache
    await this.set(key, value, ttl);
    
    return value;
  }

  /**
   * Increment counter
   */
  async incr(key: string, by: number = 1): Promise<number> {
    try {
      const fullKey = this.keyPrefix + key;
      const result = await this.redis.getClient().incrby(fullKey, by);
      return result;
    } catch (error) {
      logger.error({ error, key }, 'Failed to increment counter');
      return 0;
    }
  }

  /**
   * Decrement counter
   */
  async decr(key: string, by: number = 1): Promise<number> {
    try {
      const fullKey = this.keyPrefix + key;
      const result = await this.redis.getClient().decrby(fullKey, by);
      return result;
    } catch (error) {
      logger.error({ error, key }, 'Failed to decrement counter');
      return 0;
    }
  }
}

// Export singleton instance for general use
export const cache = new CacheService();