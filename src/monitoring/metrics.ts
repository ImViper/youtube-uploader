import { EventEmitter } from 'events';
import { getDatabase } from '../database/connection';
import { getRedis } from '../redis/connection';
import pino from 'pino';

const logger = pino({
  name: 'metrics-collector',
  level: process.env.LOG_LEVEL || 'info'
});

export interface MetricValue {
  name: string;
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
}

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  details?: Record<string, any>;
}

export interface SystemMetrics {
  uploads: {
    total24h: number;
    successful24h: number;
    failed24h: number;
    averageDuration: number;
    throughput: number; // uploads per hour
  };
  accounts: {
    total: number;
    active: number;
    healthy: number;
    suspended: number;
    utilizationRate: number; // percentage
  };
  browsers: {
    total: number;
    active: number;
    idle: number;
    error: number;
    utilizationRate: number; // percentage
  };
  queue: {
    depth: number;
    processingRate: number; // jobs per minute
    averageWaitTime: number;
    backlog: number;
  };
  resources: {
    memoryUsage: number; // MB
    cpuUsage: number; // percentage
    redisMemory: number; // MB
    dbConnections: number;
  };
  errors: {
    rate24h: number;
    byCategory: Record<string, number>;
    topErrors: Array<{ message: string; count: number }>;
  };
}

export class MetricsCollector extends EventEmitter {
  private db = getDatabase();
  private redis = getRedis();
  private metricsPrefix = 'metrics:';
  private collectionInterval?: NodeJS.Timeout;
  private isCollecting = false;

  constructor(private intervalMs: number = 60000) {
    super();
  }

  /**
   * Start collecting metrics
   */
  start(): void {
    if (this.isCollecting) {
      logger.warn('Metrics collector already running');
      return;
    }

    logger.info({ interval: this.intervalMs }, 'Starting metrics collection');
    this.isCollecting = true;

    // Collect immediately
    this.collectMetrics().catch(error => {
      logger.error({ error }, 'Error collecting initial metrics');
    });

    // Schedule periodic collection
    this.collectionInterval = setInterval(() => {
      this.collectMetrics().catch(error => {
        logger.error({ error }, 'Error collecting metrics');
      });
    }, this.intervalMs);

    this.emit('started');
  }

  /**
   * Stop collecting metrics
   */
  stop(): void {
    if (!this.isCollecting) {
      return;
    }

    logger.info('Stopping metrics collection');
    
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = undefined;
    }

