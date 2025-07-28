const axios = require('axios');
require('dotenv').config({ path: '../.env' });

async function testOpenWindow() {
  console.log('=== 测试 BitBrowser 窗口打开 ===\n');
  
  const apiUrl = process.env.BITBROWSER_API_URL || 'http://127.0.0.1:54345';
  
  try {
    // 1. 获取窗口列表
    console.log('1. 获取窗口列表...');
    const listResponse = await axios.post(
      `${apiUrl}/browser/list`,
      { page: 0, pageSize: 100 },
      { timeout: 5000 }
    );
    
    const windows = listResponse.data.data?.list || [];
    const window0629 = windows.find(w => w.name === '0629');
    
    if (!window0629) {
      console.log('❌ 未找到窗口 0629');
      return;
    }
    
    console.log('✅ 找到窗口 0629');
    console.log(`   ID: ${window0629.id}`);
    console.log(`   状态: ${window0629.status === 0 ? '正常' : '异常'}`);
    
    // 2. 尝试打开窗口
    console.log('\n2. 尝试打开窗口...');
    
    try {
      const openResponse = await axios.post(
        `${apiUrl}/browser/open`,
        { id: window0629.id },
        { timeout: 30000 }  // 30秒超时
      );
      
      console.log('打开响应:', JSON.stringify(openResponse.data, null, 2));
      
      if (openResponse.data.success) {
        console.log('\n✅ 窗口打开成功！');
        console.log('调试地址:', openResponse.data.data?.ws);
        
        // 3. 等待一会儿然后关闭
        console.log('\n等待 10 秒后关闭窗口...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // 4. 关闭窗口
        console.log('\n3. 关闭窗口...');
        try {
          const closeResponse = await axios.post(
            `${apiUrl}/browser/close`,
            { id: window0629.id },
            { timeout: 10000 }
          );
          
          console.log('关闭响应:', closeResponse.data);
        } catch (e) {
          console.log('关闭失败:', e.message);
        }
      } else {
        console.log('\n❌ 窗口打开失败');
        console.log('错误信息:', openResponse.data.msg);
      }
      
    } catch (error) {
      console.error('\n❌ 打开窗口时出错:', error.message);
      if (error.response) {
        console.error('响应数据:', error.response.data);
      }
    }
    
  } catch (error) {
    console.error('错误:', error.message);
  }
}

testOpenWindow().catch(console.error);