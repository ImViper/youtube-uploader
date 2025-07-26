/**
 * User activity tracking for better error context
 */

export interface UserAction {
  type: 'click' | 'navigate' | 'input' | 'api' | 'custom';
  category: string;
  action: string;
  label?: string;
  value?: any;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface UserSession {
  id: string;
  userId?: string;
  startTime: string;
  lastActivity: string;
  actions: UserAction[];
  device: {
    type: string;
    os: string;
    browser: string;
    screenResolution: string;
  };
}

class ActivityTracker {
  private session: UserSession;
  private maxActions = 50;
  private enabled = true;
  private trackingHandlers = new Map<string, (...args: unknown[]) => unknown>();

  constructor() {
    this.session = this.initializeSession();
    this.setupTracking();
  }

  /**
   * Initialize session
   */
  private initializeSession(): UserSession {
    const sessionId = this.getOrCreateSessionId();

    return {
      id: sessionId,
      startTime: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      actions: [],
      device: this.getDeviceInfo(),
    };
  }

  /**
   * Get or create session ID
   */
  private getOrCreateSessionId(): string {
    let sessionId = sessionStorage.getItem('activity_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('activity_session_id', sessionId);
    }
    return sessionId;
  }

  /**
   * Get device information
   */
  private getDeviceInfo() {
    const ua = navigator.userAgent;
    const isMobile = /Mobile|Android|iPhone|iPad/.test(ua);

    return {
      type: isMobile ? 'mobile' : 'desktop',
      os: this.detectOS(ua),
      browser: this.detectBrowser(ua),
      screenResolution: `${screen.width}x${screen.height}`,
    };
  }

  /**
   * Detect operating system
   */
  private detectOS(ua: string): string {
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac')) return 'macOS';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iOS')) return 'iOS';
    return 'Unknown';
  }

  /**
   * Detect browser
   */
  private detectBrowser(ua: string): string {
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  /**
   * Track user action
   */
  track(action: Omit<UserAction, 'timestamp'>): void {
    if (!this.enabled) return;

    const fullAction: UserAction = {
      ...action,
      timestamp: new Date().toISOString(),
    };

    this.session.actions.push(fullAction);
    this.session.lastActivity = fullAction.timestamp;

    // Keep only recent actions
    if (this.session.actions.length > this.maxActions) {
      this.session.actions = this.session.actions.slice(-this.maxActions);
    }

    // Update session storage
    this.saveSession();
  }

  /**
   * Track click event
   */
  trackClick(element: HTMLElement, label?: string): void {
    const selector = this.getElementSelector(element);
    const text = element.textContent?.trim().substring(0, 50) || '';

    this.track({
      type: 'click',
      category: 'UI',
      action: 'click',
      label: label || selector,
      metadata: {
        selector,
        text,
        tagName: element.tagName,
      },
    });
  }

  /**
   * Track navigation
   */
  trackNavigation(to: string, from?: string): void {
    this.track({
      type: 'navigate',
      category: 'Navigation',
      action: 'navigate',
      label: to,
      metadata: {
        from: from || window.location.pathname,
        to,
      },
    });
  }

  /**
   * Track API call
   */
  trackAPI(method: string, url: string, status: number, duration: number): void {
    this.track({
      type: 'api',
      category: 'API',
      action: method,
      label: url,
      value: status,
      metadata: {
        duration,
        success: status >= 200 && status < 300,
      },
    });
  }

  /**
   * Track custom action
   */
  trackCustom(category: string, action: string, label?: string, value?: any): void {
    this.track({
      type: 'custom',
      category,
      action,
      label,
      value,
    });
  }

  /**
   * Get element selector
   */
  private getElementSelector(element: HTMLElement): string {
    if (element.id) return `#${element.id}`;
    if (element.className) {
      const classes = element.className
        .split(' ')
        .filter((c) => c)
        .join('.');
      return `${element.tagName.toLowerCase()}.${classes}`;
    }
    return element.tagName.toLowerCase();
  }

  /**
   * Setup automatic tracking
   */
  private setupTracking(): void {
    // Track clicks
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'BUTTON' || target.tagName === 'A') {
        this.trackClick(target);
      }
    });

    // Track page visibility
    document.addEventListener('visibilitychange', () => {
      this.track({
        type: 'custom',
        category: 'Page',
        action: document.hidden ? 'hidden' : 'visible',
      });
    });

    // Track errors
    window.addEventListener('error', (event) => {
      this.track({
        type: 'custom',
        category: 'Error',
        action: 'error',
        label: event.message,
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    });

    // Track unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.track({
        type: 'custom',
        category: 'Error',
        action: 'unhandledRejection',
        label: event.reason?.message || String(event.reason),
      });
    });
  }

  /**
   * Set user ID
   */
  setUser(userId: string): void {
    this.session.userId = userId;
    this.saveSession();
  }

  /**
   * Get current session
   */
  getSession(): UserSession {
    return { ...this.session };
  }

  /**
   * Get recent actions
   */
  getRecentActions(count: number = 10): UserAction[] {
    return this.session.actions.slice(-count);
  }

  /**
   * Clear session
   */
  clearSession(): void {
    sessionStorage.removeItem('activity_session_id');
    sessionStorage.removeItem('activity_session_data');
    this.session = this.initializeSession();
  }

  /**
   * Save session to storage
   */
  private saveSession(): void {
    sessionStorage.setItem('activity_session_data', JSON.stringify(this.session));
  }

  /**
   * Load session from storage
   */
  private loadSession(): void {
    const data = sessionStorage.getItem('activity_session_data');
    if (data) {
      try {
        this.session = JSON.parse(data);
      } catch {
        // Invalid data, reinitialize
        this.session = this.initializeSession();
      }
    }
  }

  /**
   * Enable/disable tracking
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Add custom tracking handler
   */
  addTrackingHandler(name: string, handler: (...args: unknown[]) => unknown): void {
    this.trackingHandlers.set(name, handler);
  }

  /**
   * Remove tracking handler
   */
  removeTrackingHandler(name: string): void {
    this.trackingHandlers.delete(name);
  }

  /**
   * Get session summary
   */
  getSessionSummary() {
    const duration = Date.now() - new Date(this.session.startTime).getTime();
    const actionCounts = this.session.actions.reduce(
      (acc, action) => {
        acc[action.type] = (acc[action.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      sessionId: this.session.id,
      userId: this.session.userId,
      duration: Math.floor(duration / 1000), // seconds
      totalActions: this.session.actions.length,
      actionCounts,
      device: this.session.device,
      lastActivity: this.session.lastActivity,
    };
  }
}

// Export singleton instance
export const activityTracker = new ActivityTracker();

// Auto-save session before unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    activityTracker.track({
      type: 'custom',
      category: 'Session',
      action: 'end',
    });
  });
}
