import { baseApi } from '@/services/baseApi';
import type { ApiResponse, PaginatedResponse } from '@/types';

// Task types matching backend
export type TaskType = 'upload' | 'update' | 'comment' | 'analytics';
export type TaskStatus = 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'paused';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  accountId?: string;
  matrixId?: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  result?: any;
  error?: string;
  progress?: number;
  attempts?: number;
  maxAttempts?: number;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  
  // Video-specific fields for upload tasks
  video?: {
    path: string;
    title: string;
    description: string;
    tags?: string[];
    language?: string;
    playlist?: string;
    thumbnail?: string;
    publishType?: 'PRIVATE' | 'UNLISTED' | 'PUBLIC';
    channelName?: string;
    uploadAsDraft?: boolean;
    isAgeRestriction?: boolean;
    isNotForKid?: boolean;
  };
  
  // Computed fields for UI compatibility
  title?: string;
  description?: string;
  tags?: string[];
  videoUrl?: string;
  thumbnailUrl?: string;
}

interface TasksQueryParams {
  page?: number;
  pageSize?: number;
  type?: TaskType;
  status?: TaskStatus | 'all';
  accountId?: string;
  matrixId?: string;
  priority?: TaskPriority;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

interface CreateTaskRequest {
  type: TaskType;
  priority?: TaskPriority;
  accountId?: string;
  scheduledAt?: string;
  video?: {
    path: string;
    title: string;
    description: string;
    tags?: string[];
    thumbnail?: string;
    publishType?: 'PRIVATE' | 'UNLISTED' | 'PUBLIC';
    language?: string;
  };
  data?: any;
  metadata?: Record<string, any>;
}

interface UpdateTaskRequest {
  id: string;
  data: {
    priority?: TaskPriority;
    scheduledAt?: string;
    video?: Partial<CreateTaskRequest['video']>;
    metadata?: Record<string, any>;
  };
}

interface BatchCreateTaskRequest {
  tasks: CreateTaskRequest[];
}

// Transform task to match Upload interface for backward compatibility
function transformTaskToUpload(task: Task): any {
  return {
    id: task.id,
    accountId: task.accountId || '',
    videoPath: task.video?.path || '',
    title: task.video?.title || task.title || 'Untitled',
    description: task.video?.description || task.description || '',
    tags: task.video?.tags || task.tags || [],
    thumbnailPath: task.video?.thumbnail || task.thumbnailUrl || '',
    status: mapTaskStatusToUploadStatus(task.status),
    progress: task.progress || 0,
    error: task.error,
    videoId: task.result?.videoId,
    url: task.result?.videoUrl || task.videoUrl,
    scheduledAt: task.scheduledAt,
    completedAt: task.completedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function mapTaskStatusToUploadStatus(status: TaskStatus): string {
  const statusMap: Record<TaskStatus, string> = {
    'pending': 'pending',
    'queued': 'pending',
    'processing': 'uploading',
    'completed': 'completed',
    'failed': 'failed',
    'cancelled': 'cancelled'
  };
  return statusMap[status] || status;
}

export const tasksApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Get tasks (with upload type filter for backward compatibility)
    getTasks: builder.query<PaginatedResponse<Task>, TasksQueryParams>({
      query: (params) => ({
        url: '/v1/tasks',
        params: {
          ...params,
          type: params.type || 'upload', // Default to upload tasks
        },
      }),
      transformResponse: (response: ApiResponse<Task[]> & { pagination?: any }) => {
        // Handle backend response format
        const data = response.data || [];
        const pagination = response.pagination || {
          page: 1,
          pageSize: 100,
          total: data.length,
          totalPages: 1
        };
        
        // Add computed fields for UI
        const items = data.map(task => ({
          ...task,
          title: task.video?.title || task.title,
          description: task.video?.description || task.description,
          tags: task.video?.tags || task.tags,
          videoUrl: task.result?.videoUrl || task.videoUrl,
          thumbnailUrl: task.video?.thumbnail || task.thumbnailUrl,
        }));
        
        return {
          items,
          total: pagination.total,
          page: pagination.page,
          pageSize: pagination.pageSize,
          hasMore: pagination.page < pagination.totalPages
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ id }) => ({ type: 'Task' as const, id })),
              { type: 'Task', id: 'LIST' },
            ]
          : [{ type: 'Task', id: 'LIST' }],
    }),

    // Get single task
    getTask: builder.query<Task, string>({
      query: (id) => `/v1/tasks/${id}`,
      transformResponse: (task: Task) => ({
        ...task,
        title: task.video?.title || task.title,
        description: task.video?.description || task.description,
        tags: task.video?.tags || task.tags,
        videoUrl: task.result?.videoUrl || task.videoUrl,
        thumbnailUrl: task.video?.thumbnail || task.thumbnailUrl,
      }),
      providesTags: (_result, _error, id) => [{ type: 'Task', id }],
    }),

