const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),  
  database: process.env.DB_NAME || 'youtube_matrix',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function checkError() {
  try {
    // 检查最近的失败任务
    const result = await pool.query(`
      SELECT t.id, t.status, t.error, t.created_at, 
             a.email, a.bitbrowser_window_name
      FROM upload_tasks t
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.status = 'failed'
      AND t.created_at > NOW() - INTERVAL '10 minutes'
      ORDER BY t.created_at DESC
      LIMIT 5
    `);
    
    console.log('=== 最近失败的任务 ===\n');
    
    for (const task of result.rows) {
      console.log(`任务 ID: ${task.id}`);
      console.log(`账户: ${task.email} (窗口: ${task.bitbrowser_window_name})`);
      console.log(`创建时间: ${task.created_at}`);
      console.log(`错误信息: ${task.error}`);
      console.log('---\n');
    }
    
    // 检查 BullMQ 队列中的失败任务
    const { Queue } = require('bullmq');
    const IORedis = require('ioredis');
    
    const redis = new IORedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null
    });
    
    const queue = new Queue('youtube-uploads', { connection: redis });
    const failedJobs = await queue.getFailed();
    
    console.log(`\n=== 队列中的失败任务 (${failedJobs.length} 个) ===\n`);
    
    for (const job of failedJobs.slice(0, 3)) {
      console.log(`Job ID: ${job.id}`);
      console.log(`数据: ${JSON.stringify(job.data)}`);
      console.log(`失败原因: ${job.failedReason}`);
      console.log(`堆栈: ${job.stacktrace?.[0] || '无'}`);
      console.log('---\n');
    }
    
    await queue.close();
    await redis.quit();
    
  } catch (error) {
    console.error('错误:', error.message);
  } finally {
    await pool.end();
  }
}

checkError().catch(console.error);