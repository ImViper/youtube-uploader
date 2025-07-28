const axios = require('axios');
const { Pool } = require('pg');
const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '../.env' });

const API_BASE_URL = 'http://localhost:5989/api/v1';

// 数据库连接
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'youtube_matrix',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Redis 连接
const redis = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null
});

// 测试视频信息
const testVideo = {
  path: "C:\\Users\\75662\\Downloads\\aaa.mp4",
  title: `测试上传 - ${new Date().toLocaleString('zh-CN')}`,
  description: "这是一个自动化测试上传的视频",
  tags: ["测试", "自动化", "YouTube"],
  privacy: "private", // 使用私密模式以免公开
  language: "zh-CN",
  categoryId: "22" // 人物与博客
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer(url, maxRetries = 30) {
  console.log(`等待服务器响应: ${url}`);
  for (let i = 0; i < maxRetries; i++) {
    try {
      await axios.get(url, { timeout: 1000 });
      console.log('✅ 服务器已响应');
      return true;
    } catch (error) {
      process.stdout.write('.');
      await sleep(1000);
    }
  }
  console.log('\n❌ 服务器未响应');
  return false;
}

async function checkPrerequisites() {
  console.log('\n=== 检查前置条件 ===');
  
  // 1. 检查视频文件
  if (!fs.existsSync(testVideo.path)) {
    console.error(`❌ 视频文件不存在: ${testVideo.path}`);
    return false;
  }
  const stats = fs.statSync(testVideo.path);
  console.log(`✅ 视频文件存在 (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  
  // 2. 检查数据库连接
  try {
    await pool.query('SELECT 1');
    console.log('✅ 数据库连接正常');
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    return false;
  }
  
  // 3. 检查 Redis 连接
  try {
    await redis.ping();
    console.log('✅ Redis 连接正常');
  } catch (error) {
    console.error('❌ Redis 连接失败:', error.message);
    return false;
  }
  
  // 4. 检查 API 服务器
  const apiReady = await waitForServer('http://localhost:5989/api/health');
  if (!apiReady) return false;
  
  // 5. 检查账户
  try {
    const accounts = await pool.query(
      "SELECT id, email, status FROM accounts WHERE status = 'active' LIMIT 5"
    );
    if (accounts.rows.length === 0) {
      console.error('❌ 没有可用的活跃账户');
      return false;
    }
    console.log(`✅ 找到 ${accounts.rows.length} 个活跃账户`);
    return accounts.rows[0].id; // 返回第一个账户ID
  } catch (error) {
    console.error('❌ 查询账户失败:', error.message);
    return false;
  }
}

async function createUploadTask(accountId) {
  console.log('\n=== 创建上传任务 ===');
  
  const taskData = {
    type: "upload",
    priority: "high",
    accountId: accountId,
    video: testVideo,
    metadata: {
      categoryId: testVideo.categoryId,
      allowComments: true,
      allowRatings: true,
      allowEmbedding: true
    }
  };
  
  try {
    console.log('发送任务请求...');
    const response = await axios.post(`${API_BASE_URL}/tasks`, taskData);
    const task = response.data.data;
    
    console.log('✅ 任务创建成功');
    console.log(`- 任务 ID: ${task.id}`);
    console.log(`- 状态: ${task.status}`);
    console.log(`- 账户 ID: ${task.accountId}`);
    
    return task.id;
  } catch (error) {
    console.error('❌ 创建任务失败:', error.response?.data || error.message);
    return null;
  }
}

async function monitorTask(taskId) {
  console.log('\n=== 监控任务执行 ===');
  console.log('提示: 请观察 BitBrowser 窗口中的上传进度\n');
  
  const startTime = Date.now();
  let lastStatus = '';
  let lastProgress = 0;
  
  while (true) {
    try {
      // 从数据库获取任务状态
      const result = await pool.query(
        'SELECT * FROM upload_tasks WHERE id = $1',
        [taskId]
      );
      
      if (result.rows.length === 0) {
        console.error('任务不存在');
        break;
      }
      
      const task = result.rows[0];
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      
      // 状态变化时显示
      if (task.status !== lastStatus) {
        console.log(`\n[${elapsed}s] 状态变更: ${lastStatus || '初始'} → ${task.status}`);
        lastStatus = task.status;
        
        if (task.started_at) {
          console.log(`- 开始时间: ${new Date(task.started_at).toLocaleTimeString()}`);
        }
      }
      
      // 检查队列中的进度
      const queue = new Queue('youtube-uploads', { connection: redis });
      const job = await queue.getJob(taskId);
      if (job && job.progress) {
        const progress = typeof job.progress === 'object' ? job.progress.progress : job.progress;
        if (progress && progress !== lastProgress) {
          console.log(`[${elapsed}s] 上传进度: ${progress}%`);
          lastProgress = progress;
        }
      }
      
      // 任务完成或失败
      if (['completed', 'failed'].includes(task.status)) {
        console.log(`\n任务${task.status === 'completed' ? '成功' : '失败'}！`);
        
        if (task.status === 'completed') {
          console.log('✅ 视频上传成功');
          if (task.result) {
            console.log('上传结果:', JSON.stringify(task.result, null, 2));
          }
        } else {
          console.log('❌ 上传失败');
          if (task.error) {
            console.log('错误信息:', task.error);
          }
        }
        
        await queue.close();
        return task;
      }
      
      // 超时检查
      if (elapsed > 600) { // 10分钟超时
        console.log('\n⏱️ 监控超时');
        await queue.close();
        break;
      }
      
      await sleep(2000); // 每2秒检查一次
    } catch (error) {
      console.error('监控错误:', error.message);
      await sleep(5000);
    }
  }
}

async function checkUploadHistory(accountId) {
  console.log('\n=== 检查上传历史 ===');
  
  try {
    const result = await pool.query(`
      SELECT 
        uh.id,
        uh.video_url,
        uh.upload_duration,
        uh.success,
        uh.created_at,
        ut.video_data->>'title' as title
      FROM upload_history uh
      JOIN upload_tasks ut ON uh.task_id = ut.id
      WHERE uh.account_id = $1
      ORDER BY uh.created_at DESC
      LIMIT 5
    `, [accountId]);
    
    if (result.rows.length > 0) {
      console.log(`最近的上传记录 (共 ${result.rows.length} 条):`);
      result.rows.forEach((record, index) => {
        console.log(`\n${index + 1}. ${record.title}`);
        console.log(`   - URL: ${record.video_url || '无'}`);
        console.log(`   - 耗时: ${record.upload_duration || 0} 秒`);
        console.log(`   - 状态: ${record.success ? '成功' : '失败'}`);
        console.log(`   - 时间: ${new Date(record.created_at).toLocaleString()}`);
      });
    } else {
      console.log('暂无上传记录');
    }
  } catch (error) {
    console.error('查询失败:', error.message);
  }
}

async function main() {
  console.log('=== YouTube 视频上传完整测试 ===');
  console.log(`时间: ${new Date().toLocaleString()}\n`);
  
  try {
    // 1. 检查前置条件
    const accountId = await checkPrerequisites();
    if (!accountId) {
      console.log('\n请解决上述问题后重试');
      return;
    }
    
    // 2. 创建上传任务
    const taskId = await createUploadTask(accountId);
    if (!taskId) {
      console.log('\n任务创建失败，测试终止');
      return;
    }
    
    // 3. 监控任务执行
    const result = await monitorTask(taskId);
    
    // 4. 检查上传历史
    await checkUploadHistory(accountId);
    
    console.log('\n=== 测试完成 ===');
    
  } catch (error) {
    console.error('\n测试失败:', error.message);
  } finally {
    await pool.end();
    await redis.quit();
  }
}

// 运行测试
main().catch(console.error);