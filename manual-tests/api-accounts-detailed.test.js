const axios = require('axios');

const API_URL = 'http://localhost:5989/api';
const token = 'dev-token';

async function testAccountsEndpoint() {
  console.log('=== Testing Accounts API in Detail ===\n');
  
  try {
    console.log('Making request to:', `${API_URL}/v1/accounts`);
    console.log('Headers:', {
      'Authorization': `Bearer ${token}`,
      'X-Dev-Token': token
    });
    
    const response = await axios({
      method: 'GET',
      url: `${API_URL}/v1/accounts`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Dev-Token': token
      },
      params: {
        page: 1,
        pageSize: 100
      },
      validateStatus: () => true // Don't throw on any status code
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 500) {
      console.log('\n❌ Server returned 500 error');
      console.log('Error details:', response.data);
    }
    
  } catch (error) {
    console.error('Request failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testAccountsEndpoint();