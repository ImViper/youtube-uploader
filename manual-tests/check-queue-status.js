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

async function checkStatus() {
  console.log('=== 队列和任务状态检查 ===\n');
  
  try {
    // 1. 检查队列状态
    const queue = new Queue('youtube-uploads', { connection: redis });
    
    console.log('1. 队列状态:');
    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    const completed = await queue.getCompletedCount();
    const failed = await queue.getFailedCount();
    
    console.log(`   等待中: ${waiting}`);
    console.log(`   活跃中: ${active}`);
    console.log(`   已完成: ${completed}`);
    console.log(`   已失败: ${failed}`);
    
    // 2. 获取活跃任务
    console.log('\n2. 活跃任务:');
    const activeJobs = await queue.getActive();
    if (activeJobs.length === 0) {
      console.log('   没有活跃任务');
    } else {
      for (const job of activeJobs) {
        console.log(`   Job ${job.id}: ${JSON.stringify(job.data)}`);
        console.log(`   进度: ${JSON.stringify(job.progress)}`);
      }
    }
    
    // 3. 获取等待任务
    console.log('\n3. 等待任务:');
    const waitingJobs = await queue.getWaiting();
    if (waitingJobs.length === 0) {
      console.log('   没有等待任务');
    } else {
      for (const job of waitingJobs) {
        console.log(`   Job ${job.id}: ${JSON.stringify(job.data)}`);
      }
    }
    
    // 4. 获取失败任务
    console.log('\n4. 失败任务:');
    const failedJobs = await queue.getFailed();
    if (failedJobs.length === 0) {
      console.log('   没有失败任务');
    } else {
      for (const job of failedJobs) {
        console.log(`   Job ${job.id}: ${JSON.stringify(job.data)}`);
        console.log(`   失败原因: ${job.failedReason}`);
      }
    }
    
    // 5. 检查数据库中的任务
    console.log('\n5. 数据库任务状态:');
    const tasks = await pool.query(`
      SELECT t.id, t.status, t.created_at, t.started_at, t.completed_at, 
             a.email, a.bitbrowser_window_name
      FROM upload_tasks t
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.created_at > NOW() - INTERVAL '1 hour'
      ORDER BY t.created_at DESC
      LIMIT 10
    `);
    
    if (tasks.rows.length === 0) {
      console.log('   最近一小时没有任务');
    } else {
      for (const task of tasks.rows) {
        console.log(`\n   任务 ${task.id}:`);
        console.log(`     状态: ${task.status}`);
        console.log(`     账户: ${task.email || '未分配'}`);
        console.log(`     窗口: ${task.bitbrowser_window_name || '未分配'}`);
        console.log(`     创建: ${task.created_at}`);
        console.log(`     开始: ${task.started_at || '未开始'}`);
        console.log(`     完成: ${task.completed_at || '未完成'}`);
      }
    }
    
    // 6. 检查 Worker 是否在运行
    console.log('\n6. Worker 状态:');
    const workers = await queue.getWorkers();
    console.log(`   活跃 Workers: ${workers.length}`);
    
    await queue.close();
    
  } catch (error) {
    console.error('错误:', error.message);
  } finally {
    await pool.end();
    await redis.quit();
  }
}

checkStatus().catch(console.error);