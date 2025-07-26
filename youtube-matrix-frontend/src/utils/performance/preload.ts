/**
 * Resource preloading utilities for performance optimization
 */

interface PreloadOptions {
  as?: 'script' | 'style' | 'image' | 'font' | 'fetch';
  type?: string;
  crossOrigin?: 'anonymous' | 'use-credentials';
  media?: string;
}

/**
 * Preload a resource
 */
export function preloadResource(href: string, options: PreloadOptions = {}): void {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;

  if (options.as) link.as = options.as;
  if (options.type) link.type = options.type;
  if (options.crossOrigin) link.crossOrigin = options.crossOrigin;
  if (options.media) link.media = options.media;

  document.head.appendChild(link);
}

/**
 * Prefetch a resource for future navigation
 */
export function prefetchResource(href: string): void {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  document.head.appendChild(link);
}

/**
 * Preconnect to an origin
 */
export function preconnectOrigin(origin: string, crossOrigin = true): void {
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = origin;
  if (crossOrigin) link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
}

/**
 * DNS prefetch for a domain
 */
export function dnsPrefetch(hostname: string): void {
  const link = document.createElement('link');
  link.rel = 'dns-prefetch';
  link.href = `//${hostname}`;
  document.head.appendChild(link);
}

/**
 * Preload critical resources
 */
export function preloadCriticalResources(): void {
  // Preconnect to API and CDN origins
  preconnectOrigin(window.location.origin, false);
  preconnectOrigin('https://fonts.googleapis.com');
  preconnectOrigin('https://fonts.gstatic.com');

  // DNS prefetch for external services
  dnsPrefetch('www.google-analytics.com');
  dnsPrefetch('cdn.jsdelivr.net');

  // Preload critical fonts
  preloadResource('/fonts/inter-var.woff2', {
    as: 'font',
    type: 'font/woff2',
    crossOrigin: 'anonymous',
  });

  // Preload critical CSS
  const criticalStyles = ['/css/critical.css', '/css/above-the-fold.css'];

  criticalStyles.forEach((style) => {
    preloadResource(style, { as: 'style' });
  });
}

/**
 * Lazy load non-critical CSS
 */
export function loadCSS(href: string, media = 'all'): Promise<void> {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.media = media;

    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));

    document.head.appendChild(link);
  });
}

/**
 * Preload images
 */
export function preloadImages(urls: string[]): Promise<void[]> {
  return Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`Failed to preload image: ${url}`));
          img.src = url;
        }),
    ),
  );
}

/**
 * Resource hints manager
 */
class ResourceHints {
  private addedHints = new Set<string>();

  /**
   * Add resource hint if not already added
   */
  addHint(
    type: 'preload' | 'prefetch' | 'preconnect' | 'dns-prefetch',
    href: string,
    options?: PreloadOptions,
  ): void {
    const key = `${type}:${href}`;
    if (this.addedHints.has(key)) return;

    this.addedHints.add(key);

    switch (type) {
      case 'preload':
        preloadResource(href, options);
        break;
      case 'prefetch':
        prefetchResource(href);
        break;
      case 'preconnect':
        preconnectOrigin(href);
        break;
      case 'dns-prefetch':
        dnsPrefetch(href);
        break;
    }
  }

  /**
   * Remove all hints
   */
  clear(): void {
    const links = document.querySelectorAll(
      'link[rel="preload"], link[rel="prefetch"], link[rel="preconnect"], link[rel="dns-prefetch"]',
    );
    links.forEach((link) => link.remove());
    this.addedHints.clear();
  }
}

export const resourceHints = new ResourceHints();

/**
 * Intersection Observer based resource loading
 */
export class ResourceLoader {
  private observer: IntersectionObserver;
  private loadedResources = new Set<string>();

  constructor(options?: IntersectionObserverInit) {
    this.observer = new IntersectionObserver(this.handleIntersection.bind(this), {
      rootMargin: '50px',
      threshold: 0.01,
      ...options,
    });
  }

  private handleIntersection(entries: IntersectionObserverEntry[]): void {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const element = entry.target as HTMLElement;
        const resource = element.dataset.preload;

        if (resource && !this.loadedResources.has(resource)) {
          this.loadResource(resource, element);
          this.loadedResources.add(resource);
          this.observer.unobserve(element);
        }
      }
    });
  }

  private loadResource(resource: string, element: HTMLElement): void {
    const type = element.dataset.preloadType || 'fetch';

    switch (type) {
      case 'image':
        preloadImages([resource]);
        break;
      case 'style':
        loadCSS(resource);
        break;
      case 'script':
        this.loadScript(resource);
        break;
      default:
        prefetchResource(resource);
    }
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.body.appendChild(script);
    });
  }

  observe(element: HTMLElement): void {
    if (element.dataset.preload) {
      this.observer.observe(element);
    }
  }

  disconnect(): void {
    this.observer.disconnect();
  }
}

/**
 * Service Worker resource caching
 */
export async function cacheResources(resources: string[]): Promise<void> {
  if ('caches' in window) {
    try {
      const cache = await caches.open('v1-resources');
      await cache.addAll(resources);
    } catch (error) {
      console.error('Failed to cache resources:', error);
    }
  }
}
