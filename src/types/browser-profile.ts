/**
 * Browser profile mapping types for BitBrowser integration
 */

export interface BrowserProfileMapping {
  accountEmail: string;
  windowName: string;
  windowId?: string; // Optional, can be fetched from BitBrowser API
  proxy?: ProxyConfig;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol?: 'http' | 'https' | 'socks5';
}

export interface BitBrowserProfile {
  id: string;
  windowId: string;
  windowName: string;
  debugUrl?: string;
  profileData: {
    proxy?: ProxyConfig;
    userAgent?: string;
    [key: string]: any;
  };
  isLoggedIn: boolean;
  isActive: boolean;
  lastHealthCheck?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface WindowStatus {
  windowId: string;
  windowName: string;
  isOpen: boolean;
  isLoggedIn: boolean;
  debugUrl?: string;
  accountEmail?: string;
  lastActivity?: Date;
  errorCount: number;
}