import { EventEmitter } from 'events';
import { RecoveryOrchestrator, RecoveryContext } from './recovery-strategy';
import { getDatabase } from '../database/connection';
import pino from 'pino';

const logger = pino({
  name: 'error-handler',
  level: process.env.LOG_LEVEL || 'info'
});

export interface ErrorContext {
  error: Error;
  source: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
  resourceId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorsByCategory: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  errorsBySource: Record<string, number>;
  recentErrors: ErrorContext[];
}

export interface AlertConfig {
  enabled: boolean;
  thresholds: {
    errorRate: number; // errors per minute
    criticalErrors: number; // critical errors before alert
    consecutiveErrors: number; // consecutive errors before alert
  };
  handlers: AlertHandler[];
}

export interface AlertHandler {
  name: string;
  handle(alert: ErrorAlert): Promise<void>;
}

export interface ErrorAlert {
  type: 'error_rate' | 'critical_error' | 'consecutive_errors' | 'system_failure';
  severity: 'warning' | 'critical';
  message: string;
  details: Record<string, any>;
  timestamp: Date;
}

/**
 * Global error handler with categorization and recovery
 */
export class GlobalErrorHandler extends EventEmitter {
  private db = getDatabase();
  private errorHistory: ErrorContext[] = [];
  private errorCounts: Map<string, number> = new Map();
  private consecutiveErrors = 0;
  private lastErrorTime?: Date;
  private alertConfig: AlertConfig;
  private recoveryOrchestrator?: RecoveryOrchestrator;
  private gracefulShutdownHandlers: Array<() => Promise<void>> = [];
  private isShuttingDown = false;

  constructor(alertConfig: AlertConfig) {
    super();
    this.alertConfig = alertConfig;
    this.setupProcessHandlers();
  }

  /**
   * Set recovery orchestrator
   */
  setRecoveryOrchestrator(orchestrator: RecoveryOrchestrator): void {
    this.recoveryOrchestrator = orchestrator;
  }

  /**
   * Handle error
   */
  async handleError(context: ErrorContext): Promise<void> {
    // Log error
    logger.error({
      error: context.error.message,
      stack: context.error.stack,
      source: context.source,
      severity: context.severity,
      category: context.category,
      resourceId: context.resourceId,
      metadata: context.metadata
    }, 'Handling error');

    // Update counters
    this.updateErrorCounters(context);

    // Store error
    await this.storeError(context);

    // Add to history
    this.addToHistory(context);

    // Check for alerts
    await this.checkAlerts();

    // Emit error event
    this.emit('error', context);

    // Attempt recovery if configured
    if (this.recoveryOrchestrator && context.category && context.resourceId) {
      const recoveryContext: RecoveryContext = {
        errorType: context.category as any,
        errorMessage: context.error.message,
        resourceId: context.resourceId,
        metadata: context.metadata
      };

      try {
        const recoveryAction = await this.recoveryOrchestrator.executeRecovery(recoveryContext);
        
        if (recoveryAction.success) {
          logger.info({ recoveryAction }, 'Error recovery successful');
          this.consecutiveErrors = 0; // Reset on successful recovery
        } else {
          logger.warn({ recoveryAction }, 'Error recovery failed');
        }
      } catch (recoveryError) {
        logger.error({ recoveryError }, 'Recovery execution failed');
      }
    }
  }

  /**
   * Categorize error
   */
  categorizeError(error: Error): string {
    const errorMessage = error.message.toLowerCase();
    
    const categories = {
      network: /network|connection|timeout|econnrefused|etimedout/i,
      auth: /auth|unauthorized|forbidden|401|403/i,
      rate_limit: /rate limit|too many|429|quota/i,
      validation: /validation|invalid|missing required/i,
      database: /database|sql|postgres|connection pool/i,
      browser: /browser|puppeteer|chrome|navigation/i,
      file: /file|enoent|permission denied|disk/i,
      memory: /memory|heap|out of memory/i,
      unknown: /.*/
    };

    for (const [category, pattern] of Object.entries(categories)) {
      if (pattern.test(errorMessage)) {
        return category;
      }
    }

    return 'unknown';
  }

