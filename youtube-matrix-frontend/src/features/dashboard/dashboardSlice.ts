import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { LoadingState } from '@/types';

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
}

interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

interface DashboardState {
  metrics: DashboardMetrics | null;
  alerts: Alert[];
  loadingState: LoadingState;
  error: string | null;
  lastUpdated: string | null;
}

const initialState: DashboardState = {
  metrics: null,
  alerts: [],
  loadingState: 'idle',
  error: null,
  lastUpdated: null,
};

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    fetchMetricsStart: (state) => {
      state.loadingState = 'loading';
      state.error = null;
    },
    fetchMetricsSuccess: (state, action: PayloadAction<DashboardMetrics>) => {
      state.metrics = action.payload;
      state.loadingState = 'succeeded';
      state.error = null;
      state.lastUpdated = new Date().toISOString();
    },
    fetchMetricsFailure: (state, action: PayloadAction<string>) => {
      state.loadingState = 'failed';
      state.error = action.payload;
    },
    updateMetrics: (state, action: PayloadAction<Partial<DashboardMetrics>>) => {
      if (state.metrics) {
        state.metrics = { ...state.metrics, ...action.payload };
        state.lastUpdated = new Date().toISOString();
      }
    },
    setAlerts: (state, action: PayloadAction<Alert[]>) => {
      state.alerts = action.payload;
    },
    addAlert: (state, action: PayloadAction<Alert>) => {
      state.alerts.unshift(action.payload);
    },
    acknowledgeAlert: (state, action: PayloadAction<string>) => {
      const alert = state.alerts.find((a) => a.id === action.payload);
      if (alert) {
        alert.acknowledged = true;
      }
    },
    removeAlert: (state, action: PayloadAction<string>) => {
      state.alerts = state.alerts.filter((a) => a.id !== action.payload);
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  fetchMetricsStart,
  fetchMetricsSuccess,
  fetchMetricsFailure,
  updateMetrics,
  setAlerts,
  addAlert,
  acknowledgeAlert,
  removeAlert,
  clearError,
} = dashboardSlice.actions;

export default dashboardSlice.reducer;
