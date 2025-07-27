const { TaskService } = require('./dist/api/task/task.service.js');
const { QueueManager } = require('./dist/queue/manager.js');
const { getDatabase } = require('./dist/database/connection.js');

async function testFullFlow() {
  console.log('=== Testing Full Task Flow ===\n');
  
  const db = getDatabase();
  
  try {
    // 1. Initialize QueueManager
    console.log('1. Initializing QueueManager...');
    const queueManager = new QueueManager();
    console.log('✓ QueueManager initialized\n');
    
    // 2. Initialize TaskService with QueueManager
    console.log('2. Initializing TaskService with QueueManager...');
    const taskService = new TaskService(queueManager);
    console.log('✓ TaskService initialized\n');
    
    // 3. Get an account
    console.log('3. Getting an active account...');
    const accountResult = await db.query(
      'SELECT id, username FROM accounts WHERE status = $1 LIMIT 1',
      ['active']
    );
    
    if (accountResult.rows.length === 0) {
      console.log('✗ No active accounts found');
      return;
    }
    
    const account = accountResult.rows[0];
    console.log('✓ Using account:', account.username, `(${account.id})\n`);
    
    // 4. Create a new task
    console.log('4. Creating new upload task...');
    const taskData = {
      type: 'upload',
      priority: 'normal',
      accountId: account.id,
      video: {
        path: 'C:\\\\test\\\\video.mp4',
        title: 'Test Video ' + new Date().toISOString(),
        description: 'This is a test video upload',
        tags: ['test', 'demo', 'youtube']
      }
    };
    
    const task = await taskService.create(taskData);
    console.log('✓ Task created:', {
      id: task.id,
      status: task.status,
      type: task.type
    });
    console.log('');
    
    // 5. Check queue status
    console.log('5. Checking queue status...');
    const queue = queueManager.queue;
    let waiting = await queue.getWaitingCount();
    let active = await queue.getActiveCount();
    console.log('Queue stats:', { waiting, active });
    
    // 6. Check if job is in queue
    const jobs = await queue.getJobs(['waiting', 'active'], 0, 10);
    const taskJob = jobs.find(j => j.data.id === task.id);
    if (taskJob) {
      console.log('✓ Job found in queue:', {
        jobId: taskJob.id,
        state: await taskJob.getState(),
        taskId: taskJob.data.id
      });
    } else {
      console.log('✗ Job NOT found in queue');
    }
    console.log('');
    
    // 7. Wait a bit and check status
    console.log('6. Waiting 3 seconds to see if task status changes...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const updatedTask = await taskService.findById(task.id);
    console.log('Updated task status:', updatedTask?.status);
    
    // Check queue again
    waiting = await queue.getWaitingCount();
    active = await queue.getActiveCount();
    const failed = await queue.getFailedCount();
    console.log('Queue stats after wait:', { waiting, active, failed });
    
    // Check for failed jobs
    if (failed > 0) {
      const failedJobs = await queue.getJobs(['failed'], 0, 5);
      console.log('\nFailed jobs:');
      for (const job of failedJobs) {
        console.log(`- Job ${job.id}: ${job.failedReason}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.$pool.end();
    process.exit(0);
  }
}

// Load env vars
require('dotenv').config();
testFullFlow();