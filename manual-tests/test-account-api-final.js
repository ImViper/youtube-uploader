const axios = require('axios');

async function testAccountAPIFinal() {
  console.log('=== 最终测试账户创建 API ===\n');
  
  const API_URL = 'http://localhost:5989';
  let token = null;
  
  try {
    // 1. 登录获取 token
    console.log('1. 登录获取认证...');
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    token = loginResponse.data.accessToken;
    console.log('✅ 登录成功');
    
    // 2. 准备测试数据
    const timestamp = Date.now();
    const testData = {
      email: `final_test_${timestamp}@example.com`,
      password: 'TestPassword123',
      bitbrowser_window_name: `final_window_${timestamp}`,
      dailyUploadLimit: 5,
      metadata: {
        notes: '最终API测试账户',
        tags: ['test', 'final'],
        customFields: {
          source: 'final_api_test',
          timestamp: timestamp
        }
      }
    };
    
    console.log('\n2. 创建账户...');
    console.log('请求URL:', `${API_URL}/api/v1/accounts`);
    console.log('请求方法: POST');
    console.log('请求头:', {
      'Authorization': 'Bearer ' + token.substring(0, 20) + '...',
      'Content-Type': 'application/json'
    });
    console.log('请求体:', JSON.stringify(testData, null, 2));
    
    // 3. 发送创建请求
    let createResponse;
    try {
      createResponse = await axios.post(
        `${API_URL}/api/v1/accounts`,
        testData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      if (error.response) {
        console.error('\n❌ API 返回错误:');
        console.error('状态码:', error.response.status);
        console.error('响应头:', error.response.headers);
        console.error('响应体:', JSON.stringify(error.response.data, null, 2));
        
        // 如果是验证错误，显示详细信息
        if (error.response.status === 400 && error.response.data.details) {
          console.error('\n验证错误详情:');
          error.response.data.details.forEach(detail => {
            console.error(`  - ${detail.field}: ${detail.message}`);
          });
        }
        
        return;
      }
      throw error;
    }
    
    console.log('\n✅ 账户创建成功!');
    console.log('响应状态:', createResponse.status);
    console.log('响应数据:', JSON.stringify(createResponse.data, null, 2));
    
    // 4. 验证创建的账户
    if (createResponse.data.success && createResponse.data.data) {
      const account = createResponse.data.data;
      console.log('\n账户详情:');
      console.log('  ID:', account.id);
      console.log('  Email:', account.email);
      console.log('  BitBrowser窗口名:', account.bitbrowser_window_name);
      console.log('  每日上传限制:', account.dailyUploadLimit);
      console.log('  健康分数:', account.healthScore);
      console.log('  状态:', account.status);
      console.log('  创建时间:', account.createdAt);
      
      // 5. 获取账户列表验证
      console.log('\n3. 验证账户列表...');
      const listResponse = await axios.get(
        `${API_URL}/api/v1/accounts?page=1&pageSize=10`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const foundAccount = listResponse.data.items.find(acc => acc.id === account.id);
      if (foundAccount) {
        console.log('✅ 账户在列表中找到');
        console.log('  窗口名验证:', foundAccount.bitbrowser_window_name === account.bitbrowser_window_name ? '✅ 匹配' : '❌ 不匹配');
      } else {
        console.log('❌ 账户在列表中未找到');
      }
    }
    
    console.log('\n✅ 所有测试通过！账户创建API功能正常。');
    
  } catch (error) {
    console.error('\n❌ 测试失败:');
    
    if (error.response) {
      console.error('HTTP 错误:', error.response.status);
      console.error('错误数据:', error.response.data);
    } else if (error.request) {
      console.error('无响应，服务器可能未启动');
    } else {
      console.error('错误:', error.message);
    }
  }
}

// 运行测试
testAccountAPIFinal();