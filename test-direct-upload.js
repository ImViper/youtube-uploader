const { BitBrowserManager } = require('./dist/bitbrowser/manager');
const { getDatabase } = require('./dist/database/connection');
const path = require('path');

// 直接使用上传模块的内部函数
const uploadModule = require('./dist/upload');

async function testDirectUpload() {
  console.log('=== 直接上传测试（跳过登录） ===\n');
  
  const db = getDatabase();
  let browserInstance = null;
  
  try {
    // 配置
    const TASK_ID = '30115706-168b-4d16-9392-d397829ec9b1';
    const WINDOW_NAME = '0629';
    
    // 1. 获取任务信息
    console.log('[1] 获取任务信息...');
    const taskResult = await db.query(
      'SELECT * FROM upload_tasks WHERE id = $1',
      [TASK_ID]
    );
    
    if (taskResult.rows.length === 0) {
      throw new Error(`未找到任务 ID: ${TASK_ID}`);
    }
    
    const task = taskResult.rows[0];
    const videoData = task.video_data;
    
    console.log('✓ 视频信息:');
    console.log(`  - 标题: ${videoData.title}`);
    console.log(`  - 路径: ${videoData.path}`);
    console.log(`  - 描述: ${(videoData.description || '').substring(0, 50)}...`);
    
    // 2. 打开浏览器窗口
    console.log('\n[2] 打开浏览器窗口...');
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
    
    // 3. 获取页面
    console.log('\n[3] 准备页面...');
    const pages = await browser.pages();
    let page = pages[0];
    
    if (!page) {
      page = await browser.newPage();
    }
    
    // 设置 upload 模块使用的浏览器和页面
    uploadModule.browser = browser;
    uploadModule.page = page;
    
    // 4. 直接导航到上传页面
    console.log('\n[4] 导航到上传页面...');
    const uploadURL = 'https://www.youtube.com/upload';
    await page.goto(uploadURL, { waitUntil: 'networkidle2' });
    console.log('✓ 已导航到上传页面');
    
    // 等待页面加载
    await page.waitForTimeout(3000);
    
    // 5. 执行上传
    console.log('\n[5] 开始上传视频...');
    console.log('==================================================');
    
    const messageTransport = {
      log: (message) => console.log(`[上传日志] ${message}`),
      debug: (message) => console.log(`[调试] ${message}`),
      userAction: (message) => console.log(`[用户操作] ${message}`)
    };
    
    // 调用内部的 uploadVideo 函数
    const uploadVideo = uploadModule.uploadVideo;
    if (!uploadVideo) {
      throw new Error('uploadVideo 函数不可用');
    }
    
    // 准备视频数据
    const videoToUpload = {
      ...videoData,
      onProgress: (progress) => {
        if (typeof progress === 'number') {
          process.stdout.write(`\r上传进度: ${progress}%`);
        } else if (typeof progress === 'string') {
          console.log(`\n状态: ${progress}`);
        }
      }
    };
    
    const startTime = Date.now();
    
    try {
      const videoLink = await uploadVideo(videoToUpload, messageTransport);
      
      const uploadDuration = Math.round((Date.now() - startTime) / 1000);
      console.log('\n\n==================================================');
      console.log('✅ 上传成功！');
      console.log(`  - 视频链接: ${videoLink}`);
      console.log(`  - 上传耗时: ${uploadDuration} 秒`);
      
      // 6. 更新数据库
      console.log('\n[6] 更新数据库...');
      
      // 更新任务状态
      await db.query(
        `UPDATE upload_tasks 
         SET status = 'completed', 
             completed_at = NOW(),
             result = $2
         WHERE id = $1`,
        [TASK_ID, { 
          videoUrl: videoLink,
          uploadDuration: uploadDuration
        }]
      );
      console.log('✓ 任务状态已更新');
      
    } catch (uploadError) {
      console.error('\n❌ 上传失败:', uploadError.message);
      
      // 更新任务状态为失败
      await db.query(
        `UPDATE upload_tasks 
         SET status = 'failed', 
             error = $2,
             completed_at = NOW()
         WHERE id = $1`,
        [TASK_ID, uploadError.message]
      );
    }
    
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
    
    console.log('\n程序结束');
  }
}

testDirectUpload();