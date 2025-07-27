import express, { Express } from 'express';
import request from 'supertest';
import { createApiV1Routes } from '../../../api/v1/routes';
import { createMockMatrixManager } from '../../../tests/mocks/matrixManager.mock';
import { createMockMetricsCollector } from '../../../tests/mocks/metricsCollector.mock';

// Mock the sub-route modules
jest.mock('../../../api/matrix', () => ({
  createMatrixRoutes: jest.fn(() => {
    const router = require('express').Router();
    router.get('/', (req: any, res: any) => res.json({ matrices: [] }));
    router.post('/', (req: any, res: any) => res.status(201).json({ id: 'matrix-1' }));
    router.get('/:id', (req: any, res: any) => res.json({ id: req.params.id }));
    router.patch('/:id', (req: any, res: any) => res.json({ success: true }));
    router.delete('/:id', (req: any, res: any) => res.json({ success: true }));
    return router;
  }),
}));

jest.mock('../../../api/account', () => ({
  createAccountRoutes: jest.fn(() => {
    const router = require('express').Router();
    router.get('/', (req: any, res: any) => res.json({ accounts: [] }));
    router.post('/', (req: any, res: any) => res.status(201).json({ id: 'account-1' }));
    router.get('/:id', (req: any, res: any) => res.json({ id: req.params.id }));
    router.patch('/:id', (req: any, res: any) => res.json({ success: true }));
    router.delete('/:id', (req: any, res: any) => res.json({ success: true }));
    return router;
  }),
}));

jest.mock('../../../api/task', () => ({
  createTaskRoutes: jest.fn(() => {
    const router = require('express').Router();
    router.get('/', (req: any, res: any) => res.json({ tasks: [] }));
    router.post('/', (req: any, res: any) => res.status(201).json({ id: 'task-1' }));
    router.get('/:id', (req: any, res: any) => res.json({ id: req.params.id }));
    router.patch('/:id', (req: any, res: any) => res.json({ success: true }));
    router.delete('/:id', (req: any, res: any) => res.json({ success: true }));
    return router;
  }),
}));

