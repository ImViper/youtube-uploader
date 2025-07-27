const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');

async function runMigrations() {
  // 加载环境变量
  require('dotenv').config();
  
  // 数据库连接配置
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5987,
    database: process.env.DB_NAME || 'youtube_uploader',
    user: process.env.DB_USER || 'youtube_user',
    password: process.env.DB_PASSWORD || 'qiyuan123',
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    
    // 创建迁移历史表
    await client.query(`
      CREATE TABLE IF NOT EXISTS migration_history (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 获取所有SQL文件
    const migrationsDir = path.join(__dirname, 'src', 'database', 'migrations');
    const schemaFile = path.join(__dirname, 'src', 'database', 'schema.sql');
    
    // 首先运行schema.sql
    console.log('Running schema.sql...');
    try {
      const schema = await fs.readFile(schemaFile, 'utf8');
      await client.query(schema);
      console.log('✓ Schema created successfully');
    } catch (error) {
      console.log('Schema already exists or error:', error.message);
    }

    // 然后运行迁移文件
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

    for (const file of sqlFiles) {
      // 检查是否已经执行过
      const result = await client.query(
        'SELECT * FROM migration_history WHERE filename = $1',
        [file]
      );

      if (result.rows.length > 0) {
        console.log(`Skipping ${file} (already executed)`);
        continue;
      }

      // 执行迁移
      console.log(`Running ${file}...`);
      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      
      try {
        await client.query(sql);
        
        // 记录到历史表
        await client.query(
          'INSERT INTO migration_history (filename) VALUES ($1)',
          [file]
        );
        
        console.log(`✓ ${file} executed successfully`);
      } catch (error) {
        console.error(`✗ Error in ${file}:`, error.message);
        throw error;
      }
    }

    console.log('\nAll migrations completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// 运行迁移
runMigrations();