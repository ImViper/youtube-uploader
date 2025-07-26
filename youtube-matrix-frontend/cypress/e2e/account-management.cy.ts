describe('Account Management E2E Tests', () => {
  beforeEach(() => {
    // Login as admin
    cy.login('admin', 'admin123');

    // Mock initial accounts data
    cy.fixture('accounts').then((accounts) => {
      cy.mockApiResponse('GET', '/api/accounts', [
        accounts.active,
        accounts.warning,
        accounts.error,
      ]);
    });
  });

  it('displays account health dashboard', () => {
    cy.visit('/accounts');

    // Page should load
    cy.findByText(/account management/i).should('be.visible');

    // Health summary cards should be visible
    cy.findByTestId('total-accounts-card').should('contain', '3');
    cy.findByTestId('active-accounts-card').should('contain', '1');
    cy.findByTestId('warning-accounts-card').should('contain', '1');
    cy.findByTestId('error-accounts-card').should('contain', '1');

    // Account table should show all accounts
    cy.findByText('youtube_account_1').should('be.visible');
    cy.findByText('youtube_account_2').should('be.visible');
    cy.findByText('youtube_account_3').should('be.visible');

    // Health scores should be displayed with correct colors
    cy.get('[data-testid="health-score-95"]')
      .should('be.visible')
      .should('have.class', 'health-good');

    cy.get('[data-testid="health-score-75"]')
      .should('be.visible')
      .should('have.class', 'health-warning');

    cy.get('[data-testid="health-score-45"]')
      .should('be.visible')
      .should('have.class', 'health-error');
  });

  it('creates new YouTube account', () => {
    cy.visit('/accounts');

    // Click add account
    cy.findByRole('button', { name: /add account/i }).click();

    // Modal should open
    cy.findByRole('dialog').should('be.visible');
    cy.findByText(/add youtube account/i).should('be.visible');

    // Fill account form
    cy.findByLabelText(/account name/i).type('new_test_account');
    cy.findByLabelText(/email/i).type('newaccount@youtube.com');
    cy.findByLabelText(/password/i).type('SecurePass123!');
    cy.findByLabelText(/confirm password/i).type('SecurePass123!');

    // Select proxy (optional)
    cy.findByLabelText(/proxy/i).click();
    cy.findByText('Proxy Server 1').click();

    // Add notes
    cy.findByLabelText(/notes/i).type('Test account for E2E testing');

    // Mock account creation
    cy.mockApiResponse('POST', '/api/accounts', {
      id: 'new-account-id',
      username: 'new_test_account',
      status: 'pending',
      healthScore: 100,
    });

    // Submit form
    cy.findByRole('button', { name: /create account/i }).click();

    // Should show success
    cy.waitForToast('Account created successfully');

    // New account should appear in list
    cy.findByText('new_test_account').should('be.visible');
    cy.findByText('pending').should('be.visible');
  });

  it('verifies account with 2FA', () => {
    cy.visit('/accounts');

    // Find unverified account
    cy.findByText('youtube_account_3')
      .closest('tr')
      .within(() => {
        cy.findByRole('button', { name: /actions/i }).click();
      });

    // Click verify
    cy.findByRole('menuitem', { name: /verify account/i }).click();

    // Verification modal should open
    cy.findByText(/account verification/i).should('be.visible');

    // Mock 2FA setup
    cy.mockApiResponse('POST', '/api/accounts/acc-3/2fa/setup', {
      qrCode: 'data:image/png;base64,mockQRCode',
      secret: 'MOCK2FASECRET',
    });

    // Should show QR code
    cy.findByAltText(/2fa qr code/i).should('be.visible');

    // Enter verification code
    cy.findByLabelText(/verification code/i).type('123456');

    // Mock verification
    cy.mockApiResponse('POST', '/api/accounts/acc-3/verify', {
      success: true,
      status: 'active',
    });

    // Submit verification
    cy.findByRole('button', { name: /verify/i }).click();

    // Should show success
    cy.waitForToast('Account verified successfully');

    // Account status should update
    cy.findByText('youtube_account_3').closest('tr').should('contain', 'active');
  });

  it('handles bulk account operations', () => {
    cy.visit('/accounts');

    // Select multiple accounts
    cy.get('input[type="checkbox"]').eq(1).check(); // First account
    cy.get('input[type="checkbox"]').eq(3).check(); // Third account

    // Bulk actions should appear
    cy.findByText(/2 accounts selected/i).should('be.visible');
    cy.findByRole('button', { name: /bulk actions/i }).should('be.visible');

    // Open bulk actions menu
    cy.findByRole('button', { name: /bulk actions/i }).click();

    // Select pause action
    cy.findByRole('menuitem', { name: /pause selected/i }).click();

    // Confirmation modal
    cy.findByText(/pause 2 accounts/i).should('be.visible');
    cy.findByText(/this will temporarily disable/i).should('be.visible');

    // Mock bulk action
    cy.mockApiResponse('POST', '/api/accounts/bulk/pause', {
      success: true,
      affected: 2,
    });

    // Confirm action
    cy.findByRole('button', { name: /confirm/i }).click();

    // Should show success
    cy.waitForToast('2 accounts paused successfully');

    // Selected accounts should show paused status
    cy.findByText('youtube_account_1').closest('tr').should('contain', 'paused');
  });

  it('monitors account performance metrics', () => {
    // Mock metrics data
    cy.mockApiResponse('GET', '/api/accounts/acc-1/metrics', {
      uploadSuccess: 145,
      uploadFailure: 5,
      avgUploadTime: 125.5,
      healthTrend: [
        { date: '2023-11-25', score: 92 },
        { date: '2023-11-26', score: 93 },
        { date: '2023-11-27', score: 94 },
        { date: '2023-11-28', score: 94 },
        { date: '2023-11-29', score: 95 },
        { date: '2023-11-30', score: 95 },
        { date: '2023-12-01', score: 95 },
      ],
      recentActivity: [
        { timestamp: '2023-12-01T10:00:00Z', action: 'upload_success', details: 'Video uploaded' },
        { timestamp: '2023-12-01T09:30:00Z', action: 'login', details: 'Account logged in' },
      ],
    });

    cy.visit('/accounts/acc-1');

    // Account details should load
    cy.findByText('youtube_account_1').should('be.visible');

    // Performance metrics should be displayed
    cy.findByTestId('success-rate').should('contain', '96.7%');
    cy.findByTestId('avg-upload-time').should('contain', '2m 5s');
    cy.findByTestId('total-uploads').should('contain', '150');

    // Health trend chart should be visible
    cy.get('[data-testid="health-trend-chart"] canvas').should('be.visible');

    // Recent activity should be shown
    cy.findByText(/recent activity/i).should('be.visible');
    cy.findByText('Video uploaded').should('be.visible');
    cy.findByText('Account logged in').should('be.visible');
  });

  it('edits account settings', () => {
    cy.visit('/accounts');

    // Open account actions
    cy.findByText('youtube_account_1')
      .closest('tr')
      .within(() => {
        cy.findByRole('button', { name: /actions/i }).click();
      });

    // Click edit
    cy.findByRole('menuitem', { name: /edit/i }).click();

    // Edit modal should open with current values
    cy.findByRole('dialog').should('be.visible');
    cy.findByDisplayValue('youtube_account_1').should('be.visible');

    // Update settings
    cy.findByLabelText(/daily upload limit/i)
      .clear()
      .type('20');
    cy.findByLabelText(/auto retry failed/i).check();
    cy.findByLabelText(/proxy/i).click();
    cy.findByText('Proxy Server 2').click();

    // Mock update
    cy.mockApiResponse('PATCH', '/api/accounts/acc-1', {
      id: 'acc-1',
      username: 'youtube_account_1',
      dailyLimit: 20,
      autoRetry: true,
      proxy: 'proxy-2',
    });

    // Save changes
    cy.findByRole('button', { name: /save changes/i }).click();

    // Should show success
    cy.waitForToast('Account updated successfully');
  });

  it('handles account deletion with safety checks', () => {
    cy.visit('/accounts');

    // Open actions for error account
    cy.findByText('youtube_account_3')
      .closest('tr')
      .within(() => {
        cy.findByRole('button', { name: /actions/i }).click();
      });

    // Click delete
    cy.findByRole('menuitem', { name: /delete/i }).click();

    // Confirmation modal with warnings
    cy.findByText(/delete account/i).should('be.visible');
    cy.findByText(/this action cannot be undone/i).should('be.visible');
    cy.findByText(/all associated data will be lost/i).should('be.visible');

    // Type confirmation
    cy.findByPlaceholderText(/type "delete" to confirm/i).type('delete');

    // Delete button should be enabled
    cy.findByRole('button', { name: /delete account/i }).should('not.be.disabled');

    // Mock deletion
    cy.mockApiResponse('DELETE', '/api/accounts/acc-3', {
      success: true,
    });

    // Confirm deletion
    cy.findByRole('button', { name: /delete account/i }).click();

    // Should show success
    cy.waitForToast('Account deleted successfully');

    // Account should be removed from list
    cy.findByText('youtube_account_3').should('not.exist');
  });

  it('filters and searches accounts', () => {
    cy.visit('/accounts');

    // Search by name
    cy.findByPlaceholderText(/search accounts/i).type('account_2');

    // Should only show matching account
    cy.findByText('youtube_account_2').should('be.visible');
    cy.findByText('youtube_account_1').should('not.exist');
    cy.findByText('youtube_account_3').should('not.exist');

    // Clear search
    cy.findByPlaceholderText(/search accounts/i).clear();

    // Filter by status
    cy.findByLabelText(/filter by status/i).click();
    cy.findByText('Warning').click();

    // Should only show warning accounts
    cy.findByText('youtube_account_2').should('be.visible');
    cy.findByText('youtube_account_1').should('not.exist');

    // Add health score filter
    cy.findByLabelText(/health score/i).click();
    cy.findByText('Below 80').click();

    // Should show accounts with health < 80
    cy.findByText('youtube_account_2').should('be.visible');
    cy.findByText('youtube_account_3').should('be.visible');
  });

  it('exports account data', () => {
    cy.visit('/accounts');

    // Click export button
    cy.findByRole('button', { name: /export/i }).click();

    // Export modal should open
    cy.findByText(/export accounts/i).should('be.visible');

    // Select export options
    cy.findByLabelText(/include credentials/i).check();
    cy.findByLabelText(/include metrics/i).check();
    cy.findByLabelText(/format/i).click();
    cy.findByText('CSV').click();

    // Mock export
    cy.mockApiResponse('POST', '/api/accounts/export', {
      url: '/downloads/accounts-export.csv',
      filename: 'accounts-2023-12-01.csv',
    });

    // Start export
    cy.findByRole('button', { name: /export data/i }).click();

    // Should trigger download
    cy.waitForToast('Export completed');

    // Verify download was triggered (cypress limitation - can't actually check file)
    cy.window().its('navigator.msSaveOrOpenBlob').should('be.called');
  });

  it('manages account proxies and rotation', () => {
    cy.visit('/accounts/acc-1/settings');

    // Proxy configuration section
    cy.findByText(/proxy configuration/i).should('be.visible');

    // Enable proxy rotation
    cy.findByLabelText(/enable proxy rotation/i).check();

    // Configure rotation
    cy.findByLabelText(/rotation interval/i)
      .clear()
      .type('30');
    cy.findByLabelText(/rotation unit/i).click();
    cy.findByText('Minutes').click();

    // Add proxy pool
    cy.findByRole('button', { name: /add proxy/i }).click();
    cy.findByLabelText(/proxy url/i).type('http://proxy1.example.com:8080');
    cy.findByLabelText(/username/i).type('proxyuser');
    cy.findByLabelText(/password/i).type('proxypass');

    // Test proxy
    cy.mockApiResponse('POST', '/api/proxies/test', {
      success: true,
      latency: 150,
      location: 'US',
    });

    cy.findByRole('button', { name: /test proxy/i }).click();

    // Should show test results
    cy.findByText(/proxy test successful/i).should('be.visible');
    cy.findByText(/latency: 150ms/i).should('be.visible');

    // Save proxy configuration
    cy.findByRole('button', { name: /save proxy settings/i }).click();

    cy.waitForToast('Proxy settings updated');
  });
});