describe('API V1 Routes', () => {
  let app: Express;
  let mockMatrixManager: ReturnType<typeof createMockMatrixManager>;
  let mockMetricsCollector: ReturnType<typeof createMockMetricsCollector>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create fresh mocks for each test
    mockMatrixManager = createMockMatrixManager();
    mockMetricsCollector = createMockMetricsCollector();

    // Create Express app with routes
    app = express();
    app.use(express.json());
    app.use('/api/v1', createApiV1Routes({
      matrixManager: mockMatrixManager,
      metricsCollector: mockMetricsCollector,
    }));
  });

  describe('Module Integration', () => {
    it('should mount matrix routes at /api/v1/matrices', async () => {
      const response = await request(app).get('/api/v1/matrices');
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ matrices: [] });
    });

    it('should mount account routes at /api/v1/accounts', async () => {
      const response = await request(app).get('/api/v1/accounts');
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ accounts: [] });
    });

    it('should mount task routes at /api/v1/tasks', async () => {
      const response = await request(app).get('/api/v1/tasks');
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ tasks: [] });
    });

    it('should pass matrixManager to matrix routes', () => {
      const { createMatrixRoutes } = require('../../../api/matrix');
      expect(createMatrixRoutes).toHaveBeenCalledWith(mockMatrixManager);
    });

    it('should pass accountManager to account routes', () => {
      const { createAccountRoutes } = require('../../../api/account');
      expect(createAccountRoutes).toHaveBeenCalledWith(mockMatrixManager.getAccountManager());
    });

    it('should pass queueManager to task routes', () => {
      const { createTaskRoutes } = require('../../../api/task');
      expect(createTaskRoutes).toHaveBeenCalledWith(mockMatrixManager.getQueueManager());
    });
  });

  describe('GET /api/v1/health', () => {
    it('should return healthy status when all checks pass', async () => {
      const response = await request(app).get('/api/v1/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        status: 'healthy',
        timestamp: expect.any(String),
        checks: expect.arrayContaining([
          expect.objectContaining({
            service: 'database',
            status: 'healthy',
          }),
          expect.objectContaining({
            service: 'redis',
            status: 'healthy',
          }),
          expect.objectContaining({
            service: 'queue',
            status: 'healthy',
          }),
        ]),
      });
      expect(mockMetricsCollector.performHealthChecks).toHaveBeenCalledTimes(1);
    });

    it('should return unhealthy status with 503 when any check fails', async () => {
      mockMetricsCollector.performHealthChecks.mockResolvedValueOnce([
        {
          service: 'database',
          status: 'healthy',
          message: 'Database connection is healthy',
        },
        {
          service: 'redis',
          status: 'unhealthy',
          message: 'Redis connection failed',
        },
        {
          service: 'queue',
          status: 'degraded',
          message: 'Queue system is slow',
        },
      ]);

      const response = await request(app).get('/api/v1/health');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        success: true,
        status: 'unhealthy',
        timestamp: expect.any(String),
        checks: expect.arrayContaining([
          expect.objectContaining({
            service: 'redis',
            status: 'unhealthy',
          }),
        ]),
      });
    });

    it('should handle health check errors gracefully', async () => {
      mockMetricsCollector.performHealthChecks.mockRejectedValueOnce(new Error('Health check system failure'));

      const response = await request(app).get('/api/v1/health');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        success: false,
        status: 'error',
        message: 'Health check failed',
      });
    });

    it('should not expose sensitive error details', async () => {
      mockMetricsCollector.performHealthChecks.mockRejectedValueOnce(
        new Error('Database password: secret123 is invalid')
      );

      const response = await request(app).get('/api/v1/health');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        success: false,
        status: 'error',
        message: 'Health check failed',
      });
      // Should not contain the actual error message with sensitive data
      expect(response.body.message).not.toContain('secret123');
    });
  });

  describe('GET /api/v1/status', () => {
    it('should return system status successfully', async () => {
      const response = await request(app).get('/api/v1/status');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'running',
          activeAccounts: 5,
          queuedJobs: 10,
          completedJobs: 100,
          failedJobs: 2,
          systemHealth: 'healthy',
          timestamp: expect.any(String),
        },
      });
      expect(mockMatrixManager.getSystemStatus).toHaveBeenCalledTimes(1);
    });

    it('should handle status retrieval errors', async () => {
      mockMatrixManager.getSystemStatus.mockRejectedValueOnce(new Error('Status service unavailable'));

      const response = await request(app).get('/api/v1/status');

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Failed to get system status',
      });
    });

    it('should handle timeout scenarios', async () => {
      // Simulate a timeout by creating a promise that never resolves within the test timeout
      mockMatrixManager.getSystemStatus.mockImplementation(() => 
        new Promise((resolve) => {
          // This will timeout before Jest's timeout
          setTimeout(resolve, 60000);
        })
      );

      await expect(
        request(app)
          .get('/api/v1/status')
          .timeout(1000) // Set a 1 second timeout for the request
      ).rejects.toThrow(/Timeout of 1000ms exceeded/);
    }, 5000); // Set test timeout to 5 seconds
  });

  describe('GET /api/v1/metrics', () => {
    it('should return current metrics successfully', async () => {
      const response = await request(app).get('/api/v1/metrics');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          uploads: expect.objectContaining({
            total24h: expect.any(Number),
            successful24h: expect.any(Number),
            failed24h: expect.any(Number),
            averageDuration: expect.any(Number),
            throughput: expect.any(Number),
          }),
          accounts: expect.any(Object),
          browsers: expect.any(Object),
          queue: expect.any(Object),
          resources: expect.any(Object),
          errors: expect.any(Object),
        },
      });
      expect(mockMetricsCollector.getCurrentMetrics).toHaveBeenCalledTimes(1);
    });

    it('should handle metrics retrieval errors', async () => {
      mockMetricsCollector.getCurrentMetrics.mockRejectedValueOnce(new Error('Metrics collection failed'));

      const response = await request(app).get('/api/v1/metrics');

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Failed to get metrics',
      });
    });

    it('should return partial metrics when some collectors fail', async () => {
      mockMetricsCollector.getCurrentMetrics.mockResolvedValueOnce({
        uploads: {
          total24h: 200,
          successful24h: 180,
          failed24h: 20,
          averageDuration: 250,
          throughput: 8.0,
        },
        accounts: {
          total: 50,
          active: 45,
          healthy: 40,
          suspended: 5,
          utilizationRate: 85,
        },
        browsers: {
          total: 0,
          active: 0,
          idle: 0,
          error: 0,
          utilizationRate: 0,
        },
        queue: {
          depth: 10,
          processingRate: 10,
          averageWaitTime: 100,
          backlog: 2,
        },
        resources: {
          memoryUsage: 0,
          cpuUsage: 0,
          redisMemory: 0,
          dbConnections: 0,
        },
        errors: {
          rate24h: 0.1,
          byCategory: { 'upload': 10, 'auth': 5 },
          topErrors: [],
        },
      });

      const response = await request(app).get('/api/v1/metrics');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.browsers.utilizationRate).toBe(0);
      expect(response.body.data.resources.memoryUsage).toBe(0);
      expect(response.body.data.queue).toBeDefined();
    });
  });

  describe('Response Format Consistency', () => {
    it('should maintain consistent success response format', async () => {
      const healthResponse = await request(app).get('/api/v1/health');
      const statusResponse = await request(app).get('/api/v1/status');
      const metricsResponse = await request(app).get('/api/v1/metrics');

      // All successful responses should have success: true
      expect(healthResponse.body).toHaveProperty('success', true);
      expect(statusResponse.body).toHaveProperty('success', true);
      expect(metricsResponse.body).toHaveProperty('success', true);

      // Status and metrics should wrap data in 'data' property
      expect(statusResponse.body).toHaveProperty('data');
      expect(metricsResponse.body).toHaveProperty('data');
    });

    it('should maintain consistent error response format', async () => {
      mockMatrixManager.getSystemStatus.mockRejectedValueOnce(new Error('Error 1'));
      mockMetricsCollector.getCurrentMetrics.mockRejectedValueOnce(new Error('Error 2'));

      const statusResponse = await request(app).get('/api/v1/status');
      const metricsResponse = await request(app).get('/api/v1/metrics');

      // All error responses should have success: false
      expect(statusResponse.body).toHaveProperty('success', false);
      expect(metricsResponse.body).toHaveProperty('success', false);

      // All error responses should have an error message
      expect(statusResponse.body).toHaveProperty('error');
      expect(metricsResponse.body).toHaveProperty('error');
    });
  });

  describe('Route Not Found', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app).get('/api/v1/non-existent-route');
      expect(response.status).toBe(404);
    });

    it('should handle invalid HTTP methods', async () => {
      // These endpoints only support GET
      const postHealth = await request(app).post('/api/v1/health');
      const putStatus = await request(app).put('/api/v1/status');
      const deleteMetrics = await request(app).delete('/api/v1/metrics');

      expect(postHealth.status).toBe(404);
      expect(putStatus.status).toBe(404);
      expect(deleteMetrics.status).toBe(404);
    });
  });

  describe('Integration with Sub-Routes', () => {
    it('should handle matrix sub-route operations', async () => {
      // Test various matrix endpoints
      const listResponse = await request(app).get('/api/v1/matrices');
      const createResponse = await request(app).post('/api/v1/matrices').send({});
      const getResponse = await request(app).get('/api/v1/matrices/matrix-1');
      const updateResponse = await request(app).patch('/api/v1/matrices/matrix-1').send({});
      const deleteResponse = await request(app).delete('/api/v1/matrices/matrix-1');

      expect(listResponse.status).toBe(200);
      expect(createResponse.status).toBe(201);
      expect(getResponse.status).toBe(200);
      expect(updateResponse.status).toBe(200);
      expect(deleteResponse.status).toBe(200);
    });

    it('should handle account sub-route operations', async () => {
      // Test various account endpoints
      const listResponse = await request(app).get('/api/v1/accounts');
      const createResponse = await request(app).post('/api/v1/accounts').send({});
      const getResponse = await request(app).get('/api/v1/accounts/account-1');
      const updateResponse = await request(app).patch('/api/v1/accounts/account-1').send({});
      const deleteResponse = await request(app).delete('/api/v1/accounts/account-1');

      expect(listResponse.status).toBe(200);
      expect(createResponse.status).toBe(201);
      expect(getResponse.status).toBe(200);
      expect(updateResponse.status).toBe(200);
      expect(deleteResponse.status).toBe(200);
    });

    it('should handle task sub-route operations', async () => {
      // Test various task endpoints
      const listResponse = await request(app).get('/api/v1/tasks');
      const createResponse = await request(app).post('/api/v1/tasks').send({});
      const getResponse = await request(app).get('/api/v1/tasks/task-1');
      const updateResponse = await request(app).patch('/api/v1/tasks/task-1').send({});
      const deleteResponse = await request(app).delete('/api/v1/tasks/task-1');

      expect(listResponse.status).toBe(200);
      expect(createResponse.status).toBe(201);
      expect(getResponse.status).toBe(200);
      expect(updateResponse.status).toBe(200);
      expect(deleteResponse.status).toBe(200);
    });
  });
});