    this.isCollecting = false;
    this.emit('stopped');
  }

  /**
   * Collect all metrics
   */
  private async collectMetrics(): Promise<void> {
    const startTime = Date.now();

    try {
      const metrics = await this.gatherSystemMetrics();
      
      // Store in Redis for quick access
      await this.storeMetrics(metrics);
      
      // Store time-series data in database
      await this.storeTimeSeries(metrics);
      
      const duration = Date.now() - startTime;
      logger.debug({ duration }, 'Metrics collection completed');
      
      this.emit('collected', metrics);

    } catch (error) {
      logger.error({ error }, 'Failed to collect metrics');
      this.emit('error', error);
    }
  }

  /**
   * Gather system metrics
   */
  async gatherSystemMetrics(): Promise<SystemMetrics> {
    const [uploads, accounts, browsers, queue, resources, errors] = await Promise.all([
      this.getUploadMetrics(),
      this.getAccountMetrics(),
      this.getBrowserMetrics(),
      this.getQueueMetrics(),
      this.getResourceMetrics(),
      this.getErrorMetrics()
    ]);

    return {
      uploads,
      accounts,
      browsers,
      queue,
      resources,
      errors
    };
  }

  /**
   * Get upload metrics
   */
  private async getUploadMetrics() {
    const result = await this.db.query(`
      SELECT 
        COUNT(*) as total_24h,
        COUNT(*) FILTER (WHERE success = true) as successful_24h,
        COUNT(*) FILTER (WHERE success = false) as failed_24h,
        AVG(upload_duration) as avg_duration,
        COUNT(*)::float / 24 as throughput
      FROM upload_history
      WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
    `);

    const metrics = result.rows[0];
    
    return {
      total24h: parseInt(metrics.total_24h) || 0,
      successful24h: parseInt(metrics.successful_24h) || 0,
      failed24h: parseInt(metrics.failed_24h) || 0,
      averageDuration: parseFloat(metrics.avg_duration) || 0,
      throughput: parseFloat(metrics.throughput) || 0
    };
  }

  /**
   * Get account metrics
   */
  private async getAccountMetrics() {
    const result = await this.db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'active' AND health_score >= 70) as healthy,
        COUNT(*) FILTER (WHERE status = 'suspended') as suspended,
        COUNT(*) FILTER (WHERE last_upload_time > CURRENT_TIMESTAMP - INTERVAL '24 hours')::float / 
          NULLIF(COUNT(*), 0) * 100 as utilization_rate
      FROM accounts
    `);

    const metrics = result.rows[0];
    
    return {
      total: parseInt(metrics.total) || 0,
      active: parseInt(metrics.active) || 0,
      healthy: parseInt(metrics.healthy) || 0,
      suspended: parseInt(metrics.suspended) || 0,
      utilizationRate: parseFloat(metrics.utilization_rate) || 0
    };
  }

  /**
   * Get browser metrics
   */
  private async getBrowserMetrics() {
    const result = await this.db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'busy') as active,
        COUNT(*) FILTER (WHERE status = 'idle') as idle,
        COUNT(*) FILTER (WHERE status = 'error') as error,
        COUNT(*) FILTER (WHERE status = 'busy')::float / 
          NULLIF(COUNT(*), 0) * 100 as utilization_rate
      FROM browser_instances
      WHERE last_health_check > CURRENT_TIMESTAMP - INTERVAL '5 minutes'
    `);

    const metrics = result.rows[0];
    
    return {
      total: parseInt(metrics.total) || 0,
      active: parseInt(metrics.active) || 0,
      idle: parseInt(metrics.idle) || 0,
      error: parseInt(metrics.error) || 0,
      utilizationRate: parseFloat(metrics.utilization_rate) || 0
    };
  }

  /**
   * Get queue metrics
   */
  private async getQueueMetrics() {
    // Get queue depth from Redis
    const queueKey = 'bull:youtube-uploads:wait';
    const depth = await this.redis.getClient().llen(queueKey);

    // Get processing rate from database
    const result = await this.db.query(`
      SELECT 
        COUNT(*)::float / 60 as processing_rate,
        AVG(EXTRACT(EPOCH FROM (started_at - created_at))) as avg_wait_time
      FROM upload_tasks
      WHERE started_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
        AND started_at IS NOT NULL
    `);

    const metrics = result.rows[0];

    // Get backlog
    const backlogResult = await this.db.query(`
      SELECT COUNT(*) as backlog
      FROM upload_tasks
      WHERE status IN ('queued', 'processing')
        AND created_at < CURRENT_TIMESTAMP - INTERVAL '1 hour'
    `);

    return {
      depth,
      processingRate: parseFloat(metrics.processing_rate) || 0,
      averageWaitTime: parseFloat(metrics.avg_wait_time) || 0,
      backlog: parseInt(backlogResult.rows[0].backlog) || 0
    };
  }

  /**
   * Get resource metrics
   */
  private async getResourceMetrics() {
    const memoryUsage = process.memoryUsage();
    
    // Get Redis memory usage
    const redisInfo = await this.redis.getClient().info('memory');
    const redisMemMatch = redisInfo.match(/used_memory:(\d+)/);
    const redisMemory = redisMemMatch ? parseInt(redisMemMatch[1]) / 1024 / 1024 : 0;

    // Get database connections
    const dbResult = await this.db.query(`
      SELECT COUNT(*) as connections
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);

    return {
      memoryUsage: memoryUsage.heapUsed / 1024 / 1024,
      cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
      redisMemory,
      dbConnections: parseInt(dbResult.rows[0].connections) || 0
    };
  }

  /**
   * Get error metrics
   */
  private async getErrorMetrics() {
    const result = await this.db.query(`
      SELECT 
        COUNT(*)::float / 24 as error_rate,
        error_category,
        COUNT(*) as count
      FROM upload_errors
      WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
      GROUP BY error_category
      ORDER BY count DESC
    `);

    const byCategory: Record<string, number> = {};
    let totalErrors = 0;

    for (const row of result.rows) {
      byCategory[row.error_category] = parseInt(row.count);
      totalErrors += parseInt(row.count);
    }

    // Get top errors
    const topErrorsResult = await this.db.query(`
      SELECT 
        error_message,
        COUNT(*) as count
      FROM upload_errors
      WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
      GROUP BY error_message
      ORDER BY count DESC
      LIMIT 5
    `);

    const topErrors = topErrorsResult.rows.map(row => ({
      message: row.error_message,
      count: parseInt(row.count)
    }));

    return {
      rate24h: totalErrors / 24,
      byCategory,
      topErrors
    };
  }

  /**
   * Store metrics in Redis
   */
  private async storeMetrics(metrics: SystemMetrics): Promise<void> {
    const key = `${this.metricsPrefix}current`;
    const ttl = 300; // 5 minutes

    await this.redis.set(key, JSON.stringify(metrics), ttl);
  }

  /**
   * Store time-series data
   */
  private async storeTimeSeries(metrics: SystemMetrics): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO metrics_history (
          timestamp, metric_type, metric_data
        ) VALUES ($1, $2, $3)`,
        [new Date(), 'system', JSON.stringify(metrics)]
      );
    } catch (error) {
      logger.error({ error }, 'Failed to store time-series data');
    }
  }

  /**
   * Get current metrics
   */
  async getCurrentMetrics(): Promise<SystemMetrics | null> {
    const key = `${this.metricsPrefix}current`;
    const data = await this.redis.get(key);
    
    if (data) {
      return JSON.parse(data);
    }

    // Collect fresh metrics if none cached
    return this.gatherSystemMetrics();
  }

  /**
   * Perform health checks
   */
  async performHealthChecks(): Promise<HealthCheckResult[]> {
    const checks: HealthCheckResult[] = [];

    // Database health
    try {
      await this.db.query('SELECT 1');
      checks.push({
        service: 'database',
        status: 'healthy'
      });
    } catch (error) {
      checks.push({
        service: 'database',
        status: 'unhealthy',
        message: 'Database connection failed',
        details: { error: error.message }
      });
    }

    // Redis health
    try {
      await this.redis.getClient().ping();
      checks.push({
        service: 'redis',
        status: 'healthy'
      });
    } catch (error) {
      checks.push({
        service: 'redis',
        status: 'unhealthy',
        message: 'Redis connection failed',
        details: { error: error.message }
      });
    }

    // Queue health
    const metrics = await this.getCurrentMetrics();
    if (metrics) {
      const queueStatus = metrics.queue.backlog > 100 ? 'degraded' : 'healthy';
      checks.push({
        service: 'queue',
        status: queueStatus,
        message: queueStatus === 'degraded' ? 'High backlog detected' : undefined,
        details: { backlog: metrics.queue.backlog }
      });
    }

    // Account health
    if (metrics) {
      const accountStatus = metrics.accounts.healthy < metrics.accounts.active * 0.5 ? 'degraded' : 'healthy';
      checks.push({
        service: 'accounts',
        status: accountStatus,
        message: accountStatus === 'degraded' ? 'Low healthy account ratio' : undefined,
        details: { 
          healthy: metrics.accounts.healthy,
          active: metrics.accounts.active
        }
      });
    }

    return checks;
  }

  /**
   * Record custom metric
   */
  async recordMetric(metric: MetricValue): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO custom_metrics (
          name, value, timestamp, labels
        ) VALUES ($1, $2, $3, $4)`,
        [metric.name, metric.value, metric.timestamp, JSON.stringify(metric.labels || {})]
      );
    } catch (error) {
      logger.error({ metric, error }, 'Failed to record custom metric');
    }
  }
}