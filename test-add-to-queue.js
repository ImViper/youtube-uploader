const { Queue } = require('bullmq');
const { getDatabase } = require('./dist/database/connection.js');

async function testAddToQueue() {
  console.log('=== Testing Manual Task Addition to Queue ===\n');
  
  const db = getDatabase();
  
  try {
    // Get a pending task
    console.log('1. Getting a pending task...');
    const result = await db.query(
      `SELECT id, status, account_id, video_data 
       FROM upload_tasks 
       WHERE status = 'pending' AND account_id IS NOT NULL
       LIMIT 1`
    );
    
    if (result.rows.length === 0) {
      console.log('No pending tasks with account_id found');
      return;
    }
    
    const task = result.rows[0];
    console.log('Found task:', {
      id: task.id,
      status: task.status,
      accountId: task.account_id,
      title: task.video_data?.title
    });
    console.log('');
    
    // Create Redis connection config
    const connection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '5988'),
      password: process.env.REDIS_PASSWORD || 'redis_password_change_me'
    };
    
    // Create queue
    console.log('2. Creating queue...');
    const queue = new Queue('youtube-uploads', { connection });
    console.log('✓ Queue created\n');
    
    // Add task to queue
    console.log('3. Adding task to queue...');
    const uploadTask = {
      id: task.id,
      accountId: task.account_id,
      video: task.video_data,
      priority: 3, // normal priority
      metadata: {}
    };
    
    const job = await queue.add(
      `upload-${task.id}`,
      uploadTask,
      {
        priority: 3
      }
    );
    
    console.log('✓ Job added successfully:', {
      jobId: job.id,
      jobName: job.name,
      priority: job.opts.priority
    });
    console.log('');
    
    // Update task status in database
    console.log('4. Updating task status to active...');
    await db.query(
      `UPDATE upload_tasks SET status = 'active' WHERE id = $1`,
      [task.id]
    );
    console.log('✓ Task status updated\n');
    
    // Check queue status
    console.log('5. Checking queue status...');
    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    
    console.log('Queue stats:', { waiting, active });
    
    // Check if job is in queue
    const checkJob = await queue.getJob(job.id);
    if (checkJob) {
      const state = await checkJob.getState();
      console.log('Job state:', state);
    }
    
    await queue.close();
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.$pool.end();
    process.exit(0);
  }
}

// Load env vars
require('dotenv').config();
testAddToQueue();