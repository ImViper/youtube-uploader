const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// 使用编译后的代码
const { AccountManager } = require('./dist/accounts/manager');
const { getDatabase } = require('./dist/database/connection');

async function testAccountCreation() {
  console.log('=== 直接测试账户创建 ===\n');
  
  let db;
  try {
    // 获取数据库连接
    console.log('1. 获取数据库连接...');
    db = getDatabase();
    
    // 测试连接
    await db.connect();
    console.log('✅ 数据库连接成功');
    
    // 创建 AccountManager 实例
    console.log('\n2. 创建 AccountManager...');
    const accountManager = new AccountManager();
    
    // 准备测试数据
    const testAccount = {
      email: `test_${Date.now()}@example.com`,
      password: 'TestPassword123',
      metadata: {
        source: 'manual_test',
        created_at: new Date().toISOString(),
        bitbrowser_window_name: 'test_window_' + Date.now(),
        dailyUploadLimit: 5
      }
    };
    
    console.log('\n3. 尝试创建账户...');
    console.log('账户数据:', {
      ...testAccount,
      password: '***'
    });
    
    // 调用 addAccount 方法
    const result = await accountManager.addAccount(
      testAccount.email,
      testAccount.password,
      testAccount.metadata
    );
    
    console.log('\n✅ 账户创建成功!');
    console.log('账户ID:', result.id);
    console.log('创建时间:', result.created_at);
    console.log('BitBrowser窗口名:', result.bitbrowser_window_name);
    
    // 验证账户是否真的创建了
    console.log('\n4. 验证账户...');
    const verifyResult = await db.query(
      'SELECT id, email, bitbrowser_window_name FROM accounts WHERE id = $1',
      [result.id]
    );
    
    if (verifyResult.rows.length > 0) {
      console.log('✅ 账户在数据库中存在');
      console.log('数据库记录:', verifyResult.rows[0]);
    } else {
      console.log('❌ 账户在数据库中不存在');
    }
    
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error('错误类型:', error.constructor.name);
    console.error('错误栈:', error.stack);
    
    // 详细错误分析
    if (error.message.includes('column')) {
      console.error('\n💡 这是一个列相关的错误。可能的原因：');
      console.error('  1. 数据库表结构与代码不匹配');
      console.error('  2. 编译后的代码未更新');
      console.error('  3. 某些字段已被删除但代码仍在引用');
    }
    
    if (error.message.includes('password')) {
      console.error('\n💡 这是一个认证错误。请检查：');
      console.error('  1. 数据库密码是否正确');
      console.error('  2. 用户名是否正确');
    }
  } finally {
    if (db) {
      await db.close();
      console.log('\n数据库连接已关闭');
    }
  }
}

// 运行测试
testAccountCreation();