const { UploadWorkerV2 } = require('./dist/workers/upload-worker-v2');
const { AccountManager } = require('./dist/accounts/manager');
const { BitBrowserManager } = require('./dist/bitbrowser/manager');

async function startUploadWorker() {
  console.log('=== 启动 Upload Worker V2 ===\n');
  
  try {
    // 初始化依赖
    console.log('初始化组件...');
    
    const accountManager = new AccountManager();
    console.log('✓ AccountManager 已初始化');
    
    const bitBrowserManager = new BitBrowserManager({
      apiUrl: process.env.BITBROWSER_API_URL || 'http://127.0.0.1:54345',
      windowPosition: { x: 1380, y: 400 }
    });
    console.log('✓ BitBrowserManager 已初始化');
    
    // 创建 worker
    const worker = new UploadWorkerV2({
      accountManager,
      bitBrowserManager,
      maxUploadTime: 1800000, // 30分钟
      maxRetries: 3
    });
    
    console.log('✓ UploadWorkerV2 已创建');
    console.log('\n开始监听上传任务...');
    console.log('按 Ctrl+C 停止\n');
    
    // 启动 worker
    await worker.start();
    
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

// 处理退出信号
process.on('SIGINT', async () => {
  console.log('\n\n正在停止 worker...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n正在停止 worker...');
  process.exit(0);
});

startUploadWorker();