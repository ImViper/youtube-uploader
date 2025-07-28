const axios = require('axios');

async function testAccountAPINoAuth() {
  console.log('=== 测试账户创建 API (无认证) ===\n');
  
  const API_URL = 'http://localhost:5989';
  
  try {
    // 准备测试数据
    const testData = {
      email: `test_noauth_${Date.now()}@example.com`,
      password: 'TestPassword123',
      metadata: {
        source: 'api_test_no_auth',
        created_at: new Date().toISOString(),
        bitbrowser_window_name: 'noauth_window_' + Date.now(),
        dailyUploadLimit: 5
      }
    };
    
    console.log('创建账户...');
    console.log('请求数据:', {
      ...testData,
      password: '***'
    });
    
    // 调用创建账户 API (不带认证)
    const createResponse = await axios.post(
      `${API_URL}/api/account/create`,
      testData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('\n✅ 账户创建成功!');
    console.log('响应数据:', createResponse.data);
    
  } catch (error) {
    console.error('\n❌ API 调用失败:');
    
    if (error.response) {
      console.error('HTTP 状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
      
      if (error.response.status === 401) {
        console.error('\n💡 需要认证。让我们检查 API 路由配置...');
      } else if (error.response.status === 500) {
        console.error('\n💡 服务器内部错误详情:');
        if (error.response.data.details) {
          console.error('详细错误:', error.response.data.details);
        }
      }
    } else {
      console.error('错误:', error.message);
    }
  }
}

// 运行测试
testAccountAPINoAuth();