    // Create task
    createTask: builder.mutation<Task, CreateTaskRequest>({
      query: (body) => ({
        url: '/v1/tasks',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Task', id: 'LIST' }],
    }),

    // Batch create tasks
    batchCreateTasks: builder.mutation<Task[], BatchCreateTaskRequest>({
      query: (body) => ({
        url: '/v1/tasks/batch',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Task', id: 'LIST' }],
    }),

    // Update task
    updateTask: builder.mutation<Task, UpdateTaskRequest>({
      query: ({ id, data }) => ({
        url: `/v1/tasks/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Task', id },
        { type: 'Task', id: 'LIST' },
      ],
    }),

    // Pause task
    pauseTask: builder.mutation<Task, string>({
      query: (id) => ({
        url: `/v1/tasks/${id}/pause`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Task', id },
        { type: 'Task', id: 'LIST' },
      ],
    }),

    // Resume task
    resumeTask: builder.mutation<Task, string>({
      query: (id) => ({
        url: `/v1/tasks/${id}/resume`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Task', id },
        { type: 'Task', id: 'LIST' },
      ],
    }),

    // Cancel task
    cancelTask: builder.mutation<ApiResponse, string>({
      query: (id) => ({
        url: `/v1/tasks/${id}/cancel`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Task', id },
        { type: 'Task', id: 'LIST' },
      ],
    }),

    // Retry task
    retryTask: builder.mutation<Task, string>({
      query: (id) => ({
        url: `/v1/tasks/${id}/retry`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Task', id },
        { type: 'Task', id: 'LIST' },
      ],
    }),

    // Get task progress
    getTaskProgress: builder.query<{ progress: number; status: string }, string>({
      query: (id) => `/v1/tasks/${id}/progress`,
    }),

    // Schedule task
    scheduleTask: builder.mutation<Task, { id: string; scheduledAt: string }>({
      query: ({ id, scheduledAt }) => ({
        url: `/v1/tasks/${id}/schedule`,
        method: 'POST',
        body: { scheduledAt },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Task', id },
        { type: 'Task', id: 'LIST' },
      ],
    }),

    // Get task statistics
    getTaskStats: builder.query<any, TasksQueryParams>({
      query: (params) => ({
        url: '/v1/tasks/stats',
        params,
      }),
    }),

    // Backward compatibility: Upload-specific endpoints that map to tasks
    getUploads: builder.query<PaginatedResponse<any>, TasksQueryParams>({
      query: (params) => ({
        url: '/v1/tasks',
        params: {
          ...params,
          type: 'upload',
        },
      }),
      transformResponse: (response: ApiResponse<Task[]> & { pagination?: any }) => {
        // Handle backend response format
        const data = response.data || [];
        const pagination = response.pagination || {
          page: 1,
          pageSize: 100,
          total: data.length,
          totalPages: 1
        };
        
        const items = data.map(transformTaskToUpload);
        
        return {
          items,
          total: pagination.total,
          page: pagination.page,
          pageSize: pagination.pageSize,
          hasMore: pagination.page < pagination.totalPages
        };
      },
      providesTags: ['Upload'],
    }),

    createUpload: builder.mutation<any, any>({
      query: (body) => {
        // Transform upload request to task request
        const taskRequest: CreateTaskRequest = {
          type: 'upload',
          priority: 'normal',
          accountId: body.accountId,
          scheduledAt: body.publishAt || body.scheduledAt, // 定时发布
          video: {
            // Required fields - 现在直接使用路径
            path: body.videoPath || '',
            title: body.title,
            description: body.description,
            
            // Optional fields that map directly
            tags: body.tags,
            thumbnail: body.thumbnailPath || '',
            publishType: body.privacy?.toUpperCase() as any || 'PUBLIC',
            language: body.language,
            playlist: body.playlist,
            gameTitleSearch: body.gameTitle,
            
            // Boolean fields with special handling
            isNotForKid: body.madeForKids === true ? false : true, // 注意逻辑相反
            isAgeRestriction: body.ageRestriction || false,
            uploadAsDraft: body.uploadAsDraft || false,
            isChannelMonetized: body.isChannelMonetized || false,
            
            // Location handling - only automaticPlaces is supported
            automaticPlaces: body.location ? false : true, // 如果前端提供了位置，禁用自动位置
            
            // Channel selection (if needed)
            channelName: body.channelName,
          },
          metadata: {
            // 存储前端特有的字段，这些字段后端Video类型不支持
            categoryId: body.categoryId,
            location: body.location, // 手动输入的位置
            recordingDate: body.recordingDate,
            allowComments: body.allowComments !== false, // 默认true
            allowRatings: body.allowRatings !== false, // 默认true
            allowEmbedding: body.allowEmbedding !== false, // 默认true
            originalFileName: body.videoFile?.name,
            thumbnailFileName: body.thumbnailFile?.name,
          }
        };
        
        return {
          url: '/v1/tasks',
          method: 'POST',
          body: taskRequest,
        };
      },
      transformResponse: transformTaskToUpload,
      invalidatesTags: ['Upload', { type: 'Task', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetTasksQuery,
  useGetTaskQuery,
  useCreateTaskMutation,
  useBatchCreateTasksMutation,
  useUpdateTaskMutation,
  usePauseTaskMutation,
  useResumeTaskMutation,
  useCancelTaskMutation,
  useRetryTaskMutation,
  useGetTaskProgressQuery,
  useScheduleTaskMutation,
  useGetTaskStatsQuery,
  // Backward compatibility exports
  useGetUploadsQuery,
  useCreateUploadMutation,
} = tasksApi;