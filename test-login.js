const axios = require('axios');

async function testLogin() {
  console.log('Testing login to YouTube Matrix...');
  
  try {
    const response = await axios.post('http://localhost:5989/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Login successful!');
    console.log('User:', response.data.user);
    console.log('Access Token:', response.data.accessToken.substring(0, 50) + '...');
    
    // Test /me endpoint
    const meResponse = await axios.get('http://localhost:5989/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${response.data.accessToken}`
      }
    });
    
    console.log('\n✅ /me endpoint test successful!');
    console.log('Current user:', meResponse.data);
    
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    console.error('Status:', error.response?.status);
    console.error('Headers:', error.response?.headers);
  }
}

// Test with different credentials
async function testInvalidLogin() {
  console.log('\n\nTesting invalid login...');
  
  try {
    await axios.post('http://localhost:5989/api/auth/login', {
      username: 'admin',
      password: 'wrongpassword'
    });
  } catch (error) {
    console.log('✅ Invalid login correctly rejected:', error.response?.data);
  }
}

// Run tests
async function runTests() {
  await testLogin();
  await testInvalidLogin();
}

runTests();