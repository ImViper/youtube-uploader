const axios = require('axios');
const { Client } = require('pg');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const API_BASE_URL = 'http://localhost:5989/api';

// Database connection
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5987'),
  user: process.env.DB_USER || 'youtube_user',
  password: process.env.DB_PASSWORD || 'qiyuan123',
  database: process.env.DB_NAME || 'youtube_uploader'
};

let authToken = '';
let testAccountId = '';

// Helper function to make API requests
async function apiRequest(method, endpoint, data = null) {
  const config = {
    method,
    url: `${API_BASE_URL}${endpoint}`,
    headers: {}
  };

  if (authToken) {
    config.headers['Authorization'] = `Bearer ${authToken}`;
  }

  if (data) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`API Error: ${error.response?.data?.error || error.message}`);
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

// Test functions
async function testLogin() {
  console.log('\n📌 Testing Login...');
  try {
    const response = await apiRequest('POST', '/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    authToken = response.accessToken;
    console.log('✅ Login successful');
    return true;
  } catch (error) {
    console.log('❌ Login failed');
    return false;
  }
}

async function testCreateAccount() {
  console.log('\n📌 Testing Account Creation...');
  try {
    const accountData = {
      email: `test-${Date.now()}@example.com`,
      password: 'test123',
      bitbrowser_window_name: `TestWindow_${Date.now()}`,
      dailyUploadLimit: 5,
      metadata: {
        tags: ['test']
      }
    };
    
    const response = await apiRequest('POST', '/v1/accounts', accountData);
    const account = response.data || response;
    testAccountId = account.id;
    
    console.log(`✅ Account created successfully: ${account.email}`);
    console.log(`   Window Name: ${account.bitbrowser_window_name}`);
    console.log(`   Daily Upload Limit: ${account.daily_upload_limit || account.dailyUploadLimit}`);
    
    return true;
  } catch (error) {
    console.log('❌ Account creation failed');
    return false;
  }
}

async function testCreateUploadTask() {
  console.log('\n📌 Testing Upload Task Creation...');
  try {
    const taskData = {
      videoPath: '/path/to/test-video.mp4',
      title: 'Test Video ' + new Date().toISOString(),
      description: 'This is a test video upload',
      privacy: 'private',
      accountId: testAccountId
    };
    
    const response = await apiRequest('POST', '/v1/tasks', taskData);
    const task = response.data || response;
    
    console.log(`✅ Upload task created successfully: ${task.id}`);
    console.log(`   Status: ${task.status}`);
    console.log(`   Priority: ${task.priority}`);
    
    return task.id;
  } catch (error) {
    console.log('❌ Upload task creation failed');
    return null;
  }
}

async function testDatabaseStructure() {
  console.log('\n📌 Verifying Database Structure...');
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    
    // Check tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log('\n📋 Existing tables:');
    const expectedTables = [
      'accounts', 'browser_instances', 'metrics_history', 
      'system_metrics', 'upload_errors', 'upload_history', 'upload_tasks'
    ];
    
    tablesResult.rows.forEach(row => {
      const isExpected = expectedTables.includes(row.table_name);
      console.log(`   ${isExpected ? '✅' : '❓'} ${row.table_name}`);
    });
    
    // Check accounts table structure
    const accountColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'accounts' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Accounts table structure:');
    const deletedColumns = ['bitbrowser_window_id', 'is_window_logged_in'];
    
    accountColumns.rows.forEach(col => {
      const wasDeleted = deletedColumns.includes(col.column_name);
      if (!wasDeleted) {
        console.log(`   ✅ ${col.column_name} (${col.data_type})`);
      }
    });
    
    // Verify deleted columns are gone
    const hasDeletedColumns = accountColumns.rows.some(col => 
      deletedColumns.includes(col.column_name)
    );
    
    if (hasDeletedColumns) {
      console.log('   ❌ Found columns that should have been deleted!');
      return false;
    } else {
      console.log('   ✅ All redundant columns successfully removed');
    }
    
    // Check that deleted tables are gone
    const deletedTables = ['bitbrowser_profiles', 'queue_stats', 'custom_metrics'];
    const existingTables = tablesResult.rows.map(r => r.table_name);
    const stillExist = deletedTables.filter(t => existingTables.includes(t));
    
    if (stillExist.length > 0) {
      console.log(`   ❌ Tables that should be deleted still exist: ${stillExist.join(', ')}`);
      return false;
    } else {
      console.log('   ✅ All redundant tables successfully removed');
    }
    
    return true;
  } catch (error) {
    console.error('Database verification error:', error);
    return false;
  } finally {
    await client.end();
  }
}

async function cleanup() {
  if (testAccountId) {
    console.log('\n🧹 Cleaning up test data...');
    const client = new Client(dbConfig);
    try {
      await client.connect();
      await client.query('DELETE FROM accounts WHERE id = $1', [testAccountId]);
      console.log('✅ Test data cleaned up');
    } catch (error) {
      console.error('Cleanup error:', error);
    } finally {
      await client.end();
    }
  }
}

// Main test runner
async function runTests() {
  console.log('========================================');
  console.log('   主业务流程测试 (数据库清理后)');
  console.log('========================================');
  
  let allTestsPassed = true;
  
  // Run tests
  allTestsPassed &= await testLogin();
  allTestsPassed &= await testDatabaseStructure();
  
  if (authToken) {
    allTestsPassed &= await testCreateAccount();
    
    if (testAccountId) {
      const taskId = await testCreateUploadTask();
      allTestsPassed &= !!taskId;
    }
  }
  
  // Cleanup
  await cleanup();
  
  // Summary
  console.log('\n========================================');
  if (allTestsPassed) {
    console.log('✅ 所有测试通过！主业务流程正常工作。');
  } else {
    console.log('❌ 部分测试失败，请检查错误信息。');
  }
  console.log('========================================');
}

// Run the tests
runTests().catch(console.error);