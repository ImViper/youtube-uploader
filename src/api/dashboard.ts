import { Request, Response, Router } from 'express';
import { MatrixManager } from '../matrix/manager';
import { MetricsCollector } from '../monitoring/metrics';
import { cacheMiddleware, cacheInvalidation, cacheConfigs } from '../middleware/cache';
import pino from 'pino';

const logger = pino({
  name: 'dashboard-api',
  level: process.env.LOG_LEVEL || 'info'
});

export interface DashboardConfig {
  matrixManager: MatrixManager;
  metricsCollector: MetricsCollector;
}

// Alert storage (in production, use database)
interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  metadata?: Record<string, any>;
}

const alerts: Alert[] = [];

export function createDashboardRoutes(config: DashboardConfig): Router {
  const router = Router();
  const { matrixManager, metricsCollector } = config;

  // Get dashboard metrics with caching
  router.get('/metrics', cacheMiddleware(cacheConfigs.dashboard), async (req: Request, res: Response) => {
    try {
      // Get real metrics from services
      const accountManager = matrixManager?.getAccountManager();
      const queueManager = matrixManager?.getQueueManager();
      
      let accountStats = {
        total: 0,
        active: 0,
        disabled: 0,
        error: 0
      };
      
      let queueStats = {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0
      };
      
      // Try to get real stats
      try {
        if (accountManager) {
          accountStats = await accountManager.getAccountStats();
        }
      } catch (error) {
        logger.warn({ error }, 'Failed to get account stats');
      }
      
      try {
        if (queueManager) {
          queueStats = await queueManager.getStats();
        }
      } catch (error) {
        logger.warn({ error }, 'Failed to get queue stats');
      }
      
      // Get system metrics
      let systemMetrics = {
        cpuUsage: 0,
        memoryUsage: 0,
        uptime: process.uptime()
      };
      
      try {
        if (metricsCollector) {
          const currentMetrics = await metricsCollector.getCurrentMetrics();
          systemMetrics = {
            cpuUsage: currentMetrics?.resources?.cpuUsage || 0,
            memoryUsage: currentMetrics?.resources?.memoryUsage || 0,
            uptime: process.uptime()
          };
        }
      } catch (error) {
        logger.warn({ error }, 'Failed to get system metrics');
      }
      
      // Calculate derived metrics
      const totalUploads = queueStats.completed + queueStats.failed;
      const uploadSuccessRate = totalUploads > 0 
        ? (queueStats.completed / totalUploads) * 100 
        : 0;
      
      // Generate hourly upload data for the last 24 hours
      const uploadsLast24Hours = Array.from({ length: 24 }, (_, i) => ({
        hour: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
        count: Math.floor(Math.random() * 20) // Mock data, replace with real data
      }));
      
      // Calculate upload distribution
      const uploadDistribution = [
        { 
          status: 'successful', 
          count: queueStats.completed, 
          percentage: totalUploads > 0 ? (queueStats.completed / totalUploads) * 100 : 0 
        },
        { 
          status: 'failed', 
          count: queueStats.failed, 
          percentage: totalUploads > 0 ? (queueStats.failed / totalUploads) * 100 : 0 
        },
        { 
          status: 'queued', 
          count: queueStats.waiting, 
          percentage: 0 // Queued items don't count towards total 
        }
      ];
      
      res.json({
        totalAccounts: accountStats.total,
        activeAccounts: accountStats.active,
        totalUploads,
        successfulUploads: queueStats.completed,
        failedUploads: queueStats.failed,
        queuedUploads: queueStats.waiting,
        uploadSuccessRate,
        averageUploadTime: 125.5, // Mock, calculate from actual data
        systemLoad: systemMetrics.cpuUsage,
        memoryUsage: systemMetrics.memoryUsage,
        uploadsLast24Hours,
        uploadDistribution
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get dashboard metrics');
      res.status(500).json({
        error: 'Failed to get dashboard metrics'
      });
    }
  });

  // Get alerts
  router.get('/alerts', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const unacknowledged = req.query.unacknowledged === 'true';
      
      let filteredAlerts = alerts;
      
      if (unacknowledged) {
        filteredAlerts = alerts.filter(alert => !alert.acknowledged);
      }
      
      // Sort by timestamp descending
      filteredAlerts.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      // Apply limit
      const paginatedAlerts = filteredAlerts.slice(0, limit);
      
      res.json({
        alerts: paginatedAlerts,
        unacknowledgedCount: alerts.filter(a => !a.acknowledged).length
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get alerts');
      res.status(500).json({
        error: 'Failed to get alerts'
      });
    }
  });

  // Acknowledge alert
  router.post('/alerts/:id/acknowledge', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const alert = alerts.find(a => a.id === id);
      
      if (!alert) {
        return res.status(404).json({
          error: 'Alert not found'
        });
      }
      
      alert.acknowledged = true;
      res.json(alert);
    } catch (error) {
      logger.error({ error }, 'Failed to acknowledge alert');
      res.status(500).json({
        error: 'Failed to acknowledge alert'
      });
    }
  });

  // Dismiss alert
  router.delete('/alerts/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const index = alerts.findIndex(a => a.id === id);
      
      if (index === -1) {
        return res.status(404).json({
          error: 'Alert not found'
        });
      }
      
      alerts.splice(index, 1);
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Failed to dismiss alert');
      res.status(500).json({
        error: 'Failed to dismiss alert'
      });
    }
  });

  // Batch acknowledge alerts
  router.post('/alerts/batch/acknowledge', async (req: Request, res: Response) => {
    try {
      const { ids } = req.body;
      
      if (!Array.isArray(ids)) {
        return res.status(400).json({
          error: 'IDs must be an array'
        });
      }
      
      let acknowledgedCount = 0;
      
      for (const id of ids) {
        const alert = alerts.find(a => a.id === id);
        if (alert) {
          alert.acknowledged = true;
          acknowledgedCount++;
        }
      }
      
      res.json({ 
        success: true,
        acknowledgedCount
      });
    } catch (error) {
      logger.error({ error }, 'Failed to batch acknowledge alerts');
      res.status(500).json({
        error: 'Failed to batch acknowledge alerts'
      });
    }
  });

  // Create alert (internal use) with cache invalidation
  router.post('/alerts', cacheInvalidation(['alerts:*']), async (req: Request, res: Response) => {
    try {
      const { type, title, message, metadata } = req.body;
      
      if (!type || !title || !message) {
        return res.status(400).json({
          error: 'Type, title, and message are required'
        });
      }
      
      const alert: Alert = {
        id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        title,
        message,
        timestamp: new Date().toISOString(),
        acknowledged: false,
        metadata
      };
      
      alerts.push(alert);
      
      // Keep only last 1000 alerts
      if (alerts.length > 1000) {
        alerts.splice(0, alerts.length - 1000);
      }
      
      res.status(201).json(alert);
    } catch (error) {
      logger.error({ error }, 'Failed to create alert');
      res.status(500).json({
        error: 'Failed to create alert'
      });
    }
  });

  // Get overview statistics with caching
  router.get('/stats/overview', cacheMiddleware({ ttl: 60, prefix: 'dashboard:stats:' }), async (req: Request, res: Response) => {
    try {
      const accountManager = matrixManager?.getAccountManager();
      const queueManager = matrixManager?.getQueueManager();
      
      let stats = {
        accounts: {
          total: 0,
          active: 0,
          disabled: 0,
          error: 0
        },
        tasks: {
          total: 0,
          queued: 0,
          processing: 0,
          completed: 0,
          failed: 0
        },
        uploads: {
          today: 0,
          thisWeek: 0,
          thisMonth: 0,
          total: 0
        },
        performance: {
          avgUploadTime: 0,
          successRate: 0,
          errorRate: 0
        }
      };
      
      // Get account statistics
      if (accountManager) {
        try {
          const accountStats = await accountManager.getAccountStats();
          stats.accounts = accountStats;
        } catch (error) {
          logger.warn({ error }, 'Failed to get account stats');
        }
      }
      
      // Get task/queue statistics
      if (queueManager) {
        try {
          const queueStats = await queueManager.getStats();
          stats.tasks = {
            total: queueStats.waiting + queueStats.active + queueStats.completed + queueStats.failed,
            queued: queueStats.waiting,
            processing: queueStats.active,
            completed: queueStats.completed,
            failed: queueStats.failed
          };
          
          // Calculate performance metrics
          const totalProcessed = queueStats.completed + queueStats.failed;
          if (totalProcessed > 0) {
            stats.performance.successRate = (queueStats.completed / totalProcessed) * 100;
            stats.performance.errorRate = (queueStats.failed / totalProcessed) * 100;
          }
        } catch (error) {
          logger.warn({ error }, 'Failed to get queue stats');
        }
      }
      
      // TODO: Get actual upload counts from database
      stats.uploads.total = stats.tasks.completed;
      stats.uploads.today = Math.floor(stats.tasks.completed * 0.1);
      stats.uploads.thisWeek = Math.floor(stats.tasks.completed * 0.3);
      stats.uploads.thisMonth = Math.floor(stats.tasks.completed * 0.7);
      
      res.json(stats);
    } catch (error) {
      logger.error({ error }, 'Failed to get overview statistics');
      res.status(500).json({
        error: 'Failed to get overview statistics'
      });
    }
  });

  // Get task statistics with caching
  router.get('/stats/tasks', cacheMiddleware(cacheConfigs.taskStats), async (req: Request, res: Response) => {
    try {
      const queueManager = matrixManager?.getQueueManager();
      const timeRange = req.query.range as string || '24h';
      
      let taskStats = {
        summary: {
          total: 0,
          byStatus: {
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0,
            delayed: 0
          }
        },
        timeline: [] as Array<{ time: string; waiting: number; active: number; completed: number; failed: number }>,
        byPriority: {
          high: 0,
          normal: 0,
          low: 0
        },
        averageProcessingTime: 0,
        throughput: {
          perMinute: 0,
          perHour: 0,
          perDay: 0
        }
      };
      
      if (queueManager) {
        try {
          const stats = await queueManager.getStats();
          taskStats.summary.byStatus = {
            waiting: stats.waiting,
            active: stats.active,
            completed: stats.completed,
            failed: stats.failed,
            delayed: stats.delayed || 0
          };
          taskStats.summary.total = Object.values(taskStats.summary.byStatus).reduce((a, b) => a + b, 0);
          
          // Generate timeline data based on time range
          const hours = timeRange === '7d' ? 168 : timeRange === '30d' ? 720 : 24;
          const interval = hours > 168 ? 24 : hours > 24 ? 4 : 1;
          
          for (let i = 0; i < hours; i += interval) {
            taskStats.timeline.push({
              time: new Date(Date.now() - (hours - i) * 3600000).toISOString(),
              waiting: Math.floor(Math.random() * 20),
              active: Math.floor(Math.random() * 5),
              completed: Math.floor(Math.random() * 50),
              failed: Math.floor(Math.random() * 5)
            });
          }
          
          // Calculate throughput
          if (stats.completed > 0) {
            taskStats.throughput.perDay = stats.completed;
            taskStats.throughput.perHour = Math.floor(stats.completed / 24);
            taskStats.throughput.perMinute = Math.floor(stats.completed / 1440);
          }
        } catch (error) {
          logger.warn({ error }, 'Failed to get queue stats');
        }
      }
      
      res.json(taskStats);
    } catch (error) {
      logger.error({ error }, 'Failed to get task statistics');
      res.status(500).json({
        error: 'Failed to get task statistics'
      });
    }
  });

  // Get account statistics with caching
  router.get('/stats/accounts', cacheMiddleware(cacheConfigs.accountStats), async (req: Request, res: Response) => {
    try {
      const accountManager = matrixManager?.getAccountManager();
      
      let accountStats = {
        summary: {
          total: 0,
          byStatus: {
            active: 0,
            disabled: 0,
            error: 0,
            cooldown: 0
          }
        },
        health: {
          excellent: 0,  // > 80
          good: 0,       // 60-80
          fair: 0,       // 40-60
          poor: 0        // < 40
        },
        activity: [] as Array<{ accountId: string; email: string; uploads: number; lastActive: string; healthScore: number }>,
        performance: {
          avgHealthScore: 0,
          avgUploadsPerAccount: 0,
          mostActive: null as any
        }
      };
      
      if (accountManager) {
        try {
          const stats = await accountManager.getAccountStats();
          accountStats.summary.byStatus = {
            active: stats.active,
            disabled: stats.disabled,
            error: stats.error,
            cooldown: 0  // TODO: implement cooldown status
          };
          accountStats.summary.total = stats.total;
          
          // Get all accounts for detailed stats
          const accounts = await accountManager.listAccounts();
          
          let totalHealthScore = 0;
          let totalUploads = 0;
          
          for (const account of accounts) {
            // Categorize by health score
            if (account.healthScore > 80) accountStats.health.excellent++;
            else if (account.healthScore > 60) accountStats.health.good++;
            else if (account.healthScore > 40) accountStats.health.fair++;
            else accountStats.health.poor++;
            
            totalHealthScore += account.healthScore;
            totalUploads += account.dailyUploadCount;
            
            // Add to activity list
            accountStats.activity.push({
              accountId: account.id,
              email: account.email,
              uploads: account.dailyUploadCount,
              lastActive: account.lastUploadTime?.toISOString() || 'Never',
              healthScore: account.healthScore
            });
          }
          
          // Sort by uploads and get top 10
          accountStats.activity.sort((a, b) => b.uploads - a.uploads);
          accountStats.activity = accountStats.activity.slice(0, 10);
          
          // Calculate averages
          if (accounts.length > 0) {
            accountStats.performance.avgHealthScore = totalHealthScore / accounts.length;
            accountStats.performance.avgUploadsPerAccount = totalUploads / accounts.length;
            accountStats.performance.mostActive = accountStats.activity[0] || null;
          }
        } catch (error) {
          logger.warn({ error }, 'Failed to get account stats');
        }
      }
      
      res.json(accountStats);
    } catch (error) {
      logger.error({ error }, 'Failed to get account statistics');
      res.status(500).json({
        error: 'Failed to get account statistics'
      });
    }
  });

  // Get performance metrics with caching
  router.get('/stats/performance', cacheMiddleware({ ttl: 30, prefix: 'dashboard:perf:' }), async (req: Request, res: Response) => {
    try {
      const timeRange = req.query.range as string || '1h';
      
      let performanceStats = {
        system: {
          cpu: {
            current: 0,
            average: 0,
            peak: 0
          },
          memory: {
            current: 0,
            average: 0,
            peak: 0,
            total: 0
          },
          uptime: process.uptime()
        },
        uploads: {
          avgProcessingTime: 0,
          successRate: 0,
          errorRate: 0,
          throughput: {
            current: 0,
            average: 0,
            peak: 0
          }
        },
        timeline: [] as Array<{ time: string; cpu: number; memory: number; throughput: number }>
      };
      
      // Get system metrics if available
      if (metricsCollector) {
        try {
          const currentMetrics = await metricsCollector.getCurrentMetrics();
          const historicalMetrics = await metricsCollector.getHistoricalMetrics(timeRange);
          
          performanceStats.system.cpu.current = currentMetrics?.resources?.cpuUsage || 0;
          performanceStats.system.memory.current = currentMetrics?.resources?.memoryUsage || 0;
          
          // Calculate averages and peaks from historical data
          if (historicalMetrics && historicalMetrics.length > 0) {
            let totalCpu = 0;
            let totalMemory = 0;
            let peakCpu = 0;
            let peakMemory = 0;
            
            for (const metric of historicalMetrics) {
              totalCpu += metric.resources?.cpuUsage || 0;
              totalMemory += metric.resources?.memoryUsage || 0;
              peakCpu = Math.max(peakCpu, metric.resources?.cpuUsage || 0);
              peakMemory = Math.max(peakMemory, metric.resources?.memoryUsage || 0);
            }
            
            performanceStats.system.cpu.average = totalCpu / historicalMetrics.length;
            performanceStats.system.cpu.peak = peakCpu;
            performanceStats.system.memory.average = totalMemory / historicalMetrics.length;
            performanceStats.system.memory.peak = peakMemory;
          }
        } catch (error) {
          logger.warn({ error }, 'Failed to get metrics');
        }
      }
      
      // Generate timeline data
      const hours = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 1;
      const interval = hours > 24 ? 4 : hours > 1 ? 1 : 0.25;
      
      for (let i = 0; i < hours; i += interval) {
        performanceStats.timeline.push({
          time: new Date(Date.now() - (hours - i) * 3600000).toISOString(),
          cpu: Math.random() * 100,
          memory: Math.random() * 100,
          throughput: Math.floor(Math.random() * 10)
        });
      }
      
      res.json(performanceStats);
    } catch (error) {
      logger.error({ error }, 'Failed to get performance metrics');
      res.status(500).json({
        error: 'Failed to get performance metrics'
      });
    }
  });

  // Get time series data for charts with caching
  router.get('/charts/timeseries', cacheMiddleware({ ttl: 120, prefix: 'dashboard:charts:' }), async (req: Request, res: Response) => {
    try {
      const metric = req.query.metric as string || 'uploads';
      const range = req.query.range as string || '24h';
      const interval = req.query.interval as string || 'auto';
      
      let data = {
        metric,
        range,
        interval: interval === 'auto' ? (range === '24h' ? '1h' : range === '7d' ? '6h' : '1d') : interval,
        series: [] as Array<{ time: string; value: number }>
      };
      
      // Generate sample data based on metric type
      const hours = range === '7d' ? 168 : range === '30d' ? 720 : 24;
      const step = interval === 'auto' ? (hours > 168 ? 24 : hours > 24 ? 6 : 1) : parseInt(interval);
      
      for (let i = 0; i < hours; i += step) {
        const time = new Date(Date.now() - (hours - i) * 3600000);
        let value = 0;
        
        switch (metric) {
          case 'uploads':
            value = Math.floor(Math.random() * 50) + 10;
            break;
          case 'accounts':
            value = Math.floor(Math.random() * 5) + 20;
            break;
          case 'cpu':
            value = Math.random() * 100;
            break;
          case 'memory':
            value = Math.random() * 100;
            break;
          case 'errors':
            value = Math.floor(Math.random() * 10);
            break;
        }
        
        data.series.push({
          time: time.toISOString(),
          value
        });
      }
      
      res.json(data);
    } catch (error) {
      logger.error({ error }, 'Failed to get time series data');
      res.status(500).json({
        error: 'Failed to get time series data'
      });
    }
  });

  // Get distribution statistics with caching
  router.get('/charts/distribution', cacheMiddleware({ ttl: 120, prefix: 'dashboard:charts:' }), async (req: Request, res: Response) => {
    try {
      const type = req.query.type as string || 'uploads';
      
      let distribution = {
        type,
        data: [] as Array<{ label: string; value: number; percentage: number }>
      };
      
      switch (type) {
        case 'uploads':
          distribution.data = [
            { label: 'Successful', value: 850, percentage: 85 },
            { label: 'Failed', value: 100, percentage: 10 },
            { label: 'Cancelled', value: 50, percentage: 5 }
          ];
          break;
        case 'accounts':
          distribution.data = [
            { label: 'Active', value: 15, percentage: 60 },
            { label: 'Idle', value: 5, percentage: 20 },
            { label: 'Error', value: 3, percentage: 12 },
            { label: 'Disabled', value: 2, percentage: 8 }
          ];
          break;
        case 'tasks':
          distribution.data = [
            { label: 'Queued', value: 25, percentage: 25 },
            { label: 'Processing', value: 10, percentage: 10 },
            { label: 'Completed', value: 60, percentage: 60 },
            { label: 'Failed', value: 5, percentage: 5 }
          ];
          break;
      }
      
      res.json(distribution);
    } catch (error) {
      logger.error({ error }, 'Failed to get distribution data');
      res.status(500).json({
        error: 'Failed to get distribution data'
      });
    }
  });

  // Get trend analysis with caching
  router.get('/charts/trends', cacheMiddleware({ ttl: 300, prefix: 'dashboard:trends:' }), async (req: Request, res: Response) => {
    try {
      const metrics = (req.query.metrics as string || 'uploads,errors').split(',');
      const range = req.query.range as string || '7d';
      
      let trends = {
        range,
        metrics: {} as Record<string, { current: number; previous: number; change: number; trend: 'up' | 'down' | 'stable' }>
      };
      
      // Calculate trends for each metric
      for (const metric of metrics) {
        const current = Math.floor(Math.random() * 1000);
        const previous = Math.floor(Math.random() * 1000);
        const change = ((current - previous) / previous) * 100;
        
        trends.metrics[metric] = {
          current,
          previous,
          change: Math.round(change * 10) / 10,
          trend: change > 5 ? 'up' : change < -5 ? 'down' : 'stable'
        };
      }
      
      res.json(trends);
    } catch (error) {
      logger.error({ error }, 'Failed to get trend analysis');
      res.status(500).json({
        error: 'Failed to get trend analysis'
      });
    }
  });

  return router;
}

// Helper function to create system alerts
export function createSystemAlert(
  type: 'error' | 'warning' | 'info',
  title: string,
  message: string,
  metadata?: Record<string, any>
) {
  const alert: Alert = {
    id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    title,
    message,
    timestamp: new Date().toISOString(),
    acknowledged: false,
    metadata
  };
  
  alerts.push(alert);
  
  // Keep only last 1000 alerts
  if (alerts.length > 1000) {
    alerts.splice(0, alerts.length - 1000);
  }
  
  logger.info({ alert }, 'System alert created');
}