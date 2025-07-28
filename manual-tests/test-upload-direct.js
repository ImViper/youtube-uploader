const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// 确保使用正确的模块路径
const projectRoot = path.join(__dirname, '..');
const { UploadWorkerV2 } = require(path.join(projectRoot, 'dist/workers/upload-worker-v2'));
const { AccountManager } = require(path.join(projectRoot, 'dist/accounts/manager'));
const { BitBrowserManager } = require(path.join(projectRoot, 'dist/bitbrowser/manager'));
const { getDatabase } = require(path.join(projectRoot, 'dist/database/connection'));
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'youtube_matrix',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// 测试视频
const testVideo = {
  path: "C:\\Users\\75662\\Downloads\\aaa.mp4",
  title: `直接测试 - ${new Date().toLocaleString('zh-CN')}`,
  description: "直接调用 Worker 测试",
  tags: ["测试"],
  privacy: "private",
  language: "zh-CN"
};

async function testDirectUpload() {
  console.log('=== 直接 Worker 测试 ===\n');
  
  try {
    // 1. 检查视频文件
    if (!fs.existsSync(testVideo.path)) {
      console.error('视频文件不存在');
      return;
    }
    console.log('✅ 视频文件存在');
    
    // 2. 获取账户
    const accountResult = await pool.query(
      `SELECT id, email FROM accounts 
       WHERE bitbrowser_window_name = '0629' AND status = 'active' 
       LIMIT 1`
    );
    
    if (accountResult.rows.length === 0) {
      console.error('没有账户');
      return;
    }
    
    const account = accountResult.rows[0];
    console.log(`✅ 使用账户: ${account.email}`);
    
    // 3. 创建任务
    const taskId = uuidv4();
    
    await pool.query(
      `INSERT INTO upload_tasks (
        id, account_id, video_data, priority, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [taskId, account.id, JSON.stringify(testVideo), 5, 'pending']
    );
    
    console.log(`✅ 任务创建: ${taskId}`);
    
    // 4. 初始化管理器
    console.log('\n初始化管理器...');
    const accountManager = new AccountManager();
    const bitBrowserManager = new BitBrowserManager({
      apiUrl: process.env.BITBROWSER_API_URL || 'http://127.0.0.1:54345',
      windowPosition: {
        x: parseInt(process.env.BITBROWSER_WINDOW_X || '1380'),
        y: parseInt(process.env.BITBROWSER_WINDOW_Y || '400')
      }
    });
    
    console.log('✅ 管理器初始化成功');
    
    // 5. 创建模拟的 Job 对象
    const mockJob = {
      id: 'test-job-' + Date.now(),
      data: {
        taskId: taskId,
        accountId: account.id
      },
      updateProgress: async (progress) => {
        console.log('进度更新:', progress);
      },
      attemptsMade: 0
    };
    
    // 6. 直接调用 Worker 的处理方法
    console.log('\n开始处理任务...');
    const worker = new UploadWorkerV2({
      accountManager,
      bitBrowserManager,
      maxUploadTime: 1800000,
      maxRetries: 3
    });
    
    // 监听错误
    worker.on('error', (error) => {
      console.error('Worker 错误:', error);
    });
    
    worker.on('failed', (job, error) => {
      console.error('任务失败:', error);
    });
    
    // 手动处理任务
    console.log('\n正在处理...');
    const result = await worker.processUpload(mockJob);
    console.log('\n处理结果:', result);
    
    // 停止 Worker
    await worker.stop();
    
  } catch (error) {
    console.error('\n错误:', error);
    console.error('堆栈:', error.stack);
  } finally {
    await pool.end();
    // 等待一下让日志输出完整
    await new Promise(resolve => setTimeout(resolve, 2000));
    process.exit();
  }
}

testDirectUpload().catch(console.error);