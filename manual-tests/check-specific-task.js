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

// 获取命令行参数中的任务 ID
const taskId = process.argv[2] || 'f6e7f3a7-0b7d-44af-adc1-3d9ada8b7338';

async function checkTask() {
  console.log(`=== 检查任务 ${taskId} ===\n`);
  
  try {
    // 1. 查询任务详情
    const taskResult = await pool.query(`
      SELECT t.*, a.email, a.bitbrowser_window_name
      FROM upload_tasks t
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.id = $1
    `, [taskId]);
    
    if (taskResult.rows.length === 0) {
      console.log('任务不存在');
      return;
    }
    
    const task = taskResult.rows[0];
    console.log('任务信息:');
    console.log(`  状态: ${task.status}`);
    console.log(`  账户: ${task.email}`);
    console.log(`  窗口: ${task.bitbrowser_window_name}`);
    console.log(`  创建时间: ${new Date(task.created_at).toLocaleString()}`);
    
    if (task.started_at) {
      console.log(`  开始时间: ${new Date(task.started_at).toLocaleString()}`);
    }
    
    if (task.completed_at) {
      console.log(`  完成时间: ${new Date(task.completed_at).toLocaleString()}`);
    }
    
    if (task.error) {
      console.log(`  错误: ${task.error}`);
    }
    
    if (task.result) {
      console.log(`  结果: ${JSON.stringify(task.result, null, 2)}`);
    }
    
    // 2. 查询上传历史
    console.log('\n上传历史:');
    const historyResult = await pool.query(`
      SELECT * FROM upload_history
      WHERE task_id = $1
      ORDER BY created_at DESC
    `, [taskId]);
    
    if (historyResult.rows.length === 0) {
      console.log('  无上传历史');
    } else {
      for (const history of historyResult.rows) {
        console.log(`\n  历史 ID: ${history.id}`);
        console.log(`  成功: ${history.success}`);
        console.log(`  视频 URL: ${history.video_url || '无'}`);
        console.log(`  耗时: ${history.upload_duration || 0} 毫秒`);
        console.log(`  创建时间: ${new Date(history.created_at).toLocaleString()}`);
        
        if (history.error_details) {
          console.log(`  错误详情: ${JSON.stringify(history.error_details)}`);
        }
      }
    }
    
    // 3. 检查 BullMQ 任务
    console.log('\n\nBullMQ 任务状态:');
    const queue = new Queue('youtube-uploads', { connection: redis });
    
    // 查找所有相关的 jobs
    const allJobs = await queue.getJobs(['completed', 'failed', 'active', 'waiting']);
    const relatedJobs = allJobs.filter(job => job.data.taskId === taskId);
    
    if (relatedJobs.length === 0) {
      console.log('  未找到相关的 BullMQ 任务');
    } else {
      for (const job of relatedJobs) {
        console.log(`\n  Job ID: ${job.id}`);
        console.log(`  状态: ${await job.getState()}`);
        console.log(`  数据: ${JSON.stringify(job.data)}`);
        
        if (job.failedReason) {
          console.log(`  失败原因: ${job.failedReason}`);
          
          if (job.stacktrace && job.stacktrace.length > 0) {
            console.log('\n  错误堆栈:');
            console.log(job.stacktrace[0]);
          }
        }
        
        if (job.progress) {
          console.log(`  进度: ${JSON.stringify(job.progress)}`);
        }
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

checkTask().catch(console.error);