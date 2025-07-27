const { Queue } = require('bullmq');
const { getDatabase } = require('./dist/database/connection');
const { getRedis } = require('./dist/redis/connection');

async function testUploadViaQueue() {
  console.log('=== 测试通过队列系统上传 ===\n');
  
  const db = getDatabase();
  const redis = getRedis();
  
  try {
    // 配置
    const TASK_ID = '30115706-168b-4d16-9392-d397829ec9b1';
    
    // 1. 获取任务信息
    console.log('[1] 获取任务信息...');
    const taskResult = await db.query(
      'SELECT * FROM upload_tasks WHERE id = $1',
      [TASK_ID]
    );
    
    if (taskResult.rows.length === 0) {
      throw new Error(`未找到任务 ID: ${TASK_ID}`);
    }
    
    const task = taskResult.rows[0];
    console.log('✓ 任务信息:');
    console.log(`  - ID: ${task.id}`);
    console.log(`  - 状态: ${task.status}`);
    console.log(`  - 标题: ${task.video_data.title}`);
    
    // 2. 重置任务状态为 pending
    console.log('\n[2] 重置任务状态...');
    await db.query(
      `UPDATE upload_tasks 
       SET status = 'pending', 
           started_at = NULL,
           completed_at = NULL,
           error = NULL
       WHERE id = $1`,
      [TASK_ID]
    );
    console.log('✓ 任务状态已重置为 pending');
    
    // 3. 创建队列并添加任务
    console.log('\n[3] 添加任务到队列...');
    const uploadQueue = new Queue('youtube:upload', {
      connection: redis
    });
    
    const job = await uploadQueue.add('upload', {
      taskId: TASK_ID,
      accountId: task.account_id
    }, {
      priority: task.priority || 5,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });
    
    console.log(`✓ 任务已添加到队列，Job ID: ${job.id}`);
    
    // 4. 监控任务状态
    console.log('\n[4] 监控任务状态...');
    console.log('任务已提交到队列系统，请确保 UploadWorker 正在运行');
    console.log('你可以通过以下方式启动 worker:');
    console.log('  npm run worker:upload');
    console.log('\n或者在另一个终端运行:');
    console.log('  node start-upload-worker.js');
    
    // 5. 轮询任务状态
    console.log('\n[5] 开始轮询任务状态（每5秒检查一次）...\n');
    
    let checkCount = 0;
    const maxChecks = 60; // 最多检查5分钟
    
    const checkInterval = setInterval(async () => {
      checkCount++;
      
      try {
        // 检查任务状态
        const statusResult = await db.query(
          'SELECT status, error, result FROM upload_tasks WHERE id = $1',
          [TASK_ID]
        );
        
        if (statusResult.rows.length > 0) {
          const currentTask = statusResult.rows[0];
          const timestamp = new Date().toLocaleTimeString();
          
          console.log(`[${timestamp}] 任务状态: ${currentTask.status}`);
          
          if (currentTask.status === 'completed') {
            console.log('\n✅ 任务完成！');
            if (currentTask.result) {
              console.log('结果:', currentTask.result);
            }
            clearInterval(checkInterval);
            process.exit(0);
          } else if (currentTask.status === 'failed') {
            console.log('\n❌ 任务失败！');
            if (currentTask.error) {
              console.log('错误:', currentTask.error);
            }
            clearInterval(checkInterval);
            process.exit(1);
          }
        }
        
        if (checkCount >= maxChecks) {
          console.log('\n⏱️ 检查超时，请手动检查任务状态');
          clearInterval(checkInterval);
          process.exit(1);
        }
        
      } catch (error) {
        console.error('检查状态时出错:', error.message);
      }
    }, 5000);
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 处理退出信号
process.on('SIGINT', () => {
  console.log('\n\n程序被中断');
  process.exit(0);
});

testUploadViaQueue();