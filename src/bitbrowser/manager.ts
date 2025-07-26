import puppeteer from 'puppeteer-extra';
import { Browser, Page } from 'puppeteer';
import { BitBrowserApiClient } from './api-client';
import { getDatabase } from '../database/connection';
import pino from 'pino';

const logger = pino({
  name: 'bitbrowser-manager',
  level: process.env.LOG_LEVEL || 'info'
});

export interface BitBrowserConfig {
  apiUrl?: string;
  maxRetries?: number;
  retryDelay?: number;
  windowPosition?: { x: number; y: number };
  defaultArgs?: string[];
}

export interface BrowserInstance {
  id: string;
  windowId: string;
  debugUrl: string;
  status: 'idle' | 'busy' | 'error';
  lastActivity: Date;
  errorCount: number;
  uploadCount: number;
  accountId?: string;
  browser?: Browser;
  page?: Page;
}

export class BitBrowserManager {
  private apiClient: BitBrowserApiClient;
  private instances: Map<string, BrowserInstance>;
  private config: BitBrowserConfig;
  private db = getDatabase();

  constructor(config: BitBrowserConfig = {}) {
    this.config = {
      apiUrl: config.apiUrl || 'http://127.0.0.1:54345',
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      windowPosition: config.windowPosition || { x: 1380, y: 400 },
      defaultArgs: config.defaultArgs || ['--disable-blink-features=AutomationControlled'],
      ...config
    };

    this.apiClient = new BitBrowserApiClient({
      apiUrl: this.config.apiUrl!,
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay,
    });

    this.instances = new Map();
  }

  /**
   * Open a browser window
   */
  async openBrowser(windowId: string): Promise<BrowserInstance> {
    logger.info({ windowId }, 'Opening browser instance');

    try {
      // Check if instance already exists
      if (this.instances.has(windowId)) {
        const existing = this.instances.get(windowId)!;
        if (existing.status !== 'error') {
          logger.warn({ windowId }, 'Browser instance already exists');
          return existing;
        }
      }

      // Prepare browser arguments
      const args = [
        `--window-position=${this.config.windowPosition!.x},${this.config.windowPosition!.y}`,
        ...this.config.defaultArgs!
      ];

      // Open browser via BitBrowser API
      const response = await this.apiClient.openBrowser(windowId, args);
      
      if (!response.data?.http) {
        throw new Error('No debug URL returned from BitBrowser');
      }

      const debugUrl = `http://${response.data.http}`;

      // Create browser instance record
      const instance: BrowserInstance = {
        id: windowId,
        windowId,
        debugUrl,
        status: 'idle',
        lastActivity: new Date(),
        errorCount: 0,
        uploadCount: 0,
      };

      // Store instance
      this.instances.set(windowId, instance);

      // Save to database
      await this.saveBrowserInstance(instance);

      // Connect Puppeteer to the browser
      await this.connectPuppeteer(instance);

      logger.info({ windowId, debugUrl }, 'Browser instance opened successfully');
      return instance;

    } catch (error) {
      logger.error({ windowId, error }, 'Failed to open browser instance');
      throw error;
    }
  }

  /**
   * Close a browser window
   */
  async closeBrowser(instanceId: string): Promise<void> {
    logger.info({ instanceId }, 'Closing browser instance');

    try {
      const instance = this.instances.get(instanceId);
      if (!instance) {
        logger.warn({ instanceId }, 'Browser instance not found');
        return;
      }

      // Disconnect Puppeteer
      if (instance.browser) {
        await this.disconnectPuppeteer(instanceId);
      }

      // Close browser via BitBrowser API
      await this.apiClient.closeBrowser(instance.windowId);

      // Remove from instances map
      this.instances.delete(instanceId);

      // Update database
      await this.db.query(
        'UPDATE browser_instances SET status = $1, last_activity = $2 WHERE window_id = $3',
        ['closed', new Date(), instance.windowId]
      );

      logger.info({ instanceId }, 'Browser instance closed successfully');

    } catch (error) {
      logger.error({ instanceId, error }, 'Failed to close browser instance');
      throw error;
    }
  }

  /**
   * List all browser windows
   */
  async listBrowsers(): Promise<BrowserInstance[]> {
    try {
      // Get list from BitBrowser API
      const response = await this.apiClient.listBrowsers();
      
      if (!response.data?.list) {
        return [];
      }

      // Sync with internal state
      const instances: BrowserInstance[] = [];
      
      for (const browserInfo of response.data.list) {
        // Check if we have this instance
        let instance = this.instances.get(browserInfo.id);
        
        if (!instance) {
          // Create instance record for browsers we don't know about
          instance = {
            id: browserInfo.id,
            windowId: browserInfo.id,
            debugUrl: '',
            status: browserInfo.status === 1 ? 'idle' : 'error',
            lastActivity: new Date(),
            errorCount: 0,
            uploadCount: 0,
          };
        }
        
        instances.push(instance);
      }

      return instances;

    } catch (error) {
      logger.error({ error }, 'Failed to list browser instances');
      throw error;
    }
  }

