const { Client } = require('pg');
const path = require('path');

// 加载环境变量
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testSimpleConnection() {
  console.log('=== 简单数据库连接测试 ===\n');
  
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5987'),
    database: process.env.DB_NAME || 'youtube_uploader',
    user: process.env.DB_USER || 'youtube_user',
    password: process.env.DB_PASSWORD || 'qiyuan123'
  };
  
  console.log('连接配置:');
  console.log('  host:', config.host);
  console.log('  port:', config.port);
  console.log('  database:', config.database);
  console.log('  user:', config.user);
  console.log('  password:', config.password ? '***已设置***' : '未设置');
  
  const client = new Client(config);
  
  try {
    console.log('\n正在连接...');
    await client.connect();
    
    console.log('✅ 连接成功！');
    
    // 测试查询
    const result = await client.query('SELECT NOW()');
    console.log('当前时间:', result.rows[0].now);
    
    // 检查 accounts 表
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'accounts'
      )
    `);
    
    console.log('accounts 表存在:', tableCheck.rows[0].exists);
    
    // 如果表存在，获取记录数
    if (tableCheck.rows[0].exists) {
      const countResult = await client.query('SELECT COUNT(*) FROM accounts');
      console.log('accounts 表记录数:', countResult.rows[0].count);
    }
    
  } catch (error) {
    console.error('\n❌ 连接失败:');
    console.error('错误:', error.message);
    
    if (error.message.includes('password')) {
      console.error('\n可能的原因:');
      console.error('1. 密码不正确');
      console.error('2. 用户没有访问权限');
      console.error('3. PostgreSQL 配置问题');
    }
  } finally {
    await client.end();
    console.log('\n连接已关闭');
  }
}

testSimpleConnection();