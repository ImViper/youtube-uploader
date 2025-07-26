import { baseApi } from '@/services/baseApi';

interface DashboardMetrics {
  totalAccounts: number;
  activeAccounts: number;
  totalUploads: number;
  successfulUploads: number;
  failedUploads: number;
  queuedUploads: number;
  uploadSuccessRate: number;
  averageUploadTime: number;
  systemLoad: number;
  memoryUsage: number;
  uploadsLast24Hours: Array<{
    hour: string;
    count: number;
  }>;
  uploadDistribution: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
}

interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  metadata?: Record<string, any>;
}

interface AlertsResponse {
  alerts: Alert[];
  unacknowledgedCount: number;
}

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardMetrics: builder.query<DashboardMetrics, void>({
      query: () => '/dashboard/metrics',
      providesTags: ['Dashboard'],
    }),

    getDashboardAlerts: builder.query<AlertsResponse, { limit?: number }>({
      query: (params) => ({
        url: '/dashboard/alerts',
        params,
      }),
      providesTags: ['Dashboard'],
    }),

    acknowledgeAlert: builder.mutation<Alert, string>({
      query: (id) => ({
        url: `/dashboard/alerts/${id}/acknowledge`,
        method: 'POST',
      }),
      invalidatesTags: ['Dashboard'],
    }),

    dismissAlert: builder.mutation<void, string>({
      query: (id) => ({
        url: `/dashboard/alerts/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Dashboard'],
    }),

    batchAcknowledgeAlerts: builder.mutation<void, string[]>({
      query: (ids) => ({
        url: '/dashboard/alerts/batch/acknowledge',
        method: 'POST',
        body: { ids },
      }),
      invalidatesTags: ['Dashboard'],
    }),
  }),
});

export const {
  useGetDashboardMetricsQuery,
  useGetDashboardAlertsQuery,
  useAcknowledgeAlertMutation,
  useDismissAlertMutation,
  useBatchAcknowledgeAlertsMutation,
} = dashboardApi;
