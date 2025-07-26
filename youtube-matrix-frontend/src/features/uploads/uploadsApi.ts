import { baseApi } from '@/services/baseApi';
import type { ApiResponse, PaginatedResponse } from '@/types';
import type { Upload } from './uploadsSlice';

interface UploadsQueryParams {
  page?: number;
  pageSize?: number;
  status?: Upload['status'] | 'all';
  accountId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'createdAt' | 'title' | 'status' | 'progress';
  sortOrder?: 'asc' | 'desc';
}

interface CreateUploadRequest {
  accountId: string;
  videoFile: File;
  title: string;
  description: string;
  tags: string[];
  thumbnailFile?: File;
  privacy?: 'public' | 'unlisted' | 'private';
  category?: string;
  language?: string;
  scheduledAt?: string;
}

interface BatchUploadRequest {
  accountIds: string[];
  videos: Array<{
    videoFile: File;
    title: string;
    description: string;
    tags: string[];
    thumbnailFile?: File;
    privacy?: 'public' | 'unlisted' | 'private';
    category?: string;
    language?: string;
    scheduledAt?: string;
  }>;
  distributionStrategy: 'roundRobin' | 'sequential' | 'random';
}

interface UpdateUploadRequest {
  id: string;
  data: {
    title?: string;
    description?: string;
    tags?: string[];
    privacy?: 'public' | 'unlisted' | 'private';
    category?: string;
    language?: string;
    scheduledAt?: string;
  };
}

export const uploadsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUploads: builder.query<PaginatedResponse<Upload>, UploadsQueryParams>({
      query: (params) => ({
        url: '/uploads',
        params,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ id }) => ({ type: 'Upload' as const, id })),
              { type: 'Upload', id: 'LIST' },
            ]
          : [{ type: 'Upload', id: 'LIST' }],
    }),

    getUpload: builder.query<Upload, string>({
      query: (id) => `/uploads/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Upload', id }],
    }),

    createUpload: builder.mutation<Upload, CreateUploadRequest>({
      query: (body) => {
        const formData = new FormData();
        formData.append('accountId', body.accountId);
        formData.append('videoFile', body.videoFile);
        formData.append('title', body.title);
        formData.append('description', body.description);
        formData.append('tags', JSON.stringify(body.tags));

        if (body.thumbnailFile) {
          formData.append('thumbnailFile', body.thumbnailFile);
        }
        if (body.privacy) {
          formData.append('privacy', body.privacy);
        }
        if (body.category) {
          formData.append('category', body.category);
        }
        if (body.language) {
          formData.append('language', body.language);
        }
        if (body.scheduledAt) {
          formData.append('scheduledAt', body.scheduledAt);
        }

        return {
          url: '/uploads',
          method: 'POST',
          body: formData,
        };
      },
      invalidatesTags: [{ type: 'Upload', id: 'LIST' }],
    }),

    batchUpload: builder.mutation<Upload[], BatchUploadRequest>({
      query: (body) => {
        const formData = new FormData();
        formData.append('accountIds', JSON.stringify(body.accountIds));
        formData.append('distributionStrategy', body.distributionStrategy);

        body.videos.forEach((video, index) => {
          formData.append(`videos[${index}][videoFile]`, video.videoFile);
          formData.append(`videos[${index}][title]`, video.title);
          formData.append(`videos[${index}][description]`, video.description);
          formData.append(`videos[${index}][tags]`, JSON.stringify(video.tags));

          if (video.thumbnailFile) {
            formData.append(`videos[${index}][thumbnailFile]`, video.thumbnailFile);
          }
          if (video.privacy) {
            formData.append(`videos[${index}][privacy]`, video.privacy);
          }
          if (video.category) {
            formData.append(`videos[${index}][category]`, video.category);
          }
          if (video.language) {
            formData.append(`videos[${index}][language]`, video.language);
          }
          if (video.scheduledAt) {
            formData.append(`videos[${index}][scheduledAt]`, video.scheduledAt);
          }
        });

        return {
          url: '/uploads/batch',
          method: 'POST',
          body: formData,
        };
      },
      invalidatesTags: [{ type: 'Upload', id: 'LIST' }],
    }),

    updateUpload: builder.mutation<Upload, UpdateUploadRequest>({
      query: ({ id, data }) => ({
        url: `/uploads/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Upload', id },
        { type: 'Upload', id: 'LIST' },
      ],
    }),

    cancelUpload: builder.mutation<ApiResponse, string>({
      query: (id) => ({
        url: `/uploads/${id}/cancel`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Upload', id },
        { type: 'Upload', id: 'LIST' },
      ],
    }),

    retryUpload: builder.mutation<Upload, string>({
      query: (id) => ({
        url: `/uploads/${id}/retry`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Upload', id },
        { type: 'Upload', id: 'LIST' },
      ],
    }),

    deleteUpload: builder.mutation<ApiResponse, string>({
      query: (id) => ({
        url: `/uploads/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Upload', id },
        { type: 'Upload', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetUploadsQuery,
  useGetUploadQuery,
  useCreateUploadMutation,
  useBatchUploadMutation,
  useUpdateUploadMutation,
  useCancelUploadMutation,
  useRetryUploadMutation,
  useDeleteUploadMutation,
} = uploadsApi;
