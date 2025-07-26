import { MatrixManager } from '../src/matrix/manager';
import { ConfigManager } from '../src/config';
import { MetricsCollector } from '../src/monitoring/metrics';
import { CircuitBreakerFactory } from '../src/resilience/circuit-breaker';
import { Video } from '../src/types';
import express from 'express';
import { createApiRoutes } from '../src/api/routes';
import pino from 'pino';

const logger = pino({
  name: 'example-advanced',
  level: 'info',
  transport: {
    target: 'pino-pretty'
  }
});

/**
 * Advanced example with full configuration and monitoring
 */
async function advancedMatrixSetup() {
  // Load configuration from file
  const configManager = new ConfigManager('./config/matrix.json');
  const config = configManager.getConfig();

  // Create matrix manager with configuration
  const matrixManager = new MatrixManager({
    browserPool: config.browserPool,
    queue: config.queue,
    accountSelector: {
      strategy: config.accounts.selectionStrategy,
      minHealthScore: config.accounts.minHealthScore
    },
    monitoring: config.monitoring,
    bitBrowserUrl: config.bitBrowser.apiUrl
  });

  // Create metrics collector
  const metricsCollector = new MetricsCollector(config.monitoring.metricsInterval);

  try {
    // Initialize components
    logger.info('Initializing advanced matrix setup...');
    await matrixManager.initialize();
    metricsCollector.start();

    // Setup circuit breakers for resilience
    const browserCircuit = CircuitBreakerFactory.getBreaker('browser-operations', {
      failureThreshold: 5,
      resetTimeout: 60000,
      successThreshold: 3
    });

    const uploadCircuit = CircuitBreakerFactory.getBreaker('upload-operations', {
      failureThreshold: 3,
      resetTimeout: 120000,
      successThreshold: 2
    });

    // Monitor circuit breaker events
    browserCircuit.on('stateChange', ({ oldState, newState }) => {
      logger.warn({ oldState, newState }, 'Browser circuit breaker state changed');
    });

    uploadCircuit.on('stateChange', ({ oldState, newState }) => {
      logger.warn({ oldState, newState }, 'Upload circuit breaker state changed');
    });

    // Setup API server if enabled
    if (config.api.enabled) {
      const app = express();
      app.use(express.json());

      // Add API routes
      const apiRoutes = createApiRoutes({
        matrixManager,
        metricsCollector
      });
      app.use('/api', apiRoutes);

      // Start server
      const server = app.listen(config.api.port, config.api.host, () => {
        logger.info({
          host: config.api.host,
          port: config.api.port
        }, 'API server started');
      });

      // Graceful shutdown handler
      process.on('SIGTERM', async () => {
        logger.info('Received SIGTERM, shutting down gracefully...');
        server.close();
        await matrixManager.shutdown();
        metricsCollector.stop();
        process.exit(0);
      });
    }

    // Setup account monitoring alerts
    const accountManager = matrixManager.getAccountManager();
    const monitor = accountManager.getMonitor?.();
    
    if (monitor) {
      monitor.on('alert', (alert) => {
        logger.warn({ alert }, 'Account alert received');
        
        // Handle different alert types
        switch (alert.type) {
          case 'health_low':
            logger.warn(`Account ${alert.metadata?.email} health is low: ${alert.metadata?.healthScore}`);
            break;
          case 'limit_reached':
            logger.info(`Account ${alert.metadata?.email} reached daily limit`);
            break;
          case 'suspended':
            logger.error(`Account ${alert.metadata?.email} is suspended`);
            break;
          case 'error_rate_high':
            logger.error(`Account ${alert.metadata?.email} has high error rate: ${alert.metadata?.errorRate}`);
            break;
        }
      });
    }

    // Setup queue monitoring
    const queueManager = matrixManager.getQueueManager();
    
    queueManager.on('jobCompleted', ({ jobId, result }) => {
      logger.info({ jobId, videoId: result.videoId }, 'Upload completed');
    });

    queueManager.on('jobFailed', ({ jobId, reason }) => {
      logger.error({ jobId, reason }, 'Upload failed');
    });

    queueManager.on('jobProgress', ({ jobId, progress }) => {
      logger.debug({ jobId, progress }, 'Upload progress');
    });

    // Setup metrics monitoring
    metricsCollector.on('collected', (metrics) => {
      // Log key metrics
      logger.info({
        uploads: {
          total24h: metrics.uploads.total24h,
          successRate: (metrics.uploads.successful24h / metrics.uploads.total24h * 100).toFixed(2) + '%'
        },
        accounts: {
          healthy: metrics.accounts.healthy,
          total: metrics.accounts.total,
          utilization: metrics.accounts.utilizationRate.toFixed(2) + '%'
        },
        queue: {
          depth: metrics.queue.depth,
          processingRate: metrics.queue.processingRate.toFixed(2) + ' jobs/min'
        }
      }, 'System metrics update');

      // Check for issues
      if (metrics.accounts.healthy < metrics.accounts.total * 0.5) {
        logger.warn('Less than 50% of accounts are healthy');
      }

      if (metrics.queue.backlog > 100) {
        logger.warn(`High queue backlog detected: ${metrics.queue.backlog} jobs`);
      }

      if (metrics.errors.rate24h > 1) {
        logger.warn(`High error rate: ${metrics.errors.rate24h.toFixed(2)} errors/hour`);
      }
    });

    // Example: Upload with circuit breaker protection
    const uploadWithProtection = async (video: Video) => {
      try {
        return await uploadCircuit.execute(async () => {
          return matrixManager.uploadVideo(video, {
            priority: 1,
            metadata: { protected: true }
          });
        });
      } catch (error) {
        logger.error({ error, video: video.title }, 'Protected upload failed');
        throw error;
      }
    };

    // Example: Scheduled uploads
    const scheduleUploads = async () => {
      const videos: Video[] = [
        {
          path: '/videos/morning-video.mp4',
          title: 'Morning Content',
          description: 'Scheduled for morning release',
          tags: ['morning', 'scheduled']
        },
        {
          path: '/videos/evening-video.mp4',
          title: 'Evening Content',
          description: 'Scheduled for evening release',
          tags: ['evening', 'scheduled']
        }
      ];

      // Schedule for specific times
      const morningTime = new Date();
      morningTime.setHours(9, 0, 0, 0); // 9 AM

      const eveningTime = new Date();
      eveningTime.setHours(18, 0, 0, 0); // 6 PM

      await matrixManager.uploadVideo(videos[0], {
        scheduledAt: morningTime,
        priority: 2
      });

      await matrixManager.uploadVideo(videos[1], {
        scheduledAt: eveningTime,
        priority: 2
      });

      logger.info('Scheduled uploads created');
    };

    // Example: Performance tuning
    const performanceTuning = async () => {
      // Adjust rate limits based on time of day
      const hour = new Date().getHours();
      
      if (hour >= 2 && hour <= 6) {
        // Low traffic hours - increase rates
        queueManager.setRateLimit(200, 3600000);
        logger.info('Increased rate limits for low traffic hours');
      } else if (hour >= 18 && hour <= 22) {
        // Peak hours - decrease rates
        queueManager.setRateLimit(50, 3600000);
        logger.info('Decreased rate limits for peak hours');
      }

      // Adjust browser pool based on queue depth
      const stats = await queueManager.getStats();
      const poolStats = matrixManager.getBrowserPool?.().getStats();
      
      if (poolStats && stats.waiting > 20 && poolStats.available === 0) {
        logger.info('High queue depth detected, consider increasing browser pool');
      }
    };

    // Run examples
    await scheduleUploads();
    await performanceTuning();

    // Keep the process running
    logger.info('Advanced matrix setup running. Press Ctrl+C to stop.');

  } catch (error) {
    logger.error({ error }, 'Error in advanced setup');
    throw error;
  }
}

// Run the example
if (require.main === module) {
  advancedMatrixSetup()
    .then(() => {
      logger.info('Advanced setup initialized successfully');
    })
    .catch((error) => {
      logger.error({ error }, 'Advanced setup failed');
      process.exit(1);
    });
}

export { advancedMatrixSetup };