  /**
   * Get browser instance status
   */
  async getBrowserStatus(instanceId: string): Promise<BrowserInstance | null> {
    try {
      const instance = this.instances.get(instanceId);
      if (!instance) {
        return null;
      }

      // Get latest status from BitBrowser API
      const response = await this.apiClient.getBrowserDetail(instance.windowId);
      
      if (response.data) {
        // Update instance status
        instance.status = response.data.status === 1 ? 'idle' : 'error';
        if (response.data.http) {
          instance.debugUrl = `http://${response.data.http}`;
        }
      }

      return instance;

    } catch (error) {
      logger.error({ instanceId, error }, 'Failed to get browser status');
      return null;
    }
  }

  /**
   * Connect Puppeteer to browser instance
   */
  async connectPuppeteer(instance: BrowserInstance): Promise<Browser> {
    logger.info({ instanceId: instance.id, debugUrl: instance.debugUrl }, 'Connecting Puppeteer to browser');

    try {
      // Wait for browser to be ready
      await this.apiClient.waitForBrowserReady(instance.windowId);

      // Connect via CDP
      const browser = await puppeteer.connect({
        browserWSEndpoint: instance.debugUrl.replace('http://', 'ws://') + '/',
        defaultViewport: null,
      });

      // Store browser reference
      instance.browser = browser;

      // Set up disconnect handler
      browser.on('disconnected', () => {
        logger.warn({ instanceId: instance.id }, 'Browser disconnected');
        instance.browser = undefined;
        instance.page = undefined;
        instance.status = 'error';
        instance.errorCount++;
      });

      // Create a page if needed
      const pages = await browser.pages();
      if (pages.length > 0) {
        instance.page = pages[0];
      } else {
        instance.page = await browser.newPage();
      }

      logger.info({ instanceId: instance.id }, 'Puppeteer connected successfully');
      return browser;

    } catch (error) {
      logger.error({ instanceId: instance.id, error }, 'Failed to connect Puppeteer');
      instance.status = 'error';
      instance.errorCount++;
      throw error;
    }
  }

  /**
   * Disconnect Puppeteer from browser instance
   */
  async disconnectPuppeteer(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance || !instance.browser) {
      return;
    }

    try {
      await instance.browser.disconnect();
      instance.browser = undefined;
      instance.page = undefined;
      logger.info({ instanceId }, 'Puppeteer disconnected');
    } catch (error) {
      logger.error({ instanceId, error }, 'Error disconnecting Puppeteer');
    }
  }

  /**
   * Health check for browser instance
   */
  async healthCheck(instanceId: string): Promise<boolean> {
    try {
      const instance = this.instances.get(instanceId);
      if (!instance) {
        return false;
      }

      // Check BitBrowser API
      const response = await this.apiClient.getBrowserDetail(instance.windowId);
      if (!response.success || !response.data || response.data.status !== 1) {
        return false;
      }

      // Check Puppeteer connection
      if (instance.browser) {
        try {
          const version = await instance.browser.version();
          logger.debug({ instanceId, version }, 'Browser health check passed');
          return true;
        } catch {
          return false;
        }
      }

      return true;

    } catch (error) {
      logger.error({ instanceId, error }, 'Health check failed');
      return false;
    }
  }

  /**
   * Restart browser instance
   */
  async restartBrowser(instanceId: string): Promise<BrowserInstance> {
    logger.info({ instanceId }, 'Restarting browser instance');

    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Browser instance ${instanceId} not found`);
    }

    try {
      // Close existing browser
      await this.closeBrowser(instanceId);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Open new browser with same window ID
      return await this.openBrowser(instance.windowId);

    } catch (error) {
      logger.error({ instanceId, error }, 'Failed to restart browser');
      throw error;
    }
  }

  /**
   * Save browser instance to database
   */
  private async saveBrowserInstance(instance: BrowserInstance): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO browser_instances (window_id, debug_url, status, error_count, upload_count, last_activity)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (window_id) DO UPDATE SET
           debug_url = $2,
           status = $3,
           error_count = $4,
           upload_count = $5,
           last_activity = $6`,
        [
          instance.windowId,
          instance.debugUrl,
          instance.status,
          instance.errorCount,
          instance.uploadCount,
          instance.lastActivity
        ]
      );
    } catch (error) {
      logger.error({ error }, 'Failed to save browser instance to database');
    }
  }

  /**
   * Get all active instances
   */
  getActiveInstances(): BrowserInstance[] {
    return Array.from(this.instances.values()).filter(
      instance => instance.status !== 'error'
    );
  }

  /**
   * Get instance by ID
   */
  getInstance(instanceId: string): BrowserInstance | undefined {
    return this.instances.get(instanceId);
  }

  /**
   * Update instance status
   */
  updateInstanceStatus(instanceId: string, status: BrowserInstance['status']): void {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.status = status;
      instance.lastActivity = new Date();
      this.saveBrowserInstance(instance);
    }
  }

  /**
   * Clean up all instances
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up all browser instances');

    const instanceIds = Array.from(this.instances.keys());
    
    for (const instanceId of instanceIds) {
      try {
        await this.closeBrowser(instanceId);
      } catch (error) {
        logger.error({ instanceId, error }, 'Error closing browser during cleanup');
      }
    }

    this.instances.clear();
  }
}