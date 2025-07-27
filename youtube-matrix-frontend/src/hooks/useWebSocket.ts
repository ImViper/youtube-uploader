import { useEffect, useCallback, useRef } from 'react';
import { useAppDispatch } from '@/app/hooks';
import websocketService from '@/services/websocket';
import { WS_EVENTS } from '@/utils/constants';
import { updateProgress as updateUploadProgress } from '@/features/uploads/uploadsSlice';
import { updateTask } from '@/features/tasks/tasksSlice';
import { updateMetrics, addAlert } from '@/features/dashboard/dashboardSlice';
import type { Task } from '@/features/tasks/tasksSlice';

interface UploadProgressEvent {
  id: string;
  progress: number;
  uploadSpeed?: number;
  timeRemaining?: number;
}

interface TaskUpdateEvent {
  id: string;
  status: Task['status'];
  progress?: number;
  error?: string;
  result?: any;
}

interface MetricsUpdateEvent {
  totalUploads?: number;
  successfulUploads?: number;
  failedUploads?: number;
  queuedUploads?: number;
  uploadSuccessRate?: number;
  systemLoad?: number;
  memoryUsage?: number;
}

interface SystemAlertEvent {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
}

export const useWebSocket = () => {
  const dispatch = useAppDispatch();
  const handlersRef = useRef<Map<string, (...args: any[]) => void>>(new Map());

  const handleUploadProgress = useCallback(
    (data: UploadProgressEvent) => {
      dispatch(
        updateUploadProgress({
          id: data.id,
          progress: data.progress,
          uploadSpeed: data.uploadSpeed,
          timeRemaining: data.timeRemaining,
        }),
      );
    },
    [dispatch],
  );

  const handleTaskUpdate = useCallback(
    (data: TaskUpdateEvent) => {
      dispatch(
        updateTask({
          id: data.id,
          changes: {
            status: data.status,
            progress: data.progress,
            error: data.error,
            result: data.result,
          },
        }),
      );
    },
    [dispatch],
  );

  const handleMetricsUpdate = useCallback(
    (data: MetricsUpdateEvent) => {
      dispatch(updateMetrics(data));
    },
    [dispatch],
  );

  const handleSystemAlert = useCallback(
    (data: SystemAlertEvent) => {
      dispatch(
        addAlert({
          ...data,
          acknowledged: false,
        }),
      );
    },
    [dispatch],
  );

  useEffect(() => {
    // Connect to WebSocket only if token exists
    const token = localStorage.getItem('authToken');
    if (token) {
      websocketService.connect();
    }

    // Setup event handlers
    const handlers = new Map<string, (...args: any[]) => void>([
      [WS_EVENTS.UPLOAD_PROGRESS, handleUploadProgress],
      [WS_EVENTS.TASK_UPDATE, handleTaskUpdate],
      [WS_EVENTS.METRICS_UPDATE, handleMetricsUpdate],
      [WS_EVENTS.SYSTEM_ALERT, handleSystemAlert],
    ]);

    // Register handlers
    handlers.forEach((handler, event) => {
      websocketService.on(event, handler);
    });

    // Store handlers ref for cleanup
    handlersRef.current = handlers;

    // Cleanup on unmount
    return () => {
      handlers.forEach((handler, event) => {
        websocketService.off(event, handler);
      });
    };
  }, [handleUploadProgress, handleTaskUpdate, handleMetricsUpdate, handleSystemAlert]);

  const emit = useCallback((event: string, data?: any) => {
    websocketService.emit(event, data);
  }, []);

  const subscribe = useCallback((event: string, handler: (...args: any[]) => void) => {
    websocketService.on(event, handler);
  }, []);

  const unsubscribe = useCallback((event: string, handler: (...args: any[]) => void) => {
    websocketService.off(event, handler);
  }, []);

  const isConnected = websocketService.isConnected();

  return {
    emit,
    subscribe,
    unsubscribe,
    isConnected,
  };
};
