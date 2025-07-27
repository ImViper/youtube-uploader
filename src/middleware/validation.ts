import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import pino from 'pino';

const logger = pino({
  name: 'validation-middleware',
  level: process.env.LOG_LEVEL || 'info'
});

export interface ValidationConfig {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Create a validation middleware for Express routes
 * @param config - Validation configuration with schemas for body, query, and params
 */
export function validate(config: ValidationConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      if (config.body) {
        req.body = await config.body.parseAsync(req.body);
      }

      // Validate query parameters
      if (config.query) {
        const validatedQuery = await config.query.parseAsync(req.query) as Record<string, any>;
        
        // Store validated query in multiple ways for compatibility
        // 1. Custom property (recommended)
        (req as any).validatedQuery = validatedQuery;
        
        // 2. Merge into req object for easier access
        (req as any).validatedData = {
          ...(req as any).validatedData,
          query: validatedQuery
        };
        
        // 3. Try to override query if possible (for backward compatibility)
        try {
          // This might fail in some Express versions
          (req as any).query = validatedQuery;
        } catch (e) {
          // Silently ignore if read-only
        }
      }

      // Validate route parameters
      if (config.params) {
        const validatedParams = await config.params.parseAsync(req.params) as any;
        req.params = validatedParams;
        
        // Also store in validatedData
        (req as any).validatedData = {
          ...(req as any).validatedData,
          params: validatedParams
        };
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn({ 
          error: error.issues,
          path: req.path,
          method: req.method 
        }, 'Validation failed');

        return res.status(400).json({
          error: 'Validation failed',
          details: error.issues.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        });
      }

      logger.error({ 
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error,
        path: req.path,
        method: req.method,
        body: req.body,
        query: req.query,
        params: req.params
      }, 'Unexpected error in validation middleware');
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
}

/**
 * Custom validation rules for specific business logic
 */
/**
 * Helper function to get validated query parameters
 * Handles different Express versions and validation middleware implementations
 */
export function getValidatedQuery(req: Request): Record<string, any> {
  // Priority order:
  // 1. Check validatedQuery property (new implementation)
  if ((req as any).validatedQuery) {
    return (req as any).validatedQuery;
  }
  
  // 2. Check validatedData.query (alternative implementation)
  if ((req as any).validatedData?.query) {
    return (req as any).validatedData.query;
  }
  
  // 3. Fallback to original query (unvalidated)
  return req.query as any;
}

/**
 * Helper function to get validated params
 */
export function getValidatedParams(req: Request): Record<string, any> {
  if ((req as any).validatedData?.params) {
    return (req as any).validatedData.params;
  }
  return req.params;
}

/**
 * Helper function to get all validated data
 */
export function getValidatedData(req: Request): {
  body?: any;
  query?: Record<string, any>;
  params?: Record<string, any>;
} {
  return {
    body: req.body,
    query: getValidatedQuery(req),
    params: getValidatedParams(req)
  };
}

export const customValidators = {
  /**
   * Validate YouTube video title
   */
  youtubeTitle: (title: string): boolean => {
    // YouTube title must be between 1 and 100 characters
    if (title.length < 1 || title.length > 100) {
      return false;
    }
    // Check for prohibited characters or patterns
    const prohibitedPatterns = [
      /<[^>]*>/g,  // HTML tags
      /[\x00-\x1F\x7F]/g  // Control characters
    ];
    return !prohibitedPatterns.some(pattern => pattern.test(title));
  },

  /**
   * Validate YouTube video description
   */
  youtubeDescription: (description: string): boolean => {
    // YouTube description has a 5000 character limit
    return description.length <= 5000;
  },

  /**
   * Validate YouTube tags
   */
  youtubeTags: (tags: string[]): boolean => {
    // Maximum 15 tags
    if (tags.length > 15) {
      return false;
    }
    // Each tag should be less than 30 characters
    return tags.every(tag => tag.length > 0 && tag.length <= 30);
  },

  /**
   * Validate proxy configuration
   */
  proxyConfig: (proxy: any): boolean => {
    if (!proxy.host || !proxy.port) {
      return false;
    }
    // Validate port range
    return proxy.port > 0 && proxy.port <= 65535;
  },

  /**
   * Validate cron expression
   */
  cronExpression: (expr: string): boolean => {
    // Simple cron validation (can be enhanced)
    const cronRegex = /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/;
    return cronRegex.test(expr);
  }
};