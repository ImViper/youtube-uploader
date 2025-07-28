const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables first
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function cleanupDatabase() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5987'),
    user: process.env.DB_USER || 'youtube_user',
    password: process.env.DB_PASSWORD || 'qiyuan123',
    database: process.env.DB_NAME || 'youtube_uploader'
  });

  try {
    console.log('🔗 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    // Read the migration SQL file
    const sqlPath = path.join(__dirname, '../src/database/migrations/006_cleanup_redundant_tables_and_fields.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('🧹 Executing database cleanup migration...');
    console.log('📋 This will:');
    console.log('  - Drop tables: bitbrowser_profiles, queue_stats, custom_metrics');
    console.log('  - Remove columns: accounts.bitbrowser_window_id, accounts.is_window_logged_in');
    console.log('  - Remove columns: browser_instances.window_name, browser_instances.is_persistent');
    
    // Execute the migration
    await client.query(sql);
    
    console.log('✅ Database cleanup completed successfully!');

    // Verify the cleanup
    console.log('\n📊 Verifying cleanup results...');
    
    // Check remaining tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log('\n📋 Remaining tables:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    // Check accounts table columns
    const accountsColumns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'accounts' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Accounts table columns:');
    accountsColumns.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

    // Check browser_instances table columns
    const browserColumns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'browser_instances' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Browser instances table columns:');
    browserColumns.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

  } catch (error) {
    console.error('❌ Error during database cleanup:', error.message);
    if (error.detail) {
      console.error('   Details:', error.detail);
    }
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the cleanup
cleanupDatabase();