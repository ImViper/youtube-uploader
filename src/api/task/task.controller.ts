import { Request, Response } from 'express';
import { TaskService } from './task.service';
import pino from 'pino';

const logger = pino({
  name: 'task-controller',
  level: process.env.LOG_LEVEL || 'info'
});

export class TaskController {
  constructor(private taskService: TaskService) {}

  /**
   * Submit a new task
   */
  async createTask(req: Request, res: Response) {
    try {
      const task = await this.taskService.create(req.body);
      
      logger.info({ taskId: task.id, type: task.type }, 'Task created successfully');
      
      res.status(201).json({
        success: true,
        data: task
      });
    } catch (error) {
      logger.error({ error }, 'Failed to create task');
      res.status(500).json({
        success: false,
        error: 'Failed to create task'
      });
    }
  }

  /**
   * Get all tasks with pagination and filtering
   */
  async getTasks(req: Request, res: Response) {
    try {
      logger.info({ query: req.query }, 'Getting tasks with query');
      const result = await this.taskService.findAll(req.query as any);

      res.json({
        success: true,
        data: result.items,
        pagination: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get tasks');
      res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'development' 
          ? error instanceof Error ? error.message : 'Failed to get tasks'
          : 'Failed to get tasks'
      });
    }
  }

  /**
   * Get a single task by ID
   */
  async getTask(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const task = await this.taskService.findById(id);

      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found'
        });
      }

      res.json({
        success: true,
        data: task
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get task');
      res.status(500).json({
        success: false,
        error: 'Failed to get task'
      });
    }
  }

  /**
   * Update task status
   */
  async updateTask(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const task = await this.taskService.update(id, req.body);

      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found'
        });
      }

      logger.info({ taskId: id }, 'Task updated successfully');

      res.json({
        success: true,
        data: task
      });
    } catch (error) {
      logger.error({ error }, 'Failed to update task');
      res.status(500).json({
        success: false,
        error: 'Failed to update task'
      });
    }
  }

  /**
   * Cancel a task
   */
  async cancelTask(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const cancelled = await this.taskService.cancel(id);

      if (!cancelled) {
        return res.status(404).json({
          success: false,
          error: 'Task not found or cannot be cancelled'
        });
      }

      logger.info({ taskId: id }, 'Task cancelled successfully');

      res.json({
        success: true,
        message: 'Task cancelled successfully'
      });
    } catch (error) {
      logger.error({ error }, 'Failed to cancel task');
      res.status(500).json({
        success: false,
        error: 'Failed to cancel task'
      });
    }
  }

  /**
   * Retry a failed task
   */
  async retryTask(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const task = await this.taskService.retry(id);

      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found or cannot be retried'
        });
      }

      logger.info({ taskId: id }, 'Task retry initiated');

      res.json({
        success: true,
        data: task
      });
    } catch (error) {
      logger.error({ error }, 'Failed to retry task');
      res.status(500).json({
        success: false,
        error: 'Failed to retry task'
      });
    }
  }

  /**
   * Batch create tasks
   */
  async batchCreateTasks(req: Request, res: Response) {
    try {
      const { tasks } = req.body;
      const result = await this.taskService.batchCreate(tasks);

      logger.info({ created: result.created }, 'Batch task creation completed');

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ error }, 'Failed to batch create tasks');
      res.status(500).json({
        success: false,
        error: 'Failed to batch create tasks'
      });
    }
  }

  /**
   * Get task statistics
   */
  async getTaskStats(req: Request, res: Response) {
    try {
      const stats = await this.taskService.getStats(req.query as any);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get task stats');
      res.status(500).json({
        success: false,
        error: 'Failed to get task stats'
      });
    }
  }

  /**
   * Get task progress
   */
  async getTaskProgress(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const progress = await this.taskService.getProgress(id);

      if (!progress) {
        return res.status(404).json({
          success: false,
          error: 'Task not found'
        });
      }

      res.json({
        success: true,
        data: progress
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get task progress');
      res.status(500).json({
        success: false,
        error: 'Failed to get task progress'
      });
    }
  }

  /**
   * Clean old completed/failed tasks
   */
  async cleanTasks(req: Request, res: Response) {
    try {
      const { grace = 86400000 } = req.body; // 24 hours default
      const result = await this.taskService.clean(grace);

      logger.info({ cleaned: result.cleaned }, 'Task cleanup completed');

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ error }, 'Failed to clean tasks');
      res.status(500).json({
        success: false,
        error: 'Failed to clean tasks'
      });
    }
  }

  /**
   * Schedule a task
   */
  async scheduleTask(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { scheduledAt } = req.body;
      
      const task = await this.taskService.schedule(id, scheduledAt);

      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found'
        });
      }

      logger.info({ taskId: id, scheduledAt }, 'Task scheduled successfully');

      res.json({
        success: true,
        data: task
      });
    } catch (error) {
      logger.error({ error }, 'Failed to schedule task');
      res.status(500).json({
        success: false,
        error: 'Failed to schedule task'
      });
    }
  }

  /**
   * Batch update tasks
   */
  async batchUpdateTasks(req: Request, res: Response) {
    try {
      const { taskIds, updates } = req.body;
      const result = await this.taskService.batchUpdate(taskIds, updates);

      logger.info({ updated: result.updated, failed: result.failed }, 'Batch task update completed');

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ error }, 'Failed to batch update tasks');
      res.status(500).json({
        success: false,
        error: 'Failed to batch update tasks'
      });
    }
  }

  /**
   * Batch cancel tasks
   */
  async batchCancelTasks(req: Request, res: Response) {
    try {
      const { taskIds } = req.body;
      const result = await this.taskService.batchCancel(taskIds);

      logger.info({ cancelled: result.cancelled, failed: result.failed }, 'Batch task cancellation completed');

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ error }, 'Failed to batch cancel tasks');
      res.status(500).json({
        success: false,
        error: 'Failed to batch cancel tasks'
      });
    }
  }
}