import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import LoadingScreen from '@/components/common/LoadingScreen';
import PrivateRoute from '@/components/auth/PrivateRoute';

// Lazy load pages for code splitting
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const AccountsPage = lazy(() => import('@/pages/AccountsPage'));
const UploadsPage = lazy(() => import('@/pages/UploadsPage'));
const TasksPage = lazy(() => import('@/pages/TasksPage'));
const MonitoringPage = lazy(() => import('@/pages/MonitoringPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

// Layout components
const MainLayout = lazy(() => import('@/components/layout/MainLayout'));

const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: '/',
    element: (
      <PrivateRoute>
        <Suspense fallback={<LoadingScreen />}>
          <MainLayout />
        </Suspense>
      </PrivateRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: (
          <Suspense fallback={<LoadingScreen />}>
            <DashboardPage />
          </Suspense>
        ),
      },
      {
        path: 'accounts',
        element: (
          <Suspense fallback={<LoadingScreen />}>
            <AccountsPage />
          </Suspense>
        ),
      },
      {
        path: 'uploads',
        element: (
          <Suspense fallback={<LoadingScreen />}>
            <UploadsPage />
          </Suspense>
        ),
      },
      {
        path: 'tasks',
        element: (
          <Suspense fallback={<LoadingScreen />}>
            <TasksPage />
          </Suspense>
        ),
      },
      {
        path: 'monitoring',
        element: (
          <Suspense fallback={<LoadingScreen />}>
            <MonitoringPage />
          </Suspense>
        ),
      },
      {
        path: 'settings',
        element: (
          <Suspense fallback={<LoadingScreen />}>
            <SettingsPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: '*',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <NotFoundPage />
      </Suspense>
    ),
  },
]);

export default router;
