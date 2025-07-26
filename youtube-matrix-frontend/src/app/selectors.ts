import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from './store';
import { selectAllAccounts } from '@/features/accounts/accountsSlice';
import { selectAllUploads } from '@/features/uploads/uploadsSlice';
import { selectAllTasks } from '@/features/tasks/tasksSlice';

// Auth selectors
export const selectCurrentUser = (state: RootState) => state.auth.user;
export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated;
export const selectAuthLoading = (state: RootState) => state.auth.loadingState === 'loading';

// Dashboard selectors
export const selectDashboardMetrics = (state: RootState) => state.dashboard.metrics;
export const selectDashboardAlerts = (state: RootState) => state.dashboard.alerts;
export const selectUnacknowledgedAlerts = createSelector([selectDashboardAlerts], (alerts) =>
  alerts.filter((alert) => !alert.acknowledged),
);

// Account selectors with filtering
export const selectFilteredAccounts = createSelector(
  [selectAllAccounts, (state: RootState) => state.accounts.filter],
  (accounts, filter) => {
    let filtered = accounts;

    if (filter.status !== 'all') {
      filtered = filtered.filter((account) => account.status === filter.status);
    }

    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      filtered = filtered.filter(
        (account) =>
          account.username.toLowerCase().includes(searchLower) ||
          account.email.toLowerCase().includes(searchLower),
      );
    }

    return filtered;
  },
);

export const selectActiveAccounts = createSelector([selectAllAccounts], (accounts) =>
  accounts.filter((account) => account.status === 'active'),
);

// Upload selectors with filtering
export const selectFilteredUploads = createSelector(
  [selectAllUploads, (state: RootState) => state.uploads.filter],
  (uploads, filter) => {
    let filtered = uploads;

    if (filter.status !== 'all') {
      filtered = filtered.filter((upload) => upload.status === filter.status);
    }

    if (filter.accountId) {
      filtered = filtered.filter((upload) => upload.accountId === filter.accountId);
    }

    if (filter.dateRange.start) {
      filtered = filtered.filter(
        (upload) => new Date(upload.createdAt) >= new Date(filter.dateRange.start),
      );
    }

    if (filter.dateRange.end) {
      filtered = filtered.filter(
        (upload) => new Date(upload.createdAt) <= new Date(filter.dateRange.end),
      );
    }

    return filtered;
  },
);

export const selectActiveUploads = createSelector([selectAllUploads], (uploads) =>
  uploads.filter((upload) => upload.status === 'uploading' || upload.status === 'processing'),
);

// Task selectors with filtering
export const selectFilteredTasks = createSelector(
  [selectAllTasks, (state: RootState) => state.tasks.filter],
  (tasks, filter) => {
    let filtered = tasks;

    if (filter.status !== 'all') {
      filtered = filtered.filter((task) => task.status === filter.status);
    }

    if (filter.type !== 'all') {
      filtered = filtered.filter((task) => task.type === filter.type);
    }

    if (filter.accountId) {
      filtered = filtered.filter((task) => task.accountId === filter.accountId);
    }

    if (filter.dateRange.start) {
      filtered = filtered.filter(
        (task) => new Date(task.createdAt) >= new Date(filter.dateRange.start),
      );
    }

    if (filter.dateRange.end) {
      filtered = filtered.filter(
        (task) => new Date(task.createdAt) <= new Date(filter.dateRange.end),
      );
    }

    return filtered;
  },
);

export const selectPendingTasks = createSelector([selectAllTasks], (tasks) =>
  tasks.filter((task) => task.status === 'pending'),
);

export const selectRunningTasks = createSelector([selectAllTasks], (tasks) =>
  tasks.filter((task) => task.status === 'running'),
);

// Settings selectors
export const selectSettings = (state: RootState) => state.settings.settings;
export const selectHasUnsavedSettings = (state: RootState) => state.settings.hasUnsavedChanges;

// Monitoring selectors
export const selectPerformanceMetrics = (state: RootState) => state.monitoring.performanceMetrics;
export const selectUploadStatistics = (state: RootState) => state.monitoring.uploadStatistics;
export const selectMonitoringTimeRange = (state: RootState) => state.monitoring.timeRange;
