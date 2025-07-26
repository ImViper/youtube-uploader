import { BitBrowserManager } from '../bitbrowser/manager';
import { AccountManager } from '../accounts/manager';
import { CircuitBreaker, CircuitBreakerFactory } from './circuit-breaker';
import { getDatabase } from '../database/connection';
import pino from 'pino';
import { EventEmitter } from 'events';

const logger = pino({
  name: 'recovery-strategy',
  level: process.env.LOG_LEVEL || 'info'
});

export interface RecoveryContext {
  errorType: 'browser' | 'account' | 'network' | 'task';
  errorMessage: string;
  resourceId?: string;
  attemptNumber?: number;
  metadata?: Record<string, any>;
}

export interface RecoveryAction {
  action: string;
  success: boolean;
  message?: string;
  duration?: number;
}

export interface RecoveryStrategy {
  name: string;
  canHandle(context: RecoveryContext): boolean;
  execute(context: RecoveryContext): Promise<RecoveryAction>;
}

/**
 * Browser error recovery strategy
 */
export class BrowserRecoveryStrategy implements RecoveryStrategy {
  name = 'browser-recovery';

  constructor(
    private browserManager: BitBrowserManager,
    private circuitBreaker: CircuitBreaker
  ) {}

  canHandle(context: RecoveryContext): boolean {
    return context.errorType === 'browser';
  }

