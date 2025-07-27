import axios, { AxiosInstance } from 'axios';
import pino from 'pino';

const logger = pino({
  name: 'bitbrowser-client',
  level: process.env.LOG_LEVEL || 'info'
});

export interface BitBrowserWindow {
  id: string;
  name: string;
}

export interface BitBrowserWindowDetail {
  id: string;
  name: string;
  http?: string;
  status?: string;
}

export interface BitBrowserConfig {
  apiUrl?: string;
  timeout?: number;
}

export class BitBrowserClient {
  private client: AxiosInstance;
  private apiUrl: string;

  constructor(config: BitBrowserConfig = {}) {
    this.apiUrl = config.apiUrl || process.env.BITBROWSER_API_URL || 'http://127.0.0.1:54345';
    
    this.client = axios.create({
      baseURL: this.apiUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    logger.info({ apiUrl: this.apiUrl }, 'BitBrowser client initialized');
  }

  /**
   * List all browser windows
   */
  async listWindows(page: number = 0, pageSize: number = 100): Promise<BitBrowserWindow[]> {
    try {
      logger.debug({ page, pageSize }, 'Listing browser windows');
      
      const response = await this.client.post('/browser/list', {
        page,
        pageSize
      });

      if (!response.data.success) {
        throw new Error(`Failed to list windows: ${response.data.message || 'Unknown error'}`);
      }

      const windows: BitBrowserWindow[] = [];
      const list = response.data.data?.list || [];
      
      for (const window of list) {
        windows.push({
          id: window.id,
          name: window.name
        });
      }

      logger.info({ count: windows.length }, 'Retrieved browser windows');
      return windows;

    } catch (error) {
      logger.error({ error }, 'Failed to list browser windows');
      throw error;
    }
  }

  /**
   * Get window details
   */
  async getWindow(windowId: string): Promise<BitBrowserWindowDetail | null> {
    try {
      logger.debug({ windowId }, 'Getting window details');
      
      const response = await this.client.post('/browser/detail', {
        id: windowId
      });

      if (!response.data.success) {
        throw new Error(`Failed to get window: ${response.data.message || 'Unknown error'}`);
      }

      const data = response.data.data;
      if (!data) {
        return null;
      }

      return {
        id: data.id,
        name: data.name,
        http: data.http,
        status: data.status
      };

    } catch (error) {
      logger.error({ windowId, error }, 'Failed to get window details');
      throw error;
    }
  }

  /**
   * Open a browser window
   */
  async openWindow(windowId: string, args: string[] = []): Promise<string> {
    try {
      logger.info({ windowId, args }, 'Opening browser window');
      
      const response = await this.client.post('/browser/open', {
        id: windowId,
        args: args.length > 0 ? args : ['--window-position=1380,400']
      });

      if (!response.data.success) {
        throw new Error(`Failed to open window: ${response.data.message || 'Unknown error'}`);
      }

      const debugUrl = response.data.data?.http;
      if (!debugUrl) {
        throw new Error('No debug URL returned');
      }

      const fullDebugUrl = `http://${debugUrl}`;
      logger.info({ windowId, debugUrl: fullDebugUrl }, 'Window opened successfully');
      
      return fullDebugUrl;

    } catch (error) {
      logger.error({ windowId, error }, 'Failed to open window');
      throw error;
    }
  }

  /**
   * Close a browser window
   */
  async closeWindow(windowId: string): Promise<void> {
    try {
      logger.info({ windowId }, 'Closing browser window');
      
      const response = await this.client.post('/browser/close', {
        id: windowId
      });

      if (!response.data.success) {
        throw new Error(`Failed to close window: ${response.data.message || 'Unknown error'}`);
      }

      logger.info({ windowId }, 'Window closed successfully');

    } catch (error) {
      logger.error({ windowId, error }, 'Failed to close window');
      throw error;
    }
  }

  /**
   * Find window by name
   */
  async findWindowByName(windowName: string): Promise<BitBrowserWindow | null> {
    try {
      logger.debug({ windowName }, 'Finding window by name');
      
      const windows = await this.listWindows();
      const window = windows.find(w => w.name === windowName);
      
      if (window) {
        logger.info({ windowName, windowId: window.id }, 'Found window');
      } else {
        logger.warn({ windowName }, 'Window not found');
      }
      
      return window || null;

    } catch (error) {
      logger.error({ windowName, error }, 'Failed to find window by name');
      throw error;
    }
  }

  /**
   * Get window ID by name
   */
  async getWindowIdByName(windowName: string): Promise<string | null> {
    try {
      const window = await this.findWindowByName(windowName);
      return window ? window.id : null;
    } catch (error) {
      logger.error({ windowName, error }, 'Failed to get window ID by name');
      return null;
    }
  }

  /**
   * Check if API is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', {
        timeout: 5000
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let bitBrowserClient: BitBrowserClient | null = null;

export function getBitBrowserClient(): BitBrowserClient {
  if (!bitBrowserClient) {
    bitBrowserClient = new BitBrowserClient();
  }
  return bitBrowserClient;
}