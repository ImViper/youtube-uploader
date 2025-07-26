import { Request, Response, Router } from 'express';
import { MatrixManager } from '../matrix/manager';
import { AccountManager } from '../accounts/manager';
import { QueueManager } from '../queue/manager';
import { MetricsCollector } from '../monitoring/metrics';
import { Video } from '../types';
import pino from 'pino';

const logger = pino({
  name: 'api-routes',
  level: process.env.LOG_LEVEL || 'info'
});

export interface ApiConfig {
  matrixManager: MatrixManager;
  metricsCollector: MetricsCollector;
}

export function createApiRoutes(config: ApiConfig): Router {
  const router = Router();
  const { matrixManager, metricsCollector } = config;

  // Health check
  router.get('/health', async (req: Request, res: Response) => {
    try {
      const healthChecks = await metricsCollector.performHealthChecks();
      const allHealthy = healthChecks.every(check => check.status !== 'unhealthy');
      
      res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date(),
        checks: healthChecks
      });
    } catch (error) {
      logger.error({ error }, 'Health check failed');
      res.status(503).json({
        status: 'error',
        message: 'Health check failed'
      });
    }
  });

  // System status
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const status = await matrixManager.getSystemStatus();
      res.json(status);
    } catch (error) {
      logger.error({ error }, 'Failed to get system status');
      res.status(500).json({
        error: 'Failed to get system status'
      });
    }
  });

  // Metrics endpoint
  router.get('/metrics', async (req: Request, res: Response) => {
    try {
      const metrics = await metricsCollector.getCurrentMetrics();
      res.json(metrics);
    } catch (error) {
      logger.error({ error }, 'Failed to get metrics');
      res.status(500).json({
        error: 'Failed to get metrics'
      });
    }
  });

  // Account management
  router.get('/accounts', async (req: Request, res: Response) => {
    try {
      const accountManager = matrixManager.getAccountManager();
      const filter = {
        status: req.query.status as any,
        minHealthScore: req.query.minHealthScore ? parseInt(req.query.minHealthScore as string) : undefined,
        hasAvailableUploads: req.query.hasAvailableUploads === 'true'
      };
      
      const accounts = await accountManager.listAccounts(filter);
      
      // Remove sensitive data
      const sanitized = accounts.map(account => ({
        id: account.id,
        email: account.email,
        status: account.status,
        healthScore: account.healthScore,
        dailyUploadCount: account.dailyUploadCount,
        dailyUploadLimit: account.dailyUploadLimit,
        lastUploadTime: account.lastUploadTime
      }));
      
      res.json(sanitized);
    } catch (error) {
      logger.error({ error }, 'Failed to list accounts');
      res.status(500).json({
        error: 'Failed to list accounts'
      });
    }
  });

  // Add account
  router.post('/accounts', async (req: Request, res: Response) => {
    try {
      const { email, password, metadata } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({
          error: 'Email and password are required'
        });
      }
      
      const accountManager = matrixManager.getAccountManager();
      const account = await accountManager.addAccount(email, password, metadata);
      
      res.status(201).json({
        id: account.id,
        email: account.email,
        status: account.status,
        healthScore: account.healthScore
      });
    } catch (error) {
      logger.error({ error }, 'Failed to add account');
      res.status(500).json({
        error: 'Failed to add account'
      });
    }
  });

  // Update account
  router.patch('/accounts/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const accountManager = matrixManager.getAccountManager();
      await accountManager.updateAccount(id, updates);
      
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Failed to update account');
      res.status(500).json({
        error: 'Failed to update account'
      });
    }
  });

  // Delete account
  router.delete('/accounts/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const accountManager = matrixManager.getAccountManager();
      await accountManager.removeAccount(id);
      
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Failed to remove account');
      res.status(500).json({
        error: 'Failed to remove account'
      });
    }
  });

  // Queue management
  router.get('/queue/stats', async (req: Request, res: Response) => {
    try {
      const queueManager = matrixManager.getQueueManager();
      const stats = await queueManager.getStats();
      res.json(stats);
    } catch (error) {
      logger.error({ error }, 'Failed to get queue stats');
      res.status(500).json({
        error: 'Failed to get queue stats'
      });
    }
  });

  // Get jobs
  router.get('/queue/jobs', async (req: Request, res: Response) => {
    try {
      const status = req.query.status as any || 'waiting';
      const limit = parseInt(req.query.limit as string) || 100;
      
      const queueManager = matrixManager.getQueueManager();
      const jobs = await queueManager.getJobs(status, limit);
      
      const jobData = jobs.map(job => ({
        id: job.id,
        name: job.name,
        data: job.data,
        opts: job.opts,
        timestamp: job.timestamp,
        attemptsMade: job.attemptsMade,
        progress: job.progress
      }));
      
      res.json(jobData);
    } catch (error) {
      logger.error({ error }, 'Failed to get jobs');
      res.status(500).json({
        error: 'Failed to get jobs'
      });
    }
  });

  // Pause queue
  router.post('/queue/pause', async (req: Request, res: Response) => {
    try {
      await matrixManager.pause();
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Failed to pause queue');
      res.status(500).json({
        error: 'Failed to pause queue'
      });
    }
  });

  // Resume queue
  router.post('/queue/resume', async (req: Request, res: Response) => {
    try {
      await matrixManager.resume();
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Failed to resume queue');
      res.status(500).json({
        error: 'Failed to resume queue'
      });
    }
  });

  // Upload video
  router.post('/upload', async (req: Request, res: Response) => {
    try {
      const { video, priority, accountId, scheduledAt, metadata } = req.body;
      
      if (!video || !video.path) {
        return res.status(400).json({
          error: 'Video path is required'
        });
      }
      
      const result = await matrixManager.uploadVideo(video as Video, {
        priority,
        accountId,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        metadata,
        // Default message transport handlers
        error: (msg: any) => logger.error(msg),
        warn: (msg: any) => logger.warn(msg),
        log: (msg: any) => logger.info(msg),
        debug: (msg: any) => logger.debug(msg),
        userAction: (msg: string) => logger.info({ action: msg }, 'User action')
      });
      
      res.status(201).json(result);
    } catch (error) {
      logger.error({ error }, 'Failed to queue upload');
      res.status(500).json({
        error: 'Failed to queue upload'
      });
    }
  });

  // Batch upload
  router.post('/upload/batch', async (req: Request, res: Response) => {
    try {
      const { videos, priority, accountId, scheduledAt, metadata } = req.body;
      
      if (!videos || !Array.isArray(videos)) {
        return res.status(400).json({
          error: 'Videos array is required'
        });
      }
      
      const results = await matrixManager.batchUpload(videos as Video[], {
        priority,
        accountId,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        metadata,
        // Default message transport handlers
        error: (msg: any) => logger.error(msg),
        warn: (msg: any) => logger.warn(msg),
        log: (msg: any) => logger.info(msg),
        debug: (msg: any) => logger.debug(msg),
        userAction: (msg: string) => logger.info({ action: msg }, 'User action')
      });
      
      res.status(201).json(results);
    } catch (error) {
      logger.error({ error }, 'Failed to queue batch upload');
      res.status(500).json({
        error: 'Failed to queue batch upload'
      });
    }
  });

  // Get task status
  router.get('/tasks/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const status = await matrixManager.getTaskStatus(id);
      
      if (!status) {
        return res.status(404).json({
          error: 'Task not found'
        });
      }
      
      res.json(status);
    } catch (error) {
      logger.error({ error }, 'Failed to get task status');
      res.status(500).json({
        error: 'Failed to get task status'
      });
    }
  });

  // Retry job
  router.post('/queue/jobs/:id/retry', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const queueManager = matrixManager.getQueueManager();
      await queueManager.retryJob(id);
      
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Failed to retry job');
      res.status(500).json({
        error: 'Failed to retry job'
      });
    }
  });

  // Clean old jobs
  router.post('/queue/clean', async (req: Request, res: Response) => {
    try {
      const grace = parseInt(req.body.grace) || 3600000; // 1 hour default
      const queueManager = matrixManager.getQueueManager();
      await queueManager.clean(grace);
      
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Failed to clean queue');
      res.status(500).json({
        error: 'Failed to clean queue'
      });
    }
  });

  // Account stats
  router.get('/accounts/stats', async (req: Request, res: Response) => {
    try {
      const accountManager = matrixManager.getAccountManager();
      const stats = await accountManager.getAccountStats();
      res.json(stats);
    } catch (error) {
      logger.error({ error }, 'Failed to get account stats');
      res.status(500).json({
        error: 'Failed to get account stats'
      });
    }
  });

  // Reset daily limits
  router.post('/accounts/reset-limits', async (req: Request, res: Response) => {
    try {
      const accountManager = matrixManager.getAccountManager();
      await accountManager.resetDailyLimits();
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Failed to reset daily limits');
      res.status(500).json({
        error: 'Failed to reset daily limits'
      });
    }
  });

  return router;
}