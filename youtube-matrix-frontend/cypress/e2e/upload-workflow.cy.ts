describe('Upload Workflow E2E Tests', () => {
  beforeEach(() => {
    // Login as regular user
    cy.login();

    // Mock accounts API
    cy.fixture('accounts').then((accounts) => {
      cy.mockApiResponse('GET', '/api/accounts', [accounts.active, accounts.warning]);
    });
  });

  it('completes single video upload workflow', () => {
    // Navigate to uploads
    cy.visit('/uploads');
    cy.findByText(/upload management/i).should('be.visible');

    // Click new upload button
    cy.findByRole('button', { name: /new upload/i }).click();

    // Modal should open
    cy.findByRole('dialog').should('be.visible');
    cy.findByText(/create new upload/i).should('be.visible');

    // Fill upload form
    cy.findByLabelText(/title/i).type('My Test Video');
    cy.findByLabelText(/description/i).type('This is a test video description with some keywords');

    // Select account
    cy.findByLabelText(/account/i).click();
    cy.findByText('youtube_account_1').click();

    // Select privacy
    cy.findByLabelText(/privacy/i).click();
    cy.findByText('Private').click();

    // Add tags
    cy.findByLabelText(/tags/i).type('test{enter}video{enter}cypress{enter}');

    // Select category
    cy.findByLabelText(/category/i).click();
    cy.findByText('Education').click();

    // Upload thumbnail
    cy.fixture('thumbnail.jpg', 'base64').then((fileContent) => {
      cy.findByLabelText(/thumbnail/i).attachFile({
        fileContent,
        fileName: 'thumbnail.jpg',
        mimeType: 'image/jpeg',
        encoding: 'base64',
      });
    });

    // Upload video file
    cy.fixture('sample-video.mp4', 'base64').then((fileContent) => {
      cy.findByLabelText(/video file/i).attachFile({
        fileContent,
        fileName: 'sample-video.mp4',
        mimeType: 'video/mp4',
        encoding: 'base64',
      });
    });

    // Mock upload creation
    cy.mockApiResponse('POST', '/api/uploads', {
      id: 'upload-123',
      title: 'My Test Video',
      status: 'processing',
      progress: 0,
    });

    // Submit form
    cy.findByRole('button', { name: /start upload/i }).click();

    // Should show success message
    cy.waitForToast('Upload created successfully');

    // Should redirect to upload details
    cy.url().should('include', '/uploads/upload-123');
  });

  it('handles bulk video uploads', () => {
    cy.visit('/uploads');

    // Click bulk upload
    cy.findByRole('button', { name: /bulk upload/i }).click();

    // Upload CSV file
    cy.fixture('bulk-uploads.csv').then((fileContent) => {
      cy.findByLabelText(/csv file/i).attachFile({
        fileContent,
        fileName: 'bulk-uploads.csv',
        mimeType: 'text/csv',
      });
    });

    // Preview should show
    cy.findByText(/preview: 5 videos will be uploaded/i).should('be.visible');

    // Select accounts for distribution
    cy.findByLabelText(/distribute across accounts/i).check();

    // Mock bulk upload
    cy.mockApiResponse('POST', '/api/uploads/bulk', {
      created: 5,
      failed: 0,
      uploads: [
        { id: 'upload-1', title: 'Video 1' },
        { id: 'upload-2', title: 'Video 2' },
        { id: 'upload-3', title: 'Video 3' },
        { id: 'upload-4', title: 'Video 4' },
        { id: 'upload-5', title: 'Video 5' },
      ],
    });

    // Start bulk upload
    cy.findByRole('button', { name: /start bulk upload/i }).click();

    // Should show progress
    cy.findByText(/uploading 5 videos/i).should('be.visible');
    cy.get('[role="progressbar"]').should('be.visible');

    // Should show completion
    cy.waitForToast('5 videos uploaded successfully');
  });

  it('monitors upload progress in real-time', () => {
    // Mock existing upload
    cy.mockApiResponse('GET', '/api/uploads/upload-123', {
      id: 'upload-123',
      title: 'My Video',
      status: 'uploading',
      progress: 25,
      startTime: new Date().toISOString(),
      estimatedTime: 300, // 5 minutes
    });

    cy.visit('/uploads/upload-123');

    // Should show upload details
    cy.findByText('My Video').should('be.visible');
    cy.findByText(/uploading/i).should('be.visible');

    // Progress bar should be visible
    cy.get('[role="progressbar"]').should('be.visible').should('have.attr', 'aria-valuenow', '25');

    // Simulate progress updates via WebSocket
    cy.window().then((win) => {
      // Emit progress update
      win.dispatchEvent(
        new CustomEvent('upload:progress', {
          detail: { uploadId: 'upload-123', progress: 50 },
        }),
      );
    });

    // Progress should update
    cy.get('[role="progressbar"]').should('have.attr', 'aria-valuenow', '50');

    // Simulate completion
    cy.window().then((win) => {
      win.dispatchEvent(
        new CustomEvent('upload:complete', {
          detail: {
            uploadId: 'upload-123',
            videoId: 'youtube-video-id',
            url: 'https://youtube.com/watch?v=youtube-video-id',
          },
        }),
      );
    });

    // Should show completion status
    cy.findByText(/completed/i).should('be.visible');
    cy.findByRole('link', { name: /view on youtube/i }).should('be.visible');
  });

  it('handles upload errors and retry', () => {
    // Mock failed upload
    cy.mockApiResponse('GET', '/api/uploads/upload-failed', {
      id: 'upload-failed',
      title: 'Failed Video',
      status: 'failed',
      error: 'Video file corrupted',
      progress: 45,
    });

    cy.visit('/uploads/upload-failed');

    // Should show error status
    cy.findByText(/failed/i).should('be.visible');
    cy.findByText(/video file corrupted/i).should('be.visible');

    // Retry button should be visible
    cy.findByRole('button', { name: /retry upload/i }).should('be.visible');

    // Mock retry
    cy.mockApiResponse('POST', '/api/uploads/upload-failed/retry', {
      success: true,
      message: 'Upload restarted',
    });

    // Click retry
    cy.findByRole('button', { name: /retry upload/i }).click();

    // Confirm retry
    cy.findByRole('button', { name: /confirm retry/i }).click();

    // Should show success message
    cy.waitForToast('Upload restarted');
  });

  it('manages upload queue and priorities', () => {
    // Mock uploads list
    cy.mockApiResponse('GET', '/api/uploads', [
      { id: '1', title: 'Video 1', status: 'queued', priority: 'normal' },
      { id: '2', title: 'Video 2', status: 'queued', priority: 'high' },
      { id: '3', title: 'Video 3', status: 'uploading', priority: 'normal' },
      { id: '4', title: 'Video 4', status: 'queued', priority: 'low' },
    ]);

    cy.visit('/uploads');

    // Check queue order (high priority first)
    cy.get('[data-testid="upload-row"]').first().should('contain', 'Video 2');

    // Change priority
    cy.get('[data-testid="upload-row"]')
      .first()
      .within(() => {
        cy.findByRole('button', { name: /actions/i }).click();
      });

    cy.findByRole('menuitem', { name: /change priority/i }).click();

    // Select new priority
    cy.findByLabelText(/priority/i).click();
    cy.findByText('Low').click();

    // Mock priority update
    cy.mockApiResponse('PATCH', '/api/uploads/2', {
      id: '2',
      title: 'Video 2',
      priority: 'low',
    });

    // Save changes
    cy.findByRole('button', { name: /save/i }).click();

    // Should show success
    cy.waitForToast('Priority updated');
  });

  it('schedules uploads for future time', () => {
    cy.visit('/uploads');
    cy.findByRole('button', { name: /new upload/i }).click();

    // Fill basic info
    cy.findByLabelText(/title/i).type('Scheduled Video');

    // Enable scheduling
    cy.findByLabelText(/schedule upload/i).check();

    // Schedule options should appear
    cy.findByLabelText(/upload date/i).should('be.visible');
    cy.findByLabelText(/upload time/i).should('be.visible');

    // Set future date and time
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    cy.findByLabelText(/upload date/i).type(dateStr);
    cy.findByLabelText(/upload time/i).type('14:30');

    // Mock scheduled upload
    cy.mockApiResponse('POST', '/api/uploads', {
      id: 'scheduled-upload',
      title: 'Scheduled Video',
      status: 'scheduled',
      scheduledTime: tomorrow.toISOString(),
    });

    // Submit
    cy.findByRole('button', { name: /schedule upload/i }).click();

    // Should show scheduled status
    cy.waitForToast('Upload scheduled successfully');
  });

  it('applies upload templates', () => {
    // Mock templates
    cy.mockApiResponse('GET', '/api/upload-templates', [
      {
        id: 'template-1',
        name: 'Gaming Template',
        description: 'Standard gaming video template',
        privacy: 'public',
        tags: ['gaming', 'gameplay', 'letsplay'],
        category: 'Gaming',
      },
      {
        id: 'template-2',
        name: 'Tutorial Template',
        description: 'Educational content template',
        privacy: 'public',
        tags: ['tutorial', 'howto', 'education'],
        category: 'Education',
      },
    ]);

    cy.visit('/uploads');
    cy.findByRole('button', { name: /new upload/i }).click();

    // Click use template
    cy.findByRole('button', { name: /use template/i }).click();

    // Template selector should open
    cy.findByText(/select upload template/i).should('be.visible');

    // Select gaming template
    cy.findByText('Gaming Template').click();
    cy.findByRole('button', { name: /apply template/i }).click();

    // Form should be populated
    cy.findByLabelText(/privacy/i).should('have.value', 'public');
    cy.findByLabelText(/category/i).should('have.value', 'Gaming');

    // Tags should be applied
    cy.get('.ant-tag').should('contain', 'gaming');
    cy.get('.ant-tag').should('contain', 'gameplay');
    cy.get('.ant-tag').should('contain', 'letsplay');
  });

  it('validates video file requirements', () => {
    cy.visit('/uploads');
    cy.findByRole('button', { name: /new upload/i }).click();

    // Try to upload invalid file type
    cy.fixture('document.pdf', 'base64').then((fileContent) => {
      cy.findByLabelText(/video file/i).attachFile({
        fileContent,
        fileName: 'document.pdf',
        mimeType: 'application/pdf',
        encoding: 'base64',
      });
    });

    // Should show error
    cy.findByText(/invalid file type/i).should('be.visible');
    cy.findByText(/supported formats: mp4, mov, avi/i).should('be.visible');

    // Try to upload too large file (mock)
    cy.window().then((win) => {
      const event = new Event('change', { bubbles: true });
      const input = win.document.querySelector('input[type="file"]');
      Object.defineProperty(event, 'target', {
        value: {
          files: [
            {
              name: 'huge-video.mp4',
              size: 5 * 1024 * 1024 * 1024, // 5GB
              type: 'video/mp4',
            },
          ],
        },
      });
      input?.dispatchEvent(event);
    });

    // Should show size error
    cy.findByText(/file too large/i).should('be.visible');
    cy.findByText(/maximum size: 2GB/i).should('be.visible');
  });
});
