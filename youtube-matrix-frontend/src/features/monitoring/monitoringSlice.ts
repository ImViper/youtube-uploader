import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { LoadingState } from '@/types';
import type { RootState } from '@/app/store';

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

interface MonitoringState {
  performanceMetrics: PerformanceMetrics | null;
  uploadStatistics: UploadStatistics | null;
  loadingState: LoadingState;
  error: string | null;
  timeRange: '1h' | '6h' | '24h' | '7d' | '30d';
  refreshInterval: number; // in seconds
  lastUpdated: string | null;
}

const initialState: MonitoringState = {
  performanceMetrics: null,
  uploadStatistics: null,
  loadingState: 'idle',
  error: null,
  timeRange: '24h',
  refreshInterval: 60, // 1 minute
  lastUpdated: null,
};

const monitoringSlice = createSlice({
  name: 'monitoring',
  initialState,
  reducers: {
    fetchMetricsStart: (state) => {
      state.loadingState = 'loading';
      state.error = null;
    },
    fetchPerformanceMetricsSuccess: (state, action: PayloadAction<PerformanceMetrics>) => {
      state.performanceMetrics = action.payload;
      state.loadingState = 'succeeded';
      state.error = null;
      state.lastUpdated = new Date().toISOString();
    },
    fetchUploadStatisticsSuccess: (state, action: PayloadAction<UploadStatistics>) => {
      state.uploadStatistics = action.payload;
      state.loadingState = 'succeeded';
      state.error = null;
      state.lastUpdated = new Date().toISOString();
    },
    fetchMetricsFailure: (state, action: PayloadAction<string>) => {
      state.loadingState = 'failed';
      state.error = action.payload;
    },
    updatePerformanceMetric: (
      state,
      action: PayloadAction<{ metric: keyof PerformanceMetrics; data: TimeSeriesData }>,
    ) => {
      if (state.performanceMetrics) {
        const { metric, data } = action.payload;
        state.performanceMetrics[metric].push(data);
        // Keep only the latest data points based on time range
        const maxPoints = 100;
        if (state.performanceMetrics[metric].length > maxPoints) {
          state.performanceMetrics[metric] = state.performanceMetrics[metric].slice(-maxPoints);
        }
      }
    },
    setTimeRange: (state, action: PayloadAction<MonitoringState['timeRange']>) => {
      state.timeRange = action.payload;
    },
    setRefreshInterval: (state, action: PayloadAction<number>) => {
      state.refreshInterval = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  fetchMetricsStart,
  fetchPerformanceMetricsSuccess,
  fetchUploadStatisticsSuccess,
  fetchMetricsFailure,
  updatePerformanceMetric,
  setTimeRange,
  setRefreshInterval,
  clearError,
} = monitoringSlice.actions;

export default monitoringSlice.reducer;

// Selectors
export const selectMonitoring = (state: RootState) => state.monitoring;
export const selectPerformanceMetrics = (state: RootState) => state.monitoring.performanceMetrics;
export const selectUploadStatistics = (state: RootState) => state.monitoring.uploadStatistics;
export const selectMonitoringLoadingState = (state: RootState) => state.monitoring.loadingState;
export const selectMonitoringError = (state: RootState) => state.monitoring.error;
export const selectTimeRange = (state: RootState) => state.monitoring.timeRange;
export const selectRefreshInterval = (state: RootState) => state.monitoring.refreshInterval;
export const selectLastUpdated = (state: RootState) => state.monitoring.lastUpdated;

// System metrics selector with default values
export const selectSystemMetrics = (state: RootState) => {
  const metrics = state.monitoring.performanceMetrics;
  return {
    cpu: metrics?.cpu || [],
    memory: metrics?.memory || [],
    network: metrics?.network || [],
    diskIO: metrics?.diskIO || [],
  };
};
