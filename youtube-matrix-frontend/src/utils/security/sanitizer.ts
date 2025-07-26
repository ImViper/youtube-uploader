import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export const sanitizeHTML = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'span', 'p', 'br'],
    ALLOWED_ATTR: ['class', 'style'],
  });
};

/**
 * Sanitize user input for display
 */
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
};

/**
 * Sanitize filename to prevent directory traversal
 */
export const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace invalid chars with underscore
    .replace(/\.{2,}/g, '.') // Remove multiple dots
    .replace(/^\.+/, '') // Remove leading dots
    .replace(/\.+$/, ''); // Remove trailing dots
};

/**
 * Sanitize URL to prevent open redirect vulnerabilities
 */
export const sanitizeURL = (url: string): string => {
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
};

/**
 * Validate and sanitize email address
 */
export const sanitizeEmail = (email: string): string => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const cleaned = email.toLowerCase().trim();
  return emailRegex.test(cleaned) ? cleaned : '';
};

/**
 * Escape special characters for regex
 */
export const escapeRegExp = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Sanitize JSON string to prevent injection
 */
export const sanitizeJSON = (jsonString: string): string => {
  try {
    const parsed = JSON.parse(jsonString);
    return JSON.stringify(parsed);
  } catch {
    return '{}';
  }
};

/**
 * Create a sanitized object by removing dangerous properties
 */
export const sanitizeObject = <T extends Record<string, any>>(
  obj: T,
  allowedKeys: string[],
): Partial<T> => {
  const sanitized: Partial<T> = {};

  for (const key of allowedKeys) {
    if (key in obj) {
      const value = obj[key];
      if (typeof value === 'string') {
        sanitized[key as keyof T] = sanitizeInput(value) as T[keyof T];
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        sanitized[key as keyof T] = sanitizeObject(value, Object.keys(value)) as T[keyof T];
      } else {
        sanitized[key as keyof T] = value;
      }
    }
  }

  return sanitized;
};

/**
 * Rate limit key generator for preventing brute force
 */
export const generateRateLimitKey = (identifier: string, action: string): string => {
  return `rate_limit:${action}:${identifier}`;
};

/**
 * Mask sensitive data for logging
 */
export const maskSensitiveData = (data: string, visibleChars = 4): string => {
  if (data.length <= visibleChars * 2) {
    return '*'.repeat(data.length);
  }

  const start = data.slice(0, visibleChars);
  const end = data.slice(-visibleChars);
  const masked = '*'.repeat(Math.max(data.length - visibleChars * 2, 3));

  return `${start}${masked}${end}`;
};
