// This file now re-exports from tasksApi for backward compatibility
// All upload operations are actually tasks with type='upload'
export * from '../tasks/tasksApi';
import { tasksApi } from '../tasks/tasksApi';

// Re-export the backward compatibility functions
const {
  useGetUploadsQuery,
  useCreateUploadMutation,
} = tasksApi;

// Map old upload mutations to new task mutations
const useGetUploadQuery = (id: string) => {
  const result = tasksApi.useGetTaskQuery(id);
  return {
    ...result,
    data: result.data ? transformTaskToUploadFormat(result.data) : undefined,
  };
};

const useUpdateUploadMutation = () => {
  const [updateTask, result] = tasksApi.useUpdateTaskMutation();
  return [
    (params: { id: string; data: any }) => updateTask({
      id: params.id,
      data: {
        ...params.data,
        video: params.data,
      },
    }),
    result,
  ] as const;
};

const useCancelUploadMutation = () => tasksApi.useCancelTaskMutation();
const useRetryUploadMutation = () => tasksApi.useRetryTaskMutation();
const usePauseUploadMutation = () => tasksApi.usePauseTaskMutation();
const useResumeUploadMutation = () => tasksApi.useResumeTaskMutation();
const useDeleteUploadMutation = () => {
  // Note: Task API doesn't have delete, might need to implement or use cancel
  return tasksApi.useCancelTaskMutation();
};

// Transform function for backward compatibility
function transformTaskToUploadFormat(task: any) {
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

function mapTaskStatusToUploadStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'pending',
    'queued': 'pending',
    'processing': 'uploading',
    'completed': 'completed',
    'failed': 'failed',
    'cancelled': 'cancelled',
    'paused': 'paused'
  };
  return statusMap[status] || status;
}

// Batch upload is not directly supported in tasks API yet
// We'll need to implement a custom solution
const useBatchUploadMutation = () => {
  const [batchCreate] = tasksApi.useBatchCreateTasksMutation();
  
  return [
    async (params: any) => {
      const tasks = params.videos.map((video: any, index: number) => ({
        type: 'upload' as const,
        priority: 'normal' as const,
        accountId: params.accountIds[index % params.accountIds.length],
        video: {
          path: video.videoFile?.name || '',
          title: video.title,
          description: video.description,
          tags: video.tags,
          thumbnail: video.thumbnailFile?.name,
          publishType: (video.privacy?.toUpperCase() || 'PUBLIC') as any,
          language: video.language,
        },
        scheduledAt: video.scheduledAt,
      }));
      
      return batchCreate({ tasks });
    },
    {} // result object
  ] as const;
};

// Export all the hooks for backward compatibility
export {
  useGetUploadsQuery,
  useGetUploadQuery,
  useCreateUploadMutation,
  useBatchUploadMutation,
  useUpdateUploadMutation,
  useCancelUploadMutation,
  useRetryUploadMutation,
  usePauseUploadMutation,
  useResumeUploadMutation,
  useDeleteUploadMutation,
};

// Also export the uploadsApi object for backward compatibility
export const uploadsApi = {
  endpoints: {
    getUploads: { matchFulfilled: () => false },
    getUpload: { matchFulfilled: () => false },
    createUpload: { matchFulfilled: () => false },
    batchUpload: { matchFulfilled: () => false },
    updateUpload: { matchFulfilled: () => false },
    cancelUpload: { matchFulfilled: () => false },
    retryUpload: { matchFulfilled: () => false },
    deleteUpload: { matchFulfilled: () => false },
  },
};
