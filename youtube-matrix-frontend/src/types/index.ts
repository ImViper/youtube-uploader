// Common type definitions
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
  lastLoginAt?: string;
}

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type LoadingState = 'idle' | 'loading' | 'succeeded' | 'failed';

export interface ErrorState {
  message: string;
  code?: string;
  details?: any;
}

export interface ErrorResponse {
  message: string;
  error?: string;
  statusCode?: number;
  details?: any;
}
