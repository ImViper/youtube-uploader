import type { ComponentType } from 'react';
import { lazyLoadWithRetry } from './lazyLoad';

/**
 * Route configuration with code splitting
 */
export interface RouteConfig {
  path: string;
  component: ComponentType<any>;
  preload?: boolean;
  exact?: boolean;
  children?: RouteConfig[];
}

/**
 * Define lazy-loaded routes
 */
export const lazyRoutes = {
  // Main pages
  Dashboard: lazyLoadWithRetry(() => import('@/pages/DashboardPage')),
  Accounts: lazyLoadWithRetry(() => import('@/pages/AccountsPage')),
  Upload: lazyLoadWithRetry(() => import('@/pages/UploadsPage')),
  Tasks: lazyLoadWithRetry(() => import('@/pages/TasksPage')),
  Monitoring: lazyLoadWithRetry(() => import('@/pages/MonitoringPage')),
  Settings: lazyLoadWithRetry(() => import('@/pages/SettingsPage')),

  // Auth pages
  Login: lazyLoadWithRetry(() => import('@/pages/LoginPage')),

  // Error pages
  NotFound: lazyLoadWithRetry(() => import('@/pages/NotFoundPage')),
  ServerError: lazyLoadWithRetry(() => import('@/pages/NotFoundPage')), // 使用同一个错误页面
  Forbidden: lazyLoadWithRetry(() => import('@/pages/NotFoundPage')), // 使用同一个错误页面
};

/**
 * Preload critical routes
 */
export const preloadCriticalRoutes = () => {
  // Preload dashboard as it's likely the first page users will see
  import('@/pages/DashboardPage');

  // Preload other critical routes after a delay
  setTimeout(() => {
    import('@/pages/AccountsPage');
    import('@/pages/UploadsPage');
  }, 2000);
};

/**
 * Route-based code splitting configuration
 */
export const routeConfig: RouteConfig[] = [
  {
    path: '/',
    component: lazyRoutes.Dashboard,
    exact: true,
    preload: true,
  },
  {
    path: '/accounts',
    component: lazyRoutes.Accounts,
    exact: true,
  },
  {
    path: '/upload',
    component: lazyRoutes.Upload,
    exact: true,
  },
  {
    path: '/tasks',
    component: lazyRoutes.Tasks,
    exact: true,
  },
  {
    path: '/monitoring',
    component: lazyRoutes.Monitoring,
    exact: true,
  },
  {
    path: '/settings',
    component: lazyRoutes.Settings,
    exact: true,
  },
  {
    path: '/login',
    component: lazyRoutes.Login,
    exact: true,
  },
  {
    path: '/403',
    component: lazyRoutes.Forbidden,
    exact: true,
  },
  {
    path: '/500',
    component: lazyRoutes.ServerError,
    exact: true,
  },
  {
    path: '*',
    component: lazyRoutes.NotFound,
  },
];

/**
 * Component-level code splitting for heavy components
 */
export const lazyComponents = {
  // Heavy chart components
  PerformanceCharts: lazyLoadWithRetry(() => import('@/components/monitoring/PerformanceCharts')),
  UploadStatistics: lazyLoadWithRetry(() => import('@/components/monitoring/UploadStatistics')),

  // Forms
  AccountForm: lazyLoadWithRetry(() => import('@/features/accounts/components/AccountFormModal')),
  VideoDropzone: lazyLoadWithRetry(() => import('@/features/uploads/components/VideoDropzone')),

  // Tables
  AccountList: lazyLoadWithRetry(() => import('@/features/accounts/components/AccountList')),
  TaskList: lazyLoadWithRetry(() => import('@/features/tasks/components/TaskList')),
};

/**
 * Webpack magic comments for better code splitting
 */
export const webpackChunkNames = {
  dashboard: /* webpackChunkName: "dashboard" */ '@/pages/Dashboard',
  accounts: /* webpackChunkName: "accounts" */ '@/pages/Accounts',
  upload: /* webpackChunkName: "upload" */ '@/pages/Upload',
  tasks: /* webpackChunkName: "tasks" */ '@/pages/Tasks',
  monitoring: /* webpackChunkName: "monitoring" */ '@/pages/Monitoring',
  settings: /* webpackChunkName: "settings" */ '@/pages/Settings',
  auth: /* webpackChunkName: "auth" */ '@/pages/Login',
  errors: /* webpackChunkName: "errors" */ '@/pages/404',
};
