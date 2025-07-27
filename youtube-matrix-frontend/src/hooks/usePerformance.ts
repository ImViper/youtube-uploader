import { useEffect, useRef, useCallback, useState } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  componentName: string;
  timestamp: number;
  props?: Record<string, unknown>;
}

interface UsePerformanceOptions {
  enableLogging?: boolean;
  threshold?: number; // Log only if render time exceeds threshold (ms)
  onSlowRender?: (metrics: PerformanceMetrics) => void;
}

/**
 * Hook to measure component render performance
 */
export function usePerformance(componentName: string, options: UsePerformanceOptions = {}) {
  const {
    enableLogging = import.meta.env.DEV,
    threshold = 16, // 16ms = 60fps
    onSlowRender,
  } = options;

  const renderStartTime = useRef<number>(0);
  const renderCount = useRef<number>(0);

  // Mark render start
  renderStartTime.current = performance.now();

  useEffect(() => {
    const renderEndTime = performance.now();
    const renderTime = renderEndTime - renderStartTime.current;
    renderCount.current += 1;

    const metrics: PerformanceMetrics = {
      renderTime,
      componentName,
      timestamp: Date.now(),
    };

    if (enableLogging && renderTime > threshold) {
      console.warn(
        `[Performance] ${componentName} took ${renderTime.toFixed(2)}ms to render (render #${renderCount.current})`,
      );

      if (onSlowRender) {
        onSlowRender(metrics);
      }
    }

    // Report to performance monitoring service
    if (window.performance && window.performance.measure) {
      try {
        performance.mark(`${componentName}-render-end`);
        performance.measure(
          `${componentName}-render`,
          `${componentName}-render-start`,
          `${componentName}-render-end`,
        );
      } catch {
        // Marks may not exist, ignore
      }
    }
  });

  // Mark render start for performance API
  if (window.performance && window.performance.mark) {
    performance.mark(`${componentName}-render-start`);
  }
}

/**
 * Hook to debounce expensive operations
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook to throttle expensive operations
 */
export function useThrottle<T>(value: T, interval: number): T {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastUpdated = useRef<number>(Date.now());

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdated.current;

    if (timeSinceLastUpdate >= interval) {
      lastUpdated.current = now;
      setThrottledValue(value);
    } else {
      const timer = setTimeout(() => {
        lastUpdated.current = Date.now();
        setThrottledValue(value);
      }, interval - timeSinceLastUpdate);

      return () => clearTimeout(timer);
    }
  }, [value, interval]);

  return throttledValue;
}

/**
 * Hook to track component mount/unmount performance
 */
export function useMountPerformance(componentName: string) {
  const mountTime = useRef<number>(0);

  useEffect(() => {
    mountTime.current = performance.now();

    return () => {
      const unmountTime = performance.now();
      const lifetimeMs = unmountTime - mountTime.current;

      if (import.meta.env.DEV) {
        console.log(`[Performance] ${componentName} lifetime: ${lifetimeMs.toFixed(2)}ms`);
      }
    };
  }, [componentName]);
}

/**
 * Hook to measure async operation performance
 */
export function useAsyncPerformance() {
  const measurements = useRef<Map<string, number>>(new Map());

  const startMeasure = useCallback((label: string) => {
    measurements.current.set(label, performance.now());
  }, []);

  const endMeasure = useCallback((label: string, log = true) => {
    const startTime = measurements.current.get(label);
    if (!startTime) {
      console.warn(`No start measurement found for label: ${label}`);
      return 0;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    measurements.current.delete(label);

    if (log && import.meta.env.DEV) {
      console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
    }

    return duration;
  }, []);

  return { startMeasure, endMeasure };
}
