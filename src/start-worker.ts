#!/usr/bin/env node
import dotenv from 'dotenv';
import { UploadWorkerV2 } from './workers/upload-worker-v2';
import { AccountManager } from './accounts/manager';
import { BitBrowserManager } from './bitbrowser/manager';
import { getDatabase } from './database/connection';
import { getRedis } from './redis/connection';
import pino from 'pino';

// Load environment variables
dotenv.config();

const logger = pino({
  name: 'worker-starter',
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname'
    }
  }
});

async function startWorker() {
  logger.info('Starting YouTube Upload Worker V2');

  try {
    // Test database connection
    const db = getDatabase();
    await db.query('SELECT 1');
    logger.info('Database connection established');

    // Test Redis connection
    const redis = getRedis();
    await redis.getClient().ping();
    logger.info('Redis connection established');

    // Initialize managers
    const accountManager = new AccountManager();
    logger.info('AccountManager initialized');

    const bitBrowserManager = new BitBrowserManager({
      apiUrl: process.env.BITBROWSER_API_URL || 'http://127.0.0.1:54345',
      windowPosition: {
        x: parseInt(process.env.BITBROWSER_WINDOW_X || '1380'),
        y: parseInt(process.env.BITBROWSER_WINDOW_Y || '400')
      }
    });
    logger.info('BitBrowserManager initialized');

    // Create and start worker
    const worker = new UploadWorkerV2({
      accountManager,
      bitBrowserManager,
      maxUploadTime: parseInt(process.env.UPLOAD_MAX_TIME || '1800000'), // 30 minutes default
      maxRetries: parseInt(process.env.UPLOAD_MAX_RETRIES || '3')
    });

    await worker.start();
    logger.info({
      concurrency: process.env.UPLOAD_CONCURRENCY || '5',
      maxUploadTime: process.env.UPLOAD_MAX_TIME || '1800000',
      maxRetries: process.env.UPLOAD_MAX_RETRIES || '3'
    }, 'Upload Worker V2 started successfully');

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Received shutdown signal');
      
      try {
        await worker.stop();
        await db.close();
        redis.getClient().disconnect();
        logger.info('Worker stopped gracefully');
        process.exit(0);
      } catch (error) {
        logger.error({ error }, 'Error during shutdown');
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Keep the process alive
    process.on('uncaughtException', (error) => {
      logger.error({ error }, 'Uncaught exception');
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error({ reason, promise }, 'Unhandled rejection');
      shutdown('unhandledRejection');
    });

  } catch (error) {
    logger.error({ error }, 'Failed to start worker');
    process.exit(1);
  }
}

// Start the worker
startWorker().catch((error) => {
  logger.error({ error }, 'Worker startup failed');
  process.exit(1);
});