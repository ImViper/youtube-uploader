import { MatrixManager } from '../../matrix/manager';
import { AccountManager } from '../../accounts/manager';
import { QueueManager } from '../../queue/manager';

export const createMockMatrixManager = (): jest.Mocked<MatrixManager> => {
  const mockAccountManager = createMockAccountManager();
  const mockQueueManager = createMockQueueManager();

  return {
    getAccountManager: jest.fn().mockReturnValue(mockAccountManager),
    getQueueManager: jest.fn().mockReturnValue(mockQueueManager),
    getSystemStatus: jest.fn().mockResolvedValue({
      status: 'running',
      activeAccounts: 5,
      queuedJobs: 10,
      completedJobs: 100,
      failedJobs: 2,
      systemHealth: 'healthy',
      timestamp: new Date().toISOString(),
    }),
    uploadVideo: jest.fn().mockResolvedValue({
      jobId: 'job-123',
      status: 'queued',
      accountId: 'account-123',
      videoId: 'video-123',
    }),
    batchUpload: jest.fn().mockImplementation((videos: any[]) => 
      Promise.resolve(videos.map((_: any, index: number) => ({
        jobId: `job-${index}`,
        status: 'queued',
        accountId: `account-${index}`,
        videoId: `video-${index}`,
      })))
    ),
    getTaskStatus: jest.fn().mockImplementation((id) => {
      if (id === 'not-found') {
        return Promise.resolve(null);
      }
      return Promise.resolve({
        id,
        status: 'completed',
        progress: 100,
        result: { url: 'https://youtube.com/watch?v=123' },
      });
    }),
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
  } as any;
};

export const createMockAccountManager = (): jest.Mocked<AccountManager> => {
  const mockAccounts = [
    {
      id: 'acc-1',
      email: 'test1@example.com',
      password: 'password1',
      status: 'active' as const,
      healthScore: 95,
      dailyUploadCount: 5,
      dailyUploadLimit: 10,
      lastUploadTime: new Date().getTime(),
      createdAt: new Date().toISOString(),
      proxy: { host: 'proxy1.example.com', port: 8080 },
      metadata: { notes: 'Test account 1' },
    },
    {
      id: 'acc-2',
      email: 'test2@example.com',
      password: 'password2',
      status: 'active' as const,
      healthScore: 80,
      dailyUploadCount: 8,
      dailyUploadLimit: 10,
      lastUploadTime: new Date().getTime() - 3600000,
      createdAt: new Date().toISOString(),
      metadata: { notes: 'Test account 2' },
    },
  ];

  return {
    listAccounts: jest.fn().mockImplementation((filter) => {
      let filtered = [...mockAccounts];
      if (filter.status) {
        filtered = filtered.filter(acc => acc.status === filter.status);
      }
      if (filter.minHealthScore !== undefined) {
        filtered = filtered.filter(acc => acc.healthScore >= filter.minHealthScore);
      }
      if (filter.hasAvailableUploads) {
        filtered = filtered.filter(acc => acc.dailyUploadCount < acc.dailyUploadLimit);
      }
      return Promise.resolve(filtered);
    }),
    getAccount: jest.fn().mockImplementation((id) => {
      const account = mockAccounts.find(acc => acc.id === id);
      return Promise.resolve(account || null);
    }),
    addAccount: jest.fn().mockImplementation((email, password, metadata) => {
      const newAccount = {
        id: `acc-${Date.now()}`,
        email,
        password,
        status: 'active' as const,
        healthScore: 100,
        dailyUploadCount: 0,
        dailyUploadLimit: 10,
        lastUploadTime: Date.now(),
        createdAt: new Date().toISOString(),
        metadata,
      };
      mockAccounts.push(newAccount);
      return Promise.resolve(newAccount);
    }),
    updateAccount: jest.fn().mockResolvedValue(undefined),
    removeAccount: jest.fn().mockResolvedValue(undefined),
    getAccountStats: jest.fn().mockResolvedValue({
      total: 10,
      active: 8,
      suspended: 1,
      banned: 1,
      averageHealthScore: 85,
      totalUploadsToday: 50,
      totalUploadCapacity: 100,
    }),
    resetDailyLimits: jest.fn().mockResolvedValue(undefined),
  } as any;
};

export const createMockQueueManager = (): jest.Mocked<QueueManager> => {
  const mockJobs = [
    {
      id: 'job-1',
      name: 'upload-video',
      data: { videoPath: '/path/to/video1.mp4' },
      opts: { priority: 1 },
      timestamp: Date.now(),
      attemptsMade: 0,
      progress: 0,
    },
    {
      id: 'job-2',
      name: 'upload-video',
      data: { videoPath: '/path/to/video2.mp4' },
      opts: { priority: 2 },
      timestamp: Date.now() - 60000,
      attemptsMade: 1,
      progress: 50,
    },
  ];

  return {
    getStats: jest.fn().mockResolvedValue({
      waiting: 5,
      active: 2,
      completed: 100,
      failed: 3,
      delayed: 1,
      paused: 0,
    }),
    getJobs: jest.fn().mockImplementation((status, limit) => {
      return Promise.resolve(mockJobs.slice(0, limit));
    }),
    retryJob: jest.fn().mockResolvedValue(undefined),
    clean: jest.fn().mockResolvedValue(undefined),
  } as any;
};