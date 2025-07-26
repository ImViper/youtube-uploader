/**
 * Performance optimization configurations and utilities
 */

import { debounce, throttle } from 'lodash';

/**
 * Request Animation Frame throttle
 */
export function rafThrottle<T extends (...args: any[]) => any>(fn: T): T {
  let rafId: number | null = null;
  let lastArgs: any[] = [];

  const throttled = (...args: any[]) => {
    lastArgs = args;

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        fn(...lastArgs);
        rafId = null;
      });
    }
  };

  return throttled as T;
}

/**
 * Idle callback wrapper
 */
export function whenIdle(callback: () => void, timeout = 1000): void {
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(callback, { timeout });
  } else {
    setTimeout(callback, timeout);
  }
}

/**
 * Batch DOM updates
 */
export class DOMBatcher {
  private reads: Array<() => void> = [];
  private writes: Array<() => void> = [];
  private scheduled = false;

  read(fn: () => void): void {
    this.reads.push(fn);
    this.scheduleFlush();
  }

  write(fn: () => void): void {
    this.writes.push(fn);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (!this.scheduled) {
      this.scheduled = true;
      requestAnimationFrame(() => this.flush());
    }
  }

  private flush(): void {
    const reads = [...this.reads];
    const writes = [...this.writes];

    this.reads = [];
    this.writes = [];
    this.scheduled = false;

    // Execute all reads first
    reads.forEach((fn) => fn());
    // Then execute all writes
    writes.forEach((fn) => fn());
  }
}

export const domBatcher = new DOMBatcher();

/**
 * Web Worker manager for offloading heavy computations
 */
export class WorkerManager {
  private workers: Map<string, Worker> = new Map();
  private workerPool: Worker[] = [];
  private maxWorkers = navigator.hardwareConcurrency || 4;

  /**
   * Create or get a worker
   */
  getWorker(name: string, scriptUrl: string): Worker {
    if (!this.workers.has(name)) {
      const worker = new Worker(scriptUrl);
      this.workers.set(name, worker);
      return worker;
    }
    return this.workers.get(name)!;
  }

  /**
   * Execute task in worker pool
   */
  async executeTask<T, R>(task: (data: T) => R, data: T): Promise<R> {
    const worker = this.getAvailableWorker();

    return new Promise((resolve, reject) => {
      const messageHandler = (e: MessageEvent) => {
        if (e.data.error) {
          reject(new Error(e.data.error));
        } else {
          resolve(e.data.result);
        }
        worker.removeEventListener('message', messageHandler);
        this.releaseWorker(worker);
      };

      worker.addEventListener('message', messageHandler);
      worker.postMessage({ task: task.toString(), data });
    });
  }

  private getAvailableWorker(): Worker {
    if (this.workerPool.length < this.maxWorkers) {
      const worker = new Worker('/workers/task-worker.js');
      this.workerPool.push(worker);
      return worker;
    }
    // Return least busy worker (simple round-robin)
    return this.workerPool[Math.floor(Math.random() * this.workerPool.length)];
  }

  private releaseWorker(worker: Worker): void {
    // In a real implementation, track worker usage
  }

  /**
   * Terminate all workers
   */
  terminate(): void {
    this.workers.forEach((worker) => worker.terminate());
    this.workerPool.forEach((worker) => worker.terminate());
    this.workers.clear();
    this.workerPool = [];
  }
}

export const workerManager = new WorkerManager();

/**
 * Performance budget monitoring
 */
export interface PerformanceBudget {
  bundleSize?: number; // in KB
  firstContentfulPaint?: number; // in ms
  timeToInteractive?: number; // in ms
  speedIndex?: number;
}

export class PerformanceMonitor {
  private budget: PerformanceBudget;

  constructor(budget: PerformanceBudget) {
    this.budget = budget;
  }

  /**
   * Check performance metrics against budget
   */
  checkBudget(): { passed: boolean; violations: string[] } {
    const violations: string[] = [];

    if (window.performance && window.performance.getEntriesByType) {
      const navigationTiming = performance.getEntriesByType(
        'navigation',
      )[0] as PerformanceNavigationTiming;

      if (this.budget.firstContentfulPaint) {
        const fcp = this.getFirstContentfulPaint();
        if (fcp && fcp > this.budget.firstContentfulPaint) {
          violations.push(`FCP: ${fcp}ms (budget: ${this.budget.firstContentfulPaint}ms)`);
        }
      }

      if (this.budget.timeToInteractive) {
        const tti = navigationTiming.loadEventEnd - navigationTiming.fetchStart;
        if (tti > this.budget.timeToInteractive) {
          violations.push(`TTI: ${tti}ms (budget: ${this.budget.timeToInteractive}ms)`);
        }
      }
    }

    return {
      passed: violations.length === 0,
      violations,
    };
  }

  private getFirstContentfulPaint(): number | null {
    const paintEntries = performance.getEntriesByType('paint');
    const fcp = paintEntries.find((entry) => entry.name === 'first-contentful-paint');
    return fcp ? fcp.startTime : null;
  }

  /**
   * Log performance metrics
   */
  logMetrics(): void {
    if (!window.performance) return;

    const metrics = {
      navigationTiming: performance.getEntriesByType('navigation')[0],
      paintTiming: performance.getEntriesByType('paint'),
      resources: performance.getEntriesByType('resource').slice(0, 10), // Top 10 resources
    };

    console.table(metrics);
  }
}

/**
 * Optimize list rendering
 */
export const listOptimizations = {
  // Debounced search
  debounceSearch: debounce((searchFn: (query: string) => void, query: string) => {
    searchFn(query);
  }, 300),

  // Throttled scroll
  throttleScroll: throttle((scrollFn: (event: Event) => void, event: Event) => {
    scrollFn(event);
  }, 100),

  // RAF-based animations
  animateOnFrame: rafThrottle((animateFn: () => void) => {
    animateFn();
  }),
};

/**
 * Memory leak prevention
 */
export class MemoryManager {
  private disposables: Array<() => void> = [];

  /**
   * Register a cleanup function
   */
  addDisposable(dispose: () => void): void {
    this.disposables.push(dispose);
  }

  /**
   * Clean up all registered disposables
   */
  dispose(): void {
    this.disposables.forEach((dispose) => {
      try {
        dispose();
      } catch (error) {
        console.error('Error during disposal:', error);
      }
    });
    this.disposables = [];
  }
}

/**
 * Bundle size optimization helpers
 */
export const bundleOptimization = {
  /**
   * Dynamic import with webpack magic comments
   */
  dynamicImport: (module: string, chunkName?: string) => {
    const comment = chunkName ? `/* webpackChunkName: "${chunkName}" */` : '';
    return import(/* @vite-ignore */ `${comment}${module}`);
  },

  /**
   * Tree-shakeable import
   */
  treeShakeableImport: <T>(module: Promise<any>, exportName: string): Promise<T> => {
    return module.then((m) => m[exportName]);
  },
};
