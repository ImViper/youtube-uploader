import { baseApi } from '@/services/baseApi';
import type { ApiResponse, PaginatedResponse } from '@/types';
import type { Task } from './tasksSlice';

interface TasksQueryParams {
  page?: number;
  pageSize?: number;
  status?: Task['status'] | 'all';
  type?: Task['type'] | 'all';
  accountId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'createdAt' | 'priority' | 'status' | 'type';
  sortOrder?: 'asc' | 'desc';
}

interface RetryTaskRequest {
  id: string;
  options?: {
    priority?: Task['priority'];
    scheduledAt?: string;
  };
}

interface BatchRetryRequest {
  ids: string[];
  options?: {
    priority?: Task['priority'];
    scheduledAt?: string;
  };
}

interface TaskDetailsResponse extends Task {
  logs: Array<{
    timestamp: string;
    level: 'info' | 'warn' | 'error';
    message: string;
    details?: any;
  }>;
}

export const tasksApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getTasks: builder.query<PaginatedResponse<Task>, TasksQueryParams>({
      query: (params) => ({
        url: '/tasks',
        params,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ id }) => ({ type: 'Task' as const, id })),
              { type: 'Task', id: 'LIST' },
            ]
          : [{ type: 'Task', id: 'LIST' }],
    }),

    getTask: builder.query<TaskDetailsResponse, string>({
      query: (id) => `/tasks/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Task', id }],
    }),

    retryTask: builder.mutation<Task, RetryTaskRequest>({
      query: ({ id, options }) => ({
        url: `/tasks/${id}/retry`,
        method: 'POST',
        body: options,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Task', id },
        { type: 'Task', id: 'LIST' },
      ],
    }),

    batchRetryTasks: builder.mutation<Task[], BatchRetryRequest>({
      query: ({ ids, options }) => ({
        url: '/tasks/batch/retry',
        method: 'POST',
        body: { ids, ...options },
      }),
      invalidatesTags: [{ type: 'Task', id: 'LIST' }],
    }),

    cancelTask: builder.mutation<ApiResponse, string>({
      query: (id) => ({
        url: `/tasks/${id}/cancel`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Task', id },
        { type: 'Task', id: 'LIST' },
      ],
    }),

    batchCancelTasks: builder.mutation<ApiResponse, string[]>({
      query: (ids) => ({
        url: '/tasks/batch/cancel',
        method: 'POST',
        body: { ids },
      }),
      invalidatesTags: [{ type: 'Task', id: 'LIST' }],
    }),

    deleteTask: builder.mutation<ApiResponse, string>({
      query: (id) => ({
        url: `/tasks/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Task', id },
        { type: 'Task', id: 'LIST' },
      ],
    }),

    batchDeleteTasks: builder.mutation<ApiResponse, string[]>({
      query: (ids) => ({
        url: '/tasks/batch',
        method: 'DELETE',
        body: { ids },
      }),
      invalidatesTags: [{ type: 'Task', id: 'LIST' }],
    }),

    getTaskStats: builder.query<
      {
        total: number;
        byStatus: Record<Task['status'], number>;
        byType: Record<Task['type'], number>;
        failureRate: number;
        avgExecutionTime: number;
      },
      void
    >({
      query: () => '/tasks/stats',
      providesTags: ['Task'],
    }),
  }),
});

export const {
  useGetTasksQuery,
  useGetTaskQuery,
  useRetryTaskMutation,
  useBatchRetryTasksMutation,
  useCancelTaskMutation,
  useBatchCancelTasksMutation,
  useDeleteTaskMutation,
  useBatchDeleteTasksMutation,
  useGetTaskStatsQuery,
} = tasksApi;

// 导出兼容性函数
export const useDeleteTasksMutation = () => {
  return useBatchDeleteTasksMutation();
};

// 导出空的钩子函数以兼容
export const usePauseTaskMutation = () => {
  return [
    async (_id: string) => {
      console.warn('Pause task functionality not implemented');
      return { data: null };
    },
  ] as const;
};

export const useResumeTaskMutation = () => {
  return [
    async (_id: string) => {
      console.warn('Resume task functionality not implemented');
      return { data: null };
    },
  ] as const;
};
