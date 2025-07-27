const { getDatabase } = require('./dist/database/connection');

async function updateAllWindowNames() {
  console.log('=== 更新所有账户的窗口名称为 0629 ===\n');
  
  const db = getDatabase();
  
  try {
    // 更新所有账户的窗口名称为 0629
    console.log('更新数据库中所有账户的窗口名称...');
    const result = await db.query(
      `UPDATE accounts 
       SET bitbrowser_window_name = $1, 
           updated_at = NOW()
       WHERE bitbrowser_window_name IS NULL OR bitbrowser_window_name = ''`,
      ['0629']
    );
    
    console.log(`✓ 已更新 ${result.rowCount} 个账户的窗口名称为 0629\n`);
    
    // 显示更新后的结果
    console.log('更新后的账户信息:\n');
    const updatedResult = await db.query(
      'SELECT email, browser_profile_id, bitbrowser_window_name FROM accounts ORDER BY email'
    );
    
    updatedResult.rows.forEach(account => {
      console.log(`${account.email}:`);
      console.log(`  - 窗口ID: ${account.browser_profile_id}`);
      console.log(`  - 窗口名称: ${account.bitbrowser_window_name}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('错误:', error);
  } finally {
    if (db && db.pool) {
      await db.pool.end();
    }
  }
}

updateAllWindowNames();