const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// 添加项目根目录到模块搜索路径
const projectRoot = path.join(__dirname, '..');
require('module').Module._nodeModulePaths = function(from) {
  const paths = [];
  let dir = from;
  while (dir !== path.parse(dir).root) {
    paths.push(path.join(dir, 'node_modules'));
    dir = path.dirname(dir);
  }
  paths.push(path.join(projectRoot, 'node_modules'));
  return paths;
};

const { UploadWorkerV2 } = require(path.join(projectRoot, 'dist/workers/upload-worker-v2'));
const { AccountManager } = require(path.join(projectRoot, 'dist/accounts/manager'));
const { BitBrowserManager } = require(path.join(projectRoot, 'dist/bitbrowser/manager'));
const { getDatabase } = require(path.join(projectRoot, 'dist/database/connection'));
const { getRedis } = require(path.join(projectRoot, 'dist/redis/connection'));

async function main() {
  console.log('[Worker 0629] 初始化中...');
  console.log('[Worker 0629] 项目根目录:', projectRoot);
  console.log('[Worker 0629] 当前目录:', __dirname);
  
  try {
    // 测试数据库连接
    const db = getDatabase();
    await db.query('SELECT 1');
    console.log('[Worker 0629] ✅ 数据库连接成功');
    
    // 测试 Redis 连接
    const redis = getRedis();
    await redis.getClient().ping();
    console.log('[Worker 0629] ✅ Redis 连接成功');
    
    // 初始化管理器
    const accountManager = new AccountManager();
    console.log('[Worker 0629] ✅ AccountManager 初始化成功');
    
    const bitBrowserManager = new BitBrowserManager({
      apiUrl: process.env.BITBROWSER_API_URL || 'http://127.0.0.1:54345',
      windowPosition: {
        x: parseInt(process.env.BITBROWSER_WINDOW_X || '1380'),
        y: parseInt(process.env.BITBROWSER_WINDOW_Y || '400')
      }
    });
    console.log('[Worker 0629] ✅ BitBrowserManager 初始化成功');
    
    // 创建 Worker 实例
    console.log('[Worker 0629] 创建 UploadWorkerV2 实例...');
    const worker = new UploadWorkerV2({
      accountManager,
      bitBrowserManager,
      maxUploadTime: 1800000, // 30分钟
      maxRetries: 3
    });
    
    console.log('[Worker 0629] ✅ Upload Worker V2 已启动');
    console.log('[Worker 0629] 等待任务...');
    
    // 定期报告状态
    setInterval(() => {
      const now = new Date().toLocaleTimeString();
      console.log(`[Worker 0629] [${now}] 运行中...`);
    }, 30000); // 每30秒
    
    // 监听进程信号
    process.on('SIGTERM', async () => {
      console.log('[Worker 0629] 收到终止信号，正在关闭...');
      await worker.stop();
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      console.log('[Worker 0629] 收到中断信号，正在关闭...');
      await worker.stop();
      process.exit(0);
    });
    
    // 错误处理
    process.on('uncaughtException', (error) => {
      console.error('[Worker 0629] 未捕获的异常:', error);
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('[Worker 0629] 未处理的 Promise 拒绝:', reason);
      process.exit(1);
    });
    
  } catch (error) {
    console.error('[Worker 0629] ❌ 启动失败:', error);
    console.error('[Worker 0629] 错误详情:', error.stack);
    process.exit(1);
  }
}

main();