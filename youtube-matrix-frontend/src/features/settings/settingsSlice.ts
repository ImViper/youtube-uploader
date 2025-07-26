import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { LoadingState } from '@/types';

export interface Settings {
  upload: {
    defaultPrivacy: 'public' | 'unlisted' | 'private';
    defaultCategory: string;
    defaultLanguage: string;
    enableNotifications: boolean;
    autoRetry: boolean;
    maxRetries: number;
    retryDelay: number; // in seconds
  };
  queue: {
    maxConcurrentUploads: number;
    uploadRateLimit: number; // uploads per hour
    priorityStrategy: 'fifo' | 'lifo' | 'priority' | 'roundRobin';
    pauseBetweenUploads: number; // in seconds
  };
  system: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    timezone: string;
    dateFormat: string;
    enableDebugMode: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
  };
  notifications: {
    uploadComplete: boolean;
    uploadFailed: boolean;
    accountError: boolean;
    systemAlert: boolean;
    emailNotifications: boolean;
    notificationEmail?: string;
  };
  security: {
    sessionTimeout: number; // in minutes
    requirePassword: boolean;
    twoFactorEnabled: boolean;
    ipWhitelist: string[];
  };
}

interface SettingsState {
  settings: Settings | null;
  loadingState: LoadingState;
  error: string | null;
  hasUnsavedChanges: boolean;
}

const initialState: SettingsState = {
  settings: null,
  loadingState: 'idle',
  error: null,
  hasUnsavedChanges: false,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    fetchSettingsStart: (state) => {
      state.loadingState = 'loading';
      state.error = null;
    },
    fetchSettingsSuccess: (state, action: PayloadAction<Settings>) => {
      state.settings = action.payload;
      state.loadingState = 'succeeded';
      state.error = null;
      state.hasUnsavedChanges = false;
    },
    fetchSettingsFailure: (state, action: PayloadAction<string>) => {
      state.loadingState = 'failed';
      state.error = action.payload;
    },
    updateSettings: (state, action: PayloadAction<Partial<Settings>>) => {
      if (state.settings) {
        state.settings = {
          ...state.settings,
          ...action.payload,
          upload: { ...state.settings.upload, ...action.payload.upload },
          queue: { ...state.settings.queue, ...action.payload.queue },
          system: { ...state.settings.system, ...action.payload.system },
          notifications: { ...state.settings.notifications, ...action.payload.notifications },
          security: { ...state.settings.security, ...action.payload.security },
        };
        state.hasUnsavedChanges = true;
      }
    },
    saveSettingsStart: (state) => {
      state.loadingState = 'loading';
      state.error = null;
    },
    saveSettingsSuccess: (state) => {
      state.loadingState = 'succeeded';
      state.hasUnsavedChanges = false;
    },
    saveSettingsFailure: (state, action: PayloadAction<string>) => {
      state.loadingState = 'failed';
      state.error = action.payload;
    },
    resetSettings: (state) => {
      state.settings = null;
      state.hasUnsavedChanges = false;
      state.error = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  fetchSettingsStart,
  fetchSettingsSuccess,
  fetchSettingsFailure,
  updateSettings,
  saveSettingsStart,
  saveSettingsSuccess,
  saveSettingsFailure,
  resetSettings,
  clearError,
} = settingsSlice.actions;

export default settingsSlice.reducer;
