const { Queue } = require('bullmq');

async function checkQueue() {
  console.log('=== Checking YouTube Uploads Queue ===\n');
  
  try {
    // Create Redis connection config
    const connection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '5988'),
      password: process.env.REDIS_PASSWORD || 'redis_password_change_me'
    };
    
    // Create queue instance (not worker)
    console.log('1. Connecting to queue...');
    const queue = new Queue('youtube-uploads', { connection });
    console.log('✓ Connected to queue\n');
    
    // Check queue status
    console.log('2. Checking queue status...');
    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    const completed = await queue.getCompletedCount();
    const failed = await queue.getFailedCount();
    const paused = await queue.isPaused();
    
    console.log('Queue stats:', { waiting, active, completed, failed, paused });
    console.log('');
    
    // Get waiting jobs
    if (waiting > 0) {
      console.log('3. Getting waiting jobs...');
      const jobs = await queue.getJobs(['waiting'], 0, 10);
      console.log(`Found ${jobs.length} waiting jobs:`);
      jobs.forEach(job => {
        console.log(`- Job ${job.id}: Task ${job.data.id || 'unknown'} - ${job.data.video?.title || 'No title'}`);
      });
    } else {
      console.log('3. No waiting jobs in queue');
    }
    
    // Get active jobs
    if (active > 0) {
      console.log('\n4. Getting active jobs...');
      const jobs = await queue.getJobs(['active'], 0, 10);
      console.log(`Found ${jobs.length} active jobs:`);
      jobs.forEach(job => {
        console.log(`- Job ${job.id}: Task ${job.data.id || 'unknown'} - ${job.data.video?.title || 'No title'}`);
      });
    }
    
    // Get failed jobs
    if (failed > 0) {
      console.log('\n5. Getting failed jobs...');
      const jobs = await queue.getJobs(['failed'], 0, 10);
      console.log(`Found ${jobs.length} failed jobs:`);
      for (const job of jobs) {
        const failedReason = job.failedReason;
        console.log(`- Job ${job.id}: Task ${job.data.id || 'unknown'} - Failed: ${failedReason}`);
      }
    }
    
    // Check workers
    console.log('\n6. Checking for workers...');
    const workers = await queue.getWorkers();
    console.log(`Active workers: ${workers.length}`);
    if (workers.length > 0) {
      workers.forEach(w => {
        console.log(`- Worker ${w.id}: ${w.name || 'unnamed'}`);
      });
    } else {
      console.log('⚠️  No workers are currently processing this queue!');
    }
    
    await queue.close();
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

// Load env vars
require('dotenv').config();
checkQueue();