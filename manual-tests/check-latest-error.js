const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'youtube_matrix',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const redis = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null
});

async function checkLatestError() {
  console.log('=== 检查最新的错误 ===\n');
  
  try {
    // 1. 获取最新的失败任务
    const taskResult = await pool.query(`
      SELECT t.id, t.status, t.error, t.created_at, t.started_at, t.completed_at,
             t.video_data,
             a.email, a.bitbrowser_window_name,
             h.error_details
      FROM upload_tasks t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN upload_history h ON h.task_id = t.id
      WHERE t.created_at > NOW() - INTERVAL '10 minutes'
      ORDER BY t.created_at DESC
      LIMIT 5
    `);
    
    console.log('最近的任务:');
    for (const task of taskResult.rows) {
      console.log(`\n任务 ID: ${task.id}`);
      console.log(`状态: ${task.status}`);
      console.log(`账户: ${task.email} (窗口: ${task.bitbrowser_window_name})`);
      console.log(`创建时间: ${new Date(task.created_at).toLocaleString()}`);
      
      if (task.started_at) {
        console.log(`开始时间: ${new Date(task.started_at).toLocaleString()}`);
      }
      
      if (task.completed_at) {
        console.log(`完成时间: ${new Date(task.completed_at).toLocaleString()}`);
        const duration = (new Date(task.completed_at) - new Date(task.started_at)) / 1000;
        console.log(`耗时: ${duration} 秒`);
      }
      
      if (task.error) {
        console.log(`任务错误: ${task.error}`);
      }
      
      if (task.error_details) {
        console.log(`历史错误: ${JSON.stringify(task.error_details)}`);
      }
      
      if (task.video_data) {
        const video = JSON.parse(task.video_data);
        console.log(`视频: ${video.title}`);
      }
    }
    
    // 2. 检查 BullMQ 失败任务
    console.log('\n\n=== BullMQ 失败任务 ===\n');
    
    const queue = new Queue('youtube-uploads', { connection: redis });
    const failedJobs = await queue.getFailed();
    
    console.log(`找到 ${failedJobs.length} 个失败任务\n`);
    
    for (const job of failedJobs.slice(0, 3)) {
      console.log(`Job ID: ${job.id}`);
      console.log(`任务 ID: ${job.data.taskId}`);
      console.log(`失败原因: ${job.failedReason}`);
      console.log(`失败时间: ${new Date(job.failedOn).toLocaleString()}`);
      
      if (job.stacktrace && job.stacktrace.length > 0) {
        console.log('\n错误堆栈:');
        const stack = job.stacktrace[0].split('\n').slice(0, 5).join('\n');
        console.log(stack);
      }
      
      console.log('---\n');
    }
    
    // 3. 检查活跃的任务
    console.log('=== 活跃任务 ===\n');
    const activeJobs = await queue.getActive();
    
    if (activeJobs.length === 0) {
      console.log('没有活跃任务');
    } else {
      for (const job of activeJobs) {
        console.log(`Job ID: ${job.id}`);
        console.log(`任务 ID: ${job.data.taskId}`);
        console.log(`进度: ${JSON.stringify(job.progress)}`);
      }
    }
    
    await queue.close();
    
  } catch (error) {
    console.error('错误:', error.message);
  } finally {
    await pool.end();
    await redis.quit();
  }
}

checkLatestError().catch(console.error);