// Add this to the main server to see what's happening
const originalConsoleError = console.error;
console.error = function(...args) {
  console.log('[CONSOLE.ERROR]', ...args);
  originalConsoleError.apply(console, args);
};

// Import after hooking console.error
require('dotenv').config();
const axios = require('axios');

async function testWithLogging() {
  try {
    console.log('Making request to tasks endpoint...');
    
    const response = await axios({
      method: 'GET',
      url: 'http://localhost:5989/api/v1/tasks',
      params: {
        page: 1,
        pageSize: 10
      },
      headers: {
        'Authorization': 'Bearer dev-token'
      },
      validateStatus: null
    });
    
    console.log('\n=== Response ===');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
    // Also test without auth to see the difference
    const response2 = await axios({
      method: 'GET',
      url: 'http://localhost:5989/api/v1/tasks',
      params: {
        page: 1,
        pageSize: 10
      },
      validateStatus: null
    });
    
    console.log('\n=== Response without auth ===');
    console.log('Status:', response2.status);
    console.log('Data:', JSON.stringify(response2.data, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testWithLogging();