import { EventEmitter } from 'events';
import pino from 'pino';

const logger = pino({
  name: 'circuit-breaker',
  level: process.env.LOG_LEVEL || 'info'
});

export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

export interface CircuitBreakerConfig {
  failureThreshold?: number; // Number of failures before opening
  resetTimeout?: number; // ms to wait before half-open
  successThreshold?: number; // Successes needed to close from half-open
  volumeThreshold?: number; // Minimum calls before evaluating
  timeout?: number; // ms for operation timeout
  rollingWindow?: number; // ms for rolling window stats
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  totalCalls: number;
  errorRate: number;
}

interface CallRecord {
  timestamp: number;
  success: boolean;
  duration: number;
  error?: Error;
}

export class CircuitBreaker extends EventEmitter {
  private config: Required<CircuitBreakerConfig>;
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private nextAttempt?: Date;
  private callHistory: CallRecord[] = [];
  private resetTimer?: NodeJS.Timeout;

  constructor(
    private name: string,
    config: CircuitBreakerConfig = {}
  ) {
    super();
    
    this.config = {
      failureThreshold: config.failureThreshold || 5,
      resetTimeout: config.resetTimeout || 60000, // 1 minute
      successThreshold: config.successThreshold || 3,
      volumeThreshold: config.volumeThreshold || 10,
      timeout: config.timeout || 30000, // 30 seconds
      rollingWindow: config.rollingWindow || 300000 // 5 minutes
    };

    logger.info({ name: this.name, config: this.config }, 'Circuit breaker created');
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (!this.shouldAttemptReset()) {
        throw new Error(`Circuit breaker is OPEN for ${this.name}`);
      }
      // Move to half-open to test
      this.transitionTo(CircuitState.HALF_OPEN);
    }

    const startTime = Date.now();
    
    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(fn);
      
      // Record success
      this.recordSuccess(Date.now() - startTime);
      
