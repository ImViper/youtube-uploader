const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
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

// 测试视频配置
const testVideo = {
  path: "C:\\Users\\75662\\Downloads\\aaa.mp4",
  title: `YouTube Matrix 测试 - ${new Date().toLocaleString('zh-CN')}`,
  description: `这是通过 YouTube Matrix 系统自动上传的测试视频。

上传时间: ${new Date().toLocaleString('zh-CN')}
使用窗口: BitBrowser 0629
测试系统: YouTube Matrix Automation

这个视频用于测试自动化上传功能。`,
  tags: ["测试", "YouTube Matrix", "BitBrowser", "0629", "自动化"],
  privacy: "private",
  language: "zh-CN"
};

async function createTask() {
  console.log('=== 创建上传任务 (窗口 0629) ===\n');
  
  try {
    // 1. 检查视频文件
    if (!fs.existsSync(testVideo.path)) {
      console.error(`❌ 视频文件不存在: ${testVideo.path}`);
      return;
    }
    const fileSize = fs.statSync(testVideo.path).size;
    console.log(`视频文件: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
    
    // 2. 获取使用 0629 窗口的账户
    const accountResult = await pool.query(
      `SELECT id, email, bitbrowser_window_name 
       FROM accounts 
       WHERE bitbrowser_window_name = '0629' 
       AND status = 'active'
       LIMIT 1`
    );
    
    if (accountResult.rows.length === 0) {
      console.error('❌ 没有找到使用窗口 0629 的活跃账户');
      return;
    }
    
    const account = accountResult.rows[0];
    console.log(`账户: ${account.email}`);
    console.log(`窗口: ${account.bitbrowser_window_name}`);
    
    // 3. 创建任务
    const taskId = uuidv4();
    
    await pool.query(
      `INSERT INTO upload_tasks (
        id, account_id, video_data, priority, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [taskId, account.id, JSON.stringify(testVideo), 5, 'pending']
    );
    
    console.log(`\n任务 ID: ${taskId}`);
    
    // 4. 添加到队列 - 使用正确的数据结构
    const queue = new Queue('youtube-uploads', { connection: redis });
    
    const job = await queue.add('upload', {
      taskId: taskId,        // 注意：是 taskId 而不是 id
      accountId: account.id  // 可选，Worker 会从数据库读取
    }, {
      priority: 5,
      removeOnComplete: true,
      removeOnFail: false
    });
    
    console.log(`队列 Job ID: ${job.id}`);
    
    await queue.close();
    
    console.log('\n✅ 任务创建成功！');
    console.log('\n请观察 BitBrowser 窗口 0629 中的操作...');
    
    // 5. 监控任务状态
    console.log('\n监控任务状态 (按 Ctrl+C 退出)...\n');
    
    let lastStatus = '';
    const checkInterval = setInterval(async () => {
      try {
        const taskResult = await pool.query(
          'SELECT status, error, result FROM upload_tasks WHERE id = $1',
          [taskId]
        );
        
        if (taskResult.rows.length > 0) {
          const task = taskResult.rows[0];
          if (task.status !== lastStatus) {
            console.log(`[${new Date().toLocaleTimeString()}] 状态: ${lastStatus || 'pending'} → ${task.status}`);
            lastStatus = task.status;
            
            if (task.status === 'completed') {
              console.log('\n✅ 上传成功！');
              if (task.result) {
                console.log('结果:', JSON.stringify(task.result, null, 2));
              }
              clearInterval(checkInterval);
              await pool.end();
              await redis.quit();
              process.exit(0);
            } else if (task.status === 'failed') {
              console.log('\n❌ 上传失败！');
              if (task.error) {
                console.log('错误:', task.error);
              }
              clearInterval(checkInterval);
              await pool.end();
              await redis.quit();
              process.exit(1);
            }
          }
        }
      } catch (e) {
        // 忽略查询错误
      }
    }, 2000);
    
    // 处理退出
    process.on('SIGINT', async () => {
      console.log('\n\n停止监控...');
      clearInterval(checkInterval);
      await pool.end();
      await redis.quit();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('\n错误:', error.message);
    await pool.end();
    await redis.quit();
  }
}

createTask().catch(console.error);