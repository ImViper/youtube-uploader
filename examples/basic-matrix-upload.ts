import { MatrixManager } from '../src/matrix/manager';
import { Video } from '../src/types';
import pino from 'pino';

const logger = pino({
  name: 'example-basic',
  level: 'info',
  transport: {
    target: 'pino-pretty'
  }
});

/**
 * Basic example of using the Matrix Upload system
 */
async function basicMatrixUpload() {
  // Create matrix manager instance
  const matrixManager = new MatrixManager({
    browserPool: {
      minInstances: 2,
      maxInstances: 5
    },
    queue: {
      concurrency: 3,
      rateLimit: {
        max: 50,
        duration: 3600000 // 1 hour
      }
    },
    monitoring: {
      enabled: true,
      checkInterval: 60000 // 1 minute
    }
  });

  try {
    // Initialize the system
    logger.info('Initializing matrix manager...');
    await matrixManager.initialize();

    // Add some test accounts
    logger.info('Adding test accounts...');
    await matrixManager.addAccounts([
      { email: 'test1@example.com', password: 'password123' },
      { email: 'test2@example.com', password: 'password456' },
      { email: 'test3@example.com', password: 'password789' }
    ]);

    // Define videos to upload
    const videos: Video[] = [
      {
        path: '/path/to/video1.mp4',
        title: 'Test Video 1 - Matrix Upload',
        description: 'This is a test video uploaded using the matrix system',
        tags: ['test', 'matrix', 'automation'],
        privacyStatus: 'private',
        thumbnail: '/path/to/thumbnail1.jpg'
      },
      {
        path: '/path/to/video2.mp4',
        title: 'Test Video 2 - Automated Upload',
        description: 'Another test video demonstrating the matrix upload system',
        tags: ['test', 'automation', 'youtube'],
        privacyStatus: 'private'
      }
    ];

    // Upload videos using the matrix system
    logger.info('Queueing videos for upload...');
    const results = await matrixManager.batchUpload(videos, {
      priority: 1,
      metadata: {
        campaign: 'Test Campaign',
        source: 'basic-example'
      }
    });

    logger.info({ results }, 'Videos queued successfully');

    // Monitor upload progress
    for (const result of results) {
      logger.info(`Monitoring task ${result.taskId}...`);
      
      // Poll for status (in production, use webhooks)
      let completed = false;
      while (!completed) {
        const status = await matrixManager.getTaskStatus(result.taskId);
        
        if (status) {
          logger.info({
            taskId: result.taskId,
            status: status.status,
            videoId: status.videoId
          }, 'Task status update');

          if (status.status === 'completed' || status.status === 'failed') {
            completed = true;
            
            if (status.status === 'completed') {
              logger.info(`✅ Video uploaded successfully: ${status.videoId}`);
            } else {
              logger.error(`❌ Upload failed: ${status.error}`);
            }
          }
        }

        // Wait before next check
        if (!completed) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds
        }
      }
    }

    // Get system status
    const systemStatus = await matrixManager.getSystemStatus();
    logger.info({ systemStatus }, 'System status');

    // Get metrics
    const queueManager = matrixManager.getQueueManager();
    const metrics = await queueManager.getMetrics();
    logger.info({ metrics }, 'Queue metrics');

  } catch (error) {
    logger.error({ error }, 'Error in matrix upload example');
  } finally {
    // Cleanup
    logger.info('Shutting down matrix manager...');
    await matrixManager.shutdown();
  }
}

// Run the example
if (require.main === module) {
  basicMatrixUpload()
    .then(() => {
      logger.info('Example completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error({ error }, 'Example failed');
      process.exit(1);
    });
}

export { basicMatrixUpload };