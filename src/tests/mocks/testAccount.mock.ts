// Mock implementation for testAccount functionality
// This is used in the routes but not implemented in the AccountManager yet

export const mockTestAccount = jest.fn().mockImplementation((accountManager: any) => {
  // Add a mock testAccount method to the AccountManager
  if (!accountManager.testAccount) {
    accountManager.testAccount = jest.fn().mockImplementation(async (id: string) => {
      // Mock implementation - in production this would test YouTube login
      const account = await accountManager.getAccount(id);
      if (!account) {
        return { success: false, error: 'Account not found' };
      }
      
      // Simulate different test results based on account health
      if (account.healthScore >= 80) {
        return { success: true };
      } else if (account.healthScore >= 50) {
        return { success: true, warning: 'Account may have limitations' };
      } else {
        return { success: false, error: 'Account health too low' };
      }
    });
  }
  return accountManager;
});

// Helper to enhance AccountManager with testAccount method
export function enhanceAccountManagerWithTestAccount(accountManager: any) {
  accountManager.testAccount = jest.fn().mockImplementation(async (id: string) => {
    if (id === 'acc-1') {
      return { success: true };
    } else if (id === 'acc-2') {
      return { success: false, error: 'Login failed' };
    }
    return { success: false, error: 'Account not found' };
  });
  return accountManager;
}