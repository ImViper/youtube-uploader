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

async function monitorTask() {
  console.log('=== 监控活跃任务 ===\n');
  
  const queue = new Queue('youtube-uploads', { connection: redis });
  const startTime = Date.now();
  
  const monitor = setInterval(async () => {
    try {
      // 获取活跃任务
      const activeJobs = await queue.getActive();
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      
      if (activeJobs.length === 0) {
        console.log(`[${elapsed}s] 没有活跃任务`);
        
        // 检查是否有完成或失败的任务
        const completed = await queue.getCompleted();
        const failed = await queue.getFailed();
        
        if (completed.length > 0) {
          console.log('\n最近完成的任务:');
          const latest = completed[completed.length - 1];
          console.log(`Job ${latest.id}: ${JSON.stringify(latest.returnvalue)}`);
        }
        
        if (failed.length > 0) {
          console.log('\n最近失败的任务:');
          const latest = failed[failed.length - 1];
          console.log(`Job ${latest.id}: ${latest.failedReason}`);
        }
        
        clearInterval(monitor);
        await queue.close();
        await pool.end();
        await redis.quit();
        return;
      }
      
      // 显示活跃任务
      for (const job of activeJobs) {
        const taskId = job.data.taskId;
        console.log(`[${elapsed}s] Job ${job.id} - 任务 ${taskId}`);
        
        if (job.progress) {
          console.log(`      进度: ${JSON.stringify(job.progress)}`);
        }
        
        // 查询数据库状态
        const result = await pool.query(
          'SELECT status, error_message FROM upload_tasks WHERE id = $1',
          [taskId]
        );
        
        if (result.rows.length > 0) {
          console.log(`      数据库状态: ${result.rows[0].status}`);
          if (result.rows[0].error_message) {
            console.log(`      错误: ${result.rows[0].error_message}`);
          }
        }
      }
      
    } catch (error) {
      console.error('监控错误:', error.message);
    }
  }, 3000); // 每3秒检查一次
  
  // Ctrl+C 处理
  process.on('SIGINT', async () => {
    console.log('\n\n停止监控...');
    clearInterval(monitor);
    await queue.close();
    await pool.end();
    await redis.quit();
    process.exit(0);
  });
}

monitorTask().catch(console.error);