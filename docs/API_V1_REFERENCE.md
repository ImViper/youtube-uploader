# YouTube Matrix API v1 Reference

Base URL: `http://localhost:5989/api/v1`

## Authentication

All API endpoints (except health and auth endpoints) require authentication using JWT tokens.

### Headers
```
Authorization: Bearer <jwt-token>
```

For development, you can use:
```
Authorization: Bearer dev-token
```

## Matrix API

### Create Matrix
```http
POST /api/v1/matrices
Content-Type: application/json

{
  "name": "Production Matrix",
  "description": "Main production upload matrix",
  "config": {
    "maxConcurrentUploads": 5,
    "retryAttempts": 3,
    "retryDelay": 5000,
    "dailyUploadLimit": 100,
    "priority": "high"
  }
}
```

### List Matrices
```http
GET /api/v1/matrices?page=1&pageSize=20&sortBy=createdAt&sortOrder=desc
```

### Get Matrix
```http
GET /api/v1/matrices/{id}
```

### Update Matrix
```http
PUT /api/v1/matrices/{id}
Content-Type: application/json

{
  "name": "Updated Matrix Name",
  "config": {
    "maxConcurrentUploads": 10
  },
  "status": "active"
}
```

### Delete Matrix
```http
DELETE /api/v1/matrices/{id}
```

### Get Matrix Statistics
```http
GET /api/v1/matrices/{id}/stats
```

### Start Matrix
```http
POST /api/v1/matrices/{id}/start
```

### Stop Matrix
```http
POST /api/v1/matrices/{id}/stop
```

## Account API

### Create Account
```http
POST /api/v1/accounts
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "proxy": {
    "host": "proxy.example.com",
    "port": 8080,
    "username": "proxyuser",
    "password": "proxypass"
  },
  "metadata": {
    "notes": "Production account",
    "tags": ["production", "high-priority"]
  },
  "dailyUploadLimit": 15
}
```

### List Accounts
```http
GET /api/v1/accounts?page=1&pageSize=20&status=active&minHealthScore=80
```

### Get Account
```http
GET /api/v1/accounts/{id}
```

### Update Account
```http
PUT /api/v1/accounts/{id}
Content-Type: application/json

{
  "dailyUploadLimit": 20,
  "status": "active",
  "metadata": {
    "notes": "Updated notes"
  }
}
```

### Update Account Status
```http
PATCH /api/v1/accounts/{id}/status
Content-Type: application/json

{
  "status": "suspended"
}
```

### Delete Account
```http
DELETE /api/v1/accounts/{id}
```

### Batch Delete Accounts
```http
DELETE /api/v1/accounts/batch
Content-Type: application/json

{
  "ids": ["uuid1", "uuid2", "uuid3"]
}
```

### Import Accounts
```http
POST /api/v1/accounts/import
Content-Type: application/json

{
  "format": "json",
  "accounts": [
    {
      "email": "user1@example.com",
      "password": "password1",
      "dailyUploadLimit": 10
    }
  ]
}
```

### Export Accounts
```http
GET /api/v1/accounts/export?format=csv&includePasswords=false
```

### Health Check Account
```http
GET /api/v1/accounts/{id}/health
```

### Test Account
```http
POST /api/v1/accounts/{id}/test
```

### Get Account Statistics
```http
GET /api/v1/accounts/stats
```

### Reset Daily Limits
```http
POST /api/v1/accounts/reset-limits
```

## Task API

### Create Task
```http
POST /api/v1/tasks
Content-Type: application/json

{
  "type": "upload",
  "video": {
    "path": "/path/to/video.mp4",
    "title": "My Amazing Video",
    "description": "This is a great video",
    "tags": ["tutorial", "tech"],
    "thumbnail": "/path/to/thumbnail.jpg",
    "privacy": "public",
    "publishAt": "2024-01-01T10:00:00Z"
  },
  "priority": "high",
  "accountId": "account-uuid",
  "matrixId": "matrix-uuid",
  "scheduledAt": "2024-01-01T08:00:00Z"
}
```

### Batch Create Tasks
```http
POST /api/v1/tasks/batch
Content-Type: application/json

{
  "tasks": [
    {
      "type": "upload",
      "video": { ... },
      "priority": "normal"
    }
  ]
}
```

### List Tasks
```http
GET /api/v1/tasks?page=1&pageSize=20&status=pending&type=upload&priority=high
```

### Get Task
```http
GET /api/v1/tasks/{id}
```

### Update Task
```http
PATCH /api/v1/tasks/{id}
Content-Type: application/json

{
  "status": "processing",
  "priority": "urgent",
  "metadata": {
    "note": "Processing started"
  }
}
```

### Cancel Task
```http
POST /api/v1/tasks/{id}/cancel
```

### Retry Task
```http
POST /api/v1/tasks/{id}/retry
```

### Get Task Progress
```http
GET /api/v1/tasks/{id}/progress
```

### Schedule Task
```http
POST /api/v1/tasks/{id}/schedule
Content-Type: application/json

{
  "scheduledAt": "2024-01-01T12:00:00Z"
}
```

### Get Task Statistics
```http
GET /api/v1/tasks/stats?accountId=uuid&matrixId=uuid
```

### Clean Old Tasks
```http
POST /api/v1/tasks/clean
Content-Type: application/json

{
  "grace": 86400000
}
```

## Common API Features

### Pagination
All list endpoints support pagination with these query parameters:
- `page` (default: 1)
- `pageSize` (default: 20, max: 100)
- `sortBy` (varies by endpoint)
- `sortOrder` (asc/desc, default: desc)

### Error Responses
```json
{
  "success": false,
  "error": "Error message",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format",
      "code": "invalid_string"
    }
  ]
}
```

### Successful Responses
```json
{
  "success": true,
  "data": { ... }
}
```

For paginated responses:
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- Default: 100 requests per minute per IP
- Authenticated users: 1000 requests per minute

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict (e.g., duplicate resource)
- `429` - Too Many Requests
- `500` - Internal Server Error
- `503` - Service Unavailable