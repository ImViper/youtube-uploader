/**
 * Security audit logging utilities
 */

export interface AuditEvent {
  id: string;
  timestamp: string;
  userId: string;
  username: string;
  action: string;
  resource: string;
  resourceId?: string;
  result: 'success' | 'failure';
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  sessionId?: string;
}

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'PASSWORD_CHANGE'
  | 'PERMISSION_DENIED'
  | 'DATA_ACCESS'
  | 'DATA_CREATE'
  | 'DATA_UPDATE'
  | 'DATA_DELETE'
  | 'FILE_UPLOAD'
  | 'FILE_DOWNLOAD'
  | 'SETTINGS_CHANGE'
  | 'SECURITY_ALERT';

class AuditLogger {
  private queue: AuditEvent[] = [];
  private batchSize = 10;
  private flushInterval = 5000; // 5 seconds
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startFlushTimer();
  }

  /**
   * Log an audit event
   */
  log(event: Omit<AuditEvent, 'id' | 'timestamp'>): void {
    const auditEvent: AuditEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      sessionId: this.getSessionId(),
    };

    this.queue.push(auditEvent);

    // Flush immediately for critical events
    if (this.isCriticalEvent(event.action)) {
      this.flush();
    } else if (this.queue.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * Log a successful action
   */
  logSuccess(
    userId: string,
    username: string,
    action: string,
    resource: string,
    resourceId?: string,
    metadata?: Record<string, any>,
  ): void {
    this.log({
      userId,
      username,
      action,
      resource,
      resourceId,
      result: 'success',
      metadata,
    });
  }

  /**
   * Log a failed action
   */
  logFailure(
    userId: string,
    username: string,
    action: string,
    resource: string,
    resourceId?: string,
    metadata?: Record<string, any>,
  ): void {
    this.log({
      userId,
      username,
      action,
      resource,
      resourceId,
      result: 'failure',
      metadata,
    });
  }

  /**
   * Log security-related events
   */
  logSecurityEvent(
    action: AuditAction,
    userId: string,
    username: string,
    metadata?: Record<string, any>,
  ): void {
    this.log({
      userId,
      username,
      action,
      resource: 'security',
      result: 'success',
      metadata: {
        ...metadata,
        severity: this.getEventSeverity(action),
      },
    });
  }

  /**
   * Flush queued events to the server
   */
  private async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const events = [...this.queue];
    this.queue = [];

    try {
      await this.sendToServer(events);
    } catch (error) {
      // Re-queue events on failure
      this.queue = [...events, ...this.queue];
      console.error('Failed to send audit logs:', error);
    }
  }

  /**
   * Send events to the server
   */
  private async sendToServer(events: AuditEvent[]): Promise<void> {
    const response = await fetch('/api/audit/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ events }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send audit logs: ${response.statusText}`);
    }
  }

  /**
   * Start the flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Stop the flush timer
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush(); // Final flush
  }

  /**
   * Generate a unique event ID
   */
  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get the current session ID
   */
  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('audit_session_id');
    if (!sessionId) {
      sessionId = this.generateEventId();
      sessionStorage.setItem('audit_session_id', sessionId);
    }
    return sessionId;
  }

  /**
   * Check if an event is critical and should be flushed immediately
   */
  private isCriticalEvent(action: string): boolean {
    const criticalActions = [
      'LOGIN_FAILED',
      'PERMISSION_DENIED',
      'SECURITY_ALERT',
      'DATA_DELETE',
      'SETTINGS_CHANGE',
    ];
    return criticalActions.includes(action);
  }

  /**
   * Get event severity level
   */
  private getEventSeverity(action: AuditAction): 'low' | 'medium' | 'high' | 'critical' {
    const severityMap: Record<AuditAction, 'low' | 'medium' | 'high' | 'critical'> = {
      LOGIN: 'low',
      LOGOUT: 'low',
      LOGIN_FAILED: 'high',
      PASSWORD_CHANGE: 'medium',
      PERMISSION_DENIED: 'high',
      DATA_ACCESS: 'low',
      DATA_CREATE: 'low',
      DATA_UPDATE: 'medium',
      DATA_DELETE: 'high',
      FILE_UPLOAD: 'medium',
      FILE_DOWNLOAD: 'low',
      SETTINGS_CHANGE: 'high',
      SECURITY_ALERT: 'critical',
    };
    return severityMap[action] || 'low';
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();

// Cleanup on window unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    auditLogger.destroy();
  });
}
