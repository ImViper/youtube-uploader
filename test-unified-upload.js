const { BitBrowserManager } = require('./dist/bitbrowser/manager');
const { upload } = require('./dist/upload');
const { getDatabase } = require('./dist/database/connection');
const path = require('path');
const fs = require('fs');

async function testUnifiedUpload() {
  console.log('=== 测试统一上传流程（已登录的 BitBrowser） ===\n');
  
  const db = getDatabase();
  let browserInstance = null;
  
  try {
    // 配置
    const WINDOW_NAME = '0629'; // 替换为你的窗口名称
    const TEST_VIDEO = {
      path: 'C:\\Users\\75662\\Desktop\\video\\1分钟测试视频带音频.mp4',
      title: '统一上传流程测试 - ' + new Date().toISOString().slice(0, 16),
      description: '这是一个测试视频，用于验证新的统一上传流程。',
      publishType: 'UNLISTED',
      isNotForKid: true
    };
    
    // 检查视频文件
    if (!fs.existsSync(TEST_VIDEO.path)) {
      throw new Error(`视频文件不存在: ${TEST_VIDEO.path}`);
    }
    
    console.log('[1] 视频信息:');
    console.log(`  - 标题: ${TEST_VIDEO.title}`);
    console.log(`  - 路径: ${TEST_VIDEO.path}`);
    console.log(`  - 描述: ${TEST_VIDEO.description}`);
    console.log(`  - 隐私设置: ${TEST_VIDEO.publishType}`);
    
    // 打开 BitBrowser
    console.log('\n[2] 打开 BitBrowser 窗口...');
    const bitBrowserManager = new BitBrowserManager({
      apiUrl: 'http://127.0.0.1:54345',
      windowPosition: { x: 1380, y: 400 }
    });
    
    browserInstance = await bitBrowserManager.openBrowserByName(WINDOW_NAME);
    console.log('✓ 浏览器已打开');
    console.log(`  - 窗口ID: ${browserInstance.windowId}`);
    console.log(`  - 调试地址: ${browserInstance.debugUrl}`);
    
    const browser = browserInstance.browser;
    if (!browser) {
      throw new Error('浏览器连接不可用');
    }
    
    // 模拟凭证（因为浏览器已登录）
    const mockCredentials = {
      email: 'test@example.com',
      pass: '',
      recoveryemail: 'recovery@example.com'
    };
    
    // 创建消息传输对象
    const messageTransport = {
      log: (message) => console.log(`[LOG] ${message}`),
      debug: (message) => console.log(`[DEBUG] ${message}`),
      warn: (message) => console.log(`[WARN] ${message}`),
      error: (message) => console.error(`[ERROR] ${message}`),
      userAction: (message) => console.log(`[ACTION] ${message}`)
    };
    
    // 执行上传
    console.log('\n[3] 开始上传...');
    console.log('==================================================');
    
    const startTime = Date.now();
    
    const uploadResults = await upload(
      mockCredentials,
      [TEST_VIDEO],
      {
        browser: browser,
        skipLogin: false, // 让系统自动检测是否需要登录
        onProgress: (progress) => {
          console.log(`[PROGRESS] ${JSON.stringify(progress)}`);
        },
        onLog: (message) => {
          console.log(`[UPLOAD LOG] ${message}`);
        }
      },
      messageTransport
    );
    
    const uploadDuration = Math.round((Date.now() - startTime) / 1000);
    
    console.log('\n==================================================');
    console.log('✅ 上传成功！');
    console.log(`  - 视频链接: ${uploadResults[0]}`);
    console.log(`  - 上传耗时: ${uploadDuration} 秒`);
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
  } finally {
    // 断开连接但保持窗口打开
    if (browserInstance && browserInstance.browser) {
      await browserInstance.browser.disconnect();
      console.log('\n浏览器连接已断开（窗口保持打开）');
    }
    
    if (db && db.pool) {
      await db.pool.end();
    }
    
    console.log('\n测试结束');
  }
}

// 运行测试
testUnifiedUpload().catch(console.error);