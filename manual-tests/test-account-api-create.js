const axios = require('axios');

async function testAccountAPICreate() {
  console.log('=== 测试账户创建 API ===\n');
  
  const API_URL = 'http://localhost:5989';
  
  try {
    // 1. 登录获取 token
    console.log('1. 登录获取认证...');
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginResponse.data.accessToken;
    console.log('✅ 登录成功，获取到 token');
    console.log('Token 前10个字符:', token ? token.substring(0, 10) + '...' : 'undefined');
    console.log('登录响应:', loginResponse.data);
    
    // 2. 准备测试数据
    const testData = {
      email: `test_api_${Date.now()}@example.com`,
      password: 'TestPassword123',
      bitbrowser_window_name: 'api_test_window_' + Date.now(),
      dailyUploadLimit: 5,
      metadata: {
        notes: 'API测试账户',
        tags: ['test', 'api'],
        customFields: {
          source: 'api_test',
          created_at: new Date().toISOString()
        }
      }
    };
    
    console.log('\n2. 创建账户...');
    console.log('请求数据:', {
      ...testData,
      password: '***'
    });
    
    // 3. 调用创建账户 API
    const createResponse = await axios.post(
      `${API_URL}/api/v1/accounts`,
      testData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('\n✅ 账户创建成功!');
    console.log('响应数据:', createResponse.data);
    
    // 4. 验证账户
    if (createResponse.data) {
      const responseData = createResponse.data;
      console.log('\n账户详情:');
      
      // 处理不同的响应格式
      const account = responseData.data || responseData;
      
      console.log('  ID:', account.id);
      console.log('  Email:', account.email);
      console.log('  BitBrowser窗口名:', account.bitbrowser_window_name);
      console.log('  每日上传限制:', account.dailyUploadLimit || account.daily_upload_limit);
      console.log('  健康分数:', account.healthScore || account.health_score);
      console.log('  状态:', account.status);
    }
    
  } catch (error) {
    console.error('\n❌ API 调用失败:');
    
    if (error.response) {
      console.error('HTTP 状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
      
      if (error.response.status === 500) {
        console.error('\n💡 服务器内部错误。可能的原因：');
        console.error('  1. 数据库连接问题');
        console.error('  2. 服务器代码错误');
        console.error('  3. 数据验证失败');
      }
    } else if (error.request) {
      console.error('请求未收到响应');
      console.error('\n💡 可能的原因：');
      console.error('  1. 服务器未启动');
      console.error('  2. 端口不正确');
      console.error('  3. 网络问题');
    } else {
      console.error('错误:', error.message);
    }
  }
}

// 运行测试
testAccountAPICreate();