const { getDatabase } = require('../dist/database/connection');
const { WindowMatcher } = require('../dist/bitbrowser/window-matcher');

async function updateWindowNames() {
  console.log('=== 更新账户的窗口名称 ===\n');
  
  const db = getDatabase();
  const matcher = new WindowMatcher();
  
  try {
    // 1. 获取所有窗口映射
    console.log('1. 获取所有 BitBrowser 窗口...');
    const windows = await matcher.getAllWindowMappings();
    console.log(`找到 ${windows.length} 个窗口\n`);
    
    // 创建 ID 到名称的映射
    const idToName = {};
    windows.forEach(window => {
      idToName[window.id] = window.name;
    });
    
    // 2. 获取所有账户
    console.log('2. 获取数据库中的账户...');
    const accountsResult = await db.query(
      'SELECT id, email, browser_profile_id, bitbrowser_window_name FROM accounts'
    );
    const accounts = accountsResult.rows;
    console.log(`找到 ${accounts.length} 个账户\n`);
    
    // 3. 更新账户的窗口名称
    console.log('3. 更新账户的窗口名称...\n');
    
    for (const account of accounts) {
      const windowId = account.browser_profile_id;
      const currentWindowName = account.bitbrowser_window_name;
      const actualWindowName = idToName[windowId];
      
      console.log(`账户: ${account.email}`);
      console.log(`  - 窗口ID: ${windowId}`);
      console.log(`  - 当前窗口名称: ${currentWindowName || '(空)'}`);
      console.log(`  - 实际窗口名称: ${actualWindowName || '(未找到)'}`);
      
      if (actualWindowName && actualWindowName !== currentWindowName) {
        // 更新窗口名称
        await db.query(
          'UPDATE accounts SET bitbrowser_window_name = $1 WHERE id = $2',
          [actualWindowName, account.id]
        );
        console.log(`  - ✅ 已更新窗口名称为: ${actualWindowName}`);
      } else if (!actualWindowName) {
        console.log(`  - ⚠️ 未找到对应的窗口`);
      } else {
        console.log(`  - ✓ 窗口名称已是最新`);
      }
      
      console.log('');
    }
    
    // 4. 显示更新后的结果
    console.log('4. 更新后的账户信息:\n');
    const updatedResult = await db.query(
      'SELECT email, browser_profile_id, bitbrowser_window_name FROM accounts'
    );
    
    updatedResult.rows.forEach(account => {
      console.log(`${account.email}:`);
      console.log(`  - 窗口ID: ${account.browser_profile_id}`);
      console.log(`  - 窗口名称: ${account.bitbrowser_window_name || '(空)'}`);
    });
    
  } catch (error) {
    console.error('错误:', error);
  } finally {
    if (db && db.pool) {
      await db.pool.end();
    }
  }
}

updateWindowNames();