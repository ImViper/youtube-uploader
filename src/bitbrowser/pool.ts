import { BitBrowserManager, BrowserInstance } from './manager';
import { getRedis } from '../redis/connection';
import pino from 'pino';
import { EventEmitter } from 'events';

const logger = pino({
  name: 'browser-pool',
  level: process.env.LOG_LEVEL || 'info'
});

export interface BrowserPoolConfig {
  minInstances?: number;
  maxInstances?: number;
  idleTimeout?: number; // ms before closing idle browser
  healthCheckInterval?: number; // ms between health checks
  acquireTimeout?: number; // ms to wait for available browser
}

export interface PooledBrowserInstance extends BrowserInstance {
  poolId: string;
  acquiredAt?: Date;
  acquiredBy?: string;
  idleSince?: Date;
}

export class BrowserPool extends EventEmitter {
  private manager: BitBrowserManager;
  private config: BrowserPoolConfig;
  private pool: Map<string, PooledBrowserInstance>;
  private availableInstances: string[];
  private healthCheckTimer?: NodeJS.Timeout;
  private idleCheckTimer?: NodeJS.Timeout;
  private redis = getRedis();
  private lockPrefix = 'browser:lock:';
  private lockTTL = 300; // 5 minutes

  constructor(manager: BitBrowserManager, config: BrowserPoolConfig = {}) {
    super();
    
    this.manager = manager;
    this.config = {
      minInstances: config.minInstances || 0,  // 默认不创建实例
      maxInstances: config.maxInstances || 10,
      idleTimeout: config.idleTimeout || 300000, // 5 minutes
      healthCheckInterval: config.healthCheckInterval || 30000, // 30 seconds
      acquireTimeout: config.acquireTimeout || 30000, // 30 seconds
      ...config
    };

    this.pool = new Map();
    this.availableInstances = [];
  }

  /**
   * Initialize the browser pool
   */
  async initialize(): Promise<void> {
    logger.info({ config: this.config }, 'Initializing browser pool');

    try {
      // Create minimum number of instances (if configured)
      if (this.config.minInstances! > 0) {
        const promises: Promise<void>[] = [];
        for (let i = 0; i < this.config.minInstances!; i++) {
          promises.push(this.createInstance());
        }
        await Promise.all(promises);
      }

      // Start health check timer
      this.startHealthCheck();

      // Start idle check timer
      this.startIdleCheck();

      logger.info({ 
        poolSize: this.pool.size, 
        available: this.availableInstances.length 
      }, 'Browser pool initialized');

    } catch (error) {
      logger.error({ error }, 'Failed to initialize browser pool');
      throw error;
    }
  }

