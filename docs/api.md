# YouTube Matrix Upload API Documentation

## Overview

The YouTube Matrix Upload API provides RESTful endpoints for managing multiple YouTube accounts, browser profiles, and automated video uploads using a distributed queue system.

## Base URL

```
http://localhost:3000/api
```

## Authentication

When API authentication is enabled (`security.enableApiAuth: true`), all requests must include an API key:

```
Authorization: Bearer YOUR_API_KEY
```

## Rate Limiting

Default rate limits:
- 100 requests per 15 minutes per IP
- Can be configured via `api.rateLimit` settings

## Endpoints

### Health & Status

#### GET /health
Check system health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "checks": [
    {
      "service": "database",
      "status": "healthy"
    },
    {
      "service": "redis",
      "status": "healthy"
    },
    {
      "service": "queue",
      "status": "healthy"
    }
  ]
}
```

#### GET /status
Get comprehensive system status.

**Response:**
```json
{
  "queue": {
    "waiting": 5,
    "active": 2,
    "completed": 150,
    "failed": 3,
    "delayed": 0,
    "paused": false
  },
  "browserPool": {
    "total": 5,
    "available": 3,
    "busy": 2,
    "error": 0
  },
  "accounts": {
    "total": 20,
    "active": 18,
    "healthy": 15,
    "suspended": 2
  },
  "initialized": true,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### GET /metrics
Get detailed system metrics.

**Response:**
```json
{
  "uploads": {
    "total24h": 245,
    "successful24h": 230,
    "failed24h": 15,
    "averageDuration": 185000,
    "throughput": 10.2
  },
  "accounts": {
    "total": 20,
    "active": 18,
    "healthy": 15,
    "suspended": 2,
    "utilizationRate": 75.5
  },
  "browsers": {
    "total": 5,
    "active": 2,
    "idle": 3,
    "error": 0,
    "utilizationRate": 40.0
  },
  "queue": {
    "depth": 8,
    "processingRate": 12.5,
    "averageWaitTime": 45.2,
    "backlog": 0
  },
  "errors": {
    "rate24h": 0.625,
    "byCategory": {
      "network": 5,
      "auth": 3,
      "browser": 7
    }
  }
}
```

### Account Management

#### GET /accounts
List all accounts with optional filtering.

**Query Parameters:**
- `status` (string): Filter by status (active, limited, suspended, error)
- `minHealthScore` (number): Minimum health score filter
- `hasAvailableUploads` (boolean): Filter accounts with available upload quota

**Response:**
```json
[
  {
    "id": "uuid",
    "email": "account@example.com",
    "status": "active",
    "healthScore": 85,
    "dailyUploadCount": 3,
    "dailyUploadLimit": 10,
    "lastUploadTime": "2024-01-15T09:00:00Z"
  }
]
```

#### POST /accounts
Add a new account.

**Request Body:**
```json
{
  "email": "newaccount@example.com",
  "password": "securepassword",
  "metadata": {
    "channel": "My Channel"
  }
}
```

**Response:**
```json
{
  "id": "uuid",
  "email": "newaccount@example.com",
  "status": "active",
  "healthScore": 100
}
```

#### PATCH /accounts/:id
Update account information.

**Request Body:**
```json
{
  "status": "active",
  "dailyUploadLimit": 15,
  "metadata": {
    "notes": "Premium account"
  }
}
```

#### DELETE /accounts/:id
Remove an account.

#### GET /accounts/stats
Get aggregate account statistics.

**Response:**
```json
{
  "total": 20,
  "active": 18,
  "limited": 0,
  "suspended": 2,
  "error": 0,
  "avg_health": 82.5,
  "total_uploads_today": 45
}
```

#### POST /accounts/reset-limits
Reset daily upload limits for all accounts.

### Upload Management

#### POST /upload
Queue a single video upload.

**Request Body:**
```json
{
  "video": {
    "path": "/path/to/video.mp4",
    "title": "My Video Title",
    "description": "Video description",
    "tags": ["tag1", "tag2"],
    "privacyStatus": "public",
    "thumbnail": "/path/to/thumbnail.jpg"
  },
  "priority": 1,
  "accountId": "specific-account-uuid",
  "scheduledAt": "2024-01-16T10:00:00Z",
  "metadata": {
    "campaign": "Winter 2024"
  }
}
```

**Response:**
```json
{
  "taskId": "task-uuid",
  "jobId": "job-id",
  "status": "queued"
}
```

#### POST /upload/batch
Queue multiple video uploads.

**Request Body:**
```json
{
  "videos": [
    {
      "path": "/path/to/video1.mp4",
      "title": "Video 1"
    },
    {
      "path": "/path/to/video2.mp4",
      "title": "Video 2"
    }
  ],
  "priority": 0,
  "metadata": {
    "batch": "Daily uploads"
  }
}
```

**Response:**
```json
[
  {
    "taskId": "task-uuid-1",
    "jobId": "job-id-1",
    "status": "queued"
  },
  {
    "taskId": "task-uuid-2",
    "jobId": "job-id-2",
    "status": "queued"
  }
]
```

#### GET /tasks/:id
Get upload task status.

**Response:**
```json
{
  "taskId": "task-uuid",
  "jobId": "job-id",
  "status": "completed",
  "videoId": "youtube-video-id",
  "error": null
}
```

### Queue Management

#### GET /queue/stats
Get queue statistics.

**Response:**
```json
{
  "waiting": 5,
  "active": 2,
  "completed": 150,
  "failed": 3,
  "delayed": 0,
  "paused": false,
  "rateLimit": {
    "max": 100,
    "duration": 3600000,
    "current": 25
  }
}
```

#### GET /queue/jobs
Get jobs by status.

**Query Parameters:**
- `status` (string): Job status (waiting, active, completed, failed, delayed)
- `limit` (number): Maximum number of jobs to return (default: 100)

**Response:**
```json
[
  {
    "id": "job-id",
    "name": "upload-task-uuid",
    "data": {
      "id": "task-uuid",
      "accountId": "account-uuid",
      "video": { /* video data */ }
    },
    "opts": {
      "priority": 1,
      "delay": 0
    },
    "timestamp": 1234567890,
    "attemptsMade": 0,
    "progress": 100
  }
]
```

#### POST /queue/pause
Pause queue processing.

#### POST /queue/resume
Resume queue processing.

#### POST /queue/jobs/:id/retry
Retry a failed job.

#### POST /queue/clean
Clean old completed/failed jobs.

**Request Body:**
```json
{
  "grace": 3600000
}
```

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional error details"
  }
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error
- `503` - Service Unavailable

