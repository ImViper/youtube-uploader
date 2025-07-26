/**
 * Security headers configuration
 */

export interface SecurityHeaders {
  [key: string]: string;
}

/**
 * Get Content Security Policy directives
 */
export const getCSPDirectives = (): string => {
  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' wss: https:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ];

  return directives.join('; ');
};

/**
 * Get all security headers
 */
export const getSecurityHeaders = (): SecurityHeaders => {
  return {
    'Content-Security-Policy': getCSPDirectives(),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  };
};

/**
 * Apply security headers to HTML meta tags
 */
export const applySecurityMetaTags = (): void => {
  const head = document.head;

  // CSP meta tag
  const cspMeta = document.createElement('meta');
  cspMeta.httpEquiv = 'Content-Security-Policy';
  cspMeta.content = getCSPDirectives();
  head.appendChild(cspMeta);

  // Other security meta tags
  const securityMetas = [
    { httpEquiv: 'X-Content-Type-Options', content: 'nosniff' },
    { httpEquiv: 'X-Frame-Options', content: 'DENY' },
    { httpEquiv: 'X-XSS-Protection', content: '1; mode=block' },
  ];

  securityMetas.forEach(({ httpEquiv, content }) => {
    const meta = document.createElement('meta');
    meta.httpEquiv = httpEquiv;
    meta.content = content;
    head.appendChild(meta);
  });
};

/**
 * Validate origin for CORS
 */
export const isValidOrigin = (origin: string, allowedOrigins: string[]): boolean => {
  try {
    const url = new URL(origin);
    return allowedOrigins.some((allowed) => {
      if (allowed === '*') return true;
      if (allowed.startsWith('*.')) {
        const domain = allowed.slice(2);
        return url.hostname.endsWith(domain);
      }
      return url.origin === allowed;
    });
  } catch {
    return false;
  }
};

/**
 * Generate nonce for inline scripts
 */
export const generateNonce = (): string => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
};
