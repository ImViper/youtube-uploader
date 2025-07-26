import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { STORAGE_KEYS } from '@/constants/storage';
import type { ErrorResponse } from '@/types';
import { notification } from 'antd';
import { logout } from '@/features/auth/authSlice';

// Determine API URL based on environment
// @ts-ignore - import.meta may not be available in test environment
const baseUrl = (typeof window !== 'undefined' && window.__VITE_API_URL__) || 
  (typeof process !== 'undefined' && process.env.VITE_API_URL) || 
  'http://localhost:3000/api';

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
const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);

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