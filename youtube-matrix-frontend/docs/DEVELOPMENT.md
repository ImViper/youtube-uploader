# Development Guide

This guide provides detailed information for developers working on the YouTube Matrix Frontend project.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Architecture Overview](#architecture-overview)
3. [Development Workflow](#development-workflow)
4. [Component Development](#component-development)
5. [State Management](#state-management)
6. [API Integration](#api-integration)
7. [Testing Strategy](#testing-strategy)
8. [Performance Guidelines](#performance-guidelines)
9. [Security Considerations](#security-considerations)
10. [Deployment Process](#deployment-process)

## Getting Started

### Environment Setup

1. **Required Tools**:
   - Node.js 18.x or higher
   - npm 9.x or higher
   - Git
   - VS Code (recommended) with extensions:
     - ESLint
     - Prettier
     - TypeScript and JavaScript Language Features
     - Tailwind CSS IntelliSense

2. **Initial Setup**:
   ```bash
   # Clone repository
   git clone <repository-url>
   cd youtube-matrix-frontend

   # Install dependencies
   npm ci

   # Setup environment
   cp .env.example .env
   # Edit .env with your local configuration

   # Start development server
   npm run dev
   ```

3. **VS Code Configuration**:
   ```json
   {
     "editor.formatOnSave": true,
     "editor.codeActionsOnSave": {
       "source.fixAll.eslint": true
     },
     "typescript.tsdk": "node_modules/typescript/lib"
   }
   ```

## Architecture Overview

### Directory Structure

```
src/
├── components/           # Reusable UI components
│   ├── common/          # Generic components (Button, Modal, etc.)
│   ├── upload/          # Upload-specific components
│   ├── account/         # Account management components
│   └── ...
├── features/            # Redux slices and business logic
│   ├── auth/           # Authentication slice
│   ├── upload/         # Upload management slice
│   └── ...
├── hooks/              # Custom React hooks
├── pages/              # Page-level components
├── services/           # API and external services
├── store/              # Redux store configuration
├── utils/              # Utility functions
├── types/              # TypeScript type definitions
└── styles/             # Global styles and themes
```

### Technology Stack

- **React 18**: UI library with concurrent features
- **TypeScript**: Type safety and better DX
- **Redux Toolkit**: State management with RTK Query
- **Ant Design 5**: Component library
- **Tailwind CSS**: Utility-first styling
- **Vite**: Build tool and dev server
- **Socket.io**: Real-time communication

### Design Patterns

1. **Component Composition**: Build complex UIs from simple components
2. **Container/Presentational**: Separate logic from presentation
3. **Custom Hooks**: Extract and reuse component logic
4. **Redux Ducks**: Organize Redux code by feature

## Development Workflow

### Branch Strategy

```
main
├── develop
├── feature/upload-improvements
├── feature/account-dashboard
├── bugfix/queue-error
└── hotfix/critical-security-fix
```

### Commit Convention

Follow conventional commits:
```
type(scope): subject

body (optional)

footer (optional)
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test updates
- `chore`: Build/tooling changes

Example:
```
feat(upload): add bulk upload progress indicator

- Display real-time progress for each file
- Show overall completion percentage
- Add cancel functionality

Closes #123
```

### Code Review Process

1. Create feature branch
2. Make changes and commit
3. Push branch and create PR
4. Ensure CI passes
5. Request review
6. Address feedback
7. Merge after approval

## Component Development

### Component Structure

```typescript
// components/upload/UploadProgress.tsx
import React, { FC, memo } from 'react';
import { Progress, Typography } from 'antd';
import { useUploadProgress } from '@/hooks/useUploadProgress';
import type { Upload } from '@/types/upload';

interface UploadProgressProps {
  upload: Upload;
  onCancel?: () => void;
}

export const UploadProgress: FC<UploadProgressProps> = memo(({ 
  upload, 
  onCancel 
}) => {
  const { progress, speed, timeRemaining } = useUploadProgress(upload.id);

  return (
    <div className="upload-progress">
      <Typography.Text>{upload.title}</Typography.Text>
      <Progress percent={progress} status="active" />
      <div className="upload-stats">
        <span>Speed: {speed}</span>
        <span>Time remaining: {timeRemaining}</span>
      </div>
    </div>
  );
});

UploadProgress.displayName = 'UploadProgress';
```

### Component Guidelines

1. **TypeScript First**: Always define props interfaces
2. **Memoization**: Use React.memo for expensive components
3. **Hooks**: Extract logic into custom hooks
4. **Testing**: Write tests alongside components
5. **Accessibility**: Include ARIA labels and keyboard support

### Styling Approach

Use Tailwind utilities with component-specific styles:

```tsx
// Tailwind utilities for layout
<div className="flex items-center justify-between p-4">
  {/* Component-specific styles for complex styling */}
  <div className={styles.customElement}>
    Content
  </div>
</div>
```

## State Management

### Redux Store Structure

```typescript
interface RootState {
  auth: AuthState;
  uploads: UploadState;
  accounts: AccountState;
  settings: SettingsState;
  monitoring: MonitoringState;
}
```

### Creating a Slice

```typescript
// features/upload/uploadSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { uploadApi } from '@/services/api/uploadApi';

interface UploadState {
  queue: Upload[];
  activeUploads: string[];
  completedCount: number;
}

const uploadSlice = createSlice({
  name: 'upload',
  initialState: {
    queue: [],
    activeUploads: [],
    completedCount: 0,
  } as UploadState,
  reducers: {
    addToQueue: (state, action: PayloadAction<Upload>) => {
      state.queue.push(action.payload);
    },
    removeFromQueue: (state, action: PayloadAction<string>) => {
      state.queue = state.queue.filter(u => u.id !== action.payload);
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(
      uploadApi.endpoints.createUpload.matchFulfilled,
      (state, action) => {
        state.completedCount++;
      }
    );
  },
});
```

### RTK Query Usage

```typescript
// services/api/uploadApi.ts
export const uploadApi = createApi({
  reducerPath: 'uploadApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.token;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Upload'],
  endpoints: (builder) => ({
    getUploads: builder.query<Upload[], void>({
      query: () => 'uploads',
      providesTags: ['Upload'],
    }),
    createUpload: builder.mutation<Upload, CreateUploadDto>({
      query: (upload) => ({
        url: 'uploads',
        method: 'POST',
        body: upload,
      }),
      invalidatesTags: ['Upload'],
    }),
  }),
});
```

## API Integration

### API Client Configuration

```typescript
// services/api/client.ts
import axios from 'axios';
import { store } from '@/store';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30000,
});

// Request interceptor
apiClient.interceptors.request.use((config) => {
  const token = store.getState().auth.token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Handle token refresh
    }
    return Promise.reject(error);
  }
);
```

### WebSocket Integration

```typescript
// services/websocket/client.ts
import io from 'socket.io-client';

export const createWebSocketClient = (token: string) => {
  const socket = io(import.meta.env.VITE_WEBSOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log('WebSocket connected');
  });

  socket.on('upload:progress', (data) => {
    store.dispatch(updateUploadProgress(data));
  });

  return socket;
};
```

## Testing Strategy

### Unit Testing

```typescript
// components/upload/__tests__/UploadProgress.test.tsx
import { render, screen } from '@testing-library/react';
import { UploadProgress } from '../UploadProgress';

describe('UploadProgress', () => {
  it('displays upload title and progress', () => {
    const upload = {
      id: '1',
      title: 'Test Video',
      progress: 50,
    };

    render(<UploadProgress upload={upload} />);

    expect(screen.getByText('Test Video')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '50'
    );
  });
});
```

### Integration Testing

```typescript
// __tests__/integration/upload-flow.test.tsx
import { renderWithProviders } from '@/utils/test/testUtils';
import { UploadPage } from '@/pages/UploadPage';
import { server } from '@/mocks/server';
import { rest } from 'msw';

describe('Upload Flow', () => {
  it('completes upload workflow', async () => {
    server.use(
      rest.post('/api/uploads', (req, res, ctx) => {
        return res(ctx.json({ id: '1', status: 'processing' }));
      })
    );

    renderWithProviders(<UploadPage />);
    
    // Test implementation
  });
});
```

### E2E Testing

```typescript
// cypress/e2e/upload.cy.ts
describe('Upload E2E', () => {
  beforeEach(() => {
    cy.login();
  });

  it('uploads video successfully', () => {
    cy.visit('/uploads');
    cy.findByRole('button', { name: /new upload/i }).click();
    cy.findByLabelText(/title/i).type('E2E Test Video');
    cy.findByLabelText(/video file/i).attachFile('test-video.mp4');
    cy.findByRole('button', { name: /start upload/i }).click();
    cy.findByText(/upload complete/i).should('be.visible');
  });
});
```

## Performance Guidelines

### Code Splitting

```typescript
// Lazy load pages
const UploadPage = lazy(() => import('@/pages/UploadPage'));
const AccountPage = lazy(() => import('@/pages/AccountPage'));

// Lazy load heavy components
const PerformanceCharts = lazy(() => 
  import('@/components/monitoring/PerformanceCharts')
);
```

### Optimization Techniques

1. **Virtual Scrolling**: Use for large lists
   ```typescript
   import { VirtualList } from '@/components/performance/VirtualList';
   
   <VirtualList
     items={uploads}
     itemHeight={80}
     renderItem={(upload) => <UploadItem upload={upload} />}
   />
   ```

2. **Memoization**: Prevent unnecessary re-renders
   ```typescript
   const MemoizedComponent = memo(Component, (prevProps, nextProps) => {
     return prevProps.id === nextProps.id;
   });
   ```

3. **Debouncing**: Optimize frequent updates
   ```typescript
   const debouncedSearch = useMemo(
     () => debounce(handleSearch, 300),
     []
   );
   ```

### Bundle Optimization

- Use dynamic imports for routes
- Implement tree shaking
- Optimize images with lazy loading
- Minimize CSS with PurgeCSS
- Enable gzip compression

## Security Considerations

### Input Sanitization

```typescript
// utils/security/sanitizer.ts
export const sanitizeInput = (input: string): string => {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong'],
    ALLOWED_ATTR: [],
  });
};
```

### Authentication Flow

```typescript
// hooks/useAuth.ts
export const useAuth = () => {
  const dispatch = useAppDispatch();
  
  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await authApi.login(credentials);
      
      // Store token securely
      secureStorage.setItem('token', response.token);
      
      // Update Redux state
      dispatch(setAuth({
        user: response.user,
        token: response.token,
      }));
    } catch (error) {
      // Handle error
    }
  };
  
  return { login, logout, refreshToken };
};
```

### Security Headers

Configure security headers in production:
```nginx
# nginx.conf
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Content-Security-Policy "default-src 'self';" always;
```

## Deployment Process

### Build Configuration

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['antd', '@ant-design/icons'],
          charts: ['echarts', 'echarts-for-react'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run test
      - run: npm run build
      - name: Deploy to S3
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      - run: aws s3 sync dist/ s3://${{ secrets.S3_BUCKET }}
```

## Troubleshooting

### Common Issues

1. **Module Resolution Errors**
   ```bash
   # Clear cache and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Type Errors**
   ```bash
   # Generate missing types
   npm run type-check
   ```

3. **Build Failures**
   ```bash
   # Increase memory for build
   NODE_OPTIONS="--max-old-space-size=4096" npm run build
   ```

### Debug Tools

- React Developer Tools
- Redux DevTools
- Network tab for API debugging
- Console for error tracking
- Performance profiler

## Resources

- [React Documentation](https://react.dev)
- [Redux Toolkit Guide](https://redux-toolkit.js.org)
- [Ant Design Components](https://ant.design)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Vite Documentation](https://vitejs.dev)