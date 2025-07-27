const { TaskService } = require('./dist/api/task/task.service.js');
const { QueueManager } = require('./dist/queue/manager.js');
const { getDatabase } = require('./dist/database/connection.js');

async function testTaskCreation() {
  console.log('=== Testing Task Creation and Queue Integration ===\n');
  
  try {
    // Initialize QueueManager
    console.log('1. Initializing QueueManager...');
    const queueManager = new QueueManager();
    // No initialize method needed - constructor handles it
    console.log('✓ QueueManager initialized\n');
    
    // Initialize TaskService with QueueManager
    console.log('2. Initializing TaskService with QueueManager...');
    const taskService = new TaskService(queueManager);
    console.log('✓ TaskService initialized\n');
    
    // First, get a valid account ID from database
    console.log('3. Getting a valid account ID...');
    const db = getDatabase();
    const accountResult = await db.query('SELECT id FROM accounts WHERE status = $1 LIMIT 1', ['active']);
    
    if (accountResult.rows.length === 0) {
      console.log('No active accounts found. Please create an account first.');
      return;
    }
    
    const accountId = accountResult.rows[0].id;
    console.log('✓ Using account ID:', accountId, '\n');
    
    // Create a test task
    console.log('4. Creating test upload task...');
    const taskData = {
      type: 'upload',
      priority: 'normal',
      accountId: accountId,
      video: {
        path: '/test/video.mp4',
        title: 'Test Video',
        description: 'Test Description',
        tags: ['test', 'demo']
      }
    };
    
    const task = await taskService.create(taskData);
    console.log('✓ Task created:', {
      id: task.id,
      status: task.status,
      type: task.type
    });
    console.log('');
    
    // Check if task was added to queue
    console.log('5. Checking if task was added to queue...');
    const job = await queueManager.getJob(task.id);
    if (job) {
      console.log('✓ Job found in queue:', {
        id: job.id,
        name: job.name,
        data: job.data
      });
    } else {
      console.log('✗ Job NOT found in queue!');
    }
    console.log('');
    
    // Check queue status
    console.log('6. Checking queue status...');
    const waiting = await queueManager.queue.getWaitingCount();
    const active = await queueManager.queue.getActiveCount();
    const completed = await queueManager.queue.getCompletedCount();
    const failed = await queueManager.queue.getFailedCount();
    
    console.log('Queue stats:', {
      waiting,
      active,
      completed,
      failed
    });
    console.log('');
    
    // Check if worker is processing
    console.log('7. Checking if worker is active...');
    const workers = await queueManager.queue.getWorkers();
    console.log('Workers count:', workers.length);
    
    // Wait a bit to see if task gets processed
    console.log('\n8. Waiting 5 seconds to see if task gets processed...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check task status again
    const updatedTask = await taskService.findById(task.id);
    console.log('Updated task status:', updatedTask?.status);
    
    // Check job status
    const updatedJob = await queueManager.getJob(task.id);
    if (updatedJob) {
      const state = await updatedJob.getState();
      console.log('Job state:', state);
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    // Cleanup
    const db = getDatabase();
    await db.$pool.end();
    process.exit(0);
  }
}

testTaskCreation();