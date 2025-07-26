describe('Monitoring Dashboard E2E Tests', () => {
  beforeEach(() => {
    // Login and setup mock data
    cy.login();

    // Mock performance data
    cy.mockApiResponse('GET', '/api/monitoring/performance', {
      cpu: {
        current: 45.2,
        average: 38.5,
        history: Array.from({ length: 60 }, (_, i) => ({
          timestamp: new Date(Date.now() - i * 60000).toISOString(),
          value: 35 + Math.random() * 20,
        })),
      },
      memory: {
        current: 2.1,
        total: 8,
        average: 1.8,
        history: Array.from({ length: 60 }, (_, i) => ({
          timestamp: new Date(Date.now() - i * 60000).toISOString(),
          value: 1.5 + Math.random() * 1,
        })),
      },
      network: {
        incoming: 125.5,
        outgoing: 89.3,
        total: 214.8,
      },
      disk: {
        used: 45.2,
        total: 100,
        percentage: 45.2,
      },
    });

    // Mock upload statistics
    cy.mockApiResponse('GET', '/api/monitoring/uploads', {
      today: {
        total: 145,
        successful: 138,
        failed: 7,
        pending: 12,
      },
      week: {
        total: 980,
        successful: 921,
        failed: 59,
      },
      month: {
        total: 4250,
        successful: 4001,
        failed: 249,
      },
      hourlyDistribution: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        count: Math.floor(Math.random() * 20 + 5),
      })),
      failureReasons: [
        { reason: 'Network timeout', count: 35 },
        { reason: 'Authentication failed', count: 18 },
        { reason: 'Rate limit exceeded', count: 6 },
      ],
    });
  });

  it('displays real-time performance metrics', () => {
    cy.visit('/monitoring');

    // Performance section should be visible
    cy.findByText(/system performance/i).should('be.visible');

    // CPU metrics
    cy.findByTestId('cpu-metric').within(() => {
      cy.findByText(/cpu usage/i).should('be.visible');
      cy.findByText('45.2%').should('be.visible');
      cy.get('.trend-indicator').should('have.class', 'trend-up');
    });

    // Memory metrics
    cy.findByTestId('memory-metric').within(() => {
      cy.findByText(/memory/i).should('be.visible');
      cy.findByText('2.1 GB / 8 GB').should('be.visible');
      cy.get('.progress-bar').should('have.attr', 'aria-valuenow', '26.25');
    });

    // Charts should be rendered
    cy.get('[data-testid="cpu-chart"] canvas').should('be.visible');
    cy.get('[data-testid="memory-chart"] canvas').should('be.visible');

    // Real-time updates (simulated)
    cy.window().then((win) => {
      // Emit performance update
      win.dispatchEvent(
        new CustomEvent('performance:update', {
          detail: {
            cpu: 48.5,
            memory: 2.3,
          },
        }),
      );
    });

    // Values should update
    cy.findByTestId('cpu-metric').should('contain', '48.5%');
    cy.findByTestId('memory-metric').should('contain', '2.3 GB');
  });

  it('shows upload statistics and trends', () => {
    cy.visit('/monitoring');

    // Navigate to uploads tab
    cy.findByRole('tab', { name: /uploads/i }).click();

    // Statistics cards should be visible
    cy.findByTestId('uploads-today').should('contain', '145');
    cy.findByTestId('success-rate').should('contain', '95.2%');
    cy.findByTestId('failed-uploads').should('contain', '7');

    // Time period selector
    cy.findByLabelText(/time period/i).click();
    cy.findByText('Last 7 days').click();

    // Weekly stats should show
    cy.findByTestId('total-uploads').should('contain', '980');
    cy.findByTestId('success-rate').should('contain', '94.0%');

    // Hourly distribution chart
    cy.get('[data-testid="hourly-chart"]').should('be.visible');

    // Failure analysis
    cy.findByText(/failure analysis/i).should('be.visible');
    cy.findByText('Network timeout').should('be.visible');
    cy.findByText('35 occurrences').should('be.visible');
  });

  it('monitors account health in real-time', () => {
    // Mock account health data
    cy.mockApiResponse('GET', '/api/monitoring/accounts', {
      accounts: [
        {
          id: 'acc-1',
          name: 'youtube_account_1',
          health: 95,
          status: 'active',
          uploads: { success: 45, failed: 2 },
          lastActivity: new Date().toISOString(),
        },
        {
          id: 'acc-2',
          name: 'youtube_account_2',
          health: 72,
          status: 'warning',
          uploads: { success: 30, failed: 8 },
          lastActivity: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'acc-3',
          name: 'youtube_account_3',
          health: 45,
          status: 'error',
          uploads: { success: 15, failed: 15 },
          lastActivity: new Date(Date.now() - 86400000).toISOString(),
        },
      ],
      summary: {
        total: 3,
        healthy: 1,
        warning: 1,
        error: 1,
      },
    });

    cy.visit('/monitoring');
    cy.findByRole('tab', { name: /accounts/i }).click();

    // Account health overview
    cy.findByTestId('healthy-accounts').should('contain', '1/3');
    cy.findByTestId('accounts-warning').should('contain', '1');
    cy.findByTestId('accounts-error').should('contain', '1');

    // Account list with health indicators
    cy.get('[data-testid="account-health-list"]').within(() => {
      // First account (healthy)
      cy.findByText('youtube_account_1').should('be.visible');
      cy.get('[data-health="95"]').should('have.class', 'health-good');

      // Warning account
      cy.findByText('youtube_account_2').should('be.visible');
      cy.get('[data-health="72"]').should('have.class', 'health-warning');

      // Error account
      cy.findByText('youtube_account_3').should('be.visible');
      cy.get('[data-health="45"]').should('have.class', 'health-error');
    });

    // Simulate health update
    cy.window().then((win) => {
      win.dispatchEvent(
        new CustomEvent('account:health:update', {
          detail: {
            accountId: 'acc-2',
            health: 85,
            status: 'active',
          },
        }),
      );
    });

    // Health should update
    cy.get('[data-health="85"]').should('have.class', 'health-good');
  });

  it('generates and downloads reports', () => {
    cy.visit('/monitoring');

    // Open reports section
    cy.findByRole('button', { name: /generate report/i }).click();

    // Report modal should open
    cy.findByRole('dialog').within(() => {
      cy.findByText(/generate monitoring report/i).should('be.visible');

      // Select report type
      cy.findByLabelText(/report type/i).click();
      cy.findByText('Performance Summary').click();

      // Select date range
      cy.findByLabelText(/date range/i).click();
      cy.findByText('Last 30 days').click();

      // Select metrics to include
      cy.findByLabelText(/include cpu metrics/i).check();
      cy.findByLabelText(/include memory metrics/i).check();
      cy.findByLabelText(/include upload statistics/i).check();
      cy.findByLabelText(/include account health/i).check();

      // Select format
      cy.findByLabelText(/format/i).click();
      cy.findByText('PDF').click();
    });

    // Mock report generation
    cy.mockApiResponse('POST', '/api/monitoring/reports/generate', {
      reportId: 'report-123',
      status: 'generating',
    });

    // Generate report
    cy.findByRole('button', { name: /generate$/i }).click();

    // Should show progress
    cy.findByText(/generating report/i).should('be.visible');
    cy.get('[role="progressbar"]').should('be.visible');

    // Simulate completion
    cy.mockApiResponse('GET', '/api/monitoring/reports/report-123', {
      status: 'completed',
      url: '/downloads/report-123.pdf',
    });

    // Should show download button
    cy.findByRole('button', { name: /download report/i }).should('be.visible');
  });

  it('sets up alerts and notifications', () => {
    cy.visit('/monitoring/alerts');

    // Alerts configuration page
    cy.findByText(/alert configuration/i).should('be.visible');

    // Create new alert
    cy.findByRole('button', { name: /create alert/i }).click();

    // Fill alert form
    cy.findByLabelText(/alert name/i).type('High CPU Usage Alert');
    cy.findByLabelText(/metric/i).click();
    cy.findByText('CPU Usage').click();

    cy.findByLabelText(/condition/i).click();
    cy.findByText('Greater than').click();

    cy.findByLabelText(/threshold/i).type('80');
    cy.findByLabelText(/duration/i).type('5');

    // Configure notification
    cy.findByLabelText(/notification method/i).click();
    cy.findByText('Email').click();
    cy.findByLabelText(/email recipients/i).type('admin@example.com');

    // Mock alert creation
    cy.mockApiResponse('POST', '/api/monitoring/alerts', {
      id: 'alert-1',
      name: 'High CPU Usage Alert',
      enabled: true,
    });

    // Save alert
    cy.findByRole('button', { name: /save alert/i }).click();

    // Should show in alerts list
    cy.waitForToast('Alert created successfully');
    cy.findByText('High CPU Usage Alert').should('be.visible');

    // Test alert
    cy.findByRole('button', { name: /test alert/i }).click();
    cy.waitForToast('Test notification sent');
  });

  it('displays error logs and trends', () => {
    // Mock error logs
    cy.mockApiResponse('GET', '/api/monitoring/errors', {
      errors: [
        {
          id: 'err-1',
          timestamp: new Date().toISOString(),
          level: 'error',
          message: 'Upload failed: Network timeout',
          source: 'UploadService',
          count: 5,
          lastOccurrence: new Date().toISOString(),
        },
        {
          id: 'err-2',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          level: 'warning',
          message: 'Rate limit approaching',
          source: 'APIClient',
          count: 12,
          lastOccurrence: new Date(Date.now() - 1800000).toISOString(),
        },
      ],
      summary: {
        total: 17,
        errors: 5,
        warnings: 12,
        trend: 'decreasing',
      },
    });

    cy.visit('/monitoring/errors');

    // Error summary
    cy.findByTestId('total-errors').should('contain', '17');
    cy.findByTestId('error-trend').should('have.class', 'trend-down');

    // Error list
    cy.get('[data-testid="error-log-table"]').within(() => {
      cy.findByText('Upload failed: Network timeout').should('be.visible');
      cy.findByText('5 occurrences').should('be.visible');

      cy.findByText('Rate limit approaching').should('be.visible');
      cy.findByText('12 occurrences').should('be.visible');
    });

    // Filter errors
    cy.findByLabelText(/filter by level/i).click();
    cy.findByText('Errors only').click();

    // Should only show errors
    cy.findByText('Upload failed: Network timeout').should('be.visible');
    cy.findByText('Rate limit approaching').should('not.exist');

    // View error details
    cy.findByText('Upload failed: Network timeout').click();

    // Error details modal
    cy.findByRole('dialog').within(() => {
      cy.findByText(/error details/i).should('be.visible');
      cy.findByText(/stack trace/i).should('be.visible');
      cy.findByText('UploadService').should('be.visible');
    });
  });

  it('monitors queue status and performance', () => {
    // Mock queue data
    cy.mockApiResponse('GET', '/api/monitoring/queue', {
      status: {
        active: 15,
        waiting: 45,
        completed: 890,
        failed: 23,
        paused: 5,
      },
      performance: {
        avgProcessingTime: 125.5,
        throughput: 12.5,
        successRate: 94.5,
      },
      workers: [
        { id: 'worker-1', status: 'active', load: 3, capacity: 5 },
        { id: 'worker-2', status: 'active', load: 5, capacity: 5 },
        { id: 'worker-3', status: 'idle', load: 0, capacity: 5 },
      ],
    });

    cy.visit('/monitoring/queue');

    // Queue overview
    cy.findByTestId('active-jobs').should('contain', '15');
    cy.findByTestId('waiting-jobs').should('contain', '45');
    cy.findByTestId('throughput').should('contain', '12.5 jobs/min');

    // Worker status
    cy.get('[data-testid="worker-status"]').within(() => {
      cy.findByText('worker-1').should('be.visible');
      cy.findByText('3/5').should('be.visible');

      cy.findByText('worker-2').should('be.visible');
      cy.findByText('5/5').should('be.visible');
      cy.get('[data-worker="worker-2"]').should('have.class', 'worker-full');
    });

    // Queue actions
    cy.findByRole('button', { name: /pause queue/i }).should('be.visible');
    cy.findByRole('button', { name: /clear failed/i }).should('be.visible');

    // Clear failed jobs
    cy.mockApiResponse('POST', '/api/monitoring/queue/clear-failed', {
      cleared: 23,
    });

    cy.findByRole('button', { name: /clear failed/i }).click();
    cy.findByRole('button', { name: /confirm/i }).click();

    cy.waitForToast('23 failed jobs cleared');
  });

  it('shows system resource usage over time', () => {
    cy.visit('/monitoring/resources');

    // Time range selector
    cy.findByLabelText(/time range/i).click();
    cy.findByText('Last 24 hours').click();

    // Resource charts should load
    cy.get('[data-testid="cpu-timeline"]').should('be.visible');
    cy.get('[data-testid="memory-timeline"]').should('be.visible');
    cy.get('[data-testid="network-timeline"]').should('be.visible');
    cy.get('[data-testid="disk-timeline"]').should('be.visible');

    // Hover for details
    cy.get('[data-testid="cpu-timeline"] canvas').trigger('mouseover', 100, 100);
    cy.get('.chart-tooltip').should('be.visible').and('contain', 'CPU:');

    // Export data
    cy.findByRole('button', { name: /export data/i }).click();
    cy.findByText('CSV').click();

    cy.mockApiResponse('POST', '/api/monitoring/resources/export', {
      url: '/downloads/resources-data.csv',
    });

    cy.findByRole('button', { name: /download/i }).click();
    cy.waitForToast('Export completed');
  });
});
