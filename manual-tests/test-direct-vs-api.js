const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// 使用编译后的代码
const { AccountService } = require('./dist/api/account/account.service');
const { AccountManager } = require('./dist/accounts/manager');
const { getDatabase } = require('./dist/database/connection');
const axios = require('axios');

async function compareDirectVsAPI() {
  console.log('=== 对比直接调用 vs API 调用 ===\n');
  
  const API_URL = 'http://localhost:5989';
  let db;
  
  try {
    // 1. 测试直接调用
    console.log('1. 测试直接调用 AccountService...');
    db = getDatabase();
    await db.connect();
    
    const accountManager = new AccountManager();
    const accountService = new AccountService(accountManager);
    
    const timestamp = Date.now();
    const directTestData = {
      email: `direct_${timestamp}@example.com`,
      password: 'TestPassword123',
      bitbrowser_window_name: `direct_window_${timestamp}`,
      dailyUploadLimit: 5,
      metadata: {
        notes: '直接调用测试',
        tags: ['test', 'direct']
      }
    };
    
    try {
      const directResult = await accountService.create(directTestData);
      console.log('✅ 直接调用成功');
      console.log('   ID:', directResult.id);
      console.log('   窗口名:', directResult.bitbrowser_window_name);
    } catch (error) {
      console.error('❌ 直接调用失败:', error.message);
    }
    
    // 2. 测试 API 调用
    console.log('\n2. 测试 API 调用...');
    
    // 先登录
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    const token = loginResponse.data.accessToken;
    
    const apiTimestamp = Date.now();
    const apiTestData = {
      email: `api_${apiTimestamp}@example.com`,
      password: 'TestPassword123',
      bitbrowser_window_name: `api_window_${apiTimestamp}`,
      dailyUploadLimit: 5,
      metadata: {
        notes: 'API调用测试',
        tags: ['test', 'api']
      }
    };
    
    try {
      const apiResponse = await axios.post(
        `${API_URL}/api/v1/accounts`,
        apiTestData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('✅ API 调用成功');
      console.log('   状态码:', apiResponse.status);
      console.log('   ID:', apiResponse.data.data.id);
      console.log('   窗口名:', apiResponse.data.data.bitbrowser_window_name);
    } catch (error) {
      console.error('❌ API 调用失败:');
      if (error.response) {
        console.error('   状态码:', error.response.status);
        console.error('   错误:', error.response.data);
      } else {
        console.error('   错误:', error.message);
      }
    }
    
    // 3. 对比结果
    console.log('\n3. 结果对比:');
    console.log('直接调用: 成功 ✅');
    console.log('API 调用: 失败 ❌');
    console.log('\n💡 可能的原因:');
    console.log('  1. 服务器运行的是旧代码');
    console.log('  2. 服务器需要重启以加载新的构建');
    console.log('  3. 中间件或路由配置问题');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
  } finally {
    if (db) {
      await db.close();
      console.log('\n数据库连接已关闭');
    }
  }
}

// 运行测试
compareDirectVsAPI();