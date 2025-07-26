# Design Document

## Overview

This design document outlines the architecture for integrating BitBrowser with the youtube-uploader library to enable matrix account management. The system will manage multiple YouTube accounts (20-30) through isolated browser profiles, enabling parallel video uploads while maintaining account safety and avoiding detection.

The design maintains backward compatibility with the existing API while adding new capabilities for multi-account operations through a modular architecture built on established patterns in the codebase.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Layer                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐   │
│  │   Upload    │  │   Update    │  │     Comment API      │   │
│  │   API       │  │   API       │  │                      │   │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬───────────┘   │
│         │                 │                     │                │
│  ┌──────▼─────────────────▼────────────────────▼───────────┐   │
│  │              Matrix Upload Manager                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│  │  │   Account   │  │    Task     │  │   Health    │     │   │
│  │  │   Manager   │  │   Queue     │  │   Monitor   │     │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │                                    │
├─────────────────────────────▼────────────────────────────────────┤
│                      Browser Layer                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              BitBrowser Manager                          │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐             │   │
│  │  │ Browser  │  │ Browser  │  │ Browser  │    ...      │   │
│  │  │ Pool     │  │ Instance │  │ Instance │             │   │
│  │  │ Manager  │  │    #1    │  │    #N    │             │   │
│  │  └──────────┘  └──────────┘  └──────────┘             │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │                                    │
├─────────────────────────────▼────────────────────────────────────┤
│                    Infrastructure Layer                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐    │
│  │ BitBrowser  │  │   Redis     │  │    PostgreSQL      │    │
│  │ API Server  │  │   Queue     │  │    Database        │    │
│  └─────────────┘  └─────────────┘  └─────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Core Design Principles

1. **Backward Compatibility**: Existing single-account usage remains unchanged
2. **Modular Architecture**: Clear separation between browser management, task scheduling, and upload logic
3. **Fault Isolation**: Browser instance failures don't affect other instances
4. **Scalability**: Horizontal scaling through additional browser instances
5. **Observability**: Comprehensive monitoring and logging at all layers

## Components and Interfaces

### 1. BitBrowser Manager

Manages the lifecycle of BitBrowser instances and provides an abstraction layer for browser operations.

```typescript
interface BitBrowserConfig {
  apiUrl: string;              // Default: http://127.0.0.1:54345
  maxRetries: number;          // Default: 3
  retryDelay: number;          // Default: 1000ms
  windowPosition?: {x: number, y: number};
}

interface BrowserInstance {
  id: string;                  // Unique instance identifier
  windowId: string;            // BitBrowser window ID
  debugUrl: string;            // CDP debug URL
  status: 'idle' | 'busy' | 'error';
  lastActivity: Date;
  errorCount: number;
  uploadCount: number;
  accountId?: string;          // Currently assigned account
}

class BitBrowserManager {
  constructor(config: BitBrowserConfig);
  
  // Browser lifecycle management
  async openBrowser(windowId: string): Promise<BrowserInstance>;
  async closeBrowser(instanceId: string): Promise<void>;
  async listBrowsers(): Promise<BrowserInstance[]>;
  async getBrowserStatus(instanceId: string): Promise<BrowserInstance>;
  
  // Connection management
  async connectPuppeteer(instance: BrowserInstance): Promise<Browser>;
  async disconnectPuppeteer(instanceId: string): Promise<void>;
  
  // Health management
  async healthCheck(instanceId: string): Promise<boolean>;
  async restartBrowser(instanceId: string): Promise<BrowserInstance>;
}
```

### 2. Account Manager

Manages YouTube account credentials and browser profile associations.

```typescript
interface AccountProfile {
  id: string;
  email: string;
  credentials: EncryptedCredentials;
  browserProfileId: string;
  status: 'active' | 'limited' | 'suspended' | 'error';
  dailyUploadCount: number;
  dailyUploadLimit: number;
  lastUploadTime?: Date;
  healthScore: number;        // 0-100
  metadata?: Record<string, any>;
}

class AccountManager {
  constructor(database: DatabaseConnection);
  
  // Account CRUD operations
  async addAccount(account: AccountProfile): Promise<void>;
  async updateAccount(accountId: string, updates: Partial<AccountProfile>): Promise<void>;
  async removeAccount(accountId: string): Promise<void>;
  async getAccount(accountId: string): Promise<AccountProfile>;
  async listAccounts(filter?: AccountFilter): Promise<AccountProfile[]>;
  
  // Account selection
  async getHealthyAccount(): Promise<AccountProfile>;
  async assignAccountToBrowser(accountId: string, browserId: string): Promise<void>;
  async releaseAccount(accountId: string): Promise<void>;
  
  // Health management
  async updateAccountHealth(accountId: string, success: boolean): Promise<void>;
  async resetDailyLimits(): Promise<void>;
}
```

### 3. Task Queue Manager

Implements task scheduling and distribution using BullMQ (modern successor to Bull).

