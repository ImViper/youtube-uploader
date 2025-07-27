const { BitBrowserManager } = require('./dist/bitbrowser/manager');
const { getDatabase } = require('./dist/database/connection');
const path = require('path');
const fs = require('fs');

async function uploadVideoWithLoggedInBrowser(page, videoData, messageTransport) {
  console.log('\n开始上传流程...');
  
  // 1. 导航到上传页面
  const uploadURL = 'https://www.youtube.com/upload';
  await page.goto(uploadURL, { waitUntil: 'networkidle2' });
  console.log('✓ 已导航到上传页面');
  
  await page.waitForTimeout(2000);
  
  // 2. 查找文件输入框
  console.log('查找文件输入框...');
  
  // 尝试多种选择器
  const fileInputSelectors = [
    'input[type="file"]',
    'input[name="Filedata"]',
    '#content > input[type="file"]',
    'ytcp-uploads-file-picker input[type="file"]'
  ];
  
  let fileInput = null;
  for (const selector of fileInputSelectors) {
    try {
      fileInput = await page.$(selector);
      if (fileInput) {
        console.log(`✓ 找到文件输入框: ${selector}`);
        break;
      }
    } catch (e) {
      // 继续尝试下一个选择器
    }
  }
  
  if (!fileInput) {
    // 如果找不到文件输入框，尝试点击上传按钮
    console.log('尝试点击上传按钮...');
    const uploadButtonSelectors = [
      '#select-files-button',
      'button[id*="select-files"]',
      '#upload-prompt-box',
      'ytcp-uploads-dialog'
    ];
    
    for (const selector of uploadButtonSelectors) {
      try {
        await page.click(selector);
        console.log(`✓ 点击了上传按钮: ${selector}`);
        await page.waitForTimeout(1000);
        break;
      } catch (e) {
        // 继续尝试
      }
    }
    
    // 再次查找文件输入框
    for (const selector of fileInputSelectors) {
      try {
        fileInput = await page.$(selector);
        if (fileInput) {
          console.log(`✓ 找到文件输入框: ${selector}`);
          break;
        }
      } catch (e) {
        // 继续尝试
      }
    }
  }
  
  if (!fileInput) {
    throw new Error('无法找到文件上传输入框');
  }
  
  // 3. 上传文件
  console.log(`上传文件: ${videoData.path}`);
  await fileInput.uploadFile(videoData.path);
  console.log('✓ 文件已选择');
  
  // 4. 等待上传开始
  await page.waitForTimeout(3000);
  
  // 5. 填写视频信息
  console.log('\n填写视频信息...');
  
  // 等待标题输入框
  try {
    await page.waitForSelector('#textbox', { timeout: 10000 });
    
    // 清空并输入标题
    await page.click('#textbox');
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.type('#textbox', videoData.title);
    console.log(`✓ 已输入标题: ${videoData.title}`);
  } catch (e) {
    console.log('⚠ 无法找到标题输入框');
  }
  
  // 输入描述
  if (videoData.description) {
    try {
      const descriptionBox = await page.$('#description-container #textbox');
      if (descriptionBox) {
        await descriptionBox.click();
        await page.keyboard.down('Control');
        await page.keyboard.press('A');
        await page.keyboard.up('Control');
        await page.keyboard.press('Backspace');
        await page.type('#description-container #textbox', videoData.description);
        console.log('✓ 已输入描述');
      }
    } catch (e) {
      console.log('⚠ 无法找到描述输入框');
    }
  }
  
  // 6. 选择适合儿童设置
  console.log('\n设置视频属性...');
  try {
    // 点击"不，这不是为儿童打造的内容"
    const notForKidsSelector = 'tp-yt-paper-radio-button[name="NOT_MADE_FOR_KIDS"]';
    await page.waitForSelector(notForKidsSelector, { timeout: 10000 });
    await page.click(notForKidsSelector);
    console.log('✓ 已设置为非儿童内容');
  } catch (e) {
    console.log('⚠ 无法设置儿童内容选项');
  }
  
  // 7. 点击下一步按钮（多次）
  console.log('\n点击下一步...');
  const nextButtonSelector = '#next-button';
  
  for (let i = 0; i < 3; i++) {
    try {
      await page.waitForSelector(nextButtonSelector, { timeout: 5000 });
      await page.click(nextButtonSelector);
      console.log(`✓ 点击了下一步 (${i + 1}/3)`);
      await page.waitForTimeout(2000);
    } catch (e) {
      // 可能已经到了最后一步
      break;
    }
  }
  
  // 8. 选择公开/私密设置
  if (videoData.privacy) {
    try {
      const privacySelector = `tp-yt-paper-radio-button[name="${videoData.privacy}"]`;
      await page.waitForSelector(privacySelector, { timeout: 5000 });
      await page.click(privacySelector);
      console.log(`✓ 已设置隐私级别: ${videoData.privacy}`);
    } catch (e) {
      console.log('⚠ 无法设置隐私级别');
    }
  }
  
  // 9. 等待上传完成并获取链接
  console.log('\n等待上传完成...');
  
  // 等待"完成"按钮出现
  const doneButtonSelector = '#done-button';
  try {
    await page.waitForSelector(doneButtonSelector, { 
      visible: true, 
      timeout: 300000 // 5分钟超时
    });
    
    // 获取视频链接
    let videoLink = '';
    try {
      const linkElement = await page.$('.video-url-fadeable a');
      if (linkElement) {
        videoLink = await page.evaluate(el => el.href, linkElement);
      }
    } catch (e) {
      console.log('⚠ 无法获取视频链接');
    }
    
    // 点击完成按钮
    await page.click(doneButtonSelector);
    console.log('✓ 上传完成！');
    
    return videoLink;
    
  } catch (e) {
    throw new Error('上传超时或失败: ' + e.message);
  }
}

async function testUploadWithLoggedInBrowser() {
  console.log('=== 测试已登录浏览器上传 ===\n');
  
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
    
    // 检查文件是否存在
    if (!fs.existsSync(videoData.path)) {
      throw new Error(`视频文件不存在: ${videoData.path}`);
    }
    
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
    
    // 设置视口大小
    await page.setViewport({ width: 1280, height: 720 });
    
    // 4. 执行上传
    console.log('\n[4] 开始上传视频...');
    console.log('==================================================');
    
    const messageTransport = {
      log: (message) => console.log(`[日志] ${message}`),
      debug: (message) => console.log(`[调试] ${message}`),
      userAction: (message) => console.log(`[操作] ${message}`)
    };
    
    const startTime = Date.now();
    
    try {
      // 设置默认隐私级别
      if (!videoData.privacy) {
        videoData.privacy = 'UNLISTED'; // 不公开
      }
      
      const videoLink = await uploadVideoWithLoggedInBrowser(page, videoData, messageTransport);
      
      const uploadDuration = Math.round((Date.now() - startTime) / 1000);
      console.log('\n==================================================');
      console.log('✅ 上传成功！');
      if (videoLink) {
        console.log(`  - 视频链接: ${videoLink}`);
      }
      console.log(`  - 上传耗时: ${uploadDuration} 秒`);
      
      // 5. 更新数据库
      console.log('\n[5] 更新数据库...');
      
      // 更新任务状态
      await db.query(
        `UPDATE upload_tasks 
         SET status = 'completed', 
             completed_at = NOW(),
             result = $2
         WHERE id = $1`,
        [TASK_ID, { 
          videoUrl: videoLink || 'upload-completed',
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

testUploadWithLoggedInBrowser();