  /**
   * Create a new browser instance
   */
  private async createInstance(): Promise<void> {
    const poolId = `pool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const windowId = `window-${poolId}`;

    try {
      const instance = await this.manager.openBrowser(windowId);
      
      const pooledInstance: PooledBrowserInstance = {
        ...instance,
        poolId,
        idleSince: new Date(),
      };

      this.pool.set(poolId, pooledInstance);
      this.availableInstances.push(poolId);

      logger.info({ poolId, windowId }, 'Created new browser instance');
      this.emit('instanceCreated', pooledInstance);

    } catch (error) {
      logger.error({ poolId, error }, 'Failed to create browser instance');
      throw error;
    }
  }

  /**
   * Acquire a browser instance from the pool
   */
  async acquire(requesterId: string): Promise<PooledBrowserInstance> {
    const startTime = Date.now();
    const timeout = this.config.acquireTimeout!;

    while (Date.now() - startTime < timeout) {
      // Try to get an available instance
      const poolId = this.availableInstances.shift();
      
      if (poolId) {
        const instance = this.pool.get(poolId);
        if (instance && instance.status !== 'error') {
          // Try to acquire lock
          const locked = await this.acquireLock(poolId, requesterId);
          if (locked) {
            instance.acquiredAt = new Date();
            instance.acquiredBy = requesterId;
            instance.idleSince = undefined;
            this.manager.updateInstanceStatus(instance.id, 'busy');
            
            logger.info({ poolId, requesterId }, 'Browser instance acquired');
            this.emit('instanceAcquired', instance);
            return instance;
          }
        }
      }

      // Check if we can create a new instance
      if (this.pool.size < this.config.maxInstances!) {
        try {
          await this.createInstance();
          continue;
        } catch (error) {
          logger.error({ error }, 'Failed to create new instance');
        }
      }

      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error(`Failed to acquire browser instance within ${timeout}ms`);
  }

  /**
   * Release a browser instance back to the pool
   */
  async release(poolId: string): Promise<void> {
    const instance = this.pool.get(poolId);
    if (!instance) {
      logger.warn({ poolId }, 'Attempted to release unknown browser instance');
      return;
    }

    try {
      // Release lock
      await this.releaseLock(poolId);

      // Update instance state
      instance.acquiredAt = undefined;
      instance.acquiredBy = undefined;
      instance.idleSince = new Date();
      this.manager.updateInstanceStatus(instance.id, 'idle');

      // Check if instance is healthy
      const isHealthy = await this.manager.healthCheck(instance.id);
      
      if (isHealthy) {
        this.availableInstances.push(poolId);
        logger.info({ poolId }, 'Browser instance released to pool');
      } else {
        logger.warn({ poolId }, 'Released browser instance is unhealthy, removing from pool');
        await this.removeInstance(poolId);
      }

      this.emit('instanceReleased', instance);

    } catch (error) {
      logger.error({ poolId, error }, 'Failed to release browser instance');
      throw error;
    }
  }

  /**
   * Remove an instance from the pool
   */
  private async removeInstance(poolId: string): Promise<void> {
    const instance = this.pool.get(poolId);
    if (!instance) {
      return;
    }

    try {
      // Close the browser
      await this.manager.closeBrowser(instance.id);

      // Remove from pool
      this.pool.delete(poolId);
      
      // Remove from available list
      const index = this.availableInstances.indexOf(poolId);
      if (index !== -1) {
        this.availableInstances.splice(index, 1);
      }

      // Release lock if exists
      await this.releaseLock(poolId);

      logger.info({ poolId }, 'Removed browser instance from pool');
      this.emit('instanceRemoved', instance);

      // Ensure minimum instances
      if (this.pool.size < this.config.minInstances!) {
        this.createInstance().catch(error => {
          logger.error({ error }, 'Failed to create replacement instance');
        });
      }

    } catch (error) {
      logger.error({ poolId, error }, 'Failed to remove browser instance');
    }
  }

  /**
   * Acquire a Redis lock for the instance
   */
  private async acquireLock(poolId: string, requesterId: string): Promise<boolean> {
    const key = `${this.lockPrefix}${poolId}`;
    try {
      const result = await this.redis.set(key, requesterId, this.lockTTL);
      return result === 'OK';
    } catch (error) {
      logger.error({ poolId, error }, 'Failed to acquire lock');
      return false;
    }
  }

  /**
   * Release a Redis lock
   */
  private async releaseLock(poolId: string): Promise<void> {
    const key = `${this.lockPrefix}${poolId}`;
    try {
      await this.redis.del(key);
    } catch (error) {
      logger.error({ poolId, error }, 'Failed to release lock');
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      logger.debug('Running pool health check');

      for (const [poolId, instance] of this.pool) {
        try {
          const isHealthy = await this.manager.healthCheck(instance.id);
          
          if (!isHealthy && instance.status !== 'busy') {
            logger.warn({ poolId }, 'Unhealthy browser instance detected');
            await this.removeInstance(poolId);
          }
        } catch (error) {
          logger.error({ poolId, error }, 'Health check error');
        }
      }
    }, this.config.healthCheckInterval!);
  }

  /**
   * Start periodic idle checks
   */
  private startIdleCheck(): void {
    this.idleCheckTimer = setInterval(async () => {
      logger.debug('Running pool idle check');

      const now = Date.now();

      for (const [poolId, instance] of this.pool) {
        if (instance.idleSince && instance.status === 'idle') {
          const idleTime = now - instance.idleSince.getTime();
          
          if (idleTime > this.config.idleTimeout! && this.pool.size > this.config.minInstances!) {
            logger.info({ poolId, idleTime }, 'Removing idle browser instance');
            await this.removeInstance(poolId);
          }
        }
      }
    }, 60000); // Check every minute
  }

  /**
   * Get pool statistics
   */
  getStats() {
    const stats = {
      total: this.pool.size,
      available: this.availableInstances.length,
      busy: 0,
      error: 0,
      instances: [] as any[]
    };

    for (const instance of this.pool.values()) {
      if (instance.status === 'busy') stats.busy++;
      if (instance.status === 'error') stats.error++;
      
      stats.instances.push({
        poolId: instance.poolId,
        status: instance.status,
        acquiredBy: instance.acquiredBy,
        idleTime: instance.idleSince ? Date.now() - instance.idleSince.getTime() : 0,
        errorCount: instance.errorCount,
        uploadCount: instance.uploadCount,
      });
    }

    return stats;
  }

  /**
   * Shutdown the pool
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down browser pool');

    // Stop timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.idleCheckTimer) {
      clearInterval(this.idleCheckTimer);
    }

    // Close all instances
    const promises: Promise<void>[] = [];
    for (const poolId of this.pool.keys()) {
      promises.push(this.removeInstance(poolId));
    }
    await Promise.all(promises);

    this.pool.clear();
    this.availableInstances = [];

    logger.info('Browser pool shutdown complete');
    this.emit('shutdown');
  }
}