      return result;
      
    } catch (error) {
      // Record failure
      this.recordFailure(error as Error, Date.now() - startTime);
      
      // Re-throw the error
      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Operation timeout after ${this.config.timeout}ms`));
        }, this.config.timeout);
      })
    ]);
  }

  /**
   * Record successful call
   */
  private recordSuccess(duration: number): void {
    this.successes++;
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;
    this.lastSuccessTime = new Date();

    // Add to history
    this.addToHistory({
      timestamp: Date.now(),
      success: true,
      duration
    });

    logger.debug({
      circuit: this.name,
      state: this.state,
      consecutiveSuccesses: this.consecutiveSuccesses
    }, 'Operation succeeded');

    // Handle state transitions
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    }

    this.emit('success', { duration });
  }

  /**
   * Record failed call
   */
  private recordFailure(error: Error, duration: number): void {
    this.failures++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = new Date();

    // Add to history
    this.addToHistory({
      timestamp: Date.now(),
      success: false,
      duration,
      error
    });

    logger.warn({
      circuit: this.name,
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      error: error.message
    }, 'Operation failed');

    // Handle state transitions
    if (this.state === CircuitState.CLOSED) {
      if (this.shouldOpen()) {
        this.transitionTo(CircuitState.OPEN);
      }
    } else if (this.state === CircuitState.HALF_OPEN) {
      // Single failure in half-open moves back to open
      this.transitionTo(CircuitState.OPEN);
    }

    this.emit('failure', { error, duration });
  }

  /**
   * Check if circuit should open
   */
  private shouldOpen(): boolean {
    // Check volume threshold
    const recentCalls = this.getRecentCalls();
    if (recentCalls.length < this.config.volumeThreshold) {
      return false;
    }

    // Check consecutive failures
    if (this.consecutiveFailures >= this.config.failureThreshold) {
      return true;
    }

    // Check error rate in rolling window
    const errorRate = this.calculateErrorRate();
    if (errorRate > 0.5) { // 50% error rate
      return true;
    }

    return false;
  }

  /**
   * Check if should attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.nextAttempt) {
      return true;
    }
    return Date.now() >= this.nextAttempt.getTime();
  }

  /**
   * Transition to new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    logger.info({
      circuit: this.name,
      oldState,
      newState,
      stats: this.getStats()
    }, 'Circuit state transition');

    // Handle state-specific logic
    switch (newState) {
      case CircuitState.OPEN:
        // Set next attempt time
        this.nextAttempt = new Date(Date.now() + this.config.resetTimeout);
        this.scheduleReset();
        break;
        
      case CircuitState.HALF_OPEN:
        // Reset consecutive counters for testing
        this.consecutiveFailures = 0;
        this.consecutiveSuccesses = 0;
        this.cancelReset();
        break;
        
      case CircuitState.CLOSED:
        // Reset failure counters
        this.consecutiveFailures = 0;
        this.failures = 0;
        this.nextAttempt = undefined;
        this.cancelReset();
        break;
    }

    this.emit('stateChange', { oldState, newState });
  }

  /**
   * Schedule automatic reset attempt
   */
  private scheduleReset(): void {
    this.cancelReset();
    
    this.resetTimer = setTimeout(() => {
      if (this.state === CircuitState.OPEN) {
        logger.info({ circuit: this.name }, 'Attempting automatic reset to half-open');
        this.transitionTo(CircuitState.HALF_OPEN);
      }
    }, this.config.resetTimeout);
  }

  /**
   * Cancel reset timer
   */
  private cancelReset(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }
  }

  /**
   * Add call to history
   */
  private addToHistory(record: CallRecord): void {
    this.callHistory.push(record);
    
    // Clean old records
    const cutoff = Date.now() - this.config.rollingWindow;
    this.callHistory = this.callHistory.filter(r => r.timestamp > cutoff);
  }

  /**
   * Get recent calls within rolling window
   */
  private getRecentCalls(): CallRecord[] {
    const cutoff = Date.now() - this.config.rollingWindow;
    return this.callHistory.filter(r => r.timestamp > cutoff);
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(): number {
    const recentCalls = this.getRecentCalls();
    if (recentCalls.length === 0) {
      return 0;
    }
    
    const failures = recentCalls.filter(r => !r.success).length;
    return failures / recentCalls.length;
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    const recentCalls = this.getRecentCalls();
    const totalCalls = recentCalls.length;
    const errorRate = this.calculateErrorRate();

    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalCalls,
      errorRate
    };
  }

  /**
   * Force circuit to open
   */
  forceOpen(): void {
    this.transitionTo(CircuitState.OPEN);
  }

  /**
   * Force circuit to close
   */
  forceClose(): void {
    this.transitionTo(CircuitState.CLOSED);
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.failures = 0;
    this.successes = 0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.nextAttempt = undefined;
    this.callHistory = [];
    this.cancelReset();
    this.transitionTo(CircuitState.CLOSED);
    
    logger.info({ circuit: this.name }, 'Circuit breaker reset');
  }

  /**
   * Get metrics for monitoring
   */
  getMetrics() {
    const stats = this.getStats();
    const recentCalls = this.getRecentCalls();
    
    const avgDuration = recentCalls.length > 0
      ? recentCalls.reduce((sum, r) => sum + r.duration, 0) / recentCalls.length
      : 0;

    return {
      name: this.name,
      ...stats,
      averageDuration: avgDuration,
      nextAttempt: this.nextAttempt,
      config: this.config
    };
  }
}

/**
 * Circuit breaker factory for managing multiple breakers
 */
export class CircuitBreakerFactory {
  private static breakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create circuit breaker
   */
  static getBreaker(
    name: string,
    config?: CircuitBreakerConfig
  ): CircuitBreaker {
    let breaker = this.breakers.get(name);
    
    if (!breaker) {
      breaker = new CircuitBreaker(name, config);
      this.breakers.set(name, breaker);
    }
    
    return breaker;
  }

  /**
   * Get all circuit breakers
   */
  static getAllBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  /**
   * Get metrics for all breakers
   */
  static getAllMetrics() {
    const metrics: any[] = [];
    
    for (const [name, breaker] of this.breakers) {
      metrics.push(breaker.getMetrics());
    }
    
    return metrics;
  }

  /**
   * Reset all circuit breakers
   */
  static resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Remove circuit breaker
   */
  static removeBreaker(name: string): void {
    this.breakers.delete(name);
  }
}