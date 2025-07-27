# API Documentation

This document describes the API endpoints used by the YouTube Matrix Frontend application.

## Base Configuration

### API Base URL
```
Development: http://localhost:4000/api/v1
Production: https://api.yourdomain.com/api/v1
```

### Authentication
All authenticated endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <jwt-token>
```

### Response Format
All responses follow this structure:
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}
```

## Authentication Endpoints

### Login
```http
POST /auth/login
```

Request:
```json
{
  "username": "string",
  "password": "string",
  "rememberMe": false
}
```

Response:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "string",
      "username": "string",
      "email": "string",
      "roles": ["user"],
      "permissions": ["upload:create", "upload:view"]
    },
    "token": "jwt-token",
    "refreshToken": "refresh-token",
    "expiresIn": 3600
  }
}
```

### Refresh Token
```http
POST /auth/refresh
```

Request:
```json
{
  "refreshToken": "string"
}
```

### Logout
```http
POST /auth/logout
```

### Register
```http
POST /auth/register
```

Request:
```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

## Task Endpoints (formerly Upload Endpoints)

### List Tasks
```http
GET /v1/tasks
```

Query Parameters:
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `status` (string): Filter by status (pending, uploading, completed, failed)
- `accountId` (string): Filter by account
- `search` (string): Search in title and description

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "status": "uploading",
      "progress": 45,
      "accountId": "string",
      "videoId": "string",
      "url": "string",
      "thumbnail": "string",
      "createdAt": "2023-12-01T10:00:00Z",
      "updatedAt": "2023-12-01T10:05:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

### Get Task Details
```http
GET /v1/tasks/:id
```

### Create Task
```http
POST /v1/tasks
```

Request (multipart/form-data):
```
title: string (required)
description: string
accountId: string (required)
privacy: string (public, private, unlisted)
tags: string[] (comma-separated)
categoryId: string
thumbnail: File
video: File (required)
scheduledTime: string (ISO 8601)
```

### Update Task
```http
PATCH /v1/tasks/:id
```

Request:
```json
{
  "title": "string",
  "description": "string",
  "tags": ["string"],
  "privacy": "public"
}
```

### Delete Task
```http
DELETE /v1/tasks/:id
```

### Retry Failed Task
```http
POST /v1/tasks/:id/retry
```

### Bulk Task Creation
```http
POST /v1/tasks/bulk
```

Request (multipart/form-data):
```
csv: File (required)
accountIds: string[] (comma-separated)
defaultPrivacy: string
distributeAcrossAccounts: boolean
```

CSV Format:
```csv
title,description,videoFile,tags,privacy,category
"Video Title","Description here","video1.mp4","tag1,tag2","public","Education"
```

### Upload Progress (WebSocket)
```javascript
// Connect to WebSocket
const socket = io('ws://localhost:4000', {
  auth: { token: 'jwt-token' }
});

// Listen for progress updates
socket.on('upload:progress', (data) => {
  console.log(data);
  // { uploadId: 'string', progress: 75, status: 'uploading' }
});

// Listen for completion
socket.on('upload:complete', (data) => {
  console.log(data);
  // { uploadId: 'string', videoId: 'string', url: 'string' }
});
```

## Account Endpoints

### List Accounts
```http
GET /v1/accounts
```

