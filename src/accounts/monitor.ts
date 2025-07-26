import { AccountManager, AccountProfile } from './manager';
import { getDatabase } from '../database/connection';
import { EventEmitter } from 'events';
import pino from 'pino';

const logger = pino({
  name: 'account-monitor',
  level: process.env.LOG_LEVEL || 'info'
});

export interface AccountAlert {
  accountId: string;
  type: 'health_low' | 'limit_reached' | 'suspended' | 'error_rate_high';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface MonitorConfig {
  checkInterval?: number; // ms
  healthThreshold?: number;
  errorRateThreshold?: number;
  alertHandlers?: AlertHandler[];
}

export interface AlertHandler {
  name: string;
  handle(alert: AccountAlert): Promise<void>;
}

export class ConsoleAlertHandler implements AlertHandler {
  name = 'console';

  async handle(alert: AccountAlert): Promise<void> {
    console.error(`[ALERT] ${alert.severity.toUpperCase()}: ${alert.message}`, {
      accountId: alert.accountId,
      type: alert.type,
      timestamp: alert.timestamp,
      metadata: alert.metadata
    });
  }
}

export class AccountMonitor extends EventEmitter {
  private accountManager: AccountManager;
  private db = getDatabase();
  private config: MonitorConfig;
  private monitorTimer?: NodeJS.Timeout;
  private isRunning = false;

  constructor(accountManager: AccountManager, config: MonitorConfig = {}) {
    super();
    
    this.accountManager = accountManager;
    this.config = {
      checkInterval: config.checkInterval || 60000, // 1 minute
      healthThreshold: config.healthThreshold || 40,
      errorRateThreshold: config.errorRateThreshold || 0.5, // 50% error rate
      alertHandlers: config.alertHandlers || [new ConsoleAlertHandler()],
      ...config
    };
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Monitor already running');
      return;
    }

    logger.info({ config: this.config }, 'Starting account monitor');
    this.isRunning = true;

    // Run initial check
    this.runChecks().catch(error => {
      logger.error({ error }, 'Error in initial monitor check');
    });

    // Schedule periodic checks
    this.monitorTimer = setInterval(() => {
      this.runChecks().catch(error => {
        logger.error({ error }, 'Error in monitor check');
      });
    }, this.config.checkInterval!);

    this.emit('started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping account monitor');
    
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = undefined;
    }

