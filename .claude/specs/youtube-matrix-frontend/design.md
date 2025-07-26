# Design Document

## Overview

The YouTube Matrix Upload Frontend is a modern React-based web application that provides a comprehensive user interface for managing multi-account YouTube video uploads. Built with React 18, TypeScript, Redux Toolkit, and Ant Design 5.0, the application follows industry best practices for scalability, maintainability, and performance.

The system integrates with the existing YouTube Matrix Upload backend through RESTful APIs and WebSocket connections for real-time updates. The frontend emphasizes user experience with responsive design, real-time monitoring, and efficient batch operations.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Frontend Application                     │
│                    (React 18 SPA)                        │
├─────────────────────────────────────────────────────────┤
│                  State Management                         │
│              (Redux Toolkit + RTK Query)                 │
├────────────────┬────────────────┬───────────────────────┤
│   HTTP API     │   WebSocket    │    File Upload       │
│  (RTK Query)   │  (Socket.io)   │     (Multer)         │
└────────────────┴────────────────┴───────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   API Gateway                            │
│                    (Nginx)                               │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Express API Server                          │
│         (Existing Matrix Upload Backend)                 │
└─────────────────────────────────────────────────────────┘
```

### Frontend Architecture Pattern

The application follows a feature-based modular architecture with clear separation of concerns:

```
src/
├── app/                    # Application core
│   ├── store.ts           # Redux store configuration
│   ├── hooks.ts           # Custom hooks
│   └── App.tsx            # Root component
├── features/              # Feature modules
│   ├── auth/             # Authentication
│   ├── dashboard/        # Dashboard
│   ├── accounts/         # Account management
│   ├── uploads/          # Video uploads
│   ├── tasks/            # Task management
│   ├── monitoring/       # Analytics
│   └── settings/         # System settings
├── components/           # Shared components
│   ├── common/          # Generic components
│   └── layout/          # Layout components
├── services/            # API and WebSocket services
├── utils/               # Utility functions
├── styles/              # Global styles
└── types/               # TypeScript definitions
```

### State Management Architecture

Using Redux Toolkit with RTK Query for efficient data fetching and caching:

```typescript
interface RootState {
  auth: AuthState;
  accounts: AccountsState;
  uploads: UploadsState;
  tasks: TasksState;
  monitoring: MonitoringState;
  ui: UIState;
  api: RTKQueryState; // Managed by RTK Query
}
```

### Real-time Updates Architecture

WebSocket integration for live updates using Socket.io with RTK Query streaming:

```typescript
interface WebSocketEvents {
  // System events
  'metrics:update': (metrics: SystemMetrics) => void;
  'health:change': (health: HealthStatus) => void;
  'alert:new': (alert: Alert) => void;
  
  // Upload events
  'upload:progress': (taskId: string, progress: number) => void;
  'upload:complete': (taskId: string, result: UploadResult) => void;
  'upload:failed': (taskId: string, error: Error) => void;
  
  // Account events
  'account:health': (accountId: string, health: number) => void;
  'account:status': (accountId: string, status: string) => void;
}
```

## Components and Interfaces

### Core Components Hierarchy

#### 1. Authentication Components
```typescript
// components/auth/LoginForm.tsx
interface LoginFormProps {
  onSuccess: (token: string) => void;
  onError: (error: Error) => void;
}

// features/auth/authSlice.ts
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}
```

#### 2. Dashboard Components
```typescript
// features/dashboard/Dashboard.tsx
interface DashboardProps {
  metrics: SystemMetrics;
  alerts: Alert[];
}

// components/dashboard/MetricCard.tsx
interface MetricCardProps {
  title: string;
  value: number | string;
  trend?: 'up' | 'down' | 'stable';
  icon: ReactNode;
  onClick?: () => void;
}

