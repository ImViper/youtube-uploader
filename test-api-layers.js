require('dotenv').config();
const { getDatabase } = require('./dist/database/connection');
const { TaskService } = require('./dist/api/task/task.service');
const axios = require('axios');

async function testDatabaseConnection() {
  console.log('=== Testing Database Connection ===');
  console.log('Database config:');
  console.log('  Host:', process.env.DB_HOST || 'localhost');
  console.log('  Port:', process.env.DB_PORT || '5987');
  console.log('  Database:', process.env.DB_NAME || 'youtube_uploader');
  console.log('  User:', process.env.DB_USER || 'postgres');
  console.log('  Password:', process.env.DB_PASSWORD ? '***SET***' : 'NOT SET');
  
  try {
    const db = getDatabase();
    await db.connect();
    const result = await db.query('SELECT 1 as test');
    console.log('✅ Database connection successful:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Full error:', error);
    return false;
  }
}

async function testTaskServiceDirectly() {
  console.log('\n=== Testing TaskService Directly ===');
  try {
    const taskService = new TaskService();
    
    // Test findAll method
    console.log('Testing findAll...');
    const result = await taskService.findAll({
      page: 1,
      pageSize: 10,
      type: 'upload'
    });
    
    console.log('✅ TaskService.findAll successful:');
    console.log('  - Total items:', result.total);
    console.log('  - Items returned:', result.items.length);
    console.log('  - First item:', result.items[0]);
    
    return true;
  } catch (error) {
    console.error('❌ TaskService test failed:', error);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

async function testAuthAPI() {
  console.log('\n=== Testing Auth API ===');
  try {
    const response = await axios.post('http://localhost:5989/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    }, {
      timeout: 5000
    });
    
    console.log('✅ Auth API successful:');
    console.log('  - Status:', response.status);
    console.log('  - Has token:', !!response.data.accessToken);
    
    return response.data.accessToken;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Auth API failed: Connection refused. Is the server running on port 5989?');
    } else if (error.response) {
      console.error('❌ Auth API failed:', error.response.data);
    } else {
      console.error('❌ Auth API failed:', error.message);
    }
    return null;
  }
}

async function testTasksAPI(token) {
  console.log('\n=== Testing Tasks API ===');
  
  // First test without auth
  console.log('Test 1: Without authentication');
  try {
    const response = await axios.get('http://localhost:5989/api/v1/tasks?page=1&pageSize=10', {
      timeout: 5000
    });
    console.log('❌ Expected 401 but got:', response.status);
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Connection refused. Is the server running on port 5989?');
    } else if (error.response && error.response.status === 401) {
      console.log('✅ Correctly returned 401 without auth');
    } else {
      console.error('❌ Unexpected error:', error.response ? error.response.data : error.message);
    }
  }
  
  // Test with dev token
  console.log('\nTest 2: With dev-token');
  try {
    const response = await axios.get('http://localhost:5989/api/v1/tasks', {
      params: { page: 1, pageSize: 10 },
      headers: { 'Authorization': 'Bearer dev-token' },
      timeout: 5000
    });
    console.log('✅ Dev token successful:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Connection refused. Is the server running on port 5989?');
    } else if (error.response) {
      console.error('❌ Dev token failed. Status:', error.response.status);
      console.error('Error data:', error.response.data);
    } else {
      console.error('❌ Dev token failed:', error.message);
    }
  }
  
  // Test with real token
  if (token) {
    console.log('\nTest 3: With real JWT token');
    try {
      const response = await axios.get('http://localhost:5989/api/v1/tasks', {
        params: { page: 1, pageSize: 10 },
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('✅ Real token successful:', response.status);
      console.log('Response data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.error('❌ Real token failed:', error.response ? error.response.data : error.message);
      if (error.response && error.response.status === 500) {
        console.error('Server error details:', error.response.data);
      }
    }
  }
}

async function runAllTests() {
  console.log('Starting API layer tests...\n');
  
  // Test database
  const dbOk = await testDatabaseConnection();
  if (!dbOk) {
    console.log('\n⚠️  Database connection failed. Stopping tests.');
    return;
  }
  
  // Test TaskService
  const serviceOk = await testTaskServiceDirectly();
  if (!serviceOk) {
    console.log('\n⚠️  TaskService failed. This is likely the cause of the 500 error.');
  }
  
  // Test Auth API
  const token = await testAuthAPI();
  
  // Test Tasks API
  await testTasksAPI(token);
  
  console.log('\n=== Test Summary ===');
  console.log('Database:', dbOk ? '✅' : '❌');
  console.log('TaskService:', serviceOk ? '✅' : '❌');
  console.log('Auth API:', token ? '✅' : '❌');
}

// Wait a bit for server to be ready if just started
setTimeout(runAllTests, 1000);