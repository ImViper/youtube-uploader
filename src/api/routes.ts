import { Request, Response, Router } from 'express';
import { MatrixManager } from '../matrix/manager';
import { AccountManager } from '../accounts/manager';
import { QueueManager } from '../queue/manager';
import { MetricsCollector } from '../monitoring/metrics';
import { Video } from '../types';
import browserMappingRoutes from './browser/browser-mapping.routes';
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
      if (!matrixManager) {
        return res.status(503).json({
          error: 'Service not ready. Please try again later.'
        });
      }
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
      if (!metricsCollector) {
        return res.status(503).json({
          error: 'Metrics service not ready. Please try again later.'
        });
      }
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
      if (!matrixManager) {
        return res.status(503).json({
          error: 'Service not ready. Please try again later.'
        });
      }
      
      const accountManager = matrixManager.getAccountManager();
      
      // Pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const search = req.query.search as string;
      const sortBy = req.query.sortBy as string || 'createdAt';
      const sortOrder = req.query.sortOrder as string || 'desc';
      
      const filter = {
        status: req.query.status as any,
        minHealthScore: req.query.minHealthScore ? parseInt(req.query.minHealthScore as string) : undefined,
        hasAvailableUploads: req.query.hasAvailableUploads === 'true'
      };
      
      const accounts = await accountManager.listAccounts(filter);
      
      // Apply search filter
      let filteredAccounts = accounts;
      if (search) {
        filteredAccounts = accounts.filter(account => 
          account.email.toLowerCase().includes(search.toLowerCase())
        );
      }
      
      // Sort accounts
      filteredAccounts.sort((a, b) => {
        let aVal: any, bVal: any;
        switch (sortBy) {
          case 'username':
          case 'email':
            aVal = a.email;
            bVal = b.email;
            break;
          case 'healthScore':
            aVal = a.healthScore;
            bVal = b.healthScore;
            break;
          case 'lastActive':
            aVal = a.lastUploadTime || 0;
            bVal = b.lastUploadTime || 0;
            break;
          default:
            aVal = a.createdAt || 0;
            bVal = b.createdAt || 0;
        }
        
        if (sortOrder === 'asc') {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });
      
      // Apply pagination
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedAccounts = filteredAccounts.slice(startIndex, endIndex);
      
      // Remove sensitive data
      const sanitized = paginatedAccounts.map(account => ({
        id: account.id,
        username: account.email.split('@')[0],
        email: account.email,
        status: account.status,
        healthScore: account.healthScore,
        dailyUploadCount: account.dailyUploadCount,
        dailyUploadLimit: account.dailyUploadLimit,
        lastActive: account.lastUploadTime,
        createdAt: account.createdAt || new Date().toISOString(),
        updatedAt: account.updatedAt || new Date().toISOString(),
        browserWindowName: account.bitbrowserWindowName,
        browserWindowId: account.bitbrowserWindowId,
        isWindowLoggedIn: account.isWindowLoggedIn,
        proxy: account.proxy ? { 
          host: account.proxy.host, 
          port: account.proxy.port 
        } : undefined,
        notes: account.metadata?.notes,
        cookies: account.metadata?.cookies,
        uploadsCount: account.dailyUploadCount || 0,
        successRate: account.healthScore || 100
      }));
      
      res.json({
        items: sanitized,
        total: filteredAccounts.length,
        page,
        pageSize,
        totalPages: Math.ceil(filteredAccounts.length / pageSize)
      });
    } catch (error) {
      logger.error({ error }, 'Failed to list accounts');
      res.status(500).json({
        error: 'Failed to list accounts'
      });
    }
  });
  
  // Account stats - must be before /:id route
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
  
  // Export accounts - must be before /:id route
  router.get('/accounts/export', async (req: Request, res: Response) => {
    try {
      const { format = 'json', ids } = req.query;
      const accountManager = matrixManager.getAccountManager();
      
      // Get accounts to export
      let accounts = await accountManager.listAccounts({});
      
      // Filter by IDs if provided
      if (ids) {
        const idArray = (ids as string).split(',');
        accounts = accounts.filter(account => idArray.includes(account.id));
      }
      
      // Prepare export data
      const exportData = accounts.map(account => ({
        email: account.email,
        password: '***', // Don't export passwords for security
        status: account.status,
        healthScore: account.healthScore,
        dailyUploadLimit: account.dailyUploadLimit,
        proxy: account.proxy ? `${account.proxy.host}:${account.proxy.port}` : '',
        notes: account.metadata?.notes || ''
      }));
      
      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=accounts.json');
        res.json(exportData);
      } else if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=accounts.csv');
        
        // Generate CSV
        const headers = ['email', 'password', 'status', 'healthScore', 'dailyUploadLimit', 'proxy', 'notes'];
        const csv = [
          headers.join(','),
          ...exportData.map(account => 
            headers.map(header => (account as any)[header] || '').join(',')
          )
        ].join('\n');
        
        res.send(csv);
      } else {
        res.status(400).json({
          error: 'Invalid format. Use json or csv'
        });
      }
    } catch (error) {
      logger.error({ error }, 'Failed to export accounts');
      res.status(500).json({
        error: 'Failed to export accounts'
      });
    }
  });
  
  // Get single account
  router.get('/accounts/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const accountManager = matrixManager.getAccountManager();
      const account = await accountManager.getAccount(id);
      
      if (!account) {
        return res.status(404).json({
          error: 'Account not found'
        });
      }
      
      // Remove sensitive data
      const sanitized = {
        id: account.id,
        username: account.email.split('@')[0],
        email: account.email,
        status: account.status,
        healthScore: account.healthScore,
        dailyUploadCount: account.dailyUploadCount,
        dailyUploadLimit: account.dailyUploadLimit,
        lastActive: account.lastUploadTime,
        createdAt: account.createdAt || new Date().toISOString(),
        updatedAt: account.updatedAt || new Date().toISOString(),
        browserWindowName: account.bitbrowserWindowName,
        browserWindowId: account.bitbrowserWindowId,
        isWindowLoggedIn: account.isWindowLoggedIn,
        proxy: account.proxy ? { 
          host: account.proxy.host, 
          port: account.proxy.port 
        } : undefined,
        notes: account.metadata?.notes,
        cookies: account.metadata?.cookies,
        uploadsCount: account.dailyUploadCount || 0,
        successRate: account.healthScore || 100
      };
      
      res.json(sanitized);
    } catch (error) {
      logger.error({ error }, 'Failed to get account');
      res.status(500).json({
        error: 'Failed to get account'
      });
    }
  });

  // Add account
  router.post('/accounts', async (req: Request, res: Response) => {
    try {
      const { username, email, password, browserWindowName, proxy, cookies, notes } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({
          error: 'Email and password are required'
        });
      }
      
      // Prepare metadata
      const metadata: any = {};
      if (notes) metadata.notes = notes;
      if (cookies) metadata.cookies = cookies;
      if (proxy) metadata.proxy = proxy;
      if (browserWindowName) metadata.browserWindowName = browserWindowName;
      
      const accountManager = matrixManager.getAccountManager();
      const account = await accountManager.addAccount(email, password, metadata);
      
      res.status(201).json({
        id: account.id,
        username: email.split('@')[0],
        email: account.email,
        status: account.status,
        healthScore: account.healthScore,
        browserWindowName: account.bitbrowserWindowName,
        browserWindowId: account.bitbrowserWindowId,
        isWindowLoggedIn: account.isWindowLoggedIn
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

  // Batch delete accounts - must be before /:id route
  router.delete('/accounts/batch', async (req: Request, res: Response) => {
    try {
      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          error: 'IDs array is required'
        });
      }
      
      const accountManager = matrixManager.getAccountManager();
      let deletedCount = 0;
      const errors: any[] = [];
      
      for (const id of ids) {
        try {
          await accountManager.removeAccount(id);
          deletedCount++;
        } catch (error) {
          errors.push({ id, error: (error as Error).message });
        }
      }
      
      res.json({
        success: true,
        deletedCount,
        errors
      });
    } catch (error) {
      logger.error({ error }, 'Failed to batch delete accounts');
      res.status(500).json({
        error: 'Failed to batch delete accounts'
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
      if (!matrixManager) {
        return res.status(503).json({
          error: 'Service not ready. Please try again later.'
        });
      }
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
      const grace = req.body?.grace ? parseInt(req.body.grace) : 3600000; // 1 hour default
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
  
  // Import accounts
  router.post('/accounts/import', async (req: Request, res: Response) => {
    try {
      const { format } = req.body;
      const fileData = req.body.data || req.body;
      
      if (!format || !['csv', 'json'].includes(format)) {
        return res.status(400).json({
          error: 'Format must be either csv or json'
        });
      }
      
      const accountManager = matrixManager.getAccountManager();
      let imported = 0;
      let failed = 0;
      const errors: any[] = [];
      
      // Parse data based on format
      let accountsToImport: any[] = [];
      
      if (format === 'json') {
        try {
          accountsToImport = JSON.parse(fileData);
          if (!Array.isArray(accountsToImport)) {
            accountsToImport = [accountsToImport];
          }
        } catch (error) {
          return res.status(400).json({
            error: 'Invalid JSON format'
          });
        }
      } else if (format === 'csv') {
        // Simple CSV parsing (in production, use a proper CSV parser)
        const lines = fileData.split('\n');
        const headers = lines[0].split(',').map((h: string) => h.trim());
        
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          
          const values = lines[i].split(',').map((v: string) => v.trim());
          const account: any = {};
          
          headers.forEach((header: string, index: number) => {
            account[header] = values[index];
          });
          
          accountsToImport.push(account);
        }
      }
      
      // Import accounts
      for (let i = 0; i < accountsToImport.length; i++) {
        const accountData = accountsToImport[i];
        
        try {
          // Validate required fields
          if (!accountData.email || !accountData.password) {
            throw new Error('Email and password are required');
          }
          
          // Parse proxy if provided
          let proxy;
          if (accountData.proxy) {
            if (typeof accountData.proxy === 'string') {
              const [host, port] = accountData.proxy.split(':');
              proxy = { host, port: parseInt(port) };
            } else {
              proxy = accountData.proxy;
            }
          }
          
          await accountManager.addAccount(
            accountData.email,
            accountData.password,
            {
              proxy,
              notes: accountData.notes,
              ...accountData
            }
          );
          imported++;
        } catch (error) {
          failed++;
          errors.push({
            row: i + 1,
            error: (error as Error).message
          });
        }
      }
      
      res.json({
        imported,
        failed,
        errors
      });
    } catch (error) {
      logger.error({ error }, 'Failed to import accounts');
      res.status(500).json({
        error: 'Failed to import accounts'
      });
    }
  });
  
  // Test account
  router.post('/accounts/:id/test', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const accountManager = matrixManager.getAccountManager();
      const account = await accountManager.getAccount(id);
      
      if (!account) {
        return res.status(404).json({
          error: 'Account not found'
        });
      }
      
      // Perform a simple test (in production, this would actually test YouTube login)
      const testResult = await accountManager.testAccount(id);
      
      res.json({
        success: testResult.success,
        error: testResult.error,
        data: {
          success: testResult.success,
          error: testResult.error
        }
      });
    } catch (error) {
      logger.error({ error }, 'Failed to test account');
      res.status(500).json({
        error: 'Failed to test account'
      });
    }
  });

  // Update window login status
  router.patch('/accounts/:id/window-login', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { isLoggedIn } = req.body;
      
      if (typeof isLoggedIn !== 'boolean') {
        return res.status(400).json({
          error: 'isLoggedIn must be a boolean'
        });
      }
      
      const accountManager = matrixManager.getAccountManager();
      await accountManager.updateWindowLoginStatus(id, isLoggedIn);
      
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Failed to update window login status');
      res.status(500).json({
        error: 'Failed to update window login status'
      });
    }
  });

  // Sync BitBrowser windows
  router.post('/accounts/sync-windows', async (req: Request, res: Response) => {
    try {
      const accountManager = matrixManager.getAccountManager();
      await accountManager.syncBitBrowserWindows();
      
      res.json({ success: true, message: 'Windows synced successfully' });
    } catch (error) {
      logger.error({ error }, 'Failed to sync windows');
      res.status(500).json({
        error: 'Failed to sync windows'
      });
    }
  });

  // Mount browser mapping routes
  router.use('/browser', browserMappingRoutes);

  // Add uploads endpoints (map to tasks)
  // This provides compatibility with frontend that expects /uploads
  router.get('/uploads', async (req: Request, res: Response) => {
    try {
      if (!matrixManager) {
        return res.status(503).json({
          error: 'Service not ready. Please try again later.'
        });
      }
      
      const queueManager = matrixManager.getQueueManager();
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const status = req.query.status as string;
      
      // Get tasks from queue - get jobs by different statuses
      const waitingJobs = await queueManager.getJobs('waiting');
      const activeJobs = await queueManager.getJobs('active');
      const completedJobs = await queueManager.getJobs('completed');
      const failedJobs = await queueManager.getJobs('failed');
      
      // Combine all jobs
      const allTasks = [...waitingJobs, ...activeJobs, ...completedJobs, ...failedJobs];
      
      // Filter by status if provided
      let filteredTasks = allTasks;
      if (status && status !== 'all') {
        filteredTasks = allTasks.filter((task: any) => {
          const taskStatus = task.finishedOn ? 'completed' : 
                           task.failedReason ? 'failed' : 
                           task.processedOn ? 'processing' : 'pending';
          return taskStatus === status;
        });
      }
      
      // Sort by created time
      filteredTasks.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
      
      // Paginate
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedTasks = filteredTasks.slice(startIndex, endIndex);
      
      // Map to frontend expected format
      const items = paginatedTasks.map((task: any) => ({
        id: task.id,
        accountId: task.data?.accountId || '',
        title: task.data?.title || 'Untitled',
        description: task.data?.description || '',
        tags: task.data?.tags || [],
        status: task.finishedOn ? 'completed' : 
               task.failedReason ? 'failed' : 
               task.processedOn ? 'processing' : 'pending',
        progress: task.progress || 0,
        videoUrl: task.returnvalue?.videoUrl || '',
        error: task.failedReason || null,
        createdAt: new Date(task.timestamp || Date.now()).toISOString(),
        updatedAt: new Date(task.processedOn || task.timestamp || Date.now()).toISOString(),
        completedAt: task.finishedOn ? new Date(task.finishedOn).toISOString() : null,
        thumbnailUrl: task.data?.thumbnailUrl || '',
        privacy: task.data?.privacy || 'public',
        scheduledAt: task.data?.scheduledAt || null
      }));
      
      res.json({
        items,
        total: filteredTasks.length,
        page,
        pageSize,
        totalPages: Math.ceil(filteredTasks.length / pageSize)
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get uploads');
      res.status(500).json({
        error: 'Failed to get uploads'
      });
    }
  });

  return router;
}