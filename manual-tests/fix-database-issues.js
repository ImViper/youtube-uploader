const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'youtube_matrix',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function fixDatabaseIssues() {
  console.log('=== 修复数据库问题 ===\n');
  
  try {
    // 1. 检查 browser_instances 表是否存在
    console.log('1. 检查 browser_instances 表...');
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'browser_instances'
      )
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('  表不存在，创建 browser_instances 表...');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS browser_instances (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          window_id VARCHAR(255) UNIQUE NOT NULL,
          window_name VARCHAR(255),
          debug_url TEXT,
          status VARCHAR(50) DEFAULT 'active',
          error_count INTEGER DEFAULT 0,
          upload_count INTEGER DEFAULT 0,
          last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          is_persistent BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('  ✅ browser_instances 表已创建');
    } else {
      console.log('  ✅ browser_instances 表已存在');
    }
    
    // 2. 修复 upload_history 表
    console.log('\n2. 检查 upload_history 表结构...');
    const columns = await pool.query(`
      SELECT column_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'upload_history'
      AND column_name IN ('success', 'started_at', 'completed_at')
    `);
    
    const successCol = columns.rows.find(c => c.column_name === 'success');
    if (successCol && successCol.is_nullable === 'NO') {
      console.log('  修改 success 列允许 NULL...');
      await pool.query(`
        ALTER TABLE upload_history 
        ALTER COLUMN success DROP NOT NULL
      `);
      console.log('  ✅ success 列已修改');
    }
    
    // 3. 修复 upload_tasks 表的 error_message 列
    console.log('\n3. 检查 upload_tasks 表...');
    const taskColumns = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'upload_tasks'
      AND column_name = 'error_message'
    `);
    
    if (taskColumns.rows.length === 0) {
      console.log('  error_message 列不存在，添加列...');
      await pool.query(`
        ALTER TABLE upload_tasks 
        ADD COLUMN IF NOT EXISTS error_message TEXT
      `);
      console.log('  ✅ error_message 列已添加');
    } else {
      console.log('  ✅ error_message 列已存在');
    }
    
    // 4. 确保 updated_at 列存在
    const updatedAtCol = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'upload_tasks'
      AND column_name = 'updated_at'
    `);
    
    if (updatedAtCol.rows.length === 0) {
      console.log('\n4. 添加 updated_at 列...');
      await pool.query(`
        ALTER TABLE upload_tasks 
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      `);
      console.log('  ✅ updated_at 列已添加');
    }
    
    console.log('\n✅ 所有数据库问题已修复');
    
  } catch (error) {
    console.error('错误:', error.message);
  } finally {
    await pool.end();
  }
}

fixDatabaseIssues().catch(console.error);