  /**
   * Update error counters
   */
  private updateErrorCounters(context: ErrorContext): void {
    // Update consecutive errors
    const now = new Date();
    if (this.lastErrorTime && now.getTime() - this.lastErrorTime.getTime() < 60000) {
      this.consecutiveErrors++;
    } else {
      this.consecutiveErrors = 1;
    }
    this.lastErrorTime = now;

    // Update category counts
    const category = context.category || 'unknown';
    this.errorCounts.set(category, (this.errorCounts.get(category) || 0) + 1);

    // Update source counts
    const sourceKey = `source:${context.source}`;
    this.errorCounts.set(sourceKey, (this.errorCounts.get(sourceKey) || 0) + 1);

    // Update severity counts
    const severityKey = `severity:${context.severity}`;
    this.errorCounts.set(severityKey, (this.errorCounts.get(severityKey) || 0) + 1);
  }

  /**
   * Store error in database
   */
  private async storeError(context: ErrorContext): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO system_errors (
          error_message, error_stack, source, severity, 
          category, resource_id, user_id, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          context.error.message,
          context.error.stack,
          context.source,
          context.severity,
          context.category || this.categorizeError(context.error),
          context.resourceId,
          context.userId,
          JSON.stringify(context.metadata || {})
        ]
      );
    } catch (dbError) {
      logger.error({ dbError }, 'Failed to store error in database');
    }
  }

  /**
   * Add to error history
   */
  private addToHistory(context: ErrorContext): void {
    this.errorHistory.push(context);
    
    // Keep only last 100 errors
    if (this.errorHistory.length > 100) {
      this.errorHistory.shift();
    }
  }

  /**
   * Check for alert conditions
   */
  private async checkAlerts(): Promise<void> {
    if (!this.alertConfig.enabled) {
      return;
    }

    const alerts: ErrorAlert[] = [];

    // Check error rate
    const recentErrors = this.errorHistory.filter(
      e => new Date().getTime() - new Date(e.metadata?.timestamp || Date.now()).getTime() < 60000
    );
    
    if (recentErrors.length > this.alertConfig.thresholds.errorRate) {
      alerts.push({
        type: 'error_rate',
        severity: 'warning',
        message: `Error rate exceeded: ${recentErrors.length} errors in last minute`,
        details: {
          count: recentErrors.length,
          threshold: this.alertConfig.thresholds.errorRate
        },
        timestamp: new Date()
      });
    }

    // Check critical errors
    const criticalErrors = this.errorHistory.filter(e => e.severity === 'critical');
    if (criticalErrors.length >= this.alertConfig.thresholds.criticalErrors) {
      alerts.push({
        type: 'critical_error',
        severity: 'critical',
        message: `Critical error threshold exceeded: ${criticalErrors.length} critical errors`,
        details: {
          count: criticalErrors.length,
          threshold: this.alertConfig.thresholds.criticalErrors,
          errors: criticalErrors.slice(-5) // Last 5 critical errors
        },
        timestamp: new Date()
      });
    }

    // Check consecutive errors
    if (this.consecutiveErrors >= this.alertConfig.thresholds.consecutiveErrors) {
      alerts.push({
        type: 'consecutive_errors',
        severity: 'warning',
        message: `Consecutive errors detected: ${this.consecutiveErrors} errors in a row`,
        details: {
          count: this.consecutiveErrors,
          threshold: this.alertConfig.thresholds.consecutiveErrors
        },
        timestamp: new Date()
      });
    }

    // Send alerts
    for (const alert of alerts) {
      await this.sendAlert(alert);
    }
  }

  /**
   * Send alert
   */
  private async sendAlert(alert: ErrorAlert): Promise<void> {
    logger.warn({ alert }, 'Sending error alert');
    
    this.emit('alert', alert);

    for (const handler of this.alertConfig.handlers) {
      try {
        await handler.handle(alert);
      } catch (error) {
        logger.error({ handler: handler.name, error }, 'Alert handler failed');
      }
    }
  }

  /**
   * Get error metrics
   */
  getMetrics(): ErrorMetrics {
    const metrics: ErrorMetrics = {
      totalErrors: this.errorHistory.length,
      errorsByCategory: {},
      errorsBySeverity: {},
      errorsBySource: {},
      recentErrors: this.errorHistory.slice(-10)
    };

    // Aggregate counts
    for (const [key, value] of this.errorCounts) {
      if (key.startsWith('source:')) {
        metrics.errorsBySource[key.replace('source:', '')] = value;
      } else if (key.startsWith('severity:')) {
        metrics.errorsBySeverity[key.replace('severity:', '')] = value;
      } else {
        metrics.errorsByCategory[key] = value;
      }
    }

    return metrics;
  }

  /**
   * Setup process-level error handlers
   */
  private setupProcessHandlers(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.fatal({ error }, 'Uncaught exception');
      
      this.handleError({
        error,
        source: 'process',
        severity: 'critical',
        category: 'uncaught_exception'
      }).finally(() => {
        process.exit(1);
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      
      logger.fatal({ error, promise }, 'Unhandled promise rejection');
      
      this.handleError({
        error,
        source: 'process',
        severity: 'critical',
        category: 'unhandled_rejection'
      });
    });

    // Handle SIGTERM and SIGINT
    ['SIGTERM', 'SIGINT'].forEach(signal => {
      process.on(signal, () => {
        logger.info({ signal }, 'Received shutdown signal');
        this.gracefulShutdown().then(() => {
          process.exit(0);
        }).catch(error => {
          logger.error({ error }, 'Graceful shutdown failed');
          process.exit(1);
        });
      });
    });
  }

  /**
   * Register graceful shutdown handler
   */
  registerShutdownHandler(handler: () => Promise<void>): void {
    this.gracefulShutdownHandlers.push(handler);
  }

  /**
   * Perform graceful shutdown
   */
  async gracefulShutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info('Starting graceful shutdown');

    // Set timeout for forceful shutdown
    const shutdownTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timeout, forcing exit');
      process.exit(1);
    }, 30000); // 30 seconds

    try {
      // Execute all shutdown handlers
      await Promise.all(
        this.gracefulShutdownHandlers.map(handler => 
          handler().catch(error => {
            logger.error({ error }, 'Shutdown handler failed');
          })
        )
      );

      // Log final metrics
      const metrics = this.getMetrics();
      logger.info({ metrics }, 'Final error metrics');

      // Clear timeout
      clearTimeout(shutdownTimeout);
      
      logger.info('Graceful shutdown completed');

    } catch (error) {
      logger.error({ error }, 'Error during graceful shutdown');
      clearTimeout(shutdownTimeout);
      throw error;
    }
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory = [];
    this.errorCounts.clear();
    this.consecutiveErrors = 0;
  }
}

/**
 * Console alert handler
 */
export class ConsoleAlertHandler implements AlertHandler {
  name = 'console';

  async handle(alert: ErrorAlert): Promise<void> {
    console.error(`[ERROR ALERT] ${alert.severity.toUpperCase()}: ${alert.message}`, {
      type: alert.type,
      details: alert.details,
      timestamp: alert.timestamp
    });
  }
}

/**
 * Create global error handler instance
 */
export function createGlobalErrorHandler(config?: Partial<AlertConfig>): GlobalErrorHandler {
  const defaultConfig: AlertConfig = {
    enabled: true,
    thresholds: {
      errorRate: 10, // 10 errors per minute
      criticalErrors: 3,
      consecutiveErrors: 5
    },
    handlers: [new ConsoleAlertHandler()],
    ...config
  };

  return new GlobalErrorHandler(defaultConfig);
}