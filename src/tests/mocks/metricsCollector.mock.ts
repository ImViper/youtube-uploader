import { MetricsCollector } from '../../monitoring/metrics';

export const createMockMetricsCollector = (): jest.Mocked<MetricsCollector> => {
  return {
    performHealthChecks: jest.fn().mockResolvedValue([
      {
        service: 'database',
        status: 'healthy',
        message: 'Database connection is healthy',
        details: {},
      },
      {
        service: 'redis',
        status: 'healthy',
        message: 'Redis connection is healthy',
        details: {},
      },
      {
        service: 'queue',
        status: 'healthy',
        message: 'Queue system is operational',
        details: {},
      },
    ]),
    getCurrentMetrics: jest.fn().mockResolvedValue({
      uploads: {
        total24h: 200,
        successful24h: 190,
        failed24h: 10,
        averageDuration: 300,
        throughput: 8.33,
      },
      accounts: {
        total: 50,
        active: 45,
        healthy: 40,
        suspended: 5,
        utilizationRate: 85,
      },
      browsers: {
        total: 10,
        active: 5,
        idle: 4,
        error: 1,
        utilizationRate: 50,
      },
      queue: {
        depth: 15,
        processingRate: 10,
        averageWaitTime: 120,
        backlog: 3,
      },
      resources: {
        memoryUsage: 512,
        cpuUsage: 25,
        redisMemory: 128,
        dbConnections: 10,
      },
      errors: {
        rate24h: 0.05,
        byCategory: { 'upload': 5, 'auth': 3, 'network': 2 },
        topErrors: [
          { message: 'Upload timeout', count: 5 },
          { message: 'Auth failed', count: 3 },
        ],
      },
    }),
    trackUploadSuccess: jest.fn(),
    trackUploadFailure: jest.fn(),
    trackAccountHealth: jest.fn(),
    trackQueueMetrics: jest.fn(),
    trackSystemMetrics: jest.fn(),
    reset: jest.fn(),
    startMetricsCollection: jest.fn(),
    stopMetricsCollection: jest.fn(),
  } as any;
};