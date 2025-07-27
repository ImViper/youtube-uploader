import { BitBrowserApiClient } from './api-client';
import pino from 'pino';

const logger = pino({
  name: 'window-matcher',
  level: process.env.LOG_LEVEL || 'info'
});

export interface WindowMapping {
  name: string;
  id: string;
  status?: number;
}

export class WindowMatcher {
  private apiClient: BitBrowserApiClient;
  private windowCache: Map<string, string> = new Map(); // name -> id mapping

  constructor(apiUrl: string = 'http://127.0.0.1:54345') {
    this.apiClient = new BitBrowserApiClient({ apiUrl });
  }

  /**
   * 根据窗口名称获取窗口ID
   * @param windowName 窗口名称
   * @returns 窗口ID，如果未找到则返回null
   */
  async getWindowIdByName(windowName: string): Promise<string | null> {
    // 先检查缓存
    if (this.windowCache.has(windowName)) {
      return this.windowCache.get(windowName)!;
    }

    // 从 BitBrowser 获取窗口列表
    try {
      const response = await this.apiClient.listBrowsers(0, 100);
      if (!response.success || !response.data) {
        logger.error('Failed to list browsers');
        return null;
      }

      // 更新缓存并查找匹配的窗口
      for (const window of response.data.list) {
        this.windowCache.set(window.name, window.id);
        if (window.name === windowName) {
          logger.info({ windowName, windowId: window.id }, 'Found window by name');
          return window.id;
        }
      }

      logger.warn({ windowName }, 'Window not found by name');
      return null;
    } catch (error) {
      logger.error({ error, windowName }, 'Error getting window ID by name');
      return null;
    }
  }

  /**
   * 获取所有窗口映射
   * @returns 窗口名称到ID的映射
   */
  async getAllWindowMappings(): Promise<WindowMapping[]> {
    try {
      const response = await this.apiClient.listBrowsers(0, 100);
      if (!response.success || !response.data) {
        logger.error('Failed to list browsers');
        return [];
      }

      const mappings: WindowMapping[] = [];
      for (const window of response.data.list) {
        this.windowCache.set(window.name, window.id);
        mappings.push({
          name: window.name,
          id: window.id,
          status: window.status
        });
      }

      return mappings;
    } catch (error) {
      logger.error({ error }, 'Error getting all window mappings');
      return [];
    }
  }

  /**
   * 通过名称打开窗口
   * @param windowName 窗口名称
   * @param args 额外的启动参数
   * @returns 调试URL，如果失败则返回null
   */
  async openWindowByName(windowName: string, args?: string[]): Promise<string | null> {
    const windowId = await this.getWindowIdByName(windowName);
    if (!windowId) {
      logger.error({ windowName }, 'Cannot open window: ID not found');
      return null;
    }

    try {
      const response = await this.apiClient.openBrowser(windowId, args);
      if (response.success && response.data) {
        return `http://${response.data.http}`;
      }
      return null;
    } catch (error) {
      logger.error({ error, windowName, windowId }, 'Error opening window');
      return null;
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.windowCache.clear();
  }

  /**
   * 查找包含特定关键词的窗口
   * @param keyword 关键词
   * @returns 匹配的窗口列表
   */
  async findWindowsByKeyword(keyword: string): Promise<WindowMapping[]> {
    const allWindows = await this.getAllWindowMappings();
    const keywordLower = keyword.toLowerCase();
    
    return allWindows.filter(window => 
      window.name.toLowerCase().includes(keywordLower)
    );
  }

  /**
   * 查找YouTube相关窗口
   * @returns YouTube相关窗口列表
   */
  async findYouTubeWindows(): Promise<WindowMapping[]> {
    return this.findWindowsByKeyword('youtube');
  }
}