```typescript
interface UploadTask {
  id: string;
  video: Video;
  accountId?: string;           // Optional: specific account to use
  priority: number;             // 0-10, higher = more important
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  scheduledFor?: Date;
  status: 'pending' | 'active' | 'completed' | 'failed';
  error?: string;
}

interface QueueConfig {
  redis: RedisOptions;
  concurrency: number;          // Max parallel uploads
  rateLimiter?: {
    max: number;                // Max jobs
    duration: number;           // Per duration (ms)
  };
}

class TaskQueueManager {
  constructor(config: QueueConfig);
  
  // Task management
  async addTask(video: Video, options?: TaskOptions): Promise<string>;
  async addBatchTasks(videos: Video[], options?: TaskOptions): Promise<string[]>;
  async getTask(taskId: string): Promise<UploadTask>;
  async cancelTask(taskId: string): Promise<boolean>;
  async retryTask(taskId: string): Promise<string>;
  
  // Queue operations
  async pauseQueue(): Promise<void>;
  async resumeQueue(): Promise<void>;
  async getQueueStats(): Promise<QueueStats>;
  
  // Worker registration
  async registerWorker(worker: UploadWorker): Promise<void>;
}
```

### 4. Upload Worker

Processes upload tasks using browser instances.

```typescript
class UploadWorker {
  constructor(
    browserManager: BitBrowserManager,
    accountManager: AccountManager,
    messageTransport: MessageTransport
  );
  
  async processTask(task: UploadTask): Promise<UploadResult>;
  private async acquireBrowserInstance(): Promise<BrowserInstance>;
  private async performUpload(browser: Browser, video: Video): Promise<string>;
  private async handleError(error: Error, task: UploadTask): Promise<void>;
}
```

### 5. Matrix Upload Manager

Orchestrates the entire matrix upload system and provides the main API.

```typescript
interface MatrixConfig {
  bitbrowser: BitBrowserConfig;
  queue: QueueConfig;
  database: DatabaseConfig;
  maxConcurrentUploads: number;
  healthCheckInterval: number;
  enableMetrics: boolean;
}

class MatrixUploadManager {
  constructor(config: MatrixConfig);
  
  // Main upload API (backward compatible)
  async upload(
    credentials: Credentials | AccountProfile[],
    videos: Video[],
    options?: MatrixUploadOptions
  ): Promise<string[]>;
  
  // Matrix-specific APIs
  async addAccounts(accounts: AccountProfile[]): Promise<void>;
  async getAccountStatus(accountId: string): Promise<AccountStatus>;
  async getSystemHealth(): Promise<SystemHealth>;
  
  // Lifecycle
  async start(): Promise<void>;
  async stop(): Promise<void>;
}
```

## Data Models

### Database Schema

```sql
-- Accounts table
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  encrypted_credentials TEXT NOT NULL,
  browser_profile_id VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  daily_upload_count INTEGER DEFAULT 0,
  daily_upload_limit INTEGER DEFAULT 2,
  last_upload_time TIMESTAMP,
  health_score INTEGER DEFAULT 100,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Upload tasks table
CREATE TABLE upload_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  video_data JSONB NOT NULL,
  priority INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  status VARCHAR(50) DEFAULT 'pending',
  error TEXT,
  result JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  scheduled_for TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Browser instances table
CREATE TABLE browser_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  window_id VARCHAR(255) UNIQUE NOT NULL,
  debug_url VARCHAR(255),
  status VARCHAR(50) DEFAULT 'idle',
  account_id UUID REFERENCES accounts(id),
  error_count INTEGER DEFAULT 0,
  upload_count INTEGER DEFAULT 0,
  last_activity TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Upload history table
CREATE TABLE upload_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES upload_tasks(id),
  account_id UUID REFERENCES accounts(id),
  browser_instance_id UUID REFERENCES browser_instances(id),
  video_url TEXT,
  upload_duration INTEGER,
  success BOOLEAN,
  error_details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Redis Data Structures

```typescript
// Task queue (BullMQ)
interface QueueJob {
  name: 'upload' | 'update' | 'comment';
  data: {
    taskId: string;
    video: Video;
    accountId?: string;
  };
  opts: {
    priority: number;
    delay?: number;
    attempts: number;
    backoff: {
      type: 'exponential';
      delay: number;
    };
  };
}

// Rate limiting (per account)
// Key: rate_limit:account:{accountId}
// Value: count of operations in current window

// Browser instance locks
// Key: browser_lock:{instanceId}
// Value: accountId (if locked) or empty
// TTL: 300 seconds (5 minutes)

