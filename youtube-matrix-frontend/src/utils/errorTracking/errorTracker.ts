export interface ErrorContext {
  tags?: Record<string, string>;
  extra?: Record<string, any>;
}

export const ErrorLevel = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
} as const;

export type ErrorLevelType = typeof ErrorLevel[keyof typeof ErrorLevel];

export interface ErrorReport {
  message: string;
  stack?: string;
  timestamp: string;
  source?: string;
  lineno?: number;
  colno?: number;
  userAgent?: string;
  url?: string;
  extra?: any;
}

export interface ErrorLogEntry extends ErrorReport {
  id: string;
  level: 'error' | 'warning' | 'info';
}

class ErrorTracker {
  captureException(error: Error | unknown, context?: ErrorContext): void {
    // In a real application, this would send errors to a service like Sentry
    // For now, we'll just log to console
    console.error('Error tracked:', error, context);

    // You could integrate with Sentry here:
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, context);
    // }
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    console.log(`[${level.toUpperCase()}]`, message);
  }

  setUser(user: { id: string; email?: string; username?: string }): void {
    console.log('User context set:', user);
  }

  clearUser(): void {
    console.log('User context cleared');
  }
}

export const errorTracker = new ErrorTracker();
