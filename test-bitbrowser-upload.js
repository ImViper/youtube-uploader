const { BitBrowserApiClient } = require('./dist/bitbrowser/api-client');
const { upload } = require('./dist/upload');
const { getDatabase } = require('./dist/database/connection');
// const { AccountManager } = require('./dist/accounts/manager'); // 不需要，因为账号已登录
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');

// 使用 stealth 插件
puppeteer.use(StealthPlugin());

// ===== 配置区域 - 请根据实际情况修改 =====
const CONFIG = {
  TASK_ID: '30115706-168b-4d16-9392-d397829ec9b1', // 任务ID
  WINDOW_NAME: '0629', // 强制使用 0629 窗口
  BITBROWSER_API_URL: 'http://127.0.0.1:54345',
  WINDOW_POSITION: { x: 1380, y: 400 }
};

async function testBitBrowserUpload() {
  console.log('=== BitBrowser 上传测试 ===\n');
  console.log('配置:', CONFIG);
  console.log('\n' + '='.repeat(50) + '\n');
  
  const db = getDatabase();
  let browser = null;
  let apiClient = null;
  let historyId = null;

  try {
    // 步骤 1: 获取并显示任务信息
    console.log('[步骤 1] 获取任务信息...');
    const taskResult = await db.query(
      'SELECT * FROM upload_tasks WHERE id = $1',
      [CONFIG.TASK_ID]
    );
    
    if (taskResult.rows.length === 0) {
      throw new Error(`未找到任务 ID: ${CONFIG.TASK_ID}`);
    }
    
    const task = taskResult.rows[0];
    const videoData = task.video_data;
    
    console.log('✓ 任务信息:');
    console.log(`  - ID: ${task.id}`);
    console.log(`  - 状态: ${task.status}`);
    console.log(`  - 优先级: ${task.priority}`);
    console.log(`  - 创建时间: ${task.created_at}`);
    console.log(`  - 账户ID: ${task.account_id || '未分配'}`);
    
    console.log('\n✓ 视频信息:');
    console.log(`  - 标题: ${videoData.title}`);
    console.log(`  - 路径: ${videoData.path}`);
    console.log(`  - 描述: ${(videoData.description || '').substring(0, 50)}...`);
    console.log(`  - 标签: ${videoData.tags || []}`);
    
    // 检查视频文件是否存在
    const fs = require('fs');
    if (!fs.existsSync(videoData.path)) {
      throw new Error(`视频文件不存在: ${videoData.path}`);
    }
    const stats = fs.statSync(videoData.path);
    console.log(`  - 文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
    // 步骤 2: 查找关联的账户和窗口
    console.log('\n[步骤 2] 查找关联的账户和窗口...');
    
    let account = null;
    // 优先使用 CONFIG.WINDOW_NAME
    let windowName = CONFIG.WINDOW_NAME;
    
    // 如果任务已有账户ID，使用该账户
    if (task.account_id) {
      const accountResult = await db.query(
        'SELECT * FROM accounts WHERE id = $1',
        [task.account_id]
      );
      if (accountResult.rows.length > 0) {
        account = accountResult.rows[0];
        // 如果 CONFIG.WINDOW_NAME 没有设置，才使用账户的窗口名称
        if (!windowName) {
          windowName = account.bitbrowser_window_name || '0629';
        }
        console.log(`✓ 使用任务关联的账户: ${account.email}`);
      }
    }
    
    // 如果没有找到账户，查找所有可用账户
    if (!account) {
      console.log('✓ 查找可用账户...');
      const accountsResult = await db.query(
        `SELECT * FROM accounts 
         WHERE status = 'active' 
         AND daily_upload_count < daily_upload_limit 
         ORDER BY health_score DESC, daily_upload_count ASC 
         LIMIT 1`
      );
      
      if (accountsResult.rows.length === 0) {
        throw new Error('没有可用的账户进行上传');
      }
      
      account = accountsResult.rows[0];
      // 如果 CONFIG.WINDOW_NAME 没有设置，才使用账户的窗口名称
      if (!windowName) {
        windowName = account.bitbrowser_window_name || '0629';
      }
      console.log(`✓ 选择账户: ${account.email}`);
    }
    
    console.log('\n✓ 账户详情:');
    console.log(`  - ID: ${account.id}`);
    console.log(`  - Email: ${account.email}`);
    console.log(`  - 窗口名: ${windowName}`);
    console.log(`  - 状态: ${account.status}`);
    console.log(`  - 健康分数: ${account.health_score}`);
    console.log(`  - 今日上传: ${account.daily_upload_count}/${account.daily_upload_limit}`);
    
    // 步骤 3: 初始化 BitBrowser
    console.log('\n[步骤 3] 初始化 BitBrowser...');
    apiClient = new BitBrowserApiClient({
      apiUrl: CONFIG.BITBROWSER_API_URL
    });
    
    // 步骤 4: 打开浏览器窗口
    console.log(`\n[步骤 4] 打开浏览器窗口...`);
    console.log(`  - 窗口名称: ${windowName}`);
    console.log(`  - 窗口ID: ${account.browser_profile_id}`);
    
    // 使用 BitBrowserManager 而不是直接调用 API
    const { BitBrowserManager } = require('./dist/bitbrowser/manager');
    const bitBrowserManager = new BitBrowserManager({
      apiUrl: CONFIG.BITBROWSER_API_URL,
      windowPosition: CONFIG.WINDOW_POSITION
    });
    
    // 尝试通过名称打开窗口
    let browserInstance;
    try {
      console.log('  - 尝试通过名称打开窗口...');
      browserInstance = await bitBrowserManager.openBrowserByName(windowName);
    } catch (error) {
      console.log('  - 通过名称打开失败，尝试使用ID...');
      browserInstance = await bitBrowserManager.openBrowser(account.browser_profile_id);
    }
    
    if (!browserInstance) {
      throw new Error(`无法打开窗口 ${windowName}`);
    }
    
    console.log(`✓ 浏览器已打开`);
    console.log(`  - 窗口ID: ${browserInstance.windowId}`);
    console.log(`  - 调试地址: ${browserInstance.debugUrl}`);
    
    // 等待浏览器完全启动
    console.log('  - 等待浏览器启动...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 步骤 5: 获取浏览器连接
    console.log('\n[步骤 5] 获取浏览器连接...');
    
    browser = browserInstance.browser;
    if (!browser) {
      throw new Error('浏览器连接不可用');
    }
    
    const pages = await browser.pages();
    console.log(`✓ 已连接，页面数: ${pages.length}`);
    
    // 检查是否已登录 YouTube
    if (pages.length > 0) {
      const page = pages[0];
      const url = page.url();
      console.log(`  - 当前页面: ${url}`);
      
      if (url.includes('youtube.com')) {
        console.log('  - ✓ 已在 YouTube 页面');
      } else {
        console.log('  - ⚠ 不在 YouTube 页面，可能需要登录');
      }
    }
    
    // 步骤 6: 更新任务状态
    console.log('\n[步骤 6] 更新任务状态...');
    await db.query(
      `UPDATE upload_tasks 
       SET status = 'active', 
           started_at = NOW(),
           account_id = $2
       WHERE id = $1`,
      [CONFIG.TASK_ID, account.id]
    );
    console.log('✓ 任务状态已更新为 active');
    
    // 导航到 YouTube
    if (pages.length > 0) {
      const page = pages[0];
      const url = page.url();
      
      if (!url.includes('youtube.com')) {
        console.log('\n导航到 YouTube...');
        await page.goto('https://www.youtube.com', { waitUntil: 'networkidle2' });
        console.log('✓ 已导航到 YouTube');
      }
    }
    
    // 步骤 7: 跳过创建上传历史记录（将在上传后创建）
    console.log('\n[步骤 7] 准备上传...');
    
    // 步骤 8: 执行上传
    console.log('\n[步骤 8] 开始执行上传...');
    console.log('='.repeat(50));
    
    const startTime = Date.now();
    let lastProgress = -1;
    
    // 创建一个模拟的 credentials 对象，因为 upload 函数需要它
    // 但实际上不会使用，因为浏览器已经登录
    const mockCredentials = {
      email: account.email,
      pass: '',
      recoveryemail: ''
    };
    
    const uploadResults = await upload(
      mockCredentials,
      [videoData],
      {
        browser: browser,
        onSuccess: (video) => {
          console.log('\n✅ 上传成功!');
          console.log(`  - 视频链接: ${video.link}`);
          console.log(`  - 视频 ID: ${video.id}`);
        },
        onError: (error) => {
          console.error('\n❌ 上传错误:', error);
        },
        onProgress: (progress) => {
          if (typeof progress === 'number' && progress !== lastProgress) {
            lastProgress = progress;
            process.stdout.write(`\r上传进度: ${progress}%`);
          } else if (typeof progress === 'string') {
            console.log(`\n状态: ${progress}`);
          }
        },
        onLog: (log) => {
          console.log(`[上传日志] ${log}`);
        }
      }
    );
    
    const uploadDuration = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n\n上传耗时: ${uploadDuration} 秒`);
    console.log('='.repeat(50));
    
    // 步骤 9: 处理上传结果
    console.log('\n[步骤 9] 处理上传结果...');
    
    if (!uploadResults || uploadResults.length === 0) {
      throw new Error('上传未返回任何结果');
    }
    
    const result = uploadResults[0];
    if (!result.link) {
      throw new Error('上传返回结果无效');
    }
    
    console.log('✓ 上传成功，更新数据库...');
    
    // 更新任务状态
    await db.query(
      `UPDATE upload_tasks 
       SET status = 'completed', 
           completed_at = NOW(),
           result = $2
       WHERE id = $1`,
      [CONFIG.TASK_ID, { 
        videoId: result.id,
        videoUrl: result.link,
        uploadDuration: uploadDuration
      }]
    );
    console.log('  - ✓ 任务状态已更新');
    
    // 创建成功的上传历史
    await db.query(
      `INSERT INTO upload_history (
        task_id, account_id, video_url, upload_duration, success, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())`,
      [CONFIG.TASK_ID, account.id, result.link, uploadDuration, true]
    );
    console.log('  - ✓ 上传历史已创建');
    
    // 更新账户统计
    await db.query(
      `UPDATE accounts 
       SET daily_upload_count = daily_upload_count + 1,
           last_upload_time = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [account.id]
    );
    console.log('  - ✓ 账户统计已更新');
    
    // 步骤 10: 显示最终结果
    console.log('\n[步骤 10] 最终结果...');
    console.log('='.repeat(50));
    
    console.log('\n✅ 上传成功!');
    console.log(`  - 视频标题: ${result.title || videoData.title}`);
    console.log(`  - 视频链接: ${result.link}`);
    console.log(`  - 视频 ID: ${result.id}`);
    console.log(`  - 上传耗时: ${uploadDuration} 秒`);
    
    // 获取更新后的账户状态
    const finalAccountResult = await db.query(
      'SELECT * FROM accounts WHERE id = $1',
      [account.id]
    );
    const finalAccount = finalAccountResult.rows[0];
    
    console.log('\n账户状态:');
    console.log(`  - 今日上传: ${finalAccount.daily_upload_count}/${finalAccount.daily_upload_limit}`);
    console.log(`  - 最后上传: ${finalAccount.last_upload_time}`);
    
    console.log('\n='.repeat(50));
    console.log('✅ 测试完成！');
    
  } catch (error) {
    console.error('\n='.repeat(50));
    console.error('❌ 测试失败:', error.message);
    console.error('='.repeat(50));
    
    // 更新任务状态为失败
    if (CONFIG.TASK_ID) {
      await db.query(
        `UPDATE upload_tasks 
         SET status = 'failed', 
             error = $2,
             completed_at = NOW()
         WHERE id = $1`,
        [CONFIG.TASK_ID, error.message]
      );
    }
    
    // 记录失败的上传历史
    if (account && account.id) {
      await db.query(
        `INSERT INTO upload_history (
          task_id, account_id, success, error_details, created_at
        ) VALUES ($1, $2, $3, $4, NOW())`,
        [CONFIG.TASK_ID, account.id, false, { error: error.message, stack: error.stack }]
      );
    }
    
    throw error;
    
  } finally {
    // 清理资源
    console.log('\n清理资源...');
    
    if (browser) {
      await browser.disconnect();
      console.log('  - ✓ 浏览器连接已断开（窗口保持打开）');
    }
    
    // 关闭数据库连接池
    if (db && db.pool) {
      await db.pool.end();
    }
    console.log('  - ✓ 数据库连接已关闭');
    
    console.log('\n程序结束');
  }
}

// 主函数
async function main() {
  console.clear();
  console.log('YouTube Matrix - BitBrowser 上传测试工具');
  console.log('='.repeat(50));
  console.log('\n使用说明:');
  console.log('1. 确保 BitBrowser 已启动');
  console.log('2. 确保数据库中有有效的任务和账户');
  console.log('3. 确保视频文件路径正确');
  console.log('4. 运行前请先执行: npm run build');
  console.log('\n' + '='.repeat(50) + '\n');
  
  try {
    await testBitBrowserUpload();
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
}

// 运行主函数
main();