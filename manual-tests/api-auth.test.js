const axios = require('axios');

const API_URL = 'http://localhost:5989/api';

async function testWithoutAuth() {
  console.log('=== Testing Without Auth ===\n');
  
  try {
    // Test health check (should work without auth)
    const healthResponse = await axios.get(`${API_URL}/health`);
    console.log('✅ Health check (no auth):', healthResponse.data);
    
    // Test accounts without auth (should fail)
    try {
      const accountsResponse = await axios.get(`${API_URL}/v1/accounts`);
      console.log('❌ Accounts without auth should have failed but succeeded:', accountsResponse.data);
    } catch (error) {
      console.log('✅ Accounts without auth correctly failed:', error.response?.status, error.response?.data);
    }
    
    // Test with correct dev token
    const devTokenResponse = await axios({
      method: 'GET',
      url: `${API_URL}/v1/accounts`,
      headers: {
        'Authorization': 'Bearer dev-token'
      },
      validateStatus: () => true
    });
    
    console.log('\nWith dev token:');
    console.log('Status:', devTokenResponse.status);
    console.log('Data:', devTokenResponse.data);
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testWithoutAuth();