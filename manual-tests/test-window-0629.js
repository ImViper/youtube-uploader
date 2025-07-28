const { BitBrowserManager } = require('../dist/bitbrowser/manager');
const { getDatabase } = require('../dist/database/connection');

async function testWindow0629() {
  console.log('=== 测试 0629 窗口连接 ===\n');
  
  const db = getDatabase();
  let browserInstance = null;
  
  try {
    // 初始化 BitBrowserManager
    console.log('1. 初始化 BitBrowserManager...');
    const bitBrowserManager = new BitBrowserManager({
      apiUrl: 'http://127.0.0.1:54345',
      windowPosition: { x: 1380, y: 400 }
    });
    
    // 打开 0629 窗口
    console.log('\n2. 打开 0629 窗口...');
    browserInstance = await bitBrowserManager.openBrowserByName('0629');
    
    console.log('✓ 浏览器已打开');
    console.log(`  - 窗口ID: ${browserInstance.windowId}`);
    console.log(`  - 调试地址: ${browserInstance.debugUrl}`);
    
    // 获取浏览器和页面
    const browser = browserInstance.browser;
    if (!browser) {
      throw new Error('浏览器连接不可用');
    }
    
    console.log('\n3. 获取页面信息...');
    const pages = await browser.pages();
    console.log(`  - 页面数: ${pages.length}`);
    
    // 使用第一个页面或创建新页面
    let page;
    if (pages.length > 0) {
      page = pages[0];
      const url = await page.url();
      console.log(`  - 当前 URL: ${url}`);
      
      // 如果不在 YouTube，导航到 YouTube
      if (!url.includes('youtube.com')) {
        console.log('\n4. 导航到 YouTube...');
        await page.goto('https://www.youtube.com', { 
          waitUntil: 'networkidle2',
          timeout: 30000 
        });
        console.log('✓ 已导航到 YouTube');
      }
    } else {
      console.log('\n4. 创建新页面...');
      page = await browser.newPage();
      await page.goto('https://www.youtube.com', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      console.log('✓ 已创建新页面并导航到 YouTube');
    }
    
    // 检查登录状态
    console.log('\n5. 检查登录状态...');
    await page.waitForTimeout(2000);
    
    // 尝试查找用户头像或登录按钮
    const isLoggedIn = await page.evaluate(() => {
      // 检查是否有用户头像按钮
      const avatarButton = document.querySelector('#avatar-btn');
      const accountButton = document.querySelector('button[aria-label*="Google Account"]');
      const signInButton = document.querySelector('a[href*="accounts.google.com/ServiceLogin"]');
      
      return !!(avatarButton || accountButton) && !signInButton;
    });
    
    if (isLoggedIn) {
      console.log('✓ 已登录 YouTube');
      
      // 获取频道信息
      const channelInfo = await page.evaluate(() => {
        const channelElement = document.querySelector('#channel-title');
        const accountElement = document.querySelector('#account-name');
        
        return {
          channel: channelElement?.textContent?.trim(),
          account: accountElement?.textContent?.trim()
        };
      });
      
      if (channelInfo.channel || channelInfo.account) {
        console.log(`  - 频道/账户: ${channelInfo.channel || channelInfo.account}`);
      }
    } else {
      console.log('⚠ 未登录 YouTube，需要手动登录');
    }
    
    // 测试导航到上传页面
    console.log('\n6. 测试导航到上传页面...');
    await page.goto('https://www.youtube.com/upload', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // 等待上传界面加载
    const uploadReady = await page.evaluate(() => {
      // 检查是否有上传按钮或拖放区域
      const uploadButton = document.querySelector('input[type="file"]');
      const dropArea = document.querySelector('[id*="upload-prompt-box"]');
      const selectFilesButton = document.querySelector('button[id*="select-files-button"]');
      
      return !!(uploadButton || dropArea || selectFilesButton);
    });
    
    if (uploadReady) {
      console.log('✓ 上传页面已就绪');
    } else {
      console.log('⚠ 上传页面可能未正确加载');
    }
    
    console.log('\n✅ 测试完成！0629 窗口可以正常使用');
    
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
  }
}

testWindow0629();