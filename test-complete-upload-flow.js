const { BitBrowserManager } = require('./dist/bitbrowser/manager');
const { getDatabase } = require('./dist/database/connection');
const path = require('path');
const fs = require('fs');

async function completeUploadFlow(page, videoData) {
  console.log('\n处理可见性设置页面...');
  
  try {
    // 等待可见性选项出现
    console.log('等待可见性选项...');
    
    // 选择隐私级别
    const privacy = videoData.privacy || 'UNLISTED';
    console.log(`设置隐私级别为: ${privacy}`);
    
    // 根据隐私级别选择对应的单选按钮
    const privacySelectors = {
      'PRIVATE': ['tp-yt-paper-radio-button[name="PRIVATE"]', '#privacy-radios tp-yt-paper-radio-button:nth-child(1)'],
      'UNLISTED': ['tp-yt-paper-radio-button[name="UNLISTED"]', '#privacy-radios tp-yt-paper-radio-button:nth-child(2)'],
      'PUBLIC': ['tp-yt-paper-radio-button[name="PUBLIC"]', '#privacy-radios tp-yt-paper-radio-button:nth-child(3)']
    };
    
    const selectors = privacySelectors[privacy] || privacySelectors['UNLISTED'];
    
    let clicked = false;
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        await page.click(selector);
        console.log(`✓ 成功选择隐私级别: ${privacy}`);
        clicked = true;
        break;
      } catch (e) {
        // 继续尝试下一个选择器
      }
    }
    
    if (!clicked) {
      // 使用 evaluate 在页面上下文中直接操作
      await page.evaluate((privacyLevel) => {
        const radioButtons = document.querySelectorAll('tp-yt-paper-radio-button');
        radioButtons.forEach(button => {
          const buttonName = button.getAttribute('name');
          if (buttonName === privacyLevel) {
            button.click();
          }
        });
      }, privacy);
      console.log(`✓ 通过脚本选择了隐私级别: ${privacy}`);
    }
    
    // 等待一下让选择生效
    await page.waitForTimeout(2000);
    
    // 获取视频链接
    console.log('\n获取视频链接...');
    let videoLink = '';
    
    const linkSelectors = [
      'a[href*="youtube.com/shorts"]',
      'a[href*="youtube.com/watch"]',
      '.video-url-fadeable a',
      'ytcp-video-info a',
      'input.ytcp-social-suggestions-textbox'
    ];
    
    for (const selector of linkSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const href = await page.evaluate(el => el.href || el.value, element);
          if (href && href.includes('youtube.com')) {
            videoLink = href;
            console.log(`✓ 获取到视频链接: ${videoLink}`);
            break;
          }
        }
      } catch (e) {
        // 继续尝试
      }
    }
    
    // 查找并点击发布/保存按钮
    console.log('\n查找发布按钮...');
    const publishButtonSelectors = [
      '#done-button',
      'ytcp-button[id="done-button"]',
      'tp-yt-paper-button#done-button',
      'ytcp-button.done-button',
      'tp-yt-paper-button:contains("Save")',
      'tp-yt-paper-button:contains("Publish")'
    ];
    
    let publishButton = null;
    for (const selector of publishButtonSelectors) {
      try {
        publishButton = await page.$(selector);
        if (publishButton) {
          const isVisible = await publishButton.isVisible();
          if (isVisible) {
            console.log(`✓ 找到发布按钮: ${selector}`);
            break;
          }
        }
      } catch (e) {
        // 继续尝试
      }
    }
    
    if (publishButton) {
      await publishButton.click();
      console.log('✓ 点击了发布按钮');
    } else {
      // 尝试通过文本查找
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('ytcp-button, tp-yt-paper-button'));
        const publishButton = buttons.find(button => {
          const text = button.textContent?.toLowerCase() || '';
          return text.includes('save') || text.includes('publish') || text.includes('done');
        });
        if (publishButton) {
          publishButton.click();
        }
      });
      console.log('✓ 通过脚本点击了发布按钮');
    }
    
    // 等待发布完成
    await page.waitForTimeout(3000);
    
    console.log('✓ 视频发布完成！');
    
    return videoLink;
    
  } catch (error) {
    console.error('处理可见性设置时出错:', error.message);
    throw error;
  }
}

async function testCompleteUploadFlow() {
  console.log('=== 测试完整上传流程（处理可见性设置） ===\n');
  
  const db = getDatabase();
  let browserInstance = null;
  
  try {
    // 配置
    const WINDOW_NAME = '0629';
    const videoData = {
      privacy: 'UNLISTED' // 设置为不公开
    };
    
    // 打开浏览器窗口
    console.log('[1] 打开浏览器窗口...');
    const bitBrowserManager = new BitBrowserManager({
      apiUrl: 'http://127.0.0.1:54345',
      windowPosition: { x: 1380, y: 400 }
    });
    
    browserInstance = await bitBrowserManager.openBrowserByName(WINDOW_NAME);
    console.log('✓ 浏览器已打开');
    
    const browser = browserInstance.browser;
    if (!browser) {
      throw new Error('浏览器连接不可用');
    }
    
    // 获取当前页面
    const pages = await browser.pages();
    const page = pages[0];
    
    if (!page) {
      throw new Error('没有找到页面');
    }
    
    console.log('\n[2] 当前页面信息...');
    const currentUrl = await page.url();
    console.log(`当前 URL: ${currentUrl}`);
    
    // 检查是否在可见性设置页面
    if (currentUrl.includes('youtube.com') && currentUrl.includes('upload')) {
      console.log('✓ 检测到正在上传页面');
      
      // 执行可见性设置流程
      const videoLink = await completeUploadFlow(page, videoData);
      
      console.log('\n==================================================');
      console.log('✅ 上传流程完成！');
      if (videoLink) {
        console.log(`  - 视频链接: ${videoLink}`);
      }
      console.log('==================================================');
      
    } else {
      console.log('⚠ 不在上传页面，请先开始上传流程');
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

testCompleteUploadFlow();