// components/dashboard/UploadChart.tsx
interface UploadChartProps {
  data: UploadMetric[];
  timeRange: '24h' | '7d' | '30d';
}
```

#### 3. Account Management Components
```typescript
// features/accounts/AccountList.tsx
interface AccountListProps {
  accounts: Account[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

// components/accounts/AccountForm.tsx
interface AccountFormProps {
  account?: Account;
  onSubmit: (data: AccountFormData) => void;
  onCancel: () => void;
}

// components/accounts/HealthIndicator.tsx
interface HealthIndicatorProps {
  score: number;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}
```

#### 4. Upload Components
```typescript
// features/uploads/UploadManager.tsx
interface UploadManagerProps {
  onUploadComplete: (results: UploadResult[]) => void;
}

// components/uploads/VideoDropzone.tsx
interface VideoDropzoneProps {
  onFilesAccepted: (files: File[]) => void;
  maxFiles?: number;
  accept?: string[];
}

// components/uploads/MetadataEditor.tsx
interface MetadataEditorProps {
  video: VideoFile;
  metadata: VideoMetadata;
  onChange: (metadata: VideoMetadata) => void;
  templates?: MetadataTemplate[];
}
```

#### 5. Task Management Components
```typescript
// features/tasks/TaskCenter.tsx
interface TaskCenterProps {
  tasks: Task[];
  onRetry: (taskId: string) => void;
  onCancel: (taskId: string) => void;
}

// components/tasks/TaskProgress.tsx
interface TaskProgressProps {
  task: Task;
  showDetails?: boolean;
}

// components/tasks/TaskFilters.tsx
interface TaskFiltersProps {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
}
```

### Component Patterns

#### 1. Compound Component Pattern
```typescript
// Example: Account Card with sub-components
const AccountCard = ({ children }) => { /* ... */ };
AccountCard.Header = ({ account }) => { /* ... */ };
AccountCard.Health = ({ score }) => { /* ... */ };
AccountCard.Actions = ({ onEdit, onDelete }) => { /* ... */ };

// Usage
<AccountCard>
  <AccountCard.Header account={account} />
  <AccountCard.Health score={account.healthScore} />
  <AccountCard.Actions onEdit={handleEdit} onDelete={handleDelete} />
</AccountCard>
```

#### 2. Custom Hooks Pattern
```typescript
// hooks/useWebSocket.ts
function useWebSocket<T>(event: string) {
  const [data, setData] = useState<T | null>(null);
  // WebSocket logic
  return { data, isConnected };
}

// hooks/useUploadProgress.ts
function useUploadProgress(taskId: string) {
  const { data: progress } = useWebSocket<UploadProgress>(`upload:progress:${taskId}`);
  return progress;
}
```

## Data Models

### Core Data Types

```typescript
// User and Authentication
interface User {
  id: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  createdAt: Date;
  lastLoginAt: Date;
}

// YouTube Account
interface Account {
  id: string;
  email: string;
  status: 'active' | 'paused' | 'limited' | 'error';
  healthScore: number; // 0-100
  dailyUploadCount: number;
  dailyUploadLimit: number;
  lastUploadTime: Date | null;
  proxy?: ProxyConfig;
  metadata?: Record<string, any>;
}

// Video and Upload
interface Video {
  id: string;
  path: string;
  title: string;
  description: string;
  tags: string[];
  thumbnail?: string;
  privacy: 'private' | 'unlisted' | 'public';
  scheduledAt?: Date;
  playlist?: string;
  language?: string;
  gameTitle?: string;
  metadata?: VideoMetadata;
}

interface UploadTask {
  id: string;
  videoId: string;
  accountId: string;
  status: 'waiting' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  error?: string;
  attempts: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

// System Monitoring
interface SystemMetrics {
  uploads: {
    today: number;
    successRate: number;
    queueDepth: number;
  };
  accounts: {
    total: number;
    active: number;
    healthy: number;
  };
  system: {
    cpuUsage: number;
    memoryUsage: number;
    uptime: number;
  };
}

interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}
```

### API Response Types

```typescript
// Generic API Response
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: Date;
    requestId: string;
  };
}

// Paginated Response
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
}
```

### Redux State Models

```typescript
// Auth State
interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

// Accounts State
interface AccountsState {
  entities: Record<string, Account>;
  ids: string[];
  selectedIds: string[];
  filter: AccountFilter;
  loading: boolean;
  error: string | null;
}

