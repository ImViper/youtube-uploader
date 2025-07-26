/**
 * Client-side caching utilities
 */

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class CacheManager {
  private cache = new Map<string, CacheItem<any>>();
  private timers = new Map<string, NodeJS.Timeout>();

  /**
   * Set cache item with TTL
   */
  set<T>(key: string, data: T, ttl: number = 300000): void {
    // Default 5 minutes
    // Clear existing timer
    this.clearTimer(key);

    // Set new cache item
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    // Set expiration timer
    if (ttl > 0) {
      const timer = setTimeout(() => {
        this.delete(key);
      }, ttl);
      this.timers.set(key, timer);
    }
  }

  /**
   * Get cache item
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    // Check if expired
    if (item.ttl > 0 && Date.now() - item.timestamp > item.ttl) {
      this.delete(key);
      return null;
    }

    return item.data as T;
  }

  /**
   * Check if cache has valid item
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete cache item
   */
  delete(key: string): void {
    this.cache.delete(key);
    this.clearTimer(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    // Clear all timers
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Clear expired items
   */
  clearExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((item, key) => {
      if (item.ttl > 0 && now - item.timestamp > item.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.delete(key));
  }

  private clearTimer(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }
}

// Singleton instance
export const memoryCache = new CacheManager();

/**
 * Local Storage cache with TTL
 */
export class LocalStorageCache {
  private prefix: string;

  constructor(prefix: string = 'app_cache_') {
    this.prefix = prefix;
  }

  set<T>(key: string, data: T, ttl: number = 3600000): void {
    // Default 1 hour
    const cacheKey = this.prefix + key;
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };

    try {
      localStorage.setItem(cacheKey, JSON.stringify(item));
    } catch (e) {
      console.error('LocalStorage set failed:', e);
      // Handle quota exceeded error
      this.clearOldest();
      try {
        localStorage.setItem(cacheKey, JSON.stringify(item));
      } catch {
        // Still failed, give up
      }
    }
  }

  get<T>(key: string): T | null {
    const cacheKey = this.prefix + key;

    try {
      const itemStr = localStorage.getItem(cacheKey);
      if (!itemStr) return null;

      const item: CacheItem<T> = JSON.parse(itemStr);

      // Check if expired
      if (item.ttl > 0 && Date.now() - item.timestamp > item.ttl) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      return item.data;
    } catch {
      return null;
    }
  }

  delete(key: string): void {
    localStorage.removeItem(this.prefix + key);
  }

  clear(): void {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(this.prefix)) {
        localStorage.removeItem(key);
      }
    });
  }

  clearOldest(): void {
    const items: Array<{ key: string; timestamp: number }> = [];

    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(this.prefix)) {
        try {
          const item = JSON.parse(localStorage.getItem(key) || '{}');
          items.push({ key, timestamp: item.timestamp || 0 });
        } catch {
          // Invalid item, remove it
          localStorage.removeItem(key);
        }
      }
    });

    // Sort by timestamp and remove oldest 25%
    items.sort((a, b) => a.timestamp - b.timestamp);
    const removeCount = Math.ceil(items.length * 0.25);
    items.slice(0, removeCount).forEach(({ key }) => {
      localStorage.removeItem(key);
    });
  }
}

/**
 * Session Storage cache
 */
export const sessionCache = new LocalStorageCache('session_cache_');

/**
 * API Response cache
 */
export class APICache {
  private cache = new LocalStorageCache('api_cache_');

  /**
   * Cache API response
   */
  cacheResponse(url: string, method: string, data: any, ttl?: number): void {
    const key = this.generateKey(url, method);
    this.cache.set(key, data, ttl);
  }

  /**
   * Get cached response
   */
  getCachedResponse(url: string, method: string): any | null {
    const key = this.generateKey(url, method);
    return this.cache.get(key);
  }

  /**
   * Invalidate cache for URL pattern
   */
  invalidatePattern(pattern: string): void {
    Object.keys(localStorage).forEach((key) => {
      if (key.includes(pattern)) {
        localStorage.removeItem(key);
      }
    });
  }

  private generateKey(url: string, method: string): string {
    return `${method}_${url}`;
  }
}

export const apiCache = new APICache();

/**
 * Memoization decorator
 */
export function memoize<T extends (...args: any[]) => any>(fn: T, ttl: number = 60000): T {
  const cache = new Map<string, { result: any; timestamp: number }>();

  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);

    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.result;
    }

    const result = fn(...args);
    cache.set(key, { result, timestamp: Date.now() });

    // Clean up old entries
    if (cache.size > 100) {
      const oldest = Array.from(cache.entries()).sort(
        ([, a], [, b]) => a.timestamp - b.timestamp,
      )[0];
      if (oldest) {
        cache.delete(oldest[0]);
      }
    }

    return result;
  }) as T;
}
