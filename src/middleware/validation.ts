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
        req.query = await config.query.parseAsync(req.query) as any;
      }

      // Validate route parameters
      if (config.params) {
        req.params = await config.params.parseAsync(req.params) as any;
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