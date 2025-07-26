import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import pino from 'pino';
import { createApiRoutes } from './api/routes';
import { createAuthRoutes, authenticateToken } from './api/auth';
import { createDashboardRoutes } from './api/dashboard';
import { initializeWebSocket } from './api/websocket';
import { MatrixManager } from './matrix/manager';
import { MatrixManagerLite } from './matrix/manager-lite';
import { MetricsCollector } from './monitoring/metrics';
import { initializeDatabase } from './database/init';
import { getRedis } from './redis/connection';

const logger = pino({
  name: 'server',
  level: process.env.LOG_LEVEL || 'info'
});

async function startServer() {
  try {
    // Create Express app first
    const app = express();
    const port = process.env.PORT || 5989;
    
    // Initialize services first (blocking)
    logger.info('Initializing services...');
    
    // Initialize database first
    try {
      await initializeDatabase();
      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize database');
      // Database is critical, so we should exit if it fails
      process.exit(1);
    }

    // Initialize Redis connection
    try {
      const redis = getRedis();
      await redis.connect();
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error 
      }, 'Failed to connect to Redis');
      // Redis is critical for queue operations, exit on failure
      process.exit(1);
    }
    
    let matrixManager: MatrixManager | MatrixManagerLite | null = null;
    let metricsCollector: MetricsCollector | null = null;
    
    // Initialize services synchronously
    try {
      // Try to initialize full MatrixManager first
      matrixManager = new MatrixManager();
      await matrixManager.initialize();
      logger.info('MatrixManager initialized successfully');
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error 
      }, 'Failed to initialize MatrixManager');
      // MatrixManager is critical, exit on failure
      process.exit(1);
    }
    
    try {
      metricsCollector = new MetricsCollector();
      metricsCollector.start();
      logger.info('MetricsCollector started successfully');
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack
        } : error 
      }, 'Failed to start MetricsCollector');
      // MetricsCollector is critical for monitoring, exit on failure
      process.exit(1);
    }
    
    // Middleware
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Health check (no auth required)
    app.get('/api/health', async (req, res) => {
      res.json({ status: 'ok', timestamp: new Date() });
    });
    
    // Auth routes (no auth middleware)
    const authRoutes = createAuthRoutes();
    app.use('/api/auth', authRoutes);
    
    // Apply auth middleware to all other routes
    app.use('/api', (req, res, next) => {
      // Skip auth for certain paths
      const publicPaths = ['/api/health', '/api/auth'];
      if (publicPaths.some(path => req.path.startsWith(path))) {
        return next();
      }
      
      // In development, allow requests with dev-token
      if (process.env.NODE_ENV === 'development') {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (token === 'dev-token') {
          (req as any).user = {
            id: '1',
            username: 'admin',
            role: 'admin'
          };
          return next();
        }
      }
      
      // Use JWT authentication
      authenticateToken(req, res, next);
    });
    
    // Dashboard routes
    const dashboardRoutes = createDashboardRoutes({ 
      matrixManager: matrixManager as any, 
      metricsCollector: metricsCollector as any 
    });
    app.use('/api/dashboard', dashboardRoutes);
    
    // API routes (will use null services if not initialized)
    const apiRoutes = createApiRoutes({ 
      matrixManager: matrixManager as any, 
      metricsCollector: metricsCollector as any 
    });
    app.use('/api', apiRoutes);
    
    // V1 API routes (includes tasks) - create even if services fail
    try {
      const { createApiV1Routes } = require('./api/v1/routes');
      const v1Routes = createApiV1Routes({ 
        matrixManager: matrixManager || { 
          getAccountManager: () => ({ listAccounts: async () => [] }),
          getQueueManager: () => ({ 
            addUploadTask: async () => ({ id: 'mock-id' }),
            removeTask: async () => {}
          })
        }, 
        metricsCollector: metricsCollector || { 
          getCurrentMetrics: async () => ({}),
          performHealthChecks: async () => []
        }
      });
      app.use('/api/v1', v1Routes);
      logger.info('V1 API routes initialized');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize V1 API routes');
    }
    
    // Static files for monitoring dashboard
    app.use('/monitoring-dashboard.html', express.static('public/monitoring-dashboard.html'));
    
    // Global error handler - must be last middleware
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error({ 
        error: err, 
        stack: err.stack,
        url: req.url,
        method: req.method,
        headers: req.headers,
        query: req.query,
        body: req.body 
      }, 'Unhandled error in request');
      
      res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'development' 
          ? err.message || 'Internal server error'
          : 'Internal server error'
      });
    });
    
    // Create HTTP server
    const server = createServer(app);
    
    // Initialize WebSocket
    const wsManager = initializeWebSocket(server);
    
    // Start server
    server.listen(port, () => {
      logger.info(`Server running on http://localhost:${port}`);
      logger.info(`API available at http://localhost:${port}/api`);
      logger.info(`WebSocket available at ws://localhost:${port}`);
      logger.info(`Health check at http://localhost:${port}/api/health`);
    });
    
  } catch (error) {
    console.error('Server startup error:', error);
    logger.error({ error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }, 'Failed to start server');
    process.exit(1);
  }
}

// Start the server
startServer();