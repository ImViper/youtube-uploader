const axios = require('axios');

async function testTasksAPI() {
  try {
    // Login first
    console.log('Logging in...');
    const loginResponse = await axios.post('http://localhost:5989/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginResponse.data.accessToken;
    console.log('Got token:', token);
    
    // Test tasks API
    console.log('\nTesting tasks API...');
    const tasksResponse = await axios.get('http://localhost:5989/api/v1/tasks', {
      params: {
        page: 1,
        pageSize: 10
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Tasks response:', JSON.stringify(tasksResponse.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
    if (error.response && error.response.status === 500) {
      console.error('Server returned 500 error');
    }
  }
}

testTasksAPI();