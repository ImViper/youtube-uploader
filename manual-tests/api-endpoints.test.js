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
  await testEndpoint('GET', '/v1/health', 'V1 Health check');
  await testEndpoint('GET', '/v1/status', 'V1 System status');
  await testEndpoint('GET', '/v1/metrics', 'V1 Metrics');
  
  console.log('\nAccounts:');
  await testEndpoint('GET', '/v1/accounts', 'List accounts');
  await testEndpoint('GET', '/v1/accounts?status=active', 'List active accounts');
  await testEndpoint('GET', '/v1/accounts/stats', 'Account statistics');
  
  console.log('\nTasks:');
  await testEndpoint('GET', '/v1/tasks', 'List tasks');
  await testEndpoint('GET', '/v1/tasks?type=upload', 'List upload tasks');
  await testEndpoint('GET', '/v1/tasks/stats', 'Task statistics');
  
  console.log('\nMatrices:');
  await testEndpoint('GET', '/v1/matrices', 'List matrices');
  
  console.log('\nDashboard:');
  await testEndpoint('GET', '/v1/dashboard/metrics', 'Dashboard metrics');
  await testEndpoint('GET', '/v1/dashboard/stats/overview', 'Overview stats');
  
  console.log('\n=== Summary ===');
  console.log('Base URL: http://localhost:5989/api');
  console.log('All V1 endpoints under: /api/v1/*');
  console.log('- Accounts: /api/v1/accounts');
  console.log('- Tasks: /api/v1/tasks'); 
  console.log('- Matrices: /api/v1/matrices');
  console.log('- Dashboard: /api/v1/dashboard/*');
}

runTests();