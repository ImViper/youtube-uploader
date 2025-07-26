import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { STORAGE_KEYS } from '@/constants/storage';
import type { ErrorResponse } from '@/types';
import { notification } from 'antd';
import { logout } from '@/features/auth/authSlice';

// Determine API URL based on environment
// @ts-ignore - import.meta may not be available in test environment
const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5989/api';

const baseQuery = fetchBaseQuery({
  baseUrl,
  prepareHeaders: (headers) => {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

// Enhanced base query with automatic error handling
const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  const result = await baseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    // Clear auth state and redirect to login
    api.dispatch(logout());
    window.location.href = '/login';
  }

  if (result.error && typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
    const error = result.error as FetchBaseQueryError & { data?: ErrorResponse };
    notification.error({
      message: 'API Error',
      description: error.data?.message || 'An unexpected error occurred',
    });
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Auth', 'Account', 'Upload', 'Task', 'Dashboard', 'Monitoring', 'Settings'],
  endpoints: () => ({}),
});

// Export the resetApiState action from RTK Query util
export const { resetApiState } = baseApi.util;