## Webhooks

Configure webhooks to receive notifications for:
- Upload completion
- Upload failure
- Account health changes
- System alerts

Webhook configuration is done through environment variables or configuration file.

## Examples

### Upload a video using curl

```bash
curl -X POST http://localhost:3000/api/upload \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "video": {
      "path": "/videos/sample.mp4",
      "title": "My Sample Video",
      "description": "This is a test upload",
      "tags": ["test", "sample"],
      "privacyStatus": "private"
    },
    "priority": 1
  }'
```

### Check upload status

```bash
curl http://localhost:3000/api/tasks/TASK_ID \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Add multiple accounts

```bash
curl -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "email": "channel1@example.com",
    "password": "secure_password_1"
  }'
```

## SDK Usage

### JavaScript/TypeScript

```typescript
import { MatrixUploadClient } from '@youtube-matrix/client';

const client = new MatrixUploadClient({
  baseUrl: 'http://localhost:3000/api',
  apiKey: 'YOUR_API_KEY'
});

// Upload a video
const result = await client.upload({
  video: {
    path: '/path/to/video.mp4',
    title: 'My Video',
    description: 'Video description'
  }
});

// Check status
const status = await client.getTaskStatus(result.taskId);
console.log(status);
```

### Python

```python
from youtube_matrix import MatrixClient

client = MatrixClient(
    base_url='http://localhost:3000/api',
    api_key='YOUR_API_KEY'
)

# Upload video
result = client.upload({
    'video': {
        'path': '/path/to/video.mp4',
        'title': 'My Video',
        'description': 'Video description'
    }
})

# Check status
status = client.get_task_status(result['taskId'])
print(status)
```

## Best Practices

1. **Rate Limiting**: Respect rate limits to avoid being blocked
2. **Error Handling**: Implement exponential backoff for retries
3. **Batch Operations**: Use batch endpoints when uploading multiple videos
4. **Health Monitoring**: Regularly check system health before operations
5. **Account Rotation**: Let the system handle account selection for optimal distribution
6. **Priority Management**: Use priority levels wisely (0 = normal, higher = more urgent)
7. **Webhook Integration**: Use webhooks for real-time status updates instead of polling