const { getDatabase } = require('../src/database/connection');
const path = require('path');

// 确保加载环境变量
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testDatabaseConnection() {
  console.log('=== 测试数据库连接 ===\n');
  
  console.log('环境变量:');
  console.log('  DB_HOST:', process.env.DB_HOST || 'localhost');
  console.log('  DB_PORT:', process.env.DB_PORT || '5987');
  console.log('  DB_NAME:', process.env.DB_NAME || 'youtube_uploader');
  console.log('  DB_USER:', process.env.DB_USER || 'youtube_user');
  console.log('  DB_PASSWORD:', process.env.DB_PASSWORD ? '***已设置***' : '❌ 未设置');
  
  try {
    console.log('\n🔌 获取数据库连接...');
    const db = getDatabase();
    
    console.log('📝 执行测试查询...');
    const result = await db.query('SELECT NOW() as current_time, version() as version');
    
    console.log('\n✅ 数据库连接成功!');
    console.log('  当前时间:', result.rows[0].current_time);
    console.log('  PostgreSQL 版本:', result.rows[0].version);
    
    // 测试 accounts 表
    console.log('\n📊 检查 accounts 表结构...');
    const tableResult = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'accounts'
      ORDER BY ordinal_position
      LIMIT 5
    `);
    
    console.log('  accounts 表前5个字段:');
    tableResult.rows.forEach(col => {
      console.log(`    - ${col.column_name} (${col.data_type})`);
    });
    
    // 获取连接池统计
    const stats = db.getPoolStats();
    console.log('\n📈 连接池统计:');
    console.log('  总连接数:', stats.totalCount);
    console.log('  空闲连接:', stats.idleCount);
    console.log('  等待连接:', stats.waitingCount);
    
  } catch (error) {
    console.error('\n❌ 数据库连接失败:');
    console.error('错误类型:', error.constructor.name);
    console.error('错误消息:', error.message);
    
    if (error.message.includes('SASL')) {
      console.error('\n💡 这是一个认证错误。请检查:');
      console.error('  1. 数据库密码是否正确');
      console.error('  2. .env 文件是否存在并包含 DB_PASSWORD');
      console.error('  3. 数据库用户是否有正确的权限');
    }
  } finally {
    const db = getDatabase();
    if (db) {
      await db.close();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

// 运行测试
testDatabaseConnection();