    this.isRunning = false;
    this.emit('stopped');
  }

  /**
   * Run all monitoring checks
   */
  private async runChecks(): Promise<void> {
    logger.debug('Running monitor checks');

    try {
      await Promise.all([
        this.checkHealthScores(),
        this.checkDailyLimits(),
        this.checkErrorRates(),
        this.checkAccountStatus()
      ]);

      this.emit('checkCompleted');
    } catch (error) {
      logger.error({ error }, 'Failed to run monitor checks');
      throw error;
    }
  }

  /**
   * Check account health scores
   */
  private async checkHealthScores(): Promise<void> {
    try {
      const accounts = await this.accountManager.listAccounts();
      
      for (const account of accounts) {
        if (account.healthScore < this.config.healthThreshold! && account.status === 'active') {
          await this.createAlert({
            accountId: account.id,
            type: 'health_low',
            severity: account.healthScore < 20 ? 'critical' : 'warning',
            message: `Account ${account.email} health score is ${account.healthScore}`,
            timestamp: new Date(),
            metadata: {
              email: account.email,
              healthScore: account.healthScore,
              threshold: this.config.healthThreshold
            }
          });
        }
      }
    } catch (error) {
      logger.error({ error }, 'Failed to check health scores');
    }
  }

  /**
   * Check daily upload limits
   */
  private async checkDailyLimits(): Promise<void> {
    try {
      const accounts = await this.accountManager.listAccounts();
      
      for (const account of accounts) {
        if (account.dailyUploadCount >= account.dailyUploadLimit) {
          await this.createAlert({
            accountId: account.id,
            type: 'limit_reached',
            severity: 'info',
            message: `Account ${account.email} reached daily upload limit`,
            timestamp: new Date(),
            metadata: {
              email: account.email,
              uploadCount: account.dailyUploadCount,
              uploadLimit: account.dailyUploadLimit
            }
          });
        }
      }
    } catch (error) {
      logger.error({ error }, 'Failed to check daily limits');
    }
  }

  /**
   * Check error rates
   */
  private async checkErrorRates(): Promise<void> {
    try {
      const result = await this.db.query(`
        SELECT 
          a.id,
          a.email,
          COUNT(uh.id) as total_uploads,
          COUNT(uh.id) FILTER (WHERE uh.success = false) as failed_uploads,
          CASE 
            WHEN COUNT(uh.id) > 0 
            THEN COUNT(uh.id) FILTER (WHERE uh.success = false)::float / COUNT(uh.id)
            ELSE 0
          END as error_rate
        FROM accounts a
        LEFT JOIN upload_history uh ON a.id = uh.account_id
          AND uh.created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
        WHERE a.status = 'active'
        GROUP BY a.id, a.email
        HAVING COUNT(uh.id) > 0
      `);

      for (const row of result.rows) {
        if (row.error_rate > this.config.errorRateThreshold!) {
          await this.createAlert({
            accountId: row.id,
            type: 'error_rate_high',
            severity: row.error_rate > 0.8 ? 'critical' : 'warning',
            message: `Account ${row.email} has ${(row.error_rate * 100).toFixed(0)}% error rate`,
            timestamp: new Date(),
            metadata: {
              email: row.email,
              totalUploads: row.total_uploads,
              failedUploads: row.failed_uploads,
              errorRate: row.error_rate
            }
          });
        }
      }
    } catch (error) {
      logger.error({ error }, 'Failed to check error rates');
    }
  }

  /**
   * Check account status
   */
  private async checkAccountStatus(): Promise<void> {
    try {
      const accounts = await this.accountManager.listAccounts({
        status: 'suspended'
      });

      for (const account of accounts) {
        await this.createAlert({
          accountId: account.id,
          type: 'suspended',
          severity: 'warning',
          message: `Account ${account.email} is suspended`,
          timestamp: new Date(),
          metadata: {
            email: account.email,
            healthScore: account.healthScore,
            lastUploadTime: account.lastUploadTime
          }
        });
      }
    } catch (error) {
      logger.error({ error }, 'Failed to check account status');
    }
  }

  /**
   * Create and handle alert
   */
  private async createAlert(alert: AccountAlert): Promise<void> {
    logger.warn({ alert }, 'Creating alert');

    // Emit alert event
    this.emit('alert', alert);

    // Handle alert with configured handlers
    for (const handler of this.config.alertHandlers!) {
      try {
        await handler.handle(alert);
      } catch (error) {
        logger.error({ handler: handler.name, error }, 'Alert handler failed');
      }
    }
  }

  /**
   * Get account metrics
   */
  async getAccountMetrics(accountId: string, period: '1h' | '24h' | '7d' = '24h'): Promise<any> {
    const intervals = {
      '1h': '1 hour',
      '24h': '24 hours',
      '7d': '7 days'
    };

    try {
      const result = await this.db.query(`
        SELECT 
          COUNT(*) as total_uploads,
          COUNT(*) FILTER (WHERE success = true) as successful_uploads,
          COUNT(*) FILTER (WHERE success = false) as failed_uploads,
          AVG(upload_duration) as avg_upload_duration,
          MIN(created_at) as first_upload,
          MAX(created_at) as last_upload
        FROM upload_history
        WHERE account_id = $1
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '${intervals[period]}'
      `, [accountId]);

      const metrics = result.rows[0];
      
      // Calculate success rate
      metrics.success_rate = metrics.total_uploads > 0
        ? (metrics.successful_uploads / metrics.total_uploads) * 100
        : 100;

      return metrics;

    } catch (error) {
      logger.error({ accountId, period, error }, 'Failed to get account metrics');
      throw error;
    }
  }

  /**
   * Get system-wide metrics
   */
  async getSystemMetrics(): Promise<any> {
    try {
      const [accountStats, uploadStats, healthSummary] = await Promise.all([
        this.accountManager.getAccountStats(),
        this.getUploadStats(),
        this.getHealthSummary()
      ]);

      return {
        accounts: accountStats,
        uploads: uploadStats,
        health: healthSummary,
        timestamp: new Date()
      };

    } catch (error) {
      logger.error({ error }, 'Failed to get system metrics');
      throw error;
    }
  }

  /**
   * Get upload statistics
   */
  private async getUploadStats(): Promise<any> {
    const result = await this.db.query(`
      SELECT 
        COUNT(*) as total_24h,
        COUNT(*) FILTER (WHERE success = true) as successful_24h,
        COUNT(*) FILTER (WHERE success = false) as failed_24h,
        AVG(upload_duration) as avg_duration_24h
      FROM upload_history
      WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
    `);

    return result.rows[0];
  }

  /**
   * Get health summary
   */
  private async getHealthSummary(): Promise<any> {
    const result = await this.db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE health_score >= 80) as healthy,
        COUNT(*) FILTER (WHERE health_score >= 50 AND health_score < 80) as moderate,
        COUNT(*) FILTER (WHERE health_score < 50) as unhealthy,
        AVG(health_score) as average_health
      FROM accounts
      WHERE status = 'active'
    `);

    return result.rows[0];
  }

  /**
   * Trigger account recovery workflow
   */
  async triggerRecovery(accountId: string): Promise<void> {
    logger.info({ accountId }, 'Triggering account recovery');

    try {
      const account = await this.accountManager.getAccount(accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      // Reset health score to 70
      await this.accountManager.updateAccount(accountId, {
        healthScore: 70,
        status: 'active'
      });

      // Reset daily upload count
      await this.db.query(
        'UPDATE accounts SET daily_upload_count = 0 WHERE id = $1',
        [accountId]
      );

      logger.info({ accountId }, 'Account recovery completed');
      
      this.emit('recoveryCompleted', { accountId });

    } catch (error) {
      logger.error({ accountId, error }, 'Failed to trigger recovery');
      throw error;
    }
  }
}