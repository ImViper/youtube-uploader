import express, { Express } from 'express';
import request from 'supertest';
import { createApiRoutes } from './routes';
import { createMockMatrixManager, createMockAccountManager, createMockQueueManager } from '../tests/mocks/matrixManager.mock';
import { createMockMetricsCollector } from '../tests/mocks/metricsCollector.mock';
import { enhanceAccountManagerWithTestAccount } from '../tests/mocks/testAccount.mock';

describe('API Routes', () => {
  let app: Express;
  let mockMatrixManager: ReturnType<typeof createMockMatrixManager>;
  let mockMetricsCollector: ReturnType<typeof createMockMetricsCollector>;
  let mockAccountManager: any;
  let mockQueueManager: any;

  beforeEach(() => {
    // Create fresh mocks for each test
    mockMatrixManager = createMockMatrixManager();
    mockMetricsCollector = createMockMetricsCollector();
    mockAccountManager = mockMatrixManager.getAccountManager();
    mockQueueManager = mockMatrixManager.getQueueManager();
    
    // Enhance AccountManager with testAccount method
    enhanceAccountManagerWithTestAccount(mockAccountManager);

    // Create Express app with routes
    app = express();
    app.use(express.json());
    app.use('/api', createApiRoutes({
      matrixManager: mockMatrixManager,
      metricsCollector: mockMetricsCollector,
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return healthy status when all checks pass', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        checks: expect.arrayContaining([
          expect.objectContaining({
            service: 'database',
            status: 'healthy',
          }),
          expect.objectContaining({
            service: 'redis',
            status: 'healthy',
          }),
          expect.objectContaining({
            service: 'queue',
            status: 'healthy',
          }),
        ]),
      });
      expect(mockMetricsCollector.performHealthChecks).toHaveBeenCalledTimes(1);
    });

    it('should return unhealthy status when any check fails', async () => {
      mockMetricsCollector.performHealthChecks.mockResolvedValueOnce([
        {
          service: 'database',
          status: 'healthy',
          message: 'Database connection is healthy',
        },
        {
          service: 'redis',
          status: 'unhealthy',
          message: 'Redis connection failed',
        },
      ]);

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        status: 'unhealthy',
        timestamp: expect.any(String),
        checks: expect.arrayContaining([
          expect.objectContaining({
            service: 'redis',
            status: 'unhealthy',
          }),
        ]),
      });
    });

    it('should handle health check errors', async () => {
      mockMetricsCollector.performHealthChecks.mockRejectedValueOnce(new Error('Health check failed'));

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        status: 'error',
        message: 'Health check failed',
      });
    });
  });

  describe('GET /api/status', () => {
    it('should return system status', async () => {
      const response = await request(app).get('/api/status');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'running',
        activeAccounts: 5,
        queuedJobs: 10,
        completedJobs: 100,
        failedJobs: 2,
        systemHealth: 'healthy',
        timestamp: expect.any(String),
      });
      expect(mockMatrixManager.getSystemStatus).toHaveBeenCalledTimes(1);
    });

    it('should handle status retrieval errors', async () => {
      mockMatrixManager.getSystemStatus.mockRejectedValueOnce(new Error('Status retrieval failed'));

      const response = await request(app).get('/api/status');

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error: 'Failed to get system status',
      });
    });
  });

  describe('GET /api/metrics', () => {
    it('should return current metrics', async () => {
      const response = await request(app).get('/api/metrics');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        uploads: expect.objectContaining({
          total24h: expect.any(Number),
          successful24h: expect.any(Number),
          failed24h: expect.any(Number),
          averageDuration: expect.any(Number),
          throughput: expect.any(Number),
        }),
        accounts: expect.any(Object),
        browsers: expect.any(Object),
        queue: expect.any(Object),
        resources: expect.any(Object),
        errors: expect.any(Object),
      });
      expect(mockMetricsCollector.getCurrentMetrics).toHaveBeenCalledTimes(1);
    });

    it('should handle metrics retrieval errors', async () => {
      mockMetricsCollector.getCurrentMetrics.mockRejectedValueOnce(new Error('Metrics retrieval failed'));

      const response = await request(app).get('/api/metrics');

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error: 'Failed to get metrics',
      });
    });
  });

  describe('Account Management Routes', () => {
    describe('GET /api/accounts', () => {
      it('should return paginated account list', async () => {
        const response = await request(app)
          .get('/api/accounts')
          .query({ page: 1, pageSize: 10 });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          items: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              username: expect.any(String),
              email: expect.any(String),
              status: expect.any(String),
              healthScore: expect.any(Number),
            }),
          ]),
          total: expect.any(Number),
          page: 1,
          pageSize: 10,
          totalPages: expect.any(Number),
        });
        expect(mockAccountManager.listAccounts).toHaveBeenCalled();
      });

      it('should filter accounts by status', async () => {
        const response = await request(app)
          .get('/api/accounts')
          .query({ status: 'active' });

        expect(response.status).toBe(200);
        expect(mockAccountManager.listAccounts).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'active' })
        );
      });

      it('should filter accounts by health score', async () => {
        const response = await request(app)
          .get('/api/accounts')
          .query({ minHealthScore: '80' });

        expect(response.status).toBe(200);
        expect(mockAccountManager.listAccounts).toHaveBeenCalledWith(
          expect.objectContaining({ minHealthScore: 80 })
        );
      });

      it('should search accounts by email', async () => {
        const response = await request(app)
          .get('/api/accounts')
          .query({ search: 'test1' });

        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(1);
        expect(response.body.items[0].email).toContain('test1');
      });

      it('should sort accounts', async () => {
        const response = await request(app)
          .get('/api/accounts')
          .query({ sortBy: 'healthScore', sortOrder: 'desc' });

        expect(response.status).toBe(200);
        const items = response.body.items;
        expect(items[0].healthScore).toBeGreaterThanOrEqual(items[1].healthScore);
      });

      it('should handle account listing errors', async () => {
        mockAccountManager.listAccounts.mockRejectedValueOnce(new Error('Failed to list accounts'));

        const response = await request(app).get('/api/accounts');

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          error: 'Failed to list accounts',
        });
      });
    });

    describe('GET /api/accounts/:id', () => {
      it('should return a single account', async () => {
        const response = await request(app).get('/api/accounts/acc-1');

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          id: 'acc-1',
          username: 'test1',
          email: 'test1@example.com',
          status: 'active',
          healthScore: 95,
        });
        expect(mockAccountManager.getAccount).toHaveBeenCalledWith('acc-1');
      });

      it('should return 404 for non-existent account', async () => {
        mockAccountManager.getAccount.mockResolvedValueOnce(null);

        const response = await request(app).get('/api/accounts/non-existent');

        expect(response.status).toBe(404);
        expect(response.body).toMatchObject({
          error: 'Account not found',
        });
      });

      it('should handle account retrieval errors', async () => {
        mockAccountManager.getAccount.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app).get('/api/accounts/acc-1');

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          error: 'Failed to get account',
        });
      });
    });

    describe('POST /api/accounts', () => {
      it('should create a new account', async () => {
        const newAccount = {
          email: 'new@example.com',
          password: 'password123',
          notes: 'New account',  // Changed from metadata: { notes: 'New account' }
        };

        const response = await request(app)
          .post('/api/accounts')
          .send(newAccount);

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          id: expect.any(String),
          email: 'new@example.com',
          status: 'active',
          healthScore: 100,
        });
        expect(mockAccountManager.addAccount).toHaveBeenCalledWith(
          'new@example.com',
          'password123',
          { notes: 'New account' }
        );
      });

      it('should validate required fields', async () => {
        const response = await request(app)
          .post('/api/accounts')
          .send({ email: 'test@example.com' });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          error: 'Email and password are required',
        });
      });

      it('should handle account creation errors', async () => {
        mockAccountManager.addAccount.mockRejectedValueOnce(new Error('Account already exists'));

        const response = await request(app)
          .post('/api/accounts')
          .send({ email: 'test@example.com', password: 'password123' });

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          error: 'Failed to add account',
        });
      });
    });

    describe('PATCH /api/accounts/:id', () => {
      it('should update an account', async () => {
        const updates = { status: 'suspended', metadata: { notes: 'Updated' } };

        const response = await request(app)
          .patch('/api/accounts/acc-1')
          .send(updates);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ success: true });
        expect(mockAccountManager.updateAccount).toHaveBeenCalledWith('acc-1', updates);
      });

      it('should handle update errors', async () => {
        mockAccountManager.updateAccount.mockRejectedValueOnce(new Error('Update failed'));

        const response = await request(app)
          .patch('/api/accounts/acc-1')
          .send({ status: 'suspended' });

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          error: 'Failed to update account',
        });
      });
    });

    describe('DELETE /api/accounts/:id', () => {
      it('should delete an account', async () => {
        const response = await request(app).delete('/api/accounts/acc-1');

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ success: true });
        expect(mockAccountManager.removeAccount).toHaveBeenCalledWith('acc-1');
      });

      it('should handle deletion errors', async () => {
        mockAccountManager.removeAccount.mockRejectedValueOnce(new Error('Deletion failed'));

        const response = await request(app).delete('/api/accounts/acc-1');

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          error: 'Failed to remove account',
        });
      });
    });

    describe('DELETE /api/accounts/batch', () => {
      it('should delete multiple accounts', async () => {
        const response = await request(app)
          .delete('/api/accounts/batch')
          .send({ ids: ['acc-1', 'acc-2'] });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          deletedCount: 2,
          errors: [],
        });
        expect(mockAccountManager.removeAccount).toHaveBeenCalledTimes(2);
      });

      it('should validate ids array', async () => {
        const response = await request(app)
          .delete('/api/accounts/batch')
          .send({ ids: 'not-an-array' });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          error: 'IDs array is required',
        });
      });

      it('should handle partial failures', async () => {
        mockAccountManager.removeAccount
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error('Account not found'));

        const response = await request(app)
          .delete('/api/accounts/batch')
          .send({ ids: ['acc-1', 'acc-2'] });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          deletedCount: 1,
          errors: [
            { id: 'acc-2', error: 'Account not found' },
          ],
        });
      });
    });

    describe('POST /api/accounts/:id/test', () => {
      it('should test an account successfully', async () => {
        const response = await request(app).post('/api/accounts/acc-1/test');

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          data: { success: true },
        });
        expect(mockAccountManager.testAccount).toHaveBeenCalledWith('acc-1');
      });

      it('should handle test failures', async () => {
        const response = await request(app).post('/api/accounts/acc-2/test');

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: false,
          error: 'Login failed',
          data: { success: false, error: 'Login failed' },
        });
      });

      it('should return 404 for non-existent account', async () => {
        mockAccountManager.getAccount.mockResolvedValueOnce(null);

        const response = await request(app).post('/api/accounts/non-existent/test');

        expect(response.status).toBe(404);
        expect(response.body).toMatchObject({
          error: 'Account not found',
        });
      });
    });

    describe('GET /api/accounts/stats', () => {
      it('should return account statistics', async () => {
        const response = await request(app).get('/api/accounts/stats');

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          total: 10,
          active: 8,
          suspended: 1,
          banned: 1,
          averageHealthScore: 85,
          totalUploadsToday: 50,
          totalUploadCapacity: 100,
        });
        expect(mockAccountManager.getAccountStats).toHaveBeenCalledTimes(1);
      });

      it('should handle stats retrieval errors', async () => {
        mockAccountManager.getAccountStats.mockRejectedValueOnce(new Error('Stats failed'));

        const response = await request(app).get('/api/accounts/stats');

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          error: 'Failed to get account stats',
        });
      });
    });

    describe('POST /api/accounts/reset-limits', () => {
      it('should reset daily limits', async () => {
        const response = await request(app).post('/api/accounts/reset-limits');

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ success: true });
        expect(mockAccountManager.resetDailyLimits).toHaveBeenCalledTimes(1);
      });

      it('should handle reset errors', async () => {
        mockAccountManager.resetDailyLimits.mockRejectedValueOnce(new Error('Reset failed'));

        const response = await request(app).post('/api/accounts/reset-limits');

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          error: 'Failed to reset daily limits',
        });
      });
    });

    describe('POST /api/accounts/import', () => {
      it('should import accounts from JSON', async () => {
        const importData = JSON.stringify([
          { email: 'import1@example.com', password: 'pass1' },
          { email: 'import2@example.com', password: 'pass2' },
        ]);

        const response = await request(app)
          .post('/api/accounts/import')
          .send({ format: 'json', data: importData });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          imported: 2,
          failed: 0,
          errors: [],
        });
        expect(mockAccountManager.addAccount).toHaveBeenCalledTimes(2);
      });

      it('should import accounts from CSV', async () => {
        const csvData = 'email,password,notes\ncsv1@example.com,pass1,Test note\ncsv2@example.com,pass2,Another note';

        const response = await request(app)
          .post('/api/accounts/import')
          .send({ format: 'csv', data: csvData });

        expect(response.status).toBe(200);
        expect(response.body.imported).toBeGreaterThan(0);
      });

      it('should validate format', async () => {
        const response = await request(app)
          .post('/api/accounts/import')
          .send({ format: 'xml', data: '<accounts></accounts>' });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          error: 'Format must be either csv or json',
        });
      });

      it('should handle import errors gracefully', async () => {
        mockAccountManager.addAccount
          .mockResolvedValueOnce({ id: 'acc-1' } as any)
          .mockRejectedValueOnce(new Error('Duplicate email'));

        const importData = JSON.stringify([
          { email: 'import1@example.com', password: 'pass1' },
          { email: 'import2@example.com', password: 'pass2' },
        ]);

        const response = await request(app)
          .post('/api/accounts/import')
          .send({ format: 'json', data: importData });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          imported: 1,
          failed: 1,
          errors: [{ row: 2, error: 'Duplicate email' }],
        });
      });
    });

    describe('GET /api/accounts/export', () => {
      it('should export accounts as JSON', async () => {
        const response = await request(app)
          .get('/api/accounts/export')
          .query({ format: 'json' });

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('application/json');
        expect(response.headers['content-disposition']).toContain('accounts.json');
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body[0]).toMatchObject({
          email: expect.any(String),
          password: '***',
          status: expect.any(String),
        });
      });

      it('should export accounts as CSV', async () => {
        const response = await request(app)
          .get('/api/accounts/export')
          .query({ format: 'csv' });

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('text/csv');
        expect(response.headers['content-disposition']).toContain('accounts.csv');
        expect(response.text).toContain('email,password,status');
      });

      it('should filter exported accounts by IDs', async () => {
        const response = await request(app)
          .get('/api/accounts/export')
          .query({ format: 'json', ids: 'acc-1' });

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].email).toBe('test1@example.com');
      });

      it('should handle invalid export format', async () => {
        const response = await request(app)
          .get('/api/accounts/export')
          .query({ format: 'xml' });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          error: 'Invalid format. Use json or csv',
        });
      });
    });
  });

  describe('Queue Management Routes', () => {
    describe('GET /api/queue/stats', () => {
      it('should return queue statistics', async () => {
        const response = await request(app).get('/api/queue/stats');

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          waiting: 5,
          active: 2,
          completed: 100,
          failed: 3,
          delayed: 1,
          paused: 0,
        });
        expect(mockQueueManager.getStats).toHaveBeenCalledTimes(1);
      });

      it('should handle stats retrieval errors', async () => {
        mockQueueManager.getStats.mockRejectedValueOnce(new Error('Stats failed'));

        const response = await request(app).get('/api/queue/stats');

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          error: 'Failed to get queue stats',
        });
      });
    });

    describe('GET /api/queue/jobs', () => {
      it('should return jobs with default parameters', async () => {
        const response = await request(app).get('/api/queue/jobs');

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body[0]).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          data: expect.any(Object),
        });
        expect(mockQueueManager.getJobs).toHaveBeenCalledWith('waiting', 100);
      });

      it('should filter jobs by status and limit', async () => {
        const response = await request(app)
          .get('/api/queue/jobs')
          .query({ status: 'active', limit: '50' });

        expect(response.status).toBe(200);
        expect(mockQueueManager.getJobs).toHaveBeenCalledWith('active', 50);
      });

      it('should handle job retrieval errors', async () => {
        mockQueueManager.getJobs.mockRejectedValueOnce(new Error('Job retrieval failed'));

        const response = await request(app).get('/api/queue/jobs');

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          error: 'Failed to get jobs',
        });
      });
    });

    describe('POST /api/queue/pause', () => {
      it('should pause the queue', async () => {
        const response = await request(app).post('/api/queue/pause');

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ success: true });
        expect(mockMatrixManager.pause).toHaveBeenCalledTimes(1);
      });

      it('should handle pause errors', async () => {
        mockMatrixManager.pause.mockRejectedValueOnce(new Error('Pause failed'));

        const response = await request(app).post('/api/queue/pause');

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          error: 'Failed to pause queue',
        });
      });
    });

    describe('POST /api/queue/resume', () => {
      it('should resume the queue', async () => {
        const response = await request(app).post('/api/queue/resume');

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ success: true });
        expect(mockMatrixManager.resume).toHaveBeenCalledTimes(1);
      });

      it('should handle resume errors', async () => {
        mockMatrixManager.resume.mockRejectedValueOnce(new Error('Resume failed'));

        const response = await request(app).post('/api/queue/resume');

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          error: 'Failed to resume queue',
        });
      });
    });

    describe('POST /api/queue/jobs/:id/retry', () => {
      it('should retry a job', async () => {
        const response = await request(app).post('/api/queue/jobs/job-123/retry');

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ success: true });
        expect(mockQueueManager.retryJob).toHaveBeenCalledWith('job-123');
      });

      it('should handle retry errors', async () => {
        mockQueueManager.retryJob.mockRejectedValueOnce(new Error('Retry failed'));

        const response = await request(app).post('/api/queue/jobs/job-123/retry');

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          error: 'Failed to retry job',
        });
      });
    });

    describe('POST /api/queue/clean', () => {
      it('should clean old jobs with default grace period', async () => {
        const response = await request(app).post('/api/queue/clean');

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ success: true });
        expect(mockQueueManager.clean).toHaveBeenCalledWith(3600000);
      });

      it('should clean old jobs with custom grace period', async () => {
        const response = await request(app)
          .post('/api/queue/clean')
          .send({ grace: 7200000 });

        expect(response.status).toBe(200);
        expect(mockQueueManager.clean).toHaveBeenCalledWith(7200000);
      });

      it('should handle clean errors', async () => {
        mockQueueManager.clean.mockRejectedValueOnce(new Error('Clean failed'));

        const response = await request(app).post('/api/queue/clean');

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          error: 'Failed to clean queue',
        });
      });
    });
  });

  describe('Upload Routes', () => {
    describe('POST /api/upload', () => {
      it('should queue a video upload', async () => {
        const uploadData = {
          video: {
            path: '/path/to/video.mp4',
            title: 'Test Video',
            description: 'Test Description',
          },
          priority: 1,
          accountId: 'acc-1',
        };

        const response = await request(app)
          .post('/api/upload')
          .send(uploadData);

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          jobId: 'job-123',
          status: 'queued',
          accountId: 'account-123',
          videoId: 'video-123',
        });
        expect(mockMatrixManager.uploadVideo).toHaveBeenCalledWith(
          uploadData.video,
          expect.objectContaining({
            priority: 1,
            accountId: 'acc-1',
          })
        );
      });

      it('should validate video path', async () => {
        const response = await request(app)
          .post('/api/upload')
          .send({ video: { title: 'No Path' } });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          error: 'Video path is required',
        });
      });

      it('should handle scheduled uploads', async () => {
        const scheduledDate = new Date(Date.now() + 3600000).toISOString();
        const uploadData = {
          video: { path: '/path/to/video.mp4' },
          scheduledAt: scheduledDate,
        };

        const response = await request(app)
          .post('/api/upload')
          .send(uploadData);

        expect(response.status).toBe(201);
        expect(mockMatrixManager.uploadVideo).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            scheduledAt: expect.any(Date),
          })
        );
      });

      it('should handle upload errors', async () => {
        mockMatrixManager.uploadVideo.mockRejectedValueOnce(new Error('Upload failed'));

        const response = await request(app)
          .post('/api/upload')
          .send({ video: { path: '/path/to/video.mp4' } });

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          error: 'Failed to queue upload',
        });
      });
    });

    describe('POST /api/upload/batch', () => {
      it('should queue multiple video uploads', async () => {
        const batchData = {
          videos: [
            { path: '/path/to/video1.mp4', title: 'Video 1' },
            { path: '/path/to/video2.mp4', title: 'Video 2' },
          ],
          priority: 2,
        };

        const response = await request(app)
          .post('/api/upload/batch')
          .send(batchData);

        expect(response.status).toBe(201);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body).toHaveLength(2);
        expect(response.body[0]).toMatchObject({
          jobId: expect.any(String),
          status: 'queued',
        });
        expect(mockMatrixManager.batchUpload).toHaveBeenCalledWith(
          batchData.videos,
          expect.objectContaining({ priority: 2 })
        );
      });

      it('should validate videos array', async () => {
        const response = await request(app)
          .post('/api/upload/batch')
          .send({ videos: 'not-an-array' });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          error: 'Videos array is required',
        });
      });

      it('should handle batch upload errors', async () => {
        mockMatrixManager.batchUpload.mockRejectedValueOnce(new Error('Batch upload failed'));

        const response = await request(app)
          .post('/api/upload/batch')
          .send({ videos: [{ path: '/path/to/video.mp4' }] });

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          error: 'Failed to queue batch upload',
        });
      });
    });

    describe('GET /api/tasks/:id', () => {
      it('should return task status', async () => {
        const response = await request(app).get('/api/tasks/task-123');

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          id: 'task-123',
          status: 'completed',
          progress: 100,
          result: { url: 'https://youtube.com/watch?v=123' },
        });
        expect(mockMatrixManager.getTaskStatus).toHaveBeenCalledWith('task-123');
      });

      it('should return 404 for non-existent task', async () => {
        const response = await request(app).get('/api/tasks/not-found');

        expect(response.status).toBe(404);
        expect(response.body).toMatchObject({
          error: 'Task not found',
        });
      });

      it('should handle task status errors', async () => {
        mockMatrixManager.getTaskStatus.mockRejectedValueOnce(new Error('Status failed'));

        const response = await request(app).get('/api/tasks/task-123');

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          error: 'Failed to get task status',
        });
      });
    });
  });
});