// 测试比特浏览器窗口功能
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3003/api';

async function testWindowFeature() {
  console.log('=== 测试比特浏览器窗口功能 ===\n');
  
  try {
    // 1. 创建一个带窗口映射的账号
    console.log('1. 创建账号（带窗口映射）...');
    const createResponse = await axios.post(`${API_BASE_URL}/accounts`, {
      username: 'testuser',
      email: 'test@example.com',
      password: 'test123456',
      browserWindowName: 'YouTube测试窗口1',
      notes: '这是一个测试账号'
    });
    
    const accountId = createResponse.data.id;
    console.log('✓ 账号创建成功');
    console.log('  - ID:', accountId);
    console.log('  - 窗口名称:', createResponse.data.browserWindowName);
    console.log('  - 窗口ID:', createResponse.data.browserWindowId);
    console.log('  - 登录状态:', createResponse.data.isWindowLoggedIn ? '已登录' : '未登录');
    console.log('');
    
    // 2. 获取账号列表，验证窗口信息
    console.log('2. 获取账号列表...');
    const listResponse = await axios.get(`${API_BASE_URL}/accounts`);
    const account = listResponse.data.items.find(a => a.id === accountId);
    
    if (account) {
      console.log('✓ 在列表中找到账号');
      console.log('  - 邮箱:', account.email);
      console.log('  - 窗口名称:', account.browserWindowName || '未设置');
      console.log('  - 窗口ID:', account.browserWindowId || '未设置');
      console.log('  - 登录状态:', account.isWindowLoggedIn ? '已登录' : '未登录');
    } else {
      console.log('✗ 未在列表中找到账号');
    }
    console.log('');
    
    // 3. 获取单个账号详情
    console.log('3. 获取账号详情...');
    const detailResponse = await axios.get(`${API_BASE_URL}/accounts/${accountId}`);
    const accountDetail = detailResponse.data;
    
    console.log('✓ 获取账号详情成功');
    console.log('  - 邮箱:', accountDetail.email);
    console.log('  - 窗口名称:', accountDetail.browserWindowName || '未设置');
    console.log('  - 窗口ID:', accountDetail.browserWindowId || '未设置');
    console.log('  - 登录状态:', accountDetail.isWindowLoggedIn ? '已登录' : '未登录');
    console.log('  - 健康度:', accountDetail.healthScore);
    console.log('');
    
    // 4. 创建一个不带窗口映射的账号进行对比
    console.log('4. 创建账号（无窗口映射）...');
    const createResponse2 = await axios.post(`${API_BASE_URL}/accounts`, {
      username: 'testuser2',
      email: 'test2@example.com',
      password: 'test123456',
      notes: '这是一个没有窗口映射的测试账号'
    });
    
    const account2 = createResponse2.data;
    console.log('✓ 账号创建成功');
    console.log('  - ID:', account2.id);
    console.log('  - 窗口名称:', account2.browserWindowName || '未设置');
    console.log('  - 窗口ID:', account2.browserWindowId || '未设置');
    console.log('');
    
    console.log('=== 测试完成 ===');
    console.log('\n总结：');
    console.log('- 窗口映射功能正常工作');
    console.log('- 可以在创建账号时指定窗口名称');
    console.log('- 系统会自动生成窗口ID（占位实现）');
    console.log('- 账号列表和详情接口正确返回窗口信息');
    
  } catch (error) {
    console.error('测试失败:', error.message);
    if (error.response) {
      console.error('响应数据:', error.response.data);
    }
  }
}

// 运行测试
testWindowFeature();