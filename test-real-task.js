const { Worker } = require('bullmq');
const { getDatabase } = require('./dist/database/connection.js');

async function testRealTask() {
  console.log('=== Testing Real Task Processing ===\n');
  
  const db = getDatabase();
  
  try {
    // Get a pending/queued task
    console.log('1. Looking for pending/queued tasks...');
    const result = await db.query(
      `SELECT id, status, account_id, video_data->>'title' as title 
       FROM upload_tasks 
       WHERE status IN ('pending', 'queued') 
       ORDER BY created_at DESC 
       LIMIT 5`
    );
    
    console.log('Found tasks:', result.rows);
    console.log('');
    
    if (result.rows.length === 0) {
      console.log('No pending/queued tasks found');
      return;
    }
    
    // Create Redis connection config
    const connection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '5988'),
      password: process.env.REDIS_PASSWORD || 'redis_password_change_me'
    };
    
    // Create worker to see what's in the queue
    console.log('2. Creating worker to check queue...');
    const worker = new Worker(
      'youtube-uploads',
      async (job) => {
        console.log('Worker received job:', {
          id: job.id,
          taskId: job.data.id,
          accountId: job.data.accountId,
          title: job.data.video?.title
        });
        // Don't actually process, just log
        throw new Error('Test worker - not processing');
      },
      { 
        connection,
        autorun: false // Don't start processing automatically
      }
    );
    
    // Check queue status through queue object
    console.log('3. Checking queue status...');
    const queue = worker.queue;
    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    const completed = await queue.getCompletedCount();
    const failed = await queue.getFailedCount();
    
    console.log('Queue stats:', { waiting, active, completed, failed });
    
    // Get waiting jobs
    if (waiting > 0) {
      console.log('\n4. Getting waiting jobs...');
      const jobs = await queue.getJobs('waiting', 0, 10);
      console.log(`Found ${jobs.length} waiting jobs:`);
      jobs.forEach(job => {
        console.log(`- Job ${job.id}: Task ${job.data.id} - ${job.data.video?.title || 'No title'}`);
      });
    }
    
    // Check if the basic worker is running
    console.log('\n5. Checking for active workers...');
    const workers = await queue.getWorkers();
    console.log(`Active workers: ${workers.length}`);
    workers.forEach(w => {
      console.log(`- Worker: ${w.id}`);
    });
    
    await worker.close();
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.$pool.end();
    process.exit(0);
  }
}

// Load env vars
require('dotenv').config();
testRealTask();