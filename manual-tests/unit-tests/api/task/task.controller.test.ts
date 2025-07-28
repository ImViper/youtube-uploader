import { Request, Response } from 'express';
import { TaskController } from '../../../src/api/task/task.controller';
import { TaskService } from '../../../src/api/task/task.service';

// Mock the TaskService
jest.mock('../../../src/api/task/task.service');

describe('TaskController', () => {
  let taskController: TaskController;
  let mockTaskService: jest.Mocked<TaskService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    // Create mock service
    mockTaskService = new TaskService() as jest.Mocked<TaskService>;
    
    // Create controller with mock service
    taskController = new TaskController(mockTaskService);

    // Setup response mocks
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    
    mockRequest = {
      body: {},
      params: {},
      query: {},
    };
    
    mockResponse = {
      json: mockJson,
      status: mockStatus,
    };
  });

  describe('createTask', () => {
    it('should create a task successfully', async () => {
      const mockTask = {
        id: 'task-123',
        type: 'upload' as const,
        status: 'pending' as const,
        priority: 'normal' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTaskService.create.mockResolvedValue(mockTask);
      mockRequest.body = { type: 'upload', video: { title: 'Test Video' } };

      await taskController.createTask(mockRequest as Request, mockResponse as Response);

      expect(mockTaskService.create).toHaveBeenCalledWith(mockRequest.body);
      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockTask,
      });
    });

    it('should handle creation errors', async () => {
      mockTaskService.create.mockRejectedValue(new Error('Creation failed'));
      mockRequest.body = { type: 'upload' };

      await taskController.createTask(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Creation failed',
      });
    });
  });

  describe('getTasks', () => {
    it('should return paginated tasks', async () => {
      const mockResult = {
        items: [
          { 
            id: '1', 
            type: 'upload' as const, 
            status: 'pending' as const,
            priority: 'normal' as const,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          { 
            id: '2', 
            type: 'update' as const, 
            status: 'completed' as const,
            priority: 'normal' as const,
            createdAt: new Date(),
            updatedAt: new Date()
          },
        ],
        page: 1,
        pageSize: 20,
        total: 2,
        totalPages: 1,
      };

      mockTaskService.findAll.mockResolvedValue(mockResult);
      mockRequest.query = { page: '1', pageSize: '20' };

      await taskController.getTasks(mockRequest as Request, mockResponse as Response);

      expect(mockTaskService.findAll).toHaveBeenCalledWith(mockRequest.query);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockResult.items,
        pagination: {
          page: mockResult.page,
          pageSize: mockResult.pageSize,
          total: mockResult.total,
          totalPages: mockResult.totalPages,
        },
      });
    });

    it('should handle query errors', async () => {
      mockTaskService.findAll.mockRejectedValue(new Error('Query failed'));

      await taskController.getTasks(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get tasks',
      });
    });
  });

  describe('getTask', () => {
    it('should return a single task', async () => {
      const mockTask = { id: 'task-123', type: 'upload', status: 'pending' };
      mockTaskService.findById.mockResolvedValue(mockTask as any);
      mockRequest.params = { id: 'task-123' };

      await taskController.getTask(mockRequest as Request, mockResponse as Response);

      expect(mockTaskService.findById).toHaveBeenCalledWith('task-123');
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockTask,
      });
    });

    it('should return 404 for non-existent task', async () => {
      mockTaskService.findById.mockResolvedValue(undefined);
      mockRequest.params = { id: 'non-existent' };

      await taskController.getTask(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Task not found',
      });
    });

    it('should handle errors', async () => {
      mockTaskService.findById.mockRejectedValue(new Error('Database error'));
      mockRequest.params = { id: 'task-123' };

      await taskController.getTask(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get task',
      });
    });
  });

  describe('updateTask', () => {
    it('should update a task successfully', async () => {
      const mockTask = { id: 'task-123', status: 'processing' };
      mockTaskService.update.mockResolvedValue(mockTask as any);
      mockRequest.params = { id: 'task-123' };
      mockRequest.body = { status: 'processing' };

      await taskController.updateTask(mockRequest as Request, mockResponse as Response);

      expect(mockTaskService.update).toHaveBeenCalledWith('task-123', mockRequest.body);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockTask,
      });
    });

    it('should return 404 for non-existent task', async () => {
      mockTaskService.update.mockResolvedValue(undefined);
      mockRequest.params = { id: 'non-existent' };
      mockRequest.body = { status: 'processing' };

      await taskController.updateTask(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Task not found',
      });
    });
  });

  describe('cancelTask', () => {
    it('should cancel a task successfully', async () => {
      mockTaskService.cancel.mockResolvedValue(true);
      mockRequest.params = { id: 'task-123' };

      await taskController.cancelTask(mockRequest as Request, mockResponse as Response);

      expect(mockTaskService.cancel).toHaveBeenCalledWith('task-123');
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'Task cancelled successfully',
      });
    });

    it('should return 404 when task cannot be cancelled', async () => {
      mockTaskService.cancel.mockResolvedValue(false);
      mockRequest.params = { id: 'task-123' };

      await taskController.cancelTask(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Task not found or cannot be cancelled',
      });
    });
  });

  describe('retryTask', () => {
    it('should retry a failed task', async () => {
      const mockTask = { id: 'task-123', status: 'queued', attempts: 1 };
      mockTaskService.retry.mockResolvedValue(mockTask as any);
      mockRequest.params = { id: 'task-123' };

      await taskController.retryTask(mockRequest as Request, mockResponse as Response);

      expect(mockTaskService.retry).toHaveBeenCalledWith('task-123');
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockTask,
      });
    });

    it('should return 404 when task cannot be retried', async () => {
      mockTaskService.retry.mockResolvedValue(undefined);
      mockRequest.params = { id: 'task-123' };

      await taskController.retryTask(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Task not found or cannot be retried',
      });
    });
  });

  describe('batchCreateTasks', () => {
    it('should batch create tasks successfully', async () => {
      const mockResult = {
        created: 2,
        failed: 0,
        tasks: [
          { 
            id: '1', 
            type: 'upload' as const,
            status: 'pending' as const,
            priority: 'normal' as const,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          { 
            id: '2', 
            type: 'update' as const,
            status: 'pending' as const,
            priority: 'normal' as const,
            createdAt: new Date(),
            updatedAt: new Date()
          },
        ],
        errors: [],
      };

      mockTaskService.batchCreate.mockResolvedValue(mockResult);
      mockRequest.body = {
        tasks: [
          { type: 'upload', video: { title: 'Video 1' } },
          { type: 'update', video: { title: 'Video 2' } },
        ],
      };

      await taskController.batchCreateTasks(mockRequest as Request, mockResponse as Response);

      expect(mockTaskService.batchCreate).toHaveBeenCalledWith(mockRequest.body.tasks);
      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
    });
  });

  describe('getTaskStats', () => {
    it('should return task statistics', async () => {
      const mockStats = {
        total: 100,
        byStatus: { pending: 20, processing: 5, completed: 70, failed: 5 },
        byType: { upload: 80, update: 20 },
        byPriority: { normal: 90, high: 10 },
        avgCompletionTime: 300000,
        successRate: 93.33,
        failureRate: 6.67,
      };

      mockTaskService.getStats.mockResolvedValue(mockStats);
      mockRequest.query = { accountId: 'acc-123' };

      await taskController.getTaskStats(mockRequest as Request, mockResponse as Response);

      expect(mockTaskService.getStats).toHaveBeenCalledWith(mockRequest.query);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockStats,
      });
    });
  });

  describe('getTaskProgress', () => {
    it('should return task progress', async () => {
      const mockProgress = {
        taskId: 'task-123',
        status: 'processing' as const,
        progress: 75,
        startedAt: new Date(),
        estimatedCompletion: new Date(),
        attempts: 1,
        error: undefined,
      };

      mockTaskService.getProgress.mockResolvedValue(mockProgress);
      mockRequest.params = { id: 'task-123' };

      await taskController.getTaskProgress(mockRequest as Request, mockResponse as Response);

      expect(mockTaskService.getProgress).toHaveBeenCalledWith('task-123');
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockProgress,
      });
    });

    it('should return 404 when task not found', async () => {
      mockTaskService.getProgress.mockResolvedValue(undefined);
      mockRequest.params = { id: 'non-existent' };

      await taskController.getTaskProgress(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Task not found',
      });
    });
  });

  describe('cleanTasks', () => {
    it('should clean old tasks', async () => {
      const mockResult = { cleaned: 50 };
      mockTaskService.clean.mockResolvedValue(mockResult);
      mockRequest.body = { grace: 86400000 };

      await taskController.cleanTasks(mockRequest as Request, mockResponse as Response);

      expect(mockTaskService.clean).toHaveBeenCalledWith(86400000);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
    });

    it('should use default grace period', async () => {
      const mockResult = { cleaned: 30 };
      mockTaskService.clean.mockResolvedValue(mockResult);
      mockRequest.body = {};

      await taskController.cleanTasks(mockRequest as Request, mockResponse as Response);

      expect(mockTaskService.clean).toHaveBeenCalledWith(86400000);
    });
  });

  describe('scheduleTask', () => {
    it('should schedule a task', async () => {
      const scheduledAt = '2024-01-01T10:00:00Z';
      const mockTask = { id: 'task-123', scheduledAt: new Date(scheduledAt) };
      mockTaskService.schedule.mockResolvedValue(mockTask as any);
      mockRequest.params = { id: 'task-123' };
      mockRequest.body = { scheduledAt };

      await taskController.scheduleTask(mockRequest as Request, mockResponse as Response);

      expect(mockTaskService.schedule).toHaveBeenCalledWith('task-123', scheduledAt);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockTask,
      });
    });

    it('should return 404 when task not found', async () => {
      mockTaskService.schedule.mockResolvedValue(undefined);
      mockRequest.params = { id: 'non-existent' };
      mockRequest.body = { scheduledAt: '2024-01-01T10:00:00Z' };

      await taskController.scheduleTask(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Task not found',
      });
    });
  });

  describe('batchUpdateTasks', () => {
    it('should batch update tasks', async () => {
      const mockResult = {
        updated: 3,
        failed: 1,
        errors: [{ taskId: 'task-4', error: 'Task not found' }],
      };

      mockTaskService.batchUpdate.mockResolvedValue(mockResult);
      mockRequest.body = {
        taskIds: ['task-1', 'task-2', 'task-3', 'task-4'],
        updates: { status: 'processing' },
      };

      await taskController.batchUpdateTasks(mockRequest as Request, mockResponse as Response);

      expect(mockTaskService.batchUpdate).toHaveBeenCalledWith(
        mockRequest.body.taskIds,
        mockRequest.body.updates
      );
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
    });
  });

  describe('batchCancelTasks', () => {
    it('should batch cancel tasks', async () => {
      const mockResult = {
        cancelled: 2,
        failed: 1,
        errors: [{ taskId: 'task-3', error: 'Task not found or cannot be cancelled' }],
      };

      mockTaskService.batchCancel.mockResolvedValue(mockResult);
      mockRequest.body = {
        taskIds: ['task-1', 'task-2', 'task-3'],
      };

      await taskController.batchCancelTasks(mockRequest as Request, mockResponse as Response);

      expect(mockTaskService.batchCancel).toHaveBeenCalledWith(mockRequest.body.taskIds);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
    });
  });
});