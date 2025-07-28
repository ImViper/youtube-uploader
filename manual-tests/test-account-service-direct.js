const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// 使用编译后的代码
const { AccountService } = require('./dist/api/account/account.service');
const { AccountManager } = require('./dist/accounts/manager');
const { getDatabase } = require('./dist/database/connection');

async function testAccountServiceDirect() {
  console.log('=== 直接测试 AccountService ===\n');
  
  let db;
  try {
    // 获取数据库连接
    console.log('1. 初始化数据库和 AccountManager...');
    db = getDatabase();
    await db.connect();
    console.log('✅ 数据库连接成功');
    
    // 创建 AccountManager 和 AccountService
    const accountManager = new AccountManager();
    const accountService = new AccountService(accountManager);
    
    // 准备测试数据 - 按照 API 期望的格式
    const accountData = {
      email: `test_service_${Date.now()}@example.com`,
      password: 'TestPassword123',
      bitbrowser_window_name: 'service_test_window_' + Date.now(),
      dailyUploadLimit: 5,
      metadata: {
        notes: 'Service测试账户',
        tags: ['test', 'service'],
        customFields: {
          source: 'service_test',
          created_at: new Date().toISOString()
        }
      }
    };
    
    console.log('\n2. 测试数据:');
    console.log('账户数据:', {
      ...accountData,
      password: '***'
    });
    
    console.log('\n3. 调用 AccountService.create...');
    const result = await accountService.create(accountData);
    
    console.log('\n✅ 账户创建成功!');
    console.log('返回结果:', result);
    
    // 验证数据库
    console.log('\n4. 验证数据库...');
    const verifyResult = await db.query(
      'SELECT id, email, bitbrowser_window_name, metadata FROM accounts WHERE email = $1',
      [accountData.email]
    );
    
    if (verifyResult.rows.length > 0) {
      const dbRow = verifyResult.rows[0];
      console.log('✅ 账户在数据库中存在');
      console.log('  ID:', dbRow.id);
      console.log('  Email:', dbRow.email);
      console.log('  BitBrowser窗口名:', dbRow.bitbrowser_window_name);
      console.log('  Metadata:', dbRow.metadata);
    }
    
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error('错误类型:', error.constructor.name);
    console.error('错误栈:', error.stack);
    
    // 更详细的错误分析
    if (error.message.includes('column')) {
      console.error('\n💡 数据库字段错误。检查数据库结构...');
    }
    
    if (error.message.includes('metadata')) {
      console.error('\n💡 metadata 处理错误。检查数据格式...');
    }
  } finally {
    if (db) {
      await db.close();
      console.log('\n数据库连接已关闭');
    }
  }
}

// 运行测试
testAccountServiceDirect();