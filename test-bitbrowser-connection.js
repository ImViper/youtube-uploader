const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function testBitBrowserConnection() {
  console.log('=== 测试 BitBrowser 连接 ===\n');
  
  const apiUrl = 'http://127.0.0.1:54345';
  const windowName = '0629';
  
  try {
    // 1. 列出所有窗口
    console.log('1. 列出所有窗口...');
    const listResponse = await axios.post(`${apiUrl}/browser/list`, {
      page: 0,
      pageSize: 100
    });
    
    if (!listResponse.data.success) {
      throw new Error('Failed to list windows');
    }
    
    const windows = listResponse.data.data?.list || [];
    console.log(`找到 ${windows.length} 个窗口\n`);
    
    // 查找窗口 0629
    const targetWindow = windows.find(w => w.name === windowName);
    if (!targetWindow) {
      console.log(`未找到窗口: ${windowName}`);
      console.log('\n可用窗口:');
      windows.slice(0, 5).forEach(w => {
        console.log(`  - ${w.name} (ID: ${w.id})`);
      });
      return;
    }
    
    console.log(`找到窗口: ${targetWindow.name}`);
    console.log(`窗口 ID: ${targetWindow.id}\n`);
    
    // 2. 打开窗口
    console.log('2. 打开窗口...');
    const openResponse = await axios.post(`${apiUrl}/browser/open`, {
      id: targetWindow.id,
      args: ['--window-position=1380,400']
    });
    
    console.log('BitBrowser 响应:', JSON.stringify(openResponse.data, null, 2));
    
    if (!openResponse.data.success) {
      throw new Error(`Failed to open window: ${openResponse.data.message}`);
    }
    
    const debugUrl = openResponse.data.data?.http;
    if (!debugUrl) {
      throw new Error('No debug URL returned');
    }
    
    console.log(`\n调试 URL: ${debugUrl}`);
    
    // 3. 尝试不同的连接方式
    console.log('\n3. 尝试连接浏览器...\n');
    
    // 方式1: 使用原始 URL
    console.log('尝试方式 1: 原始 URL');
    try {
      const browser1 = await puppeteer.connect({
        browserURL: `http://${debugUrl}`,
        defaultViewport: null,
        headless: false,
        slowMo: 50
      });
      console.log('✓ 方式 1 成功!');
      await browser1.disconnect();
    } catch (error) {
      console.log(`✗ 方式 1 失败: ${error.message}`);
    }
    
    // 方式2: 使用 browserWSEndpoint
    console.log('\n尝试方式 2: WebSocket 端点');
    try {
      // 获取 WebSocket 端点
      const versionResponse = await axios.get(`http://${debugUrl}/json/version`);
      const wsEndpoint = versionResponse.data.webSocketDebuggerUrl;
      console.log(`WebSocket 端点: ${wsEndpoint}`);
      
      const browser2 = await puppeteer.connect({
        browserWSEndpoint: wsEndpoint,
        defaultViewport: null,
        headless: false
      });
      console.log('✓ 方式 2 成功!');
      
      const pages = await browser2.pages();
      console.log(`页面数: ${pages.length}`);
      
      await browser2.disconnect();
    } catch (error) {
      console.log(`✗ 方式 2 失败: ${error.message}`);
    }
    
    // 方式3: 直接使用端口
    console.log('\n尝试方式 3: 直接端口连接');
    try {
      const port = debugUrl.split(':')[1].split('/')[0];
      const browser3 = await puppeteer.connect({
        browserURL: `http://127.0.0.1:${port}`,
        defaultViewport: null,
        headless: false
      });
      console.log('✓ 方式 3 成功!');
      await browser3.disconnect();
    } catch (error) {
      console.log(`✗ 方式 3 失败: ${error.message}`);
    }
    
  } catch (error) {
    console.error('\n错误:', error.message);
    if (error.response) {
      console.error('响应数据:', error.response.data);
    }
  }
}

testBitBrowserConnection();