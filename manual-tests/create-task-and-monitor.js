const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const axios = require('axios');
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
  title: `YouTube 测试上传 - ${new Date().toLocaleString('zh-CN')}`,
  description: `测试视频上传功能
上传时间: ${new Date().toLocaleString('zh-CN')}
使用窗口: BitBrowser 0629`,
  tags: ["测试", "自动化"],
  privacy: "private",
  language: "zh-CN"
};

async function main() {
  console.log('=== YouTube 上传测试 ===\n');
  
  try {
    // 1. 检查视频文件
    if (!fs.existsSync(testVideo.path)) {
      console.error(`❌ 视频文件不存在: ${testVideo.path}`);
      return;
    }
    console.log(`✅ 视频文件: ${(fs.statSync(testVideo.path).size / 1024 / 1024).toFixed(2)} MB`);
    
    // 2. 检查 BitBrowser
    console.log('\n检查 BitBrowser...');
    const apiUrl = process.env.BITBROWSER_API_URL || 'http://127.0.0.1:54345';
    
    try {
      const response = await axios.post(
        `${apiUrl}/browser/list`,
        { page: 0, pageSize: 100 },
        { timeout: 5000 }
      );
      
      const windows = response.data.data?.list || [];
      const window0629 = windows.find(w => w.name === '0629');
      
      if (window0629) {
        console.log('✅ 找到窗口 0629');
        
        // 检查窗口状态，如果需要就打开它
        if (window0629.status !== 0) {
          console.log('窗口状态异常，尝试打开...');
          try {
            const openRes = await axios.post(
              `${apiUrl}/browser/open`,
              { id: window0629.id },
              { timeout: 30000 }
            );
            if (openRes.data.success) {
              console.log('✅ 窗口已打开');
              // 等待窗口完全加载
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
          } catch (e) {
            console.log('⚠️  打开窗口失败:', e.message);
          }
        }
      } else {
        console.log('❌ 未找到窗口 0629');
      }
    } catch (e) {
      console.log('⚠️  BitBrowser API 错误:', e.message);
    }
    
    // 3. 获取账户
    console.log('\n配置账户...');
    const accountResult = await pool.query(
      `SELECT id, email FROM accounts 
       WHERE bitbrowser_window_name = '0629' AND status = 'active' 
       LIMIT 1`
    );
    
    if (accountResult.rows.length === 0) {
      console.error('❌ 没有使用窗口 0629 的活跃账户');
      return;
    }
    
    const account = accountResult.rows[0];
    console.log(`✅ 使用账户: ${account.email}`);
    
    // 4. 创建任务
    console.log('\n创建任务...');
    const taskId = uuidv4();
    
    await pool.query(
      `INSERT INTO upload_tasks (
        id, account_id, video_data, priority, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [taskId, account.id, JSON.stringify(testVideo), 5, 'pending']
    );
    
    // 5. 添加到队列
    const queue = new Queue('youtube-uploads', { connection: redis });
    
    const job = await queue.add('upload', {
      taskId: taskId,
      accountId: account.id
    }, {
      priority: 5,
      removeOnComplete: true,
      removeOnFail: false
    });
    
    console.log(`✅ 任务创建成功`);
    console.log(`   任务 ID: ${taskId}`);
    console.log(`   Job ID: ${job.id}`);
    
    await queue.close();
    
    // 6. 监控进度
    console.log('\n开始监控（Ctrl+C 退出）...\n');
    
    let lastStatus = '';
    const startTime = Date.now();
    
    const monitor = setInterval(async () => {
      try {
        const result = await pool.query(
          `SELECT t.status, t.error, t.result,
                  h.video_url, h.upload_duration
           FROM upload_tasks t
           LEFT JOIN upload_history h ON h.task_id = t.id AND h.success = true
           WHERE t.id = $1`,
          [taskId]
        );
        
        if (result.rows.length > 0) {
          const task = result.rows[0];
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          
          if (task.status !== lastStatus) {
            console.log(`[${elapsed}s] ${lastStatus || 'pending'} → ${task.status}`);
            lastStatus = task.status;
          }
          
          if (task.status === 'completed') {
            console.log('\n✅ 上传成功！');
            if (task.video_url) {
              console.log(`视频链接: ${task.video_url}`);
            }
            if (task.result) {
              console.log('详情:', JSON.stringify(task.result, null, 2));
            }
            clearInterval(monitor);
            process.exit(0);
          } else if (task.status === 'failed') {
            console.log('\n❌ 上传失败');
            if (task.error) {
              console.log('错误:', task.error);
            }
            
            // 获取详细错误
            const queue2 = new Queue('youtube-uploads', { connection: redis });
            const jobs = await queue2.getFailed();
            const failedJob = jobs.find(j => j.data.taskId === taskId);
            if (failedJob) {
              console.log('\n详细错误:', failedJob.failedReason);
            }
            await queue2.close();
            
            clearInterval(monitor);
            process.exit(1);
          }
        }
      } catch (e) {
        // 忽略错误
      }
    }, 2000);
    
    // Ctrl+C 处理
    process.on('SIGINT', async () => {
      console.log('\n\n停止监控...');
      clearInterval(monitor);
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

main().catch(console.error);