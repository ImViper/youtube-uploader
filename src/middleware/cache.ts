import { Request, Response, NextFunction } from 'express';
import { CacheService } from '../cache/cache.service';
import pino from 'pino';
import crypto from 'crypto';

const logger = pino({
  name: 'cache-middleware',
  level: process.env.LOG_LEVEL || 'info'
});

export interface CacheMiddlewareOptions {
  ttl?: number;
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request) => boolean;
  prefix?: string;
}

/**
 * Create cache middleware
 */
export function cacheMiddleware(options: CacheMiddlewareOptions = {}) {
  const cacheService = new CacheService({
    prefix: options.prefix || 'api:',
    ttl: options.ttl || 300
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Check condition if provided
    if (options.condition && !options.condition(req)) {
      return next();
    }

    // Generate cache key
    const cacheKey = options.keyGenerator ? 
      options.keyGenerator(req) : 
      generateDefaultCacheKey(req);

    try {
      // Try to get from cache
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        logger.debug({ cacheKey, path: req.path }, 'Cache hit');
        
        // Set cache headers
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        
        return res.json(cached);
      }

      // Cache miss - intercept response
      logger.debug({ cacheKey, path: req.path }, 'Cache miss');
      
      const originalJson = res.json.bind(res);
      res.json = function(data: any) {
        // Store in cache if successful
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheService.set(cacheKey, data, options.ttl).catch(error => {
            logger.error({ error, cacheKey }, 'Failed to cache response');
          });
        }
        
        // Set cache headers
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Cache-Key', cacheKey);
        
        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error({ error, cacheKey }, 'Cache middleware error');
      next();
    }
  };
}

/**
 * Cache invalidation middleware
 */
export function cacheInvalidation(patterns: string[] | ((req: Request) => string[])) {
  const cacheService = new CacheService({ prefix: 'api:' });

  return async (req: Request, res: Response, next: NextFunction) => {
    // Only invalidate on write operations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }

    const originalJson = res.json.bind(res);
    res.json = function(data: any) {
      // Invalidate cache if successful
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const patternsToInvalidate = typeof patterns === 'function' ? 
          patterns(req) : patterns;

        for (const pattern of patternsToInvalidate) {
          cacheService.clearPattern(pattern).catch(error => {
            logger.error({ error, pattern }, 'Failed to invalidate cache');
          });
        }
      }
      
      return originalJson(data);
    };

    next();
  };
}

/**
 * Generate default cache key
 */
function generateDefaultCacheKey(req: Request): string {
  const parts = [
    req.path,
    JSON.stringify(req.query),
    req.get('Authorization') || 'anonymous'
  ];
  
  const hash = crypto
    .createHash('md5')
    .update(parts.join(':'))
    .digest('hex');
  
  return `${req.path}:${hash}`;
}

/**
 * Common cache configurations
 */
export const cacheConfigs = {
  // Short cache for frequently changing data
  short: { ttl: 60 }, // 1 minute
  
  // Medium cache for moderately changing data
  medium: { ttl: 300 }, // 5 minutes
  
  // Long cache for rarely changing data
  long: { ttl: 3600 }, // 1 hour
  
  // Dashboard metrics
  dashboard: {
    ttl: 30,
    prefix: 'dashboard:',
    condition: (req: Request) => req.path.startsWith('/api/dashboard')
  },
  
  // Account stats
  accountStats: {
    ttl: 60,
    prefix: 'accounts:',
    keyGenerator: (req: Request) => `accounts:stats:${JSON.stringify(req.query)}`
  },
  
  // Task stats
  taskStats: {
    ttl: 30,
    prefix: 'tasks:',
    keyGenerator: (req: Request) => `tasks:stats:${JSON.stringify(req.query)}`
  }
};