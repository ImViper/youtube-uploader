const axios = require('axios');

// Configuration
const API_URL = 'http://localhost:5989/api';
const BITBROWSER_URL = 'http://127.0.0.1:54345';

// Test data
const testAccount = {
  email: 'test@example.com',
  password: 'testpassword123',
  recoveryEmail: 'recovery@example.com',
  browserWindowName: 'TestWindow1', // This should match a window name in BitBrowser
  tags: ['test', 'integration'],
  metadata: {
    purpose: 'Integration test'
  }
};

// Helper function to make API calls
async function apiCall(method, endpoint, data = null) {
  try {
    const response = await axios({
      method,
      url: `${API_URL}${endpoint}`,
      data,
      headers: {
        'Content-Type': 'application/json',
        'X-Dev-Token': 'dev-token'
      }
    });
    return response.data;
  } catch (error) {
    console.error(`API call failed: ${method} ${endpoint}`, error.response?.data || error.message);
    throw error;
  }
}

// Test functions
async function listBitBrowserWindows() {
  console.log('\n1. Listing BitBrowser windows...');
  try {
    const response = await axios.get(`${BITBROWSER_URL}/browser/list`);
    console.log('Available windows:', response.data.data.list.map(w => ({
      id: w.id,
      name: w.name,
      status: w.status
    })));
    return response.data.data.list;
  } catch (error) {
    console.error('Failed to list BitBrowser windows:', error.message);
    return [];
  }
}

async function createTestAccount() {
  console.log('\n2. Creating test account...');
  try {
    const response = await apiCall('POST', '/accounts', testAccount);
    console.log('Account created:', {
      id: response.data.id,
      email: response.data.email,
      browserWindowName: response.data.browserWindowName,
      browserWindowId: response.data.browserWindowId,
      isWindowLoggedIn: response.data.isWindowLoggedIn
    });
    return response.data;
  } catch (error) {
    if (error.response?.data?.error?.includes('already exists')) {
      console.log('Account already exists, fetching existing account...');
      const accounts = await apiCall('GET', '/accounts');
      const existing = accounts.data.find(a => a.email === testAccount.email);
      if (existing) {
        console.log('Found existing account:', {
          id: existing.id,
          email: existing.email,
          browserWindowName: existing.browserWindowName,
          browserWindowId: existing.browserWindowId
        });
        return existing;
      }
    }
    throw error;
  }
}

async function syncWindows() {
  console.log('\n3. Syncing BitBrowser windows...');
  try {
    await apiCall('POST', '/accounts/sync-windows');
    console.log('Windows synced successfully');
  } catch (error) {
    console.error('Failed to sync windows:', error.message);
  }
}

async function getAccountDetails(accountId) {
  console.log('\n4. Getting account details...');
  try {
    const response = await apiCall('GET', `/accounts/${accountId}`);
    console.log('Account details:', {
      id: response.data.id,
      email: response.data.email,
      browserWindowName: response.data.browserWindowName,
      browserWindowId: response.data.browserWindowId,
      isWindowLoggedIn: response.data.isWindowLoggedIn,
      status: response.data.status
    });
    return response.data;
  } catch (error) {
    console.error('Failed to get account details:', error.message);
  }
}

async function testAccount(accountId) {
  console.log('\n5. Testing account connection...');
  try {
    const response = await apiCall('POST', `/accounts/${accountId}/test`);
    console.log('Test result:', response);
    return response;
  } catch (error) {
    console.error('Failed to test account:', error.message);
  }
}

async function updateWindowLoginStatus(accountId, isLoggedIn) {
  console.log(`\n6. Updating window login status to: ${isLoggedIn}...`);
  try {
    await apiCall('PATCH', `/accounts/${accountId}/window-login`, { isLoggedIn });
    console.log('Window login status updated successfully');
  } catch (error) {
    console.error('Failed to update window login status:', error.message);
  }
}

// Main test flow
async function runIntegrationTest() {
  console.log('=== BitBrowser Integration Test ===');
  console.log('Make sure:');
  console.log('1. BitBrowser is running on port 54345');
  console.log('2. Backend is running on port 5989');
  console.log('3. You have a window named "TestWindow1" in BitBrowser');
  console.log('===================================');

  try {
    // List available windows
    const windows = await listBitBrowserWindows();
    
    if (windows.length === 0) {
      console.log('\nNo BitBrowser windows found. Please create at least one window.');
      return;
    }

    // Create or get test account
    const account = await createTestAccount();

    // Sync windows to update status
    await syncWindows();

    // Get updated account details
    await getAccountDetails(account.id);

    // Test account connection
    await testAccount(account.id);

    // Update window login status
    await updateWindowLoginStatus(account.id, true);

    // Get final account details
    await getAccountDetails(account.id);

    console.log('\n✅ Integration test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Integration test failed:', error.message);
  }
}

// Run the test
runIntegrationTest();