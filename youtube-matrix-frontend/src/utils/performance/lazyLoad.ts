import React, { lazy } from 'react';
import type { LazyExoticComponent, ComponentType } from 'react';

/**
 * Options for lazy loading components
 */
interface LazyLoadOptions {
  delay?: number;
  fallback?: ComponentType<any>;
  preload?: boolean;
}

/**
 * Enhanced lazy loading with retry logic
 */
export function lazyLoadWithRetry<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  options: LazyLoadOptions = {},
): LazyExoticComponent<T> {
  const { delay = 0, preload = false } = options;

  const retryImport = async (retriesLeft = 3): Promise<{ default: T }> => {
    try {
      // Add artificial delay if specified
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      return await importFunc();
    } catch (error) {
      if (retriesLeft > 0) {
        console.warn(`Failed to load component, retrying... (${retriesLeft} retries left)`);
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return retryImport(retriesLeft - 1);
      }
      throw error;
    }
  };

  const LazyComponent = lazy(retryImport);

  // Preload component if specified
  if (preload) {
    retryImport().catch((err) => {
      console.error('Failed to preload component:', err);
    });
  }

  return LazyComponent;
}

/**
 * Preload a lazy component
 */
export function preloadComponent(lazyComponent: LazyExoticComponent<any>): Promise<void> {
  return new Promise((resolve, reject) => {
    const Component = lazyComponent as any;
    if (Component._payload && Component._payload._status === 2) {
      // Already loaded
      resolve();
    } else if (Component._init) {
      Component._init(Component._payload)
        .then(() => resolve())
        .catch(reject);
    } else {
      reject(new Error('Invalid lazy component'));
    }
  });
}

/**
 * Create a map of lazy-loaded routes
 */
export function createLazyRoutes<T extends Record<string, string>>(
  routes: T,
  basePath: string = '@/pages',
): Record<keyof T, LazyExoticComponent<any>> {
  const lazyRoutes: Record<string, LazyExoticComponent<any>> = {};

  Object.entries(routes).forEach(([key, path]) => {
    lazyRoutes[key] = lazyLoadWithRetry(() => import(/* @vite-ignore */ `${basePath}/${path}`));
  });

  return lazyRoutes as Record<keyof T, LazyExoticComponent<any>>;
}

/**
 * Intersection Observer based lazy loading for images
 */
export class LazyImageLoader {
  private observer: IntersectionObserver;
  private loadedImages = new Set<string>();

  constructor(options?: IntersectionObserverInit) {
    this.observer = new IntersectionObserver(this.handleIntersection.bind(this), {
      rootMargin: '50px',
      threshold: 0.01,
      ...options,
    });
  }

  private handleIntersection(entries: IntersectionObserverEntry[]) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        const src = img.dataset.src;

        if (src && !this.loadedImages.has(src)) {
          // Load the image
          const tempImg = new Image();
          tempImg.onload = () => {
            img.src = src;
            img.classList.add('lazy-loaded');
            this.loadedImages.add(src);
          };
          tempImg.src = src;

          // Stop observing this image
          this.observer.unobserve(img);
        }
      }
    });
  }

  observe(element: HTMLImageElement) {
    if (element.dataset.src) {
      this.observer.observe(element);
    }
  }

  unobserve(element: HTMLImageElement) {
    this.observer.unobserve(element);
  }

  disconnect() {
    this.observer.disconnect();
  }
}

/**
 * Hook for lazy loading images
 */
export function useLazyImages(
  containerRef: React.RefObject<HTMLElement>,
  selector: string = 'img[data-src]',
) {
  React.useEffect(() => {
    const loader = new LazyImageLoader();
    const container = containerRef.current;

    if (container) {
      const images = container.querySelectorAll<HTMLImageElement>(selector);
      images.forEach((img) => loader.observe(img));
    }

    return () => {
      loader.disconnect();
    };
  }, [containerRef, selector]);
}
