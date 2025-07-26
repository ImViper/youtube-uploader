import { baseApi } from '@/services/baseApi';
import type { Settings } from './settingsSlice';
import type { ApiResponse } from '@/types';

interface UpdateSettingsRequest {
  upload?: Partial<Settings['upload']>;
  queue?: Partial<Settings['queue']>;
  system?: Partial<Settings['system']>;
  notifications?: Partial<Settings['notifications']>;
  security?: Partial<Settings['security']>;
}

interface TestEmailRequest {
  email: string;
}

interface BackupSettingsResponse {
  backupId: string;
  timestamp: string;
  size: number;
}

interface RestoreSettingsRequest {
  backupId: string;
}

export const settingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSettings: builder.query<Settings, void>({
      query: () => '/settings',
      providesTags: ['Settings'],
    }),

    updateSettings: builder.mutation<Settings, UpdateSettingsRequest>({
      query: (body) => ({
        url: '/settings',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Settings'],
    }),

    resetSettings: builder.mutation<Settings, { section?: keyof Settings }>({
      query: (params) => ({
        url: '/settings/reset',
        method: 'POST',
        params,
      }),
      invalidatesTags: ['Settings'],
    }),

    testEmailNotification: builder.mutation<ApiResponse, TestEmailRequest>({
      query: (body) => ({
        url: '/settings/test-email',
        method: 'POST',
        body,
      }),
    }),

    backupSettings: builder.mutation<BackupSettingsResponse, void>({
      query: () => ({
        url: '/settings/backup',
        method: 'POST',
      }),
    }),

    getSettingsBackups: builder.query<
      Array<{
        backupId: string;
        timestamp: string;
        size: number;
        description?: string;
      }>,
      void
    >({
      query: () => '/settings/backups',
    }),

    restoreSettings: builder.mutation<Settings, RestoreSettingsRequest>({
      query: (body) => ({
        url: '/settings/restore',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Settings'],
    }),

    exportSettings: builder.query<Blob, { format: 'json' | 'yaml' }>({
      query: (params) => ({
        url: '/settings/export',
        params,
        responseHandler: (response) => response.blob(),
      }),
    }),

    importSettings: builder.mutation<Settings, { file: File }>({
      query: ({ file }) => {
        const formData = new FormData();
        formData.append('file', file);

        return {
          url: '/settings/import',
          method: 'POST',
          body: formData,
        };
      },
      invalidatesTags: ['Settings'],
    }),
  }),
});

export const {
  useGetSettingsQuery,
  useUpdateSettingsMutation,
  useResetSettingsMutation,
  useTestEmailNotificationMutation,
  useBackupSettingsMutation,
  useGetSettingsBackupsQuery,
  useRestoreSettingsMutation,
  useLazyExportSettingsQuery,
  useImportSettingsMutation,
} = settingsApi;
