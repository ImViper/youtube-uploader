const axios = require('axios');
require('dotenv').config({ path: '../.env' });

async function checkBitBrowser() {
  console.log('=== BitBrowser 窗口检查 ===\n');
  
  const apiUrl = process.env.BITBROWSER_API_URL || 'http://127.0.0.1:54345';
  console.log(`API URL: ${apiUrl}`);
  
  try {
    // 1. 检查 API 健康状态
    console.log('\n1. 检查 API 健康状态...');
    try {
      const health = await axios.get(`${apiUrl}/`, { timeout: 2000 });
      console.log('✅ API 响应正常');
    } catch (e) {
      console.log('⚠️  API 健康检查失败');
    }
    
    // 2. 获取窗口列表
    console.log('\n2. 获取窗口列表...');
    const response = await axios.post(
      `${apiUrl}/browser/list`,
      { 
        page: 1, 
        pageSize: 100 
      },
      { 
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('\nAPI 响应:');
    console.log('Success:', response.data.success);
    console.log('Total:', response.data.data?.totalNum || 0);
    
    const windows = response.data.data?.list || [];
    
    if (windows.length === 0) {
      console.log('\n❌ 没有找到任何窗口');
      console.log('可能原因:');
      console.log('1. BitBrowser 服务未完全启动');
      console.log('2. 没有创建任何浏览器窗口');
      console.log('3. API 连接问题');
      
      // 尝试其他 API 端点
      console.log('\n3. 尝试其他 API 端点...');
      
      // 尝试获取版本信息
      try {
        const version = await axios.get(`${apiUrl}/version`, { timeout: 2000 });
        console.log('版本信息:', version.data);
      } catch (e) {
        console.log('版本 API 不可用');
      }
      
      // 尝试创建窗口
      console.log('\n4. 尝试打开一个窗口...');
      try {
        const openResult = await axios.post(
          `${apiUrl}/browser/open`,
          { 
            id: '0629'  // 尝试用 ID 打开
          },
          { timeout: 5000 }
        );
        console.log('打开结果:', openResult.data);
      } catch (e) {
        console.log('打开窗口失败:', e.response?.data || e.message);
      }
      
    } else {
      console.log(`\n找到 ${windows.length} 个窗口:`);
      
      // 显示所有窗口
      windows.forEach((window, index) => {
        console.log(`\n窗口 ${index + 1}:`);
        console.log(`  ID: ${window.id}`);
        console.log(`  名称: ${window.name || '未命名'}`);
        console.log(`  代码: ${window.code || '无'}`);
        console.log(`  状态: ${window.status === 0 ? '正常' : '异常'}`);
        
        // 检查是否有 0629
        if (window.name === '0629' || window.code === '0629' || 
            (window.name && window.name.includes('0629')) ||
            window.id === '0629') {
          console.log('  ⭐ 这是目标窗口 0629!');
        }
      });
      
      // 查找 0629
      const target = windows.find(w => 
        w.name === '0629' || 
        w.code === '0629' || 
        w.id === '0629' ||
        (w.name && w.name.includes('0629'))
      );
      
      if (target) {
        console.log('\n✅ 找到窗口 0629!');
        console.log('窗口详情:', JSON.stringify(target, null, 2));
      } else {
        console.log('\n❌ 未找到名为 0629 的窗口');
        console.log('请在 BitBrowser 中创建一个名为 "0629" 的窗口');
      }
    }
    
  } catch (error) {
    console.error('\n❌ API 错误:', error.message);
    if (error.response) {
      console.error('响应数据:', error.response.data);
      console.error('响应状态:', error.response.status);
    }
    
    console.log('\n可能的解决方案:');
    console.log('1. 确保 BitBrowser 服务正在运行');
    console.log('2. 检查端口 54345 是否被占用');
    console.log('3. 重启 BitBrowser 服务');
  }
}

// 持续检查
async function continuousCheck() {
  await checkBitBrowser();
  
  console.log('\n是否继续监控? (y/n)');
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const answer = await new Promise(resolve => {
    rl.question('> ', resolve);
  });
  rl.close();
  
  if (answer.toLowerCase() === 'y') {
    console.log('\n每5秒检查一次，按 Ctrl+C 退出...\n');
    
    setInterval(async () => {
      console.log(`\n[${new Date().toLocaleTimeString()}] 检查中...`);
      
      try {
        const response = await axios.post(
          `${process.env.BITBROWSER_API_URL || 'http://127.0.0.1:54345'}/browser/list`,
          { page: 1, pageSize: 100 },
          { timeout: 5000 }
        );
        
        const windows = response.data.data?.list || [];
        console.log(`找到 ${windows.length} 个窗口`);
        
        const has0629 = windows.some(w => 
          w.name === '0629' || w.code === '0629' || w.id === '0629'
        );
        
        if (has0629) {
          console.log('✅ 窗口 0629 存在');
        } else {
          console.log('❌ 窗口 0629 不存在');
        }
      } catch (e) {
        console.log('❌ API 错误');
      }
    }, 5000);
  }
}

continuousCheck().catch(console.error);