  async execute(context: RecoveryContext): Promise<RecoveryAction> {
    const startTime = Date.now();
    const browserId = context.resourceId;

    if (!browserId) {
      return {
        action: 'skip',
        success: false,
        message: 'No browser ID provided'
      };
    }

    logger.info({ browserId }, 'Executing browser recovery');

    try {
      // First, try to restart the browser
      await this.circuitBreaker.execute(async () => {
        await this.browserManager.restartBrowser(browserId);
      });

      // Verify browser is healthy
      const isHealthy = await this.browserManager.healthCheck(browserId);

      if (isHealthy) {
        logger.info({ browserId }, 'Browser recovered successfully');
        return {
          action: 'restart',
          success: true,
          duration: Date.now() - startTime
        };
      }

      // If restart didn't work, close and create new
      logger.warn({ browserId }, 'Restart failed, recreating browser');
      
      await this.browserManager.closeBrowser(browserId);
      const newBrowser = await this.browserManager.openBrowser(`window-${Date.now()}`);

      return {
        action: 'recreate',
        success: true,
        message: `New browser created: ${newBrowser.id}`,
        duration: Date.now() - startTime
      };

    } catch (error) {
      logger.error({ browserId, error }, 'Browser recovery failed');
      return {
        action: 'failed',
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }
}

/**
 * Account error recovery strategy
 */
export class AccountRecoveryStrategy implements RecoveryStrategy {
  name = 'account-recovery';
  private db = getDatabase();

  constructor(
    private accountManager: AccountManager,
    private circuitBreaker: CircuitBreaker
  ) {}

  canHandle(context: RecoveryContext): boolean {
    return context.errorType === 'account';
  }

  async execute(context: RecoveryContext): Promise<RecoveryAction> {
    const startTime = Date.now();
    const accountId = context.resourceId;

    if (!accountId) {
      return {
        action: 'skip',
        success: false,
        message: 'No account ID provided'
      };
    }

    logger.info({ accountId }, 'Executing account recovery');

    try {
      const account = await this.accountManager.getAccount(accountId);
      if (!account) {
        return {
          action: 'skip',
          success: false,
          message: 'Account not found'
        };
      }

      // Determine recovery action based on error
      const errorPatterns = {
        suspended: /suspended|disabled|terminated/i,
        rateLimit: /rate limit|too many|quota/i,
        auth: /auth|login|password|credential/i,
        temporary: /temporary|try again|unavailable/i
      };

      let action = 'unknown';
      
      if (errorPatterns.suspended.test(context.errorMessage)) {
        // Account is suspended, mark it as such
        await this.accountManager.updateAccount(accountId, {
          status: 'suspended',
          healthScore: 0
        });
        action = 'suspend';
        
      } else if (errorPatterns.rateLimit.test(context.errorMessage)) {
        // Rate limited, mark as limited
        await this.accountManager.updateAccount(accountId, {
          status: 'limited',
          healthScore: Math.max(0, account.healthScore - 20)
        });
        action = 'limit';
        
      } else if (errorPatterns.auth.test(context.errorMessage)) {
        // Auth error, needs manual intervention
        await this.accountManager.updateAccount(accountId, {
          status: 'error',
          metadata: { 
            ...account.metadata,
            lastError: 'Authentication failed',
            errorTime: new Date()
          }
        });
        action = 'auth-error';
        
      } else if (errorPatterns.temporary.test(context.errorMessage)) {
        // Temporary error, reduce health slightly
        await this.accountManager.updateAccount(accountId, {
          healthScore: Math.max(0, account.healthScore - 5)
        });
        action = 'temporary';
        
      } else {
        // Unknown error, reduce health
        await this.accountManager.updateAccount(accountId, {
          healthScore: Math.max(0, account.healthScore - 10)
        });
        action = 'health-reduction';
      }

      // Log recovery action
      await this.db.query(
        `INSERT INTO account_recovery_log (
          account_id, action, error_message, success, metadata
        ) VALUES ($1, $2, $3, $4, $5)`,
        [accountId, action, context.errorMessage, true, JSON.stringify(context.metadata)]
      );

      return {
        action,
        success: true,
        duration: Date.now() - startTime
      };

    } catch (error) {
      logger.error({ accountId, error }, 'Account recovery failed');
      return {
        action: 'failed',
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }
}

/**
 * Task failure recovery strategy
 */
export class TaskRecoveryStrategy implements RecoveryStrategy {
  name = 'task-recovery';
  private db = getDatabase();

  canHandle(context: RecoveryContext): boolean {
    return context.errorType === 'task';
  }

  async execute(context: RecoveryContext): Promise<RecoveryAction> {
    const startTime = Date.now();
    const taskId = context.resourceId;

    if (!taskId) {
      return {
        action: 'skip',
        success: false,
        message: 'No task ID provided'
      };
    }

    logger.info({ taskId }, 'Executing task recovery');

    try {
      // Get task details
      const result = await this.db.query(
        'SELECT * FROM upload_tasks WHERE id = $1',
        [taskId]
      );

      if (result.rows.length === 0) {
        return {
          action: 'skip',
          success: false,
          message: 'Task not found'
        };
      }

      const task = result.rows[0];
      const attemptNumber = context.attemptNumber || 1;

      // Determine if task should be retried
      const shouldRetry = this.shouldRetryTask(context.errorMessage, attemptNumber);

      if (shouldRetry) {
        // Update task for retry
        await this.db.query(
          `UPDATE upload_tasks 
           SET status = 'queued', 
               retry_count = retry_count + 1,
               last_error = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [context.errorMessage, taskId]
        );

        return {
          action: 'retry',
          success: true,
          message: `Task scheduled for retry (attempt ${attemptNumber + 1})`,
          duration: Date.now() - startTime
        };

      } else {
        // Mark task as permanently failed
        await this.db.query(
          `UPDATE upload_tasks 
           SET status = 'failed', 
               error_message = $1,
               failed_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [context.errorMessage, taskId]
        );

        return {
          action: 'fail',
          success: true,
          message: 'Task marked as failed',
          duration: Date.now() - startTime
        };
      }

    } catch (error) {
      logger.error({ taskId, error }, 'Task recovery failed');
      return {
        action: 'failed',
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  private shouldRetryTask(errorMessage: string, attemptNumber: number): boolean {
    // Don't retry if too many attempts
    if (attemptNumber >= 5) {
      return false;
    }

    // Non-retryable error patterns
    const nonRetryablePatterns = [
      /invalid video|corrupt|unsupported format/i,
      /account suspended|terminated/i,
      /quota exceeded|limit reached/i,
      /permission denied|unauthorized/i
    ];

    for (const pattern of nonRetryablePatterns) {
      if (pattern.test(errorMessage)) {
        return false;
      }
    }

    return true;
  }
}

/**
 * Network error recovery strategy
 */
export class NetworkRecoveryStrategy implements RecoveryStrategy {
  name = 'network-recovery';
  private retryDelays = [1000, 5000, 15000, 30000, 60000]; // ms

  canHandle(context: RecoveryContext): boolean {
    return context.errorType === 'network';
  }

  async execute(context: RecoveryContext): Promise<RecoveryAction> {
    const startTime = Date.now();
    const attemptNumber = context.attemptNumber || 1;

    logger.info({ attemptNumber }, 'Executing network recovery');

    // Calculate delay
    const delayIndex = Math.min(attemptNumber - 1, this.retryDelays.length - 1);
    const delay = this.retryDelays[delayIndex];

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, delay));

    return {
      action: 'delay-retry',
      success: true,
      message: `Delayed ${delay}ms before retry`,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Recovery orchestrator
 */
export class RecoveryOrchestrator extends EventEmitter {
  private strategies: RecoveryStrategy[] = [];
  private recoveryHistory: Map<string, RecoveryAction[]> = new Map();

  constructor() {
    super();
  }

  /**
   * Register recovery strategy
   */
  registerStrategy(strategy: RecoveryStrategy): void {
    this.strategies.push(strategy);
    logger.info({ strategy: strategy.name }, 'Recovery strategy registered');
  }

  /**
   * Execute recovery for error
   */
  async executeRecovery(context: RecoveryContext): Promise<RecoveryAction> {
    logger.info({ context }, 'Executing recovery');

    // Find applicable strategy
    const strategy = this.strategies.find(s => s.canHandle(context));

    if (!strategy) {
      logger.warn({ errorType: context.errorType }, 'No recovery strategy found');
      return {
        action: 'no-strategy',
        success: false,
        message: 'No recovery strategy available'
      };
    }

    try {
      // Execute strategy
      const action = await strategy.execute(context);

      // Record history
      const key = `${context.errorType}:${context.resourceId || 'global'}`;
      const history = this.recoveryHistory.get(key) || [];
      history.push(action);
      
      // Keep only last 10 actions
      if (history.length > 10) {
        history.shift();
      }
      
      this.recoveryHistory.set(key, history);

      // Emit event
      this.emit('recovery', {
        context,
        strategy: strategy.name,
        action
      });

      return action;

    } catch (error) {
      logger.error({ strategy: strategy.name, error }, 'Recovery strategy failed');
      
      const failedAction: RecoveryAction = {
        action: 'strategy-error',
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };

      this.emit('recovery-failed', {
        context,
        strategy: strategy.name,
        error
      });

      return failedAction;
    }
  }

  /**
   * Get recovery history
   */
  getHistory(errorType?: string, resourceId?: string): RecoveryAction[] {
    if (errorType && resourceId) {
      const key = `${errorType}:${resourceId}`;
      return this.recoveryHistory.get(key) || [];
    }

    // Return all history
    const allHistory: RecoveryAction[] = [];
    for (const actions of this.recoveryHistory.values()) {
      allHistory.push(...actions);
    }
    return allHistory;
  }

  /**
   * Clear recovery history
   */
  clearHistory(): void {
    this.recoveryHistory.clear();
  }

  /**
   * Get recovery metrics
   */
  getMetrics() {
    const metrics = {
      totalRecoveries: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      byStrategy: {} as Record<string, number>,
      byAction: {} as Record<string, number>
    };

    for (const actions of this.recoveryHistory.values()) {
      for (const action of actions) {
        metrics.totalRecoveries++;
        
        if (action.success) {
          metrics.successfulRecoveries++;
        } else {
          metrics.failedRecoveries++;
        }

        metrics.byAction[action.action] = (metrics.byAction[action.action] || 0) + 1;
      }
    }

    metrics.byStrategy = this.strategies.reduce((acc, strategy) => {
      acc[strategy.name] = 0;
      return acc;
    }, {} as Record<string, number>);

    return metrics;
  }
}