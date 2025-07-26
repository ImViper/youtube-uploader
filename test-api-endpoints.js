const axios = require('axios');

const API_URL = 'http://localhost:5989/api';
const token = 'dev-token';

async function testEndpoint(method, path, description) {
  try {
    const response = await axios({
      method,
      url: `${API_URL}${path}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Dev-Token': token
      }
    });
    console.log(`✅ ${method} ${path} - ${description}`);
    console.log(`   Status: ${response.status}`);
    if (response.data.items) {
      console.log(`   Items: ${response.data.items.length}`);
    }
  } catch (error) {
    console.log(`❌ ${method} ${path} - ${description}`);
    console.log(`   Error: ${error.response?.status} ${error.response?.statusText || error.message}`);
  }
}

async function runTests() {
  console.log('=== Testing API Endpoints ===\n');
  
  console.log('Health & Status:');
  await testEndpoint('GET', '/health', 'Health check');
  await testEndpoint('GET', '/status', 'System status');
  
  console.log('\nAccounts:');
  await testEndpoint('GET', '/accounts', 'List accounts');
  await testEndpoint('GET', '/accounts?status=active', 'List active accounts');
  
  console.log('\nUploads (Legacy):');
  await testEndpoint('GET', '/uploads', 'List uploads');
  
  console.log('\nTasks (V1):');
  await testEndpoint('GET', '/v1/tasks', 'List tasks');
  await testEndpoint('GET', '/v1/tasks?type=upload', 'List upload tasks');
  
  console.log('\nDashboard:');
  await testEndpoint('GET', '/dashboard/metrics', 'Dashboard metrics');
  await testEndpoint('GET', '/dashboard/stats/overview', 'Overview stats');
  
  console.log('\n=== Summary ===');
  console.log('1. Accounts API: /api/accounts');
  console.log('2. Tasks API: /api/v1/tasks (not /api/uploads)');
  console.log('3. Dashboard API: /api/dashboard/*');
  console.log('4. Legacy uploads endpoint: /api/uploads (maps to tasks)');
}

runTests();