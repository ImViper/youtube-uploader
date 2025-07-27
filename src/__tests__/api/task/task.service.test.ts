import { TaskService, Task } from '../../../api/task/task.service';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../../../database/connection';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

// Mock database connection
jest.mock('../../../database/connection');

describe('TaskService', () => {
  let taskService: TaskService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get the mocked database instance
    mockDb = getDatabase();
    
    taskService = new TaskService();
  });

  describe('create', () => {
    it('should create a task and mark it as queued for upload type', async () => {
      const taskData = {
        type: 'upload',
        priority: 'high',
        video: {
          title: 'Test Video',
          path: '/path/to/video.mp4',
        },
        accountId: 'account-123',
        matrixId: 'matrix-123',
        metadata: { custom: 'data' },
      };

      const task = await taskService.create(taskData);

      expect(task).toMatchObject({
        id: 'mock-uuid',
        type: 'upload',
        status: 'queued',
        priority: 'high',
        video: taskData.video,
        accountId: taskData.accountId,
        matrixId: taskData.matrixId,
        metadata: expect.objectContaining({
          custom: 'data',
        }),
        attempts: 0,
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO upload_tasks'),
        expect.arrayContaining([
          'mock-uuid',
          'account-123',
          JSON.stringify(taskData.video),
          2, // high priority maps to 2
          'pending', // initial status in DB
          undefined, // no scheduled time
          expect.any(Date)
        ])
      );
    });

    it('should create a task without queuing for non-upload types', async () => {
      const taskData = {
        type: 'analytics',
        priority: 'normal',
        data: { report: 'monthly' },
      };

      const task = await taskService.create(taskData);

      expect(task.status).toBe('pending');
      expect(task.type).toBe('analytics');
    });

    it('should use default values when not provided', async () => {
      const taskData = {
        type: 'upload',
        video: { title: 'Test', path: '/test.mp4' },
      };

      const task = await taskService.create(taskData);

      expect(task.priority).toBe('normal');
      expect(task.matrixId).toBe('default');
      expect(task.attempts).toBe(0);
    });

    it('should handle scheduled tasks', async () => {
      const scheduledAt = '2024-01-01T10:00:00Z';
      const taskData = {
        type: 'upload',
        video: { title: 'Scheduled Video', path: '/video.mp4' },
        scheduledAt,
      };

      const task = await taskService.create(taskData);

      expect(task.scheduledAt).toEqual(new Date(scheduledAt));
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO upload_tasks'),
        expect.arrayContaining([
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.any(Number),
          expect.any(String),
          new Date(scheduledAt),
          expect.any(Date)
        ])
      );
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      // Mock count query
      mockDb.query.mockImplementation((query: string) => {
        if (query.includes('COUNT(*)')) {
          return Promise.resolve({ rows: [{ total: '25' }] });
        }
        // Mock data query
        return Promise.resolve({
          rows: [
            {
              id: 'task-1',
              account_id: 'acc-1',
              video_data: { title: 'Video 1' },
              priority: 1,
              status: 'pending',
              created_at: new Date(),
            },
            {
              id: 'task-2',
              account_id: 'acc-2',
              video_data: { title: 'Video 2' },
              priority: 2,
              status: 'completed',
              created_at: new Date(),
            },
          ],
        });
      });
    });

    it('should return paginated tasks', async () => {
      const options = {
        page: 1,
        pageSize: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc' as const,
      };

      const result = await taskService.findAll(options);

      expect(result.items).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(3);
    });

    it('should apply filters correctly', async () => {
      const options = {
        page: 1,
        pageSize: 10,
        status: 'pending',
        accountId: 'acc-1',
        search: 'test',
        sortOrder: 'desc' as const,
      };

      await taskService.findAll(options);

      // Verify the query includes filters
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $'),
        expect.arrayContaining(['pending', 'acc-1', '%test%'])
      );
    });

    it('should handle date range filters', async () => {
      const options = {
        page: 1,
        pageSize: 10,
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        sortOrder: 'desc' as const,
      };

      await taskService.findAll(options);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('created_at >='),
        expect.arrayContaining([
          new Date('2024-01-01'),
          new Date('2024-01-31'),
        ])
      );
    });
  });

  describe('findById', () => {
    it('should find a task by id', async () => {
      const mockTask = {
        id: 'task-123',
        account_id: 'acc-1',
        video_data: { title: 'Test Video' },
        priority: 1,
        status: 'pending',
        created_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockTask], rowCount: 1 });

      const task = await taskService.findById('task-123');

      expect(task).toBeTruthy();
      expect(task?.id).toBe('task-123');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['task-123']
      );
    });

    it('should return undefined if task not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const task = await taskService.findById('non-existent');

      expect(task).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should update a task', async () => {
      const mockUpdatedTask = {
        id: 'task-123',
        account_id: 'acc-1',
        video_data: { title: 'Test Video' },
        priority: 1,
        status: 'completed',
        result: { videoUrl: 'https://youtube.com/watch?v=123' },
        created_at: new Date(),
      };
      
      mockDb.query.mockResolvedValue({
        rows: [mockUpdatedTask],
        rowCount: 1,
      });

      const updates = {
        status: 'completed' as const,
        result: { videoUrl: 'https://youtube.com/watch?v=123' },
      };

      const updated = await taskService.update('task-123', updates);

      expect(updated).toBeDefined();
      expect(updated?.status).toBe('completed');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE upload_tasks'),
        expect.arrayContaining(['completed', JSON.stringify(updates.result)])
      );
    });

    it('should return undefined if task not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const updated = await taskService.update('non-existent', { status: 'failed' });

      expect(updated).toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('should return task statistics', async () => {
      // First call returns the main stats
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          total: '100',
          pending: '20',
          active: '0',
          completed: '70',
          failed: '10',
          avg_completion_time: '300000'
        }],
        rowCount: 1
      });
      
      // Second call returns priority breakdown
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { priority_name: 'low', count: '10' },
          { priority_name: 'normal', count: '60' },
          { priority_name: 'high', count: '20' },
          { priority_name: 'urgent', count: '10' }
        ],
        rowCount: 4
      });

      const stats = await taskService.getStats();

      expect(stats).toEqual({
        total: 100,
        byStatus: {
          pending: 20,
          active: 0,
          completed: 70,
          failed: 10,
        },
        byType: {
          upload: 100,  // All tasks are upload type in this implementation
        },
        byPriority: {
          low: 10,
          normal: 60,
          high: 20,
          urgent: 10,
        },
        avgCompletionTime: 300000,  // In milliseconds
        successRate: 87.5,
        failureRate: 12.5,
      });
    });
  });

  describe('cancel', () => {
    it('should cancel a pending task', async () => {
      // First mock finding the task
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'task-123',
          status: 'pending',
          metadata: { jobId: 'job-123' }
        }],
        rowCount: 1
      });
      
      // Then mock the update
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'task-123' }],
        rowCount: 1
      });

      const result = await taskService.cancel('task-123');

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining('UPDATE upload_tasks'),
        ['task-123']
      );
    });

    it('should not cancel a processing task', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          id: 'task-123',
          status: 'processing'
        }],
        rowCount: 1
      });

      const result = await taskService.cancel('task-123');

      expect(result).toBe(false);
    });

    it('should return false if task not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await taskService.cancel('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('retry', () => {
    it('should retry a failed task', async () => {
      const failedTask = {
        id: 'task-123',
        account_id: 'acc-1',
        video_data: { title: 'Test Video' },
        priority: 1,
        status: 'failed',
        created_at: new Date(),
      };
      
      // Mock finding the failed task
      mockDb.query.mockResolvedValueOnce({
        rows: [failedTask],
        rowCount: 1
      });
      
      // Mock the update returning the task
      mockDb.query.mockResolvedValueOnce({
        rows: [{ ...failedTask, status: 'pending', error: null }],
        rowCount: 1
      });
      
      // Mock updating to queued status
      mockDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 1
      });
      
      // Mock finding the updated task
      mockDb.query.mockResolvedValueOnce({
        rows: [{ ...failedTask, status: 'queued', error: null }],
        rowCount: 1
      });

      const result = await taskService.retry('task-123');

      expect(result).toBeDefined();
      expect(result?.status).toBe('queued');
    });

    it('should return undefined for a non-failed task', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          id: 'task-123',
          status: 'completed',
          account_id: 'acc-1',
          video_data: { title: 'Test Video' },
          priority: 1,
          created_at: new Date(),
        }],
        rowCount: 1
      });

      const result = await taskService.retry('task-123');

      expect(result).toBeUndefined();
    });
    
    it('should return undefined if task not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await taskService.retry('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('mapPriorityToNumber', () => {
    it('should map priority strings to numbers correctly', () => {
      expect((taskService as any).mapPriorityToNumber('low')).toBe(4);
      expect((taskService as any).mapPriorityToNumber('normal')).toBe(3);
      expect((taskService as any).mapPriorityToNumber('high')).toBe(2);
      expect((taskService as any).mapPriorityToNumber('urgent')).toBe(1);
    });
  });
});