// UI State
interface UIState {
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  activeModal: string | null;
  notifications: Notification[];
}
```

## Error Handling

### Error Handling Strategy

#### 1. API Error Handling
```typescript
// services/api/errorHandler.ts
class ApiError extends Error {
  constructor(
    public code: string,
    public message: string,
    public status: number,
    public details?: any
  ) {
    super(message);
  }
}

// RTK Query error handling
const baseQuery = fetchBaseQuery({
  baseUrl: '/api',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token;
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    return headers;
  },
  // Global error handling
  validateStatus: (response, body) => 
    response.status >= 200 && response.status < 300,
});

const baseQueryWithErrorHandling = async (args, api, extraOptions) => {
  const result = await baseQuery(args, api, extraOptions);
  
  if (result.error) {
    // Handle specific error cases
    if (result.error.status === 401) {
      // Token refresh logic
    } else if (result.error.status === 429) {
      // Rate limiting
    }
  }
  
  return result;
};
```

#### 2. Component Error Boundaries
```typescript
// components/common/ErrorBoundary.tsx
class ErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to error reporting service
    logger.error({ error, errorInfo });
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    
    return this.props.children;
  }
}
```

#### 3. Form Validation Errors
```typescript
// utils/validation.ts
interface ValidationRule<T> {
  validate: (value: T) => boolean;
  message: string;
}

const validateVideo = (video: VideoFormData): ValidationErrors => {
  const errors: ValidationErrors = {};
  
  if (!video.title || video.title.length > 100) {
    errors.title = 'Title is required and must be less than 100 characters';
  }
  
  if (video.description && video.description.length > 5000) {
    errors.description = 'Description must be less than 5000 characters';
  }
  
  if (video.tags && video.tags.join(', ').length > 500) {
    errors.tags = 'Total tags length must be less than 500 characters';
  }
  
  return errors;
};
```

### Error Recovery Strategies

1. **Automatic Retry**: For transient network errors
2. **Manual Retry**: For user-initiated recovery
3. **Fallback Content**: Show cached data when available
4. **Graceful Degradation**: Disable features that depend on failed services
5. **Error Reporting**: Send errors to monitoring service

## Testing Strategy

### Testing Pyramid

#### 1. Unit Tests (60%)
- Components with React Testing Library
- Redux slices and reducers
- Utility functions
- Custom hooks

```typescript
// Example: Component test
describe('AccountCard', () => {
  it('should display account information correctly', () => {
    const account = mockAccount();
    render(<AccountCard account={account} />);
    
    expect(screen.getByText(account.email)).toBeInTheDocument();
    expect(screen.getByText(`${account.healthScore}%`)).toBeInTheDocument();
  });
});
```

#### 2. Integration Tests (30%)
- API integration with MSW (Mock Service Worker)
- Redux integration
- WebSocket communication
- File upload flows

```typescript
// Example: API integration test
describe('Account API', () => {
  it('should fetch accounts successfully', async () => {
    const { result } = renderHook(() => useGetAccountsQuery(), {
      wrapper: createWrapper(),
    });
    
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    
    expect(result.current.data).toHaveLength(3);
  });
});
```

#### 3. E2E Tests (10%)
- Critical user journeys with Cypress
- Upload workflow
- Account management flow
- Authentication flow

```typescript
// Example: E2E test
describe('Upload Workflow', () => {
  it('should upload a video successfully', () => {
    cy.login('test@example.com', 'password');
    cy.visit('/upload');
    
    cy.get('[data-testid="dropzone"]').attachFile('test-video.mp4');
    cy.get('[name="title"]').type('Test Video');
    cy.get('[name="description"]').type('Test Description');
    
    cy.get('[data-testid="upload-button"]').click();
    
    cy.get('[data-testid="upload-progress"]').should('be.visible');
    cy.get('[data-testid="upload-success"]').should('be.visible');
  });
});
```

### Testing Best Practices

1. **Test Isolation**: Each test should be independent
2. **Mock External Dependencies**: Use MSW for API mocking
3. **Test User Behavior**: Focus on user interactions, not implementation
4. **Accessibility Testing**: Include a11y tests with jest-axe
5. **Performance Testing**: Monitor bundle size and rendering performance
6. **Visual Regression**: Use Storybook with Chromatic