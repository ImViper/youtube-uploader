const { Queue, Worker } = require('bullmq');
const { getRedis } = require('./dist/redis/connection.js');

async function testQueue() {
  console.log('=== Testing BullMQ Queue Directly ===\n');
  
  try {
    // Create Redis connection config
    const connection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '5988'),
      password: process.env.REDIS_PASSWORD || 'redis_password_change_me'
    };
    
    console.log('1. Creating queue with connection:', { 
      host: connection.host, 
      port: connection.port,
      hasPassword: !!connection.password 
    });
    
    // Create queue
    const queue = new Queue('test-queue', { connection });
    console.log('✓ Queue created\n');
    
    // Create worker
    console.log('2. Creating worker...');
    let jobProcessed = false;
    const worker = new Worker(
      'test-queue',
      async (job) => {
        console.log('✓ Worker processing job:', job.data);
        jobProcessed = true;
        return { processed: true, data: job.data };
      },
      { connection }
    );
    console.log('✓ Worker created and listening\n');
    
    // Add a test job
    console.log('3. Adding test job to queue...');
    const job = await queue.add('test-job', {
      message: 'Hello from test!',
      timestamp: new Date().toISOString()
    });
    console.log('✓ Job added:', { id: job.id, name: job.name });
    console.log('');
    
    // Wait for processing
    console.log('4. Waiting for job to be processed...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (jobProcessed) {
      console.log('✓ Job was processed successfully!');
    } else {
      console.log('✗ Job was NOT processed');
    }
    
    // Check job status
    const jobState = await job.getState();
    console.log('Job state:', jobState);
    
    if (jobState === 'completed') {
      const result = await job.returnvalue;
      console.log('Job result:', result);
    }
    
    // Cleanup
    await worker.close();
    await queue.close();
    
  } catch (error) {
    console.error('Error during test:', error);
  }
  
  process.exit(0);
}

// Load env vars
require('dotenv').config();
testQueue();