import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import pino from 'pino';
import { createApiRoutes } from './api/routes';
import { createApiV1Routes } from './api/v1/routes';
import { createAuthRoutes, authenticateToken } from './api/auth';
import { createDashboardRoutes } from './api/dashboard';
import { initializeWebSocket } from './api/websocket';
import { MatrixManager } from './matrix/manager';
import { MetricsCollector } from './monitoring/metrics';

const logger = pino({
  name: 'server',
  level: process.env.LOG_LEVEL || 'info'
});

async function startServer() {
  try {
    // Create Express app first
    const app = express();
    const port = process.env.PORT || 5989;
    
    // Initialize services (non-blocking)
    logger.info('Initializing services...');
    
    let matrixManager: MatrixManager | null = null;
    let metricsCollector: MetricsCollector | null = null;
    
    // Try to initialize services but don't block server startup
    Promise.resolve().then(async () => {
      try {
        matrixManager = new MatrixManager();
        await matrixManager.initialize();
        logger.info('MatrixManager initialized successfully');
      } catch (error) {
        logger.error({ error }, 'Failed to initialize MatrixManager');
      }
      
      try {
        metricsCollector = new MetricsCollector();
        metricsCollector.start();
        logger.info('MetricsCollector started successfully');
      } catch (error) {
        logger.error({ error }, 'Failed to start MetricsCollector');
      }
    });
    
    // Middleware
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Request logging middleware
    app.use((req, res, next) => {
      logger.info({
        method: req.method,
        path: req.path,
        query: req.query,
        ip: req.ip
      }, 'Incoming request');
      next();
    });
    
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
    
    // API v1 routes (new structured APIs)
    const apiV1Routes = createApiV1Routes({ 
      matrixManager: matrixManager as any, 
      metricsCollector: metricsCollector as any 
    });
    app.use('/api/v1', apiV1Routes);
    
    // Legacy API routes (for backward compatibility)
    const apiRoutes = createApiRoutes({ 
      matrixManager: matrixManager as any, 
      metricsCollector: metricsCollector as any 
    });
    app.use('/api', apiRoutes);
    
    // Error handling middleware
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error({
        error: err,
        method: req.method,
        path: req.path
      }, 'Unhandled error');
      
      res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      });
    });
    
    // Create HTTP server
    const server = createServer(app);
    
    // Initialize WebSocket
    initializeWebSocket(server);
    
    // Start listening
    server.listen(port, () => {
      logger.info(`Server is running on http://localhost:${port}`);
      logger.info('API Documentation:');
      logger.info('  Auth: /api/auth/*');
      logger.info('  API v1: /api/v1/*');
      logger.info('    - Matrices: /api/v1/matrices');
      logger.info('    - Accounts: /api/v1/accounts');
      logger.info('    - Tasks: /api/v1/tasks');
      logger.info('  Dashboard: /api/dashboard/*');
      logger.info('  Legacy: /api/*');
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down gracefully...');
      
      server.close(() => {
        logger.info('HTTP server closed');
      });
      
      if (matrixManager) {
        await matrixManager.shutdown();
        logger.info('MatrixManager shut down');
      }
      
      if (metricsCollector) {
        metricsCollector.stop();
        logger.info('MetricsCollector stopped');
      }
      
      process.exit(0);
    });
    
  } catch (error) {
    logger.fatal({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Start the server
startServer();