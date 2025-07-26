import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/authSlice';
import accountsReducer from '@/features/accounts/accountsSlice';
import uploadsReducer from '@/features/uploads/uploadsSlice';
import tasksReducer from '@/features/tasks/tasksSlice';
import dashboardReducer from '@/features/dashboard/dashboardSlice';
import monitoringReducer from '@/features/monitoring/monitoringSlice';
import settingsReducer from '@/features/settings/settingsSlice';
import { baseApi } from '@/services/baseApi';

const rootReducer = {
  auth: authReducer,
  accounts: accountsReducer,
  uploads: uploadsReducer,
  tasks: tasksReducer,
  dashboard: dashboardReducer,
  monitoring: monitoringReducer,
  settings: settingsReducer,
  [baseApi.reducerPath]: baseApi.reducer,
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['upload/uploadProgress', `${baseApi.reducerPath}/resetApiState`],
        // Ignore these paths in the state
        ignoredPaths: ['uploads.currentFile'],
      },
    }).concat(baseApi.middleware),
  devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
