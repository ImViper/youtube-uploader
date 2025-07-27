import { Video } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import { getDatabase } from '../../database/connection';
import { QueueManager } from '../../queue/manager';

const logger = pino({
  name: 'task-service',
  level: process.env.LOG_LEVEL || 'info'
});

export interface Task {
  id: string;
  type: 'upload' | 'update' | 'comment' | 'analytics';
  status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'paused' | 'active';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  video?: Video;
  data?: any;
  accountId?: string;
  matrixId?: string;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
  progress?: number;
  attempts?: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

interface TaskFilter {
  status?: string;
  type?: string;
  accountId?: string;
  matrixId?: string;
  priority?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface PaginationOptions extends TaskFilter {
  page?: number | string;
  pageSize?: number | string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

interface TaskStats {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  avgCompletionTime: number;
  successRate: number;
  failureRate: number;
}

export class TaskService {
  private db = getDatabase();
  private queueManager?: QueueManager;

  constructor(queueManager?: QueueManager) {
    this.queueManager = queueManager;
  }

  /**
   * Create a new task
   */
  async create(taskData: any): Promise<Task> {
    try {
      const task: Task = {
        id: uuidv4(),
        type: taskData.type,
        status: 'pending',
        priority: taskData.priority || 'normal',
        video: taskData.video,
        data: taskData.data,
        accountId: taskData.accountId,
        matrixId: taskData.matrixId || 'default',
        scheduledAt: taskData.scheduledAt ? new Date(taskData.scheduledAt) : undefined,
        metadata: taskData.metadata,
        attempts: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save task to database
      const priorityNumber = this.mapPriorityToNumber(task.priority);
      const result = await this.db.query(
        `INSERT INTO upload_tasks (
          id, account_id, video_data, priority, status, 
          scheduled_for, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING *`,
        [
          task.id,
          task.accountId,
          JSON.stringify(task.video || task.data),
          priorityNumber,
          task.status,
          task.scheduledAt,
          task.createdAt
        ]
      );

      // If it's an upload task and we have a queue manager, add to queue
      if (task.type === 'upload' && task.video && this.queueManager) {
        try {
          // Add task to BullMQ queue
          const uploadTask = {
            id: task.id,
            accountId: task.accountId || '',
            video: task.video,
            priority: this.mapPriorityToNumber(task.priority),
            scheduledAt: task.scheduledAt,
            metadata: task.metadata
          };
          
          await this.queueManager.addUploadTask(uploadTask);
          
          // Update status to active after successfully adding to queue
          task.status = 'queued'; // Keep internal status as queued
          await this.db.query(
            `UPDATE upload_tasks SET status = 'active' WHERE id = $1`,
            [task.id]
          );
          
          logger.info({ taskId: task.id }, 'Task added to queue successfully');
        } catch (error) {
          logger.error({ error, taskId: task.id }, 'Failed to add task to queue');
          // Keep status as pending if queue addition fails
        }
      } else if (task.type === 'upload' && task.video) {
        // If no queue manager, mark as active (for backward compatibility)
        task.status = 'queued'; // Keep internal status
        await this.db.query(
          `UPDATE upload_tasks SET status = 'active' WHERE id = $1`,
          [task.id]
        );
        logger.warn({ taskId: task.id }, 'No queue manager available, task marked as active but not processing');
      }

      return task;
    } catch (error) {
      logger.error({ error }, 'Failed to create task');
      throw error;
    }
  }

  /**
   * Find all tasks with pagination and filtering
   */
  async findAll(options: PaginationOptions) {
    try {
      logger.info({ options }, 'FindAll called with options');
      
      // Set default values for pagination
      const page = Math.max(1, Number(options.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(options.pageSize) || 20));

      // Build WHERE conditions
      const conditions: string[] = ['1=1'];
      const params: any[] = [];
      let paramIndex = 1;

      // Apply filters
      if (options.status && options.status !== 'all') {
        conditions.push(`status = $${paramIndex++}`);
        params.push(options.status);
      }
      
      if (options.accountId) {
        conditions.push(`account_id = $${paramIndex++}`);
        params.push(options.accountId);
      }

      // Date range filter
      if (options.dateFrom) {
        conditions.push(`created_at >= $${paramIndex++}`);
        params.push(new Date(options.dateFrom));
      }
      if (options.dateTo) {
        conditions.push(`created_at <= $${paramIndex++}`);
        params.push(new Date(options.dateTo));
      }

      // Search filter for video title (in JSONB)
      if (options.search) {
        conditions.push(`(video_data->>'title' ILIKE $${paramIndex} OR id::text ILIKE $${paramIndex})`);
        params.push(`%${options.search}%`);
        paramIndex++;
      }

      // Count total records
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM upload_tasks 
        WHERE ${conditions.join(' AND ')}
      `;
      const countResult = await this.db.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total) || 0;
      const totalPages = Math.ceil(total / pageSize);

      // Build ORDER BY clause
      const sortBy = options.sortBy || 'created_at';
      const sortOrder = options.sortOrder || 'desc';
      let orderByColumn = sortBy;
      
      // Map field names to database columns
      if (sortBy === 'createdAt') orderByColumn = 'created_at';
      if (sortBy === 'updatedAt') orderByColumn = 'created_at'; // no updated_at in schema
      if (sortBy === 'scheduledAt') orderByColumn = 'scheduled_for';

      // Query with pagination
      const query = `
        SELECT 
          id, 
          account_id,
          video_data,
          priority,
          status,
          error,
          result,
          created_at,
          scheduled_for,
          started_at,
          completed_at
        FROM upload_tasks 
        WHERE ${conditions.join(' AND ')}
        ORDER BY ${orderByColumn} ${sortOrder.toUpperCase()}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      const offset = (page - 1) * pageSize;
      logger.info({ 
        page, 
        pageSize, 
        offset,
        paramIndex,
        totalParams: params.length 
      }, 'Pagination params');
      
      params.push(pageSize);
      params.push(offset);

      const result = await this.db.query(query, params);

      // Map database rows to Task objects
      const tasks: Task[] = result.rows.map(row => ({
        id: row.id,
        type: 'upload', // Default type since it's not stored in DB
        status: row.status,
        priority: this.mapNumberToPriority(row.priority),
        video: row.video_data,
        accountId: row.account_id,
        matrixId: 'default', // Not stored in DB
        scheduledAt: row.scheduled_for,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        error: row.error,
        result: row.result,
        progress: 0, // Not stored in DB
        attempts: 0, // Not stored in DB
        createdAt: row.created_at,
        updatedAt: row.created_at // No updated_at in schema
      }));

      return {
        items: tasks,
        page: page,
        pageSize: pageSize,
        total,
        totalPages
      };
    } catch (error) {
      logger.error({ error }, 'Failed to find tasks');
      throw error;
    }
  }

  /**
   * Find task by ID
   */
  async findById(id: string): Promise<Task | undefined> {
    try {
      const result = await this.db.query(
        `SELECT 
          id, 
          account_id,
          video_data,
          priority,
          status,
          error,
          result,
          created_at,
          scheduled_for,
          started_at,
          completed_at
        FROM upload_tasks 
        WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return undefined;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        type: 'upload',
        status: row.status,
        priority: this.mapNumberToPriority(row.priority),
        video: row.video_data,
        accountId: row.account_id,
        matrixId: 'default',
        scheduledAt: row.scheduled_for,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        error: row.error,
        result: row.result,
        progress: 0,
        attempts: 0,
        createdAt: row.created_at,
        updatedAt: row.created_at
      };
    } catch (error) {
      logger.error({ error }, 'Failed to find task by ID');
      throw error;
    }
  }

  /**
   * Update task
   */
  async update(id: string, updates: any): Promise<Task | undefined> {
    try {
      // Build dynamic update query
      const updateFields: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (updates.status !== undefined) {
        updateFields.push(`status = $${paramIndex++}`);
        params.push(updates.status);
      }
      if (updates.priority !== undefined) {
        updateFields.push(`priority = $${paramIndex++}`);
        params.push(this.mapPriorityToNumber(updates.priority));
      }
      if (updates.error !== undefined) {
        updateFields.push(`error = $${paramIndex++}`);
        params.push(updates.error);
      }
      if (updates.result !== undefined) {
        updateFields.push(`result = $${paramIndex++}`);
        params.push(JSON.stringify(updates.result));
      }
      if (updates.startedAt !== undefined) {
        updateFields.push(`started_at = $${paramIndex++}`);
        params.push(updates.startedAt);
      }
      if (updates.completedAt !== undefined) {
        updateFields.push(`completed_at = $${paramIndex++}`);
        params.push(updates.completedAt);
      }
      if (updates.metadata !== undefined) {
        updateFields.push(`video_data = jsonb_set(COALESCE(video_data, '{}'), '{metadata}', $${paramIndex++}::jsonb)`);
        params.push(JSON.stringify(updates.metadata));
      }

      if (updateFields.length === 0) {
        return await this.findById(id);
      }

      params.push(id);
      const query = `
        UPDATE upload_tasks 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await this.db.query(query, params);
      
      if (result.rows.length === 0) {
        return undefined;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        type: 'upload',
        status: row.status,
        priority: this.mapNumberToPriority(row.priority),
        video: row.video_data,
        accountId: row.account_id,
        matrixId: 'default',
        scheduledAt: row.scheduled_for,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        error: row.error,
        result: row.result,
        progress: 0,
        attempts: 0,
        createdAt: row.created_at,
        updatedAt: row.created_at
      };
    } catch (error) {
      logger.error({ error }, 'Failed to update task');
      throw error;
    }
  }

  /**
   * Pause a task
   */
  async pause(id: string): Promise<Task | undefined> {
    try {
      const task = await this.findById(id);
      if (!task) {
        return undefined;
      }

      // Can only pause active tasks (queued or processing in code)
      if (task.status !== 'active' && task.status !== 'queued' && task.status !== 'processing') {
        logger.warn({ taskId: id, status: task.status }, 'Cannot pause task in current status');
        return undefined;
      }

      // If we have a queue manager and the task is in the queue, pause it
      if (this.queueManager && task.metadata?.jobId) {
        try {
          const job = await this.queueManager.getJob(task.metadata.jobId);
          if (job) {
            // BullMQ doesn't have a built-in pause for individual jobs
            // We'll remove it from queue and update status
            await job.remove();
            logger.info({ taskId: id, jobId: task.metadata.jobId }, 'Removed job from queue');
          }
        } catch (error) {
          logger.error({ error, taskId: id }, 'Failed to remove job from queue');
        }
      }

      // Update task status to failed with paused indicator
      // Since database doesn't support 'paused' status, we use 'failed' with specific error
      const result = await this.db.query(
        `UPDATE upload_tasks 
         SET status = 'failed', error = 'PAUSED_BY_USER'
         WHERE id = $1 AND status = 'active'
         RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        return undefined;
      }

      return await this.findById(id);
    } catch (error) {
      logger.error({ error }, 'Failed to pause task');
      throw error;
    }
  }

  /**
   * Resume a paused task or start a pending task
   */
  async resume(id: string): Promise<Task | undefined> {
    try {
      const task = await this.findById(id);
      if (!task) {
        return undefined;
      }

      // Can resume paused tasks (failed with PAUSED_BY_USER) or start pending tasks
      const isPaused = task.status === 'failed' && task.error === 'PAUSED_BY_USER';
      if (!isPaused && task.status !== 'pending') {
        logger.warn({ taskId: id, status: task.status }, 'Cannot resume/start task in current status');
        return undefined;
      }

      // For paused tasks, reset to pending first
      if (isPaused) {
        const result = await this.db.query(
          `UPDATE upload_tasks 
           SET status = 'pending', error = NULL
           WHERE id = $1 AND status = 'failed' AND error = 'PAUSED_BY_USER'
           RETURNING *`,
          [id]
        );

        if (result.rows.length === 0) {
          return undefined;
        }
      }

      // Add to queue if it's an upload task
      if (task.type === 'upload' && task.video && this.queueManager) {
        try {
          const uploadTask = {
            id: task.id,
            accountId: task.accountId || '',
            video: task.video,
            priority: this.mapPriorityToNumber(task.priority),
            scheduledAt: task.scheduledAt,
            metadata: { ...task.metadata, resumed: true }
          };
          
          const job = await this.queueManager.addUploadTask(uploadTask);
          
          // Update status to active and store new job ID
          await this.db.query(
            `UPDATE upload_tasks 
             SET status = 'active', 
                 video_data = jsonb_set(COALESCE(video_data, '{}'), '{metadata,jobId}', $2::jsonb)
             WHERE id = $1`,
            [task.id, JSON.stringify(job.id)]
          );
          
          logger.info({ taskId: task.id, jobId: job.id }, 'Task resumed and re-added to queue');
        } catch (error) {
          logger.error({ error, taskId: task.id }, 'Failed to re-add task to queue');
          throw error;
        }
      }

      return await this.findById(id);
    } catch (error) {
      logger.error({ error }, 'Failed to resume task');
      throw error;
    }
  }

  /**
   * Cancel a task
   */
  async cancel(id: string): Promise<boolean> {
    try {
      // First check if task exists and can be cancelled
      const task = await this.findById(id);
      if (!task) {
        return false;
      }

      // Can only cancel pending, active, or paused tasks
      const isPaused = task.status === 'failed' && task.error === 'PAUSED_BY_USER';
      if (task.status !== 'pending' && task.status !== 'active' && !isPaused) {
        return false;
      }

      // If we have a queue manager and the task is in the queue, remove it
      if (this.queueManager && task.metadata?.jobId) {
        try {
          const job = await this.queueManager.getJob(task.metadata.jobId);
          if (job) {
            await job.remove();
            logger.info({ taskId: id, jobId: task.metadata.jobId }, 'Removed job from queue for cancellation');
          }
        } catch (error) {
          logger.error({ error, taskId: id }, 'Failed to remove job from queue during cancellation');
        }
      }

      // Update task status to failed with cancelled indicator
      const result = await this.db.query(
        `UPDATE upload_tasks 
         SET status = 'failed', error = 'Task cancelled by user'
         WHERE id = $1 AND (status IN ('pending', 'active') OR (status = 'failed' AND error = 'PAUSED_BY_USER'))
         RETURNING id`,
        [id]
      );
      
      return (result.rowCount || 0) > 0;
    } catch (error) {
      logger.error({ error }, 'Failed to cancel task');
      throw error;
    }
  }

  /**
   * Retry a failed task
   */
  async retry(id: string): Promise<Task | undefined> {
    try {
      const task = await this.findById(id);
      if (!task || task.status !== 'failed') {
        return undefined;
      }

      // Reset task status in database
      const result = await this.db.query(
        `UPDATE upload_tasks 
         SET status = 'pending', error = NULL, retry_count = retry_count + 1
         WHERE id = $1 AND status = 'failed'
         RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        return undefined;
      }

      // Re-queue the task
      if (task.type === 'upload' && task.video && this.queueManager) {
        try {
          // Add task back to BullMQ queue
          const uploadTask = {
            id: task.id,
            accountId: task.accountId || '',
            video: task.video,
            priority: this.mapPriorityToNumber(task.priority),
            scheduledAt: task.scheduledAt,
            metadata: task.metadata,
            retryCount: (task.attempts || 0) + 1
          };
          
          await this.queueManager.addUploadTask(uploadTask);
          
          // Update status to active for retry
          await this.db.query(
            `UPDATE upload_tasks SET status = 'active' WHERE id = $1`,
            [id]
          );
          
          logger.info({ taskId: task.id }, 'Task re-added to queue for retry');
        } catch (error) {
          logger.error({ error, taskId: task.id }, 'Failed to re-add task to queue');
          throw error;
        }
      } else if (task.type === 'upload' && task.video) {
        // If no queue manager, just update status
        await this.db.query(
          `UPDATE upload_tasks SET status = 'active' WHERE id = $1`,
          [id]
        );
        logger.warn({ taskId: task.id }, 'No queue manager available for retry');
      }

      return await this.findById(id);
    } catch (error) {
      logger.error({ error }, 'Failed to retry task');
      throw error;
    }
  }

  /**
   * Batch create tasks
   */
  async batchCreate(tasksData: any[]) {
    const results = {
      created: 0,
      failed: 0,
      tasks: [] as Task[],
      errors: [] as any[]
    };

    for (let i = 0; i < tasksData.length; i++) {
      try {
        const task = await this.create(tasksData[i]);
        results.created++;
        results.tasks.push(task);
      } catch (error) {
        results.failed++;
        results.errors.push({
          index: i,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Get task statistics
   */
  async getStats(filter?: TaskFilter): Promise<TaskStats> {
    try {
      // Build WHERE conditions
      const conditions: string[] = ['1=1'];
      const params: any[] = [];
      let paramIndex = 1;

      if (filter) {
        if (filter.accountId) {
          conditions.push(`account_id = $${paramIndex++}`);
          params.push(filter.accountId);
        }
        if (filter.status) {
          conditions.push(`status = $${paramIndex++}`);
          params.push(filter.status);
        }
        if (filter.dateFrom) {
          conditions.push(`created_at >= $${paramIndex++}`);
          params.push(new Date(filter.dateFrom));
        }
        if (filter.dateTo) {
          conditions.push(`created_at <= $${paramIndex++}`);
          params.push(new Date(filter.dateTo));
        }
      }

      const whereClause = conditions.join(' AND ');

      // Get stats from database
      const statsQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'active') as active,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000) FILTER (WHERE status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL) as avg_completion_time
        FROM upload_tasks
        WHERE ${whereClause}
      `;

      const priorityQuery = `
        SELECT 
          CASE priority
            WHEN 1 THEN 'urgent'
            WHEN 2 THEN 'high'
            WHEN 3 THEN 'normal'
            WHEN 4 THEN 'low'
            ELSE 'normal'
          END as priority_name,
          COUNT(*) as count
        FROM upload_tasks
        WHERE ${whereClause}
        GROUP BY priority
      `;

      const [statsResult, priorityResult] = await Promise.all([
        this.db.query(statsQuery, params),
        this.db.query(priorityQuery, params)
      ]);

      const statsRow = statsResult.rows[0];
      const total = parseInt(statsRow.total) || 0;
      const completed = parseInt(statsRow.completed) || 0;
      const failed = parseInt(statsRow.failed) || 0;
      const totalFinished = completed + failed;

      const stats: TaskStats = {
        total,
        byStatus: {
          pending: parseInt(statsRow.pending) || 0,
          active: parseInt(statsRow.active) || 0,
          completed: completed,
          failed: failed
        },
        byType: {
          upload: total // All tasks are upload type in this table
        },
        byPriority: {},
        avgCompletionTime: parseFloat(statsRow.avg_completion_time) || 0,
        successRate: totalFinished > 0 ? (completed / totalFinished) * 100 : 0,
        failureRate: totalFinished > 0 ? (failed / totalFinished) * 100 : 0
      };

      // Add priority stats
      priorityResult.rows.forEach(row => {
        stats.byPriority[row.priority_name] = parseInt(row.count) || 0;
      });

      return stats;
    } catch (error) {
      logger.error({ error }, 'Failed to get task stats');
      throw error;
    }
  }

  /**
   * Get task progress
   */
  async getProgress(id: string) {
    const task = await this.findById(id);
    if (!task) {
      return undefined;
    }

    // Get job progress if available
    // Progress is tracked in the database
    const jobProgress = task.progress || 0;

    return {
      taskId: task.id,
      status: task.status,
      progress: jobProgress || task.progress || 0,
      startedAt: task.startedAt,
      estimatedCompletion: this.estimateCompletion(task),
      attempts: task.attempts,
      error: task.error
    };
  }

  /**
   * Clean old tasks
   */
  async clean(grace: number) {
    const cutoffDate = new Date(Date.now() - grace);
    
    try {
      const result = await this.db.query(
        `DELETE FROM upload_tasks 
         WHERE status IN ('completed', 'failed') 
         AND created_at < $1`,
        [cutoffDate]
      );

      return { cleaned: result.rowCount || 0 };
    } catch (error) {
      logger.error({ error }, 'Failed to clean old tasks');
      throw error;
    }
  }

  /**
   * Schedule a task
   */
  async schedule(id: string, scheduledAt: string): Promise<Task | undefined> {
    try {
      const result = await this.db.query(
        `UPDATE upload_tasks 
         SET scheduled_for = $1
         WHERE id = $2
         RETURNING *`,
        [new Date(scheduledAt), id]
      );

      if (result.rows.length === 0) {
        return undefined;
      }

      // Update job scheduling if already queued
      const task = await this.findById(id);
      if (task?.metadata?.jobId) {
        // This would update the job's delay in the queue
        // Implementation depends on the queue manager
      }

      return task;
    } catch (error) {
      logger.error({ error }, 'Failed to schedule task');
      throw error;
    }
  }

  /**
   * Map priority to number for queue
   */
  private mapPriorityToNumber(priority: string): number {
    const priorityMap = {
      urgent: 1,
      high: 2,
      normal: 3,
      low: 4
    };
    return priorityMap[priority as keyof typeof priorityMap] || 3;
  }

  private mapNumberToPriority(priorityNum: number): 'low' | 'normal' | 'high' | 'urgent' {
    const priorityMap = {
      1: 'urgent',
      2: 'high',
      3: 'normal',
      4: 'low'
    } as const;
    return priorityMap[priorityNum as keyof typeof priorityMap] || 'normal';
  }

  /**
   * Estimate completion time
   */
  private estimateCompletion(task: Task): Date | undefined {
    if (!task.startedAt || task.status !== 'processing') {
      return undefined;
    }

    // Simple estimation based on average completion time
    // In production, this would use historical data
    const avgTime = 5 * 60 * 1000; // 5 minutes
    return new Date(task.startedAt.getTime() + avgTime);
  }

  /**
   * Batch update tasks
   */
  async batchUpdate(taskIds: string[], updates: Partial<Task>) {
    const result = {
      updated: 0,
      failed: 0,
      errors: [] as Array<{ taskId: string; error: string }>
    };

    for (const taskId of taskIds) {
      try {
        const task = await this.update(taskId, updates);
        if (task) {
          result.updated++;
        } else {
          result.failed++;
          result.errors.push({ taskId, error: 'Task not found' });
        }
      } catch (error) {
        result.failed++;
        result.errors.push({ 
          taskId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return result;
  }

  /**
   * Batch cancel tasks
   */
  async batchCancel(taskIds: string[]) {
    const result = {
      cancelled: 0,
      failed: 0,
      errors: [] as Array<{ taskId: string; error: string }>
    };

    for (const taskId of taskIds) {
      try {
        const cancelled = await this.cancel(taskId);
        if (cancelled) {
          result.cancelled++;
        } else {
          result.failed++;
          result.errors.push({ taskId, error: 'Task not found or cannot be cancelled' });
        }
      } catch (error) {
        result.failed++;
        result.errors.push({ 
          taskId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return result;
  }
}