// API endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    ME: '/auth/me',
  },
  ACCOUNTS: {
    LIST: '/accounts',
    DETAIL: (id: string) => `/accounts/${id}`,
    CREATE: '/accounts',
    UPDATE: (id: string) => `/accounts/${id}`,
    DELETE: (id: string) => `/accounts/${id}`,
    IMPORT: '/accounts/import',
    EXPORT: '/accounts/export',
  },
  UPLOADS: {
    LIST: '/uploads',
    CREATE: '/uploads',
    DETAIL: (id: string) => `/uploads/${id}`,
    CANCEL: (id: string) => `/uploads/${id}/cancel`,
    RETRY: (id: string) => `/uploads/${id}/retry`,
  },
  TASKS: {
    LIST: '/tasks',
    DETAIL: (id: string) => `/tasks/${id}`,
    RETRY: (id: string) => `/tasks/${id}/retry`,
    CANCEL: (id: string) => `/tasks/${id}/cancel`,
  },
  DASHBOARD: {
    METRICS: '/dashboard/metrics',
    ALERTS: '/dashboard/alerts',
  },
  MONITORING: {
    PERFORMANCE: '/monitoring/performance',
    STATISTICS: '/monitoring/statistics',
  },
  SETTINGS: {
    GET: '/settings',
    UPDATE: '/settings',
  },
} as const;

// WebSocket events
export const WS_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',

  // Upload events
  UPLOAD_PROGRESS: 'upload:progress',
  UPLOAD_COMPLETE: 'upload:complete',
  UPLOAD_ERROR: 'upload:error',

  // Task events
  TASK_UPDATE: 'task:update',
  TASK_COMPLETE: 'task:complete',
  TASK_ERROR: 'task:error',

  // System events
  SYSTEM_ALERT: 'system:alert',
  METRICS_UPDATE: 'metrics:update',
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'youtube_matrix_auth_token',
  REFRESH_TOKEN: 'youtube_matrix_refresh_token',
  USER_PREFERENCES: 'youtube_matrix_user_preferences',
  SIDEBAR_COLLAPSED: 'youtube_matrix_sidebar_collapsed',
} as const;

// UI constants
export const UI = {
  PAGE_SIZE: 20,
  DEBOUNCE_DELAY: 300,
  NOTIFICATION_DURATION: 4,
  MAX_FILE_SIZE: 5 * 1024 * 1024 * 1024, // 5GB
  SUPPORTED_VIDEO_FORMATS: ['.mp4', '.avi', '.mov', '.mkv', '.webm'],
  SUPPORTED_IMAGE_FORMATS: ['.jpg', '.jpeg', '.png', '.webp'],
} as const;