Query Parameters:
- `status` (string): Filter by status (active, warning, error, paused)
- `healthScore` (string): Filter by health range (0-50, 51-80, 81-100)

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "username": "string",
      "email": "string",
      "status": "active",
      "healthScore": 95,
      "lastLogin": "2023-12-01T10:00:00Z",
      "uploadsCount": 150,
      "failureRate": 2.5,
      "dailyLimit": 50,
      "usedToday": 12,
      "proxy": {
        "id": "string",
        "url": "string",
        "location": "US"
      }
    }
  ]
}
```

### Get Account Details
```http
GET /v1/accounts/:id
```

### Create Account
```http
POST /v1/accounts
```

Request:
```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "proxyId": "string",
  "dailyLimit": 50,
  "notes": "string"
}
```

### Update Account
```http
PATCH /v1/accounts/:id
```

### Delete Account
```http
DELETE /v1/accounts/:id
```

### Verify Account
```http
POST /v1/accounts/:id/verify
```

Request:
```json
{
  "verificationCode": "string"
}
```

### Account Metrics
```http
GET /v1/accounts/:id/metrics
```

Query Parameters:
- `period` (string): Time period (24h, 7d, 30d, 90d)

Response:
```json
{
  "success": true,
  "data": {
    "uploadSuccess": 145,
    "uploadFailure": 5,
    "avgUploadTime": 125.5,
    "totalViews": 15000,
    "totalLikes": 500,
    "healthTrend": [
      { "date": "2023-12-01", "score": 95 }
    ],
    "dailyUploads": [
      { "date": "2023-12-01", "count": 20 }
    ],
    "recentErrors": [
      {
        "timestamp": "2023-12-01T10:00:00Z",
        "error": "Rate limit exceeded",
        "count": 3
      }
    ]
  }
}
```

### Bulk Account Operations
```http
POST /v1/accounts/bulk
```

Request:
```json
{
  "accountIds": ["string"],
  "action": "pause" | "resume" | "delete",
  "params": {}
}
```

## Settings Endpoints

### Get Settings
```http
GET /v1/settings
```

Response:
```json
{
  "success": true,
  "data": {
    "general": {
      "appName": "string",
      "language": "en",
      "timezone": "UTC",
      "dateFormat": "YYYY-MM-DD"
    },
    "upload": {
      "defaultPrivacy": "private",
      "enableComments": true,
      "enableRatings": true,
      "notifySubscribers": false,
      "maxRetries": 3,
      "retryDelay": 5000,
      "chunkSize": 5242880
    },
    "queue": {
      "maxConcurrent": 5,
      "priority": "fifo",
      "rateLimitPerAccount": 10,
      "cooldownPeriod": 300
    },
    "security": {
      "twoFactorEnabled": false,
      "sessionTimeout": 3600,
      "ipWhitelist": [],
      "apiRateLimit": 1000
    },
    "notifications": {
      "email": {
        "enabled": true,
        "uploadSuccess": true,
        "uploadFailure": true,
        "accountIssues": true
      },
      "webhook": {
        "enabled": false,
        "url": "string",
        "events": ["upload.complete", "upload.failed"]
      }
    }
  }
}
```

### Update Settings
```http
PATCH /v1/settings
```

Request:
```json
{
  "upload": {
    "defaultPrivacy": "public",
    "maxRetries": 5
  }
}
```

### Export Settings
```http
POST /v1/settings/export
```

### Import Settings
```http
POST /v1/settings/import
```

Request (multipart/form-data):
```
file: File (JSON settings file)
```

## Monitoring Endpoints

### System Performance
```http
GET /v1/monitoring/performance
```

Response:
```json
{
  "success": true,
  "data": {
    "cpu": {
      "current": 45.2,
      "average": 38.5,
      "history": [
        { "timestamp": "2023-12-01T10:00:00Z", "value": 45.2 }
      ]
    },
    "memory": {
      "current": 2.1,
      "total": 8,
      "percentage": 26.25
    },
    "network": {
      "incoming": 125.5,
      "outgoing": 89.3
    },
    "disk": {
      "used": 45.2,
      "total": 100,
      "percentage": 45.2
    }
  }
}
```

### Upload Statistics
```http
GET /v1/monitoring/uploads
```

Query Parameters:
- `period` (string): Time period (today, week, month)

### Account Health
```http
GET /v1/monitoring/accounts
```

### Error Logs
```http
GET /v1/monitoring/errors
```

Query Parameters:
- `level` (string): Filter by level (error, warning, info)
- `source` (string): Filter by source
- `startDate` (string): Start date (ISO 8601)
- `endDate` (string): End date (ISO 8601)

### Generate Report
```http
POST /v1/monitoring/reports/generate
```

Request:
```json
{
  "type": "performance" | "uploads" | "accounts" | "full",
  "period": "24h" | "7d" | "30d" | "custom",
  "startDate": "2023-12-01",
  "endDate": "2023-12-31",
  "format": "pdf" | "csv" | "json",
  "includeCharts": true
}
```

## Queue Management

### Queue Status
```http
GET /v1/queue/status
```

### Queue Jobs
```http
GET /v1/queue/jobs
```

Query Parameters:
- `status` (string): Filter by status (active, waiting, completed, failed)
- `type` (string): Filter by job type

### Pause Queue
```http
POST /v1/queue/pause
```

### Resume Queue
```http
POST /v1/queue/resume
```

### Clear Failed Jobs
```http
POST /v1/queue/clear-failed
```

## Proxy Management

### List Proxies
```http
GET /v1/proxies
```

### Test Proxy
```http
POST /v1/proxies/test
```

Request:
```json
{
  "url": "string",
  "username": "string",
  "password": "string"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "working": true,
    "latency": 150,
    "location": "US",
    "ip": "1.2.3.4"
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| AUTH001 | Invalid credentials |
| AUTH002 | Token expired |
| AUTH003 | Insufficient permissions |
| UPLOAD001 | Invalid file format |
| UPLOAD002 | File too large |
| UPLOAD003 | Upload limit exceeded |
| ACCOUNT001 | Account not found |
| ACCOUNT002 | Account suspended |
| ACCOUNT003 | Verification required |
| RATE001 | Rate limit exceeded |
| SERVER001 | Internal server error |

## Rate Limiting

Default rate limits:
- Authentication endpoints: 5 requests per minute
- Upload endpoints: 100 requests per minute
- Account endpoints: 50 requests per minute
- Monitoring endpoints: 200 requests per minute

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1701424800
```

## Webhooks

Configure webhooks to receive real-time notifications:

### Webhook Events
- `upload.created`: New upload created
- `upload.started`: Upload processing started
- `upload.progress`: Upload progress update
- `upload.completed`: Upload completed successfully
- `upload.failed`: Upload failed
- `account.health.warning`: Account health dropped below threshold
- `account.suspended`: Account suspended
- `queue.full`: Upload queue is full

### Webhook Payload
```json
{
  "event": "upload.completed",
  "timestamp": "2023-12-01T10:00:00Z",
  "data": {
    "uploadId": "string",
    "accountId": "string",
    "videoId": "string",
    "url": "string"
  }
}
```

### Webhook Security
All webhooks include a signature header for verification:
```
X-Webhook-Signature: sha256=<hmac-sha256-signature>
```

Verify webhook signature:
```typescript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return `sha256=${hash}` === signature;
}
```