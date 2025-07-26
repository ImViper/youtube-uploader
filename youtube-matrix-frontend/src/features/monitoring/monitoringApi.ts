import { baseApi } from '@/services/baseApi';

interface TimeSeriesData {
  timestamp: string;
  value: number;
}

interface PerformanceMetrics {
  cpu: TimeSeriesData[];
  memory: TimeSeriesData[];
  network: TimeSeriesData[];
  diskIO: TimeSeriesData[];
}

interface UploadStatistics {
  hourlyVolume: TimeSeriesData[];
  successRate: TimeSeriesData[];
  failureReasons: {
    reason: string;
    count: number;
    percentage: number;
  }[];
  accountPerformance: {
    accountId: string;
    username: string;
    uploadsCount: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    averageUploadTime: number;
  }[];
}

interface MonitoringQueryParams {
  timeRange: '1h' | '6h' | '24h' | '7d' | '30d';
  interval?: 'minute' | 'hour' | 'day';
}

interface ReportGenerationRequest {
  type: 'performance' | 'uploads' | 'accounts' | 'system';
  timeRange: '24h' | '7d' | '30d' | 'custom';
  format: 'pdf' | 'csv' | 'json';
  customDateRange?: {
    start: string;
    end: string;
  };
  filters?: {
    accountIds?: string[];
    uploadStatuses?: string[];
  };
}

export const monitoringApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPerformanceMetrics: builder.query<PerformanceMetrics, MonitoringQueryParams>({
      query: (params) => ({
        url: '/monitoring/performance',
        params,
      }),
      providesTags: ['Monitoring'],
    }),

    getUploadStatistics: builder.query<UploadStatistics, MonitoringQueryParams>({
      query: (params) => ({
        url: '/monitoring/statistics',
        params,
      }),
      providesTags: ['Monitoring'],
    }),

    getSystemHealth: builder.query<
      {
        status: 'healthy' | 'degraded' | 'critical';
        uptime: number;
        services: Array<{
          name: string;
          status: 'operational' | 'degraded' | 'down';
          responseTime: number;
          lastCheck: string;
        }>;
      },
      void
    >({
      query: () => '/monitoring/health',
      providesTags: ['Monitoring'],
    }),

    generateReport: builder.mutation<Blob, ReportGenerationRequest>({
      query: (body) => ({
        url: '/monitoring/reports/generate',
        method: 'POST',
        body,
        responseHandler: (response) => response.blob(),
      }),
    }),

    getScheduledReports: builder.query<
      Array<{
        id: string;
        name: string;
        type: string;
        schedule: string;
        recipients: string[];
        lastGenerated: string;
        nextGeneration: string;
      }>,
      void
    >({
      query: () => '/monitoring/reports/scheduled',
      providesTags: ['Monitoring'],
    }),

    createScheduledReport: builder.mutation<
      void,
      {
        name: string;
        type: string;
        schedule: string;
        recipients: string[];
        config: ReportGenerationRequest;
      }
    >({
      query: (body) => ({
        url: '/monitoring/reports/scheduled',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Monitoring'],
    }),

    deleteScheduledReport: builder.mutation<void, string>({
      query: (id) => ({
        url: `/monitoring/reports/scheduled/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Monitoring'],
    }),
  }),
});

export const {
  useGetPerformanceMetricsQuery,
  useGetUploadStatisticsQuery,
  useGetSystemHealthQuery,
  useGenerateReportMutation,
  useGetScheduledReportsQuery,
  useCreateScheduledReportMutation,
  useDeleteScheduledReportMutation,
} = monitoringApi;