// Health metrics (for monitoring)
// Key: metrics:{metric_name}
// Value: numeric value or JSON object
```

## Error Handling

### Error Categories

1. **Browser Errors**
   - Connection failures
   - CDP protocol errors
   - Browser crashes
   - Resource exhaustion

2. **Account Errors**
   - Authentication failures
   - Daily limit reached
   - Account suspension
   - 2FA/Captcha challenges

3. **Upload Errors**
   - Network failures
   - File access errors
   - YouTube API errors
   - Validation errors

4. **System Errors**
   - Database connection loss
   - Redis connection failure
   - Out of memory
   - Configuration errors

### Error Recovery Strategies

```typescript
class ErrorRecoveryStrategy {
  // Browser recovery
  async handleBrowserError(error: BrowserError, instance: BrowserInstance) {
    if (error.type === 'CONNECTION_LOST') {
      await this.reconnectBrowser(instance);
    } else if (error.type === 'BROWSER_CRASH') {
      await this.restartBrowser(instance);
    } else if (error.type === 'RESOURCE_EXHAUSTION') {
      await this.cooldownBrowser(instance);
    }
  }
  
  // Account recovery
  async handleAccountError(error: AccountError, account: AccountProfile) {
    if (error.type === 'DAILY_LIMIT') {
      await this.markAccountLimited(account);
    } else if (error.type === 'AUTH_FAILURE') {
      await this.refreshAuthentication(account);
    } else if (error.type === 'CAPTCHA_REQUIRED') {
      await this.notifyCaptchaRequired(account);
    }
  }
  
  // Task recovery
  async handleTaskError(error: TaskError, task: UploadTask) {
    if (task.retryCount < task.maxRetries) {
      await this.scheduleRetry(task, this.calculateBackoff(task.retryCount));
    } else {
      await this.moveToDeadLetter(task);
    }
  }
}
```

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failures: Map<string, number> = new Map();
  private lastFailureTime: Map<string, Date> = new Map();
  private state: Map<string, 'closed' | 'open' | 'half-open'> = new Map();
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000,
    private halfOpenRequests: number = 3
  ) {}
  
  async execute<T>(
    resourceId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const state = this.state.get(resourceId) || 'closed';
    
    if (state === 'open') {
      if (this.shouldAttemptReset(resourceId)) {
        this.state.set(resourceId, 'half-open');
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess(resourceId);
      return result;
    } catch (error) {
      this.onFailure(resourceId);
      throw error;
    }
  }
}
```

## Testing Strategy

### Unit Tests

```typescript
// BitBrowserManager tests
describe('BitBrowserManager', () => {
  it('should open browser instance successfully');
  it('should handle API connection failures');
  it('should reconnect on CDP disconnect');
  it('should enforce rate limits');
});

// AccountManager tests
describe('AccountManager', () => {
  it('should select healthy accounts');
  it('should update health scores correctly');
  it('should reset daily limits at midnight');
  it('should handle concurrent account selection');
});

// TaskQueueManager tests
describe('TaskQueueManager', () => {
  it('should process tasks in priority order');
  it('should retry failed tasks with backoff');
  it('should respect rate limits');
  it('should handle worker failures');
});
```

### Integration Tests

```typescript
// End-to-end upload flow
describe('Matrix Upload Integration', () => {
  it('should upload video across multiple accounts');
  it('should handle account switching');
  it('should recover from browser crashes');
  it('should respect daily upload limits');
});

// BitBrowser integration
describe('BitBrowser Integration', () => {
  it('should connect to BitBrowser API');
  it('should manage multiple browser instances');
  it('should handle browser lifecycle');
  it('should isolate browser failures');
});
```

### Load Tests

```typescript
// Performance benchmarks
describe('Performance Tests', () => {
  it('should handle 30 concurrent uploads');
  it('should maintain <16GB memory with 30 browsers');
  it('should achieve 2 uploads/account/day throughput');
  it('should scale horizontally');
});
```

### Monitoring and Metrics

Key metrics to track:

1. **Upload Metrics**
   - Upload success rate
   - Average upload duration
   - Queue depth and processing time
   - Failed upload reasons

2. **Account Health**
   - Account availability
   - Daily limit usage
   - Authentication failures
   - Health score distribution

3. **System Performance**
   - CPU and memory usage
   - Active browser instances
   - Redis queue performance
   - Database query latency

4. **Error Rates**
   - Browser crashes per hour
   - API errors by type
   - Retry success rate
   - Circuit breaker trips

## Migration Strategy

### Phase 1: Infrastructure Setup
1. Deploy Redis for queue management
2. Set up PostgreSQL database with schema
3. Configure BitBrowser on target machines
4. Implement core components without breaking changes

### Phase 2: Parallel Operation
1. Add matrix mode flag to existing API
2. Run single-account mode by default
3. Allow opt-in to matrix mode for testing
4. Monitor both modes for issues

### Phase 3: Full Migration
1. Migrate existing cookie storage to database
2. Convert single accounts to matrix profiles
3. Enable matrix mode by default
4. Deprecate single-browser mode

### Rollback Plan
1. Keep original upload logic intact
2. Feature flag for matrix mode
3. Database migration reversibility
4. Monitoring for regression detection