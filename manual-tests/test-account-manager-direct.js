const { AccountManager } = require('../dist/accounts/manager');
const { getDatabase } = require('../dist/database/connection');

async function testAccountManagerDirectly() {
  console.log('=== 直接测试 AccountManager ===\n');
  
  const accountManager = new AccountManager();
  
  try {
    // 测试数据
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'test123';
    const metadata = {
      bitbrowser_window_name: `TestWindow_${Date.now()}`,
      dailyUploadLimit: 5,
      tags: ['test']
    };
    
    console.log('📝 创建账户参数:');
    console.log('  Email:', testEmail);
    console.log('  BitBrowser Window Name:', metadata.bitbrowser_window_name);
    console.log('  Daily Upload Limit:', metadata.dailyUploadLimit);
    
    console.log('\n🚀 调用 addAccount...');
    const account = await accountManager.addAccount(testEmail, testPassword, metadata);
    
    console.log('\n✅ 账户创建成功!');
    console.log('  ID:', account.id);
    console.log('  Email:', account.email);
    console.log('  BitBrowser Window Name:', account.bitbrowser_window_name);
    console.log('  Daily Upload Limit:', account.dailyUploadLimit);
    console.log('  Health Score:', account.healthScore);
    console.log('  Status:', account.status);
    
    // 验证数据库
    const db = getDatabase();
    const result = await db.query(
      'SELECT * FROM accounts WHERE id = $1',
      [account.id]
    );
    
    if (result.rows.length > 0) {
      const dbRow = result.rows[0];
      console.log('\n🔍 数据库验证:');
      console.log('  bitbrowser_window_name:', dbRow.bitbrowser_window_name);
      console.log('  daily_upload_limit:', dbRow.daily_upload_limit);
      console.log('  ✅ 数据已正确保存到数据库');
    }
    
    // 清理测试数据
    console.log('\n🧹 清理测试数据...');
    await accountManager.removeAccount(account.id);
    console.log('✅ 测试数据已清理');
    
  } catch (error) {
    console.error('\n❌ 测试失败:');
    console.error('错误类型:', error.constructor.name);
    console.error('错误消息:', error.message);
    console.error('堆栈跟踪:', error.stack);
  } finally {
    const db = getDatabase();
    if (db && db.pool) {
      await db.pool.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

// 运行测试
testAccountManagerDirectly();