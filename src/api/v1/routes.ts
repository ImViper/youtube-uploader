import { Router } from 'express';
import { MatrixManager } from '../../matrix/manager';
import { MetricsCollector } from '../../monitoring/metrics';
import { createMatrixRoutes } from '../matrix';
import { createAccountRoutes } from '../account';
import { createTaskRoutes } from '../task';

export interface ApiV1Config {
  matrixManager: MatrixManager;
  metricsCollector: MetricsCollector;
}

export function createApiV1Routes(config: ApiV1Config): Router {
  const router = Router();
  const { matrixManager, metricsCollector } = config;

  // Mount the API modules
  router.use('/matrices', createMatrixRoutes(matrixManager));
  router.use('/accounts', createAccountRoutes(matrixManager.getAccountManager()));
  router.use('/tasks', createTaskRoutes(matrixManager.getQueueManager()));

  // Health check endpoint
  router.get('/health', async (req, res) => {
    try {
      const healthChecks = await metricsCollector.performHealthChecks();
      const allHealthy = healthChecks.every(check => check.status !== 'unhealthy');
      
      res.status(allHealthy ? 200 : 503).json({
        success: true,
        status: allHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date(),
        checks: healthChecks
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        status: 'error',
        message: 'Health check failed'
      });
    }
  });

  // System status endpoint
  router.get('/status', async (req, res) => {
    try {
      const status = await matrixManager.getSystemStatus();
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get system status'
      });
    }
  });

  // Metrics endpoint
  router.get('/metrics', async (req, res) => {
    try {
      const metrics = await metricsCollector.getCurrentMetrics();
      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get metrics'
      });
    }
  });

  return router;
}