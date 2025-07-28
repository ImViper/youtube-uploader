const axios = require('axios');

async function testServerHealth() {
  console.log('=== 测试服务器健康状态 ===\n');
  
  const API_URL = 'http://localhost:5989';
  
  try {
    // 1. 测试根路径
    console.log('1. 测试根路径...');
    try {
      const rootResponse = await axios.get(API_URL);
      console.log('✅ 根路径响应:', rootResponse.data);
    } catch (error) {
      console.log('❌ 根路径错误:', error.response?.status || error.message);
    }
    
    // 2. 测试健康检查端点
    console.log('\n2. 测试健康检查端点...');
    try {
      const healthResponse = await axios.get(`${API_URL}/api/v1/health`);
      console.log('✅ 健康检查响应:', healthResponse.data);
    } catch (error) {
      console.log('❌ 健康检查错误:', error.response?.status || error.message);
    }
    
    // 3. 测试认证端点
    console.log('\n3. 测试认证端点...');
    try {
      const authResponse = await axios.post(`${API_URL}/api/auth/login`, {
        username: 'admin',
        password: 'admin123'
      });
      console.log('✅ 认证成功');
      console.log('   User:', authResponse.data.user);
      console.log('   Token长度:', authResponse.data.accessToken?.length);
    } catch (error) {
      console.log('❌ 认证错误:', error.response?.status || error.message);
    }
    
    // 4. 测试账户端点（无认证）
    console.log('\n4. 测试账户端点（应该返回401）...');
    try {
      const accountResponse = await axios.get(`${API_URL}/api/v1/accounts`);
      console.log('⚠️  账户端点未要求认证:', accountResponse.status);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ 账户端点正确要求认证');
      } else {
        console.log('❌ 账户端点错误:', error.response?.status || error.message);
      }
    }
    
    // 5. 列出所有可用的API端点
    console.log('\n5. API 端点汇总:');
    console.log('   POST /api/auth/login - 登录');
    console.log('   GET  /api/v1/health - 健康检查');
    console.log('   POST /api/v1/accounts - 创建账户（需要认证）');
    console.log('   GET  /api/v1/accounts - 获取账户列表（需要认证）');
    
  } catch (error) {
    console.error('\n❌ 服务器可能未启动');
    console.error('错误:', error.message);
    console.error('\n💡 请确保服务器正在运行:');
    console.error('   cd manual-tests && npm run dev');
  }
}

// 运行测试
testServerHealth();