import pino from 'pino';
import { getErrorMessage } from '../utils/error-utils';

const logger = pino({
  name: 'bitbrowser-api',
  level: process.env.LOG_LEVEL || 'info'
});

export interface BitBrowserApiConfig {
  apiUrl: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface OpenBrowserRequest {
  id: string;
  args?: string[];
}

export interface OpenBrowserResponse {
  success: boolean;
  data?: {
    http: string;
    ws: string;
  };
  msg?: string;
}

export interface CloseBrowserRequest {
  id: string;
}

export interface CloseBrowserResponse {
  success: boolean;
  msg?: string;
}

export interface BrowserDetailRequest {
  id: string;
}

export interface BrowserDetailResponse {
  success: boolean;
  data?: {
    id: string;
    name: string;
    group_id: string;
    platform: string;
    kernel: string;
    proxy: string;
    user_agent: string;
    http: string;
    ws: string;
    status: number;
  };
  msg?: string;
}

export interface ListBrowsersRequest {
  page?: number;
  pageSize?: number;
}

export interface BrowserListItem {
  id: string;
  name: string;
  group_id: string;
  platform: string;
  kernel: string;
  proxy: string;
  status: number;
}

export interface ListBrowsersResponse {
  success: boolean;
  data?: {
    list: BrowserListItem[];
    total: number;
    page: number;
    pageSize: number;
  };
  msg?: string;
}

export class BitBrowserApiClient {
  private apiUrl: string;
  private timeout: number;
  private maxRetries: number;
  private retryDelay: number;

  constructor(config: BitBrowserApiConfig) {
    this.apiUrl = config.apiUrl || 'http://127.0.0.1:54345';
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  /**
   * Make HTTP request with retry logic
   */
  private async request<T>(
    endpoint: string,
    method: string,
    data?: any,
    attempt: number = 1
  ): Promise<T> {
    const url = `${this.apiUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      logger.debug({
        endpoint,
        method,
        status: response.status,
        success: result.success,
      }, 'BitBrowser API request completed');

      return result;
    } catch (error) {
      clearTimeout(timeoutId);

      // Check if we should retry
      if (attempt < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        logger.warn({
          endpoint,
          attempt,
          maxRetries: this.maxRetries,
          delay,
          error: getErrorMessage(error),
        }, 'BitBrowser API request failed, retrying...');

        await this.sleep(delay);
        return this.request<T>(endpoint, method, data, attempt + 1);
      }

      logger.error({
        endpoint,
        method,
        error: getErrorMessage(error),
        attempts: attempt,
      }, 'BitBrowser API request failed after all retries');

      throw error;
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Open a browser window
   */
  async openBrowser(windowId: string, args?: string[]): Promise<OpenBrowserResponse> {
    logger.info({ windowId, args }, 'Opening BitBrowser window');
    
    const request: OpenBrowserRequest = {
      id: windowId,
      args,
    };

    const response = await this.request<OpenBrowserResponse>(
      '/browser/open',
      'POST',
      request
    );

    if (!response.success) {
      throw new Error(`Failed to open browser: ${response.msg || 'Unknown error'}`);
    }

    return response;
  }

  /**
   * Close a browser window
   */
  async closeBrowser(windowId: string): Promise<CloseBrowserResponse> {
    logger.info({ windowId }, 'Closing BitBrowser window');
    
    const request: CloseBrowserRequest = {
      id: windowId,
    };

    const response = await this.request<CloseBrowserResponse>(
      '/browser/close',
      'POST',
      request
    );

    if (!response.success) {
      throw new Error(`Failed to close browser: ${response.msg || 'Unknown error'}`);
    }

    return response;
  }

  /**
   * Get browser details
   */
  async getBrowserDetail(windowId: string): Promise<BrowserDetailResponse> {
    logger.debug({ windowId }, 'Getting BitBrowser details');
    
    const request: BrowserDetailRequest = {
      id: windowId,
    };

    const response = await this.request<BrowserDetailResponse>(
      '/browser/detail',
      'POST',
      request
    );

    if (!response.success) {
      throw new Error(`Failed to get browser detail: ${response.msg || 'Unknown error'}`);
    }

    return response;
  }

  /**
   * List all browser windows
   */
  async listBrowsers(page: number = 0, pageSize: number = 100): Promise<ListBrowsersResponse> {
    logger.debug({ page, pageSize }, 'Listing BitBrowser windows');
    
    const request: ListBrowsersRequest = {
      page,
      pageSize,
    };

    const response = await this.request<ListBrowsersResponse>(
      '/browser/list',
      'POST',
      request
    );

    if (!response.success) {
      throw new Error(`Failed to list browsers: ${response.msg || 'Unknown error'}`);
    }

    return response;
  }

  /**
   * Check if API is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (error) {
      logger.error('BitBrowser API health check failed', error);
      return false;
    }
  }

  /**
   * Wait for browser to be ready after opening
   */
  async waitForBrowserReady(windowId: string, maxWaitTime: number = 30000): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 1000;

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const detail = await this.getBrowserDetail(windowId);
        if (detail.data && detail.data.http) {
          logger.info({ windowId }, 'Browser is ready');
          return;
        }
      } catch (error) {
        logger.debug({ windowId, error: getErrorMessage(error) }, 'Browser not ready yet');
      }

      await this.sleep(checkInterval);
    }

    throw new Error(`Browser ${windowId} did not become ready within ${maxWaitTime}ms`);
  }
}