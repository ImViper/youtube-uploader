import { Router } from 'express';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { QueueManager } from '../../queue/manager';
import { validate } from '../../middleware/validation';
import {
  createTaskSchema,
  updateTaskSchema,
  taskFilterSchema,
  paginationSchema,
  batchTaskSchema
} from '../../validation/schemas';
import { z } from 'zod';

export function createTaskRoutes(queueManager?: QueueManager): Router {
  const router = Router();
  const taskService = new TaskService(queueManager);
  const taskController = new TaskController(taskService);

  // Create a new task
  router.post(
    '/',
    validate({ body: createTaskSchema }),
    taskController.createTask.bind(taskController)
  );

  // Batch create tasks
  router.post(
    '/batch',
    validate({ body: batchTaskSchema }),
    taskController.batchCreateTasks.bind(taskController)
  );

  // Get all tasks
  router.get(
    '/',
    // validate({ 
    //   query: paginationSchema.merge(taskFilterSchema) 
    // }),
    taskController.getTasks.bind(taskController)
  );

  // Test endpoint without validation
  router.get(
    '/test',
    taskController.getTasks.bind(taskController)
  );

  // Get task statistics
  router.get(
    '/stats',
    validate({ query: taskFilterSchema }),
    taskController.getTaskStats.bind(taskController)
  );

  // Clean old tasks
  router.post(
    '/clean',
    validate({ 
      body: z.object({ 
        grace: z.number().int().positive().optional() 
      })
    }),
    taskController.cleanTasks.bind(taskController)
  );

  // Get a single task
  router.get(
    '/:id',
    validate({ params: z.object({ id: z.string().uuid() }) }),
    taskController.getTask.bind(taskController)
  );

  // Update task status
  router.patch(
    '/:id',
    validate({ 
      params: z.object({ id: z.string().uuid() }),
      body: updateTaskSchema 
    }),
    taskController.updateTask.bind(taskController)
  );

  // Pause a task
  router.post(
    '/:id/pause',
    validate({ params: z.object({ id: z.string().uuid() }) }),
    taskController.pauseTask.bind(taskController)
  );

  // Resume a paused task
  router.post(
    '/:id/resume',
    validate({ params: z.object({ id: z.string().uuid() }) }),
    taskController.resumeTask.bind(taskController)
  );

  // Cancel a task
  router.post(
    '/:id/cancel',
    validate({ params: z.object({ id: z.string().uuid() }) }),
    taskController.cancelTask.bind(taskController)
  );

  // Retry a failed task
  router.post(
    '/:id/retry',
    validate({ params: z.object({ id: z.string().uuid() }) }),
    taskController.retryTask.bind(taskController)
  );

  // Get task progress
  router.get(
    '/:id/progress',
    validate({ params: z.object({ id: z.string().uuid() }) }),
    taskController.getTaskProgress.bind(taskController)
  );

  // Schedule a task
  router.post(
    '/:id/schedule',
    validate({ 
      params: z.object({ id: z.string().uuid() }),
      body: z.object({ 
        scheduledAt: z.string().datetime() 
      })
    }),
    taskController.scheduleTask.bind(taskController)
  );

  // Batch update tasks
  router.patch(
    '/batch',
    validate({ 
      body: z.object({
        taskIds: z.array(z.string().uuid()).min(1).max(100),
        updates: updateTaskSchema
      })
    }),
    taskController.batchUpdateTasks.bind(taskController)
  );

  // Batch cancel tasks
  router.post(
    '/batch/cancel',
    validate({ 
      body: z.object({
        taskIds: z.array(z.string().uuid()).min(1).max(100)
      })
    }),
    taskController.batchCancelTasks.bind(taskController)
  );

  return router;
}