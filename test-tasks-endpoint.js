require('dotenv').config();
const axios = require('axios');

async function testTasksEndpoint() {
  console.log('Testing /api/v1/tasks endpoint directly...\n');
  
  try {
    // Test with dev-token
    console.log('Making request to http://localhost:5989/api/v1/tasks');
    console.log('Headers: { Authorization: "Bearer dev-token" }');
    console.log('Query params: { page: 1, pageSize: 10, type: "upload" }\n');
    
    const response = await axios.get('http://localhost:5989/api/v1/tasks', {
      params: { 
        page: 1, 
        pageSize: 10,
        type: 'upload'
      },
      headers: { 
        'Authorization': 'Bearer dev-token'
      },
      timeout: 5000,
      validateStatus: null // Don't throw on any status
    });
    
    console.log('Response Status:', response.status);
    console.log('Response Headers:', response.headers);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200) {
      console.log('\n✅ Success! The API is working correctly.');
    } else {
      console.log('\n❌ Error: Unexpected status code');
    }
    
  } catch (error) {
    console.error('Request failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testTasksEndpoint();