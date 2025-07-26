# YouTube Matrix API 文档

## 概述

YouTube Matrix 提供了完整的 RESTful API，用于管理多个 YouTube 账户、任务队列和自动化视频上传。系统支持账户管理、批量上传、实时监控等企业级功能。

## 基础信息

### 基础 URL
```
http://localhost:5989/api
```

### API 版本
- **当前版本**: v1
- **版本化路径**: `/api/v1/*`

## 认证

### JWT Token 认证

所有 API 请求（除了认证端点）都需要在请求头中包含有效的 JWT Token：

```
Authorization: Bearer YOUR_JWT_TOKEN
```

### 获取 Token

#### 登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your_password"
}
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "1",
      "username": "admin",
      "role": "admin"
    }
  }
}
```

#### 刷新 Token
```http
POST /api/auth/refresh
Authorization: Bearer YOUR_REFRESH_TOKEN
```

### 用户角色

系统支持三种角色权限：
- **admin**: 完全访问权限
- **operator**: 操作权限（无系统配置权限）
- **viewer**: 只读权限

## 核心 API 端点

### 1. 系统状态

#### 健康检查
```http
GET /api/v1/health
```

**响应**：
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-07-26T10:30:00Z",
  "checks": [
    {
      "service": "database",
      "status": "healthy",
      "message": "PostgreSQL connection OK"
    },
    {
      "service": "redis",
      "status": "healthy",
      "message": "Redis connection OK"
    },
    {
      "service": "queue",
      "status": "healthy",
      "message": "Queue system operational"
    }
  ]
}
```

#### 系统状态
```http
GET /api/v1/status
```

**响应**：
```json
{
  "success": true,
  "data": {
    "queue": {
      "waiting": 15,
      "active": 3,
      "completed": 245,
      "failed": 7
    },
    "accounts": {
      "total": 25,
      "active": 20,
      "healthy": 18,
      "suspended": 2
    },
    "performance": {
      "cpu": 45.2,
      "memory": 62.8,
      "uptime": 172800
    }
  }
}
```

### 2. Matrix 管理

#### 创建 Matrix
```http
POST /api/v1/matrices
Content-Type: application/json

{
  "name": "生产环境 Matrix",
  "description": "主要生产上传任务",
  "config": {
    "maxConcurrency": 5,
    "uploadTimeout": 300000,
    "retryAttempts": 3
  }
}
```

#### 获取 Matrix 列表
```http
GET /api/v1/matrices?page=1&pageSize=10
```

**查询参数**：
- `page`: 页码（默认：1）
- `pageSize`: 每页数量（默认：20）
- `status`: 状态过滤（active/paused/stopped）
- `sortBy`: 排序字段
- `sortOrder`: 排序方向（asc/desc）

#### 更新 Matrix
```http
PUT /api/v1/matrices/:id
Content-Type: application/json

{
  "name": "更新的名称",
  "config": {
    "maxConcurrency": 10
  }
}
```

#### 启动/停止 Matrix
```http
POST /api/v1/matrices/:id/start
POST /api/v1/matrices/:id/stop
```

#### 获取 Matrix 统计
```http
GET /api/v1/matrices/:id/stats
```

### 3. 账户管理

#### 获取账户列表
```http
GET /api/v1/accounts?page=1&pageSize=20&status=active
```

**查询参数**：
- `status`: 账户状态（active/limited/suspended/error）
- `minHealthScore`: 最低健康分数
- `hasAvailableUploads`: 是否有可用上传配额
- `search`: 搜索关键词
- `sortBy`: 排序字段
- `sortOrder`: 排序方向

**响应**：
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid-1234",
        "username": "channel1",
        "email": "channel1@example.com",
        "status": "active",
        "healthScore": 95,
        "dailyUploadCount": 3,
        "dailyUploadLimit": 10,
        "lastActive": "2025-07-26T08:00:00Z",
        "createdAt": "2025-01-15T10:00:00Z"
      }
    ],
    "total": 25,
    "page": 1,
    "pageSize": 20,
    "totalPages": 2
  }
}
```

#### 添加账户
```http
POST /api/v1/accounts
Content-Type: application/json

{
  "email": "newchannel@example.com",
  "password": "secure_password",
  "metadata": {
    "channelName": "我的频道",
    "notes": "主要上传教育内容"
  }
}
```

#### 批量导入账户
```http
POST /api/v1/accounts/import
Content-Type: application/json

{
  "format": "csv",
  "data": "email,password,notes\nchannel1@example.com,pass1,频道1\nchannel2@example.com,pass2,频道2"
}
```

**支持的格式**：
- `csv`: CSV 格式
- `json`: JSON 数组格式

#### 导出账户
```http
GET /api/v1/accounts/export?format=json&ids=id1,id2
```

#### 测试账户
```http
POST /api/v1/accounts/:id/test
```

#### 健康检查
```http
POST /api/v1/accounts/:id/health-check
```

#### 重置使用限制
```http
POST /api/v1/accounts/:id/reset-limits
```

### 4. 任务管理

#### 提交上传任务
```http
POST /api/v1/tasks
Content-Type: application/json

{
  "video": {
    "path": "/videos/sample.mp4",
    "title": "视频标题",
    "description": "视频描述内容",
    "tags": ["标签1", "标签2"],
    "category": "Education",
    "privacyStatus": "public",
    "thumbnail": "/thumbnails/sample.jpg"
  },
  "priority": 1,
  "accountId": "指定账户ID（可选）",
  "scheduledAt": "2025-07-27T10:00:00Z",
  "metadata": {
    "campaign": "夏季推广",
    "batchId": "batch-001"
  }
}
```

#### 批量提交任务
```http
POST /api/v1/tasks/batch
Content-Type: application/json

{
  "tasks": [
    {
      "video": {
        "path": "/videos/video1.mp4",
        "title": "视频1"
      }
    },
    {
      "video": {
        "path": "/videos/video2.mp4",
        "title": "视频2"
      }
    }
  ],
  "commonMetadata": {
    "campaign": "批量上传"
  }
}
```

#### 获取任务列表
```http
GET /api/v1/tasks?status=active&page=1&pageSize=20
```

**查询参数**：
- `status`: 任务状态（pending/active/completed/failed）
- `accountId`: 指定账户
- `priority`: 优先级
- `dateFrom/dateTo`: 时间范围
- `search`: 搜索关键词

#### 获取任务详情
```http
GET /api/v1/tasks/:id
```

#### 获取任务进度
```http
GET /api/v1/tasks/:id/progress
```

**响应**：
```json
{
  "success": true,
  "data": {
    "taskId": "task-uuid",
    "status": "uploading",
    "progress": 65,
    "currentStep": "正在上传视频文件",
    "estimatedTimeRemaining": 120
  }
}
```

#### 取消任务
```http
POST /api/v1/tasks/:id/cancel
```

#### 重试任务
```http
POST /api/v1/tasks/:id/retry
```

#### 批量操作
```http
PATCH /api/v1/tasks/batch
Content-Type: application/json

{
  "taskIds": ["id1", "id2", "id3"],
  "action": "cancel"
}
```

### 5. Dashboard API

#### 获取总览统计
```http
GET /api/dashboard/stats/overview
```

**响应**：
```json
{
  "success": true,
  "data": {
    "totalUploads24h": 156,
    "successRate": 94.2,
    "activeAccounts": 18,
    "queueDepth": 23,
    "systemHealth": 88
  }
}
```

#### 获取时间序列数据
```http
GET /api/dashboard/charts/timeseries?metric=uploads&period=7d
```

**查询参数**：
- `metric`: 指标类型（uploads/errors/performance）
- `period`: 时间周期（1h/24h/7d/30d）
- `interval`: 数据间隔

#### 获取分布统计
```http
GET /api/dashboard/charts/distribution?type=account
```

### 6. WebSocket 实时通信

#### 连接 WebSocket
```javascript
const socket = io('ws://localhost:5989', {
  auth: {
    token: 'YOUR_JWT_TOKEN'
  }
});
```

#### 订阅事件

**任务进度**：
```javascript
socket.on('upload:progress', (data) => {
  console.log('上传进度:', data.progress, '%');
});
```

**任务状态变更**：
```javascript
socket.on('task:statusChange', (data) => {
  console.log('任务状态更新:', data.status);
});
```

**系统通知**：
```javascript
socket.on('system:notification', (data) => {
  console.log('系统通知:', data.message);
});
```

## 错误处理

### 错误响应格式
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数验证失败",
    "details": [
      {
        "field": "video.title",
        "message": "标题不能为空"
      }
    ]
  }
}
```

### 常见错误码

| 错误码 | HTTP 状态码 | 说明 |
|--------|-------------|------|
| UNAUTHORIZED | 401 | 未认证或 Token 无效 |
| FORBIDDEN | 403 | 无权限访问该资源 |
| NOT_FOUND | 404 | 资源不存在 |
| VALIDATION_ERROR | 400 | 请求参数验证失败 |
| RATE_LIMIT_EXCEEDED | 429 | 请求频率超限 |
| SERVER_ERROR | 500 | 服务器内部错误 |
| SERVICE_UNAVAILABLE | 503 | 服务暂时不可用 |

## 使用示例

### JavaScript/TypeScript
```typescript
// 使用 axios 调用 API
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5989/api',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// 上传视频
async function uploadVideo() {
  try {
    const response = await api.post('/v1/tasks', {
      video: {
        path: '/videos/my-video.mp4',
        title: '我的视频',
        description: '这是一个测试视频'
      },
      priority: 1
    });
    
    console.log('任务已创建:', response.data);
  } catch (error) {
    console.error('上传失败:', error.response.data);
  }
}

// 获取任务状态
async function checkTaskStatus(taskId) {
  const response = await api.get(`/v1/tasks/${taskId}`);
  return response.data;
}
```

### Python
```python
import requests

# 配置 API
api_base = 'http://localhost:5989/api'
headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

# 上传视频
def upload_video():
    data = {
        'video': {
            'path': '/videos/my-video.mp4',
            'title': '我的视频',
            'description': '这是一个测试视频'
        },
        'priority': 1
    }
    
    response = requests.post(
        f'{api_base}/v1/tasks',
        json=data,
        headers=headers
    )
    
    return response.json()

# 批量获取账户
def get_accounts(page=1, status='active'):
    params = {
        'page': page,
        'pageSize': 20,
        'status': status
    }
    
    response = requests.get(
        f'{api_base}/v1/accounts',
        params=params,
        headers=headers
    )
    
    return response.json()
```

## 最佳实践

### 1. 认证管理
- 定期刷新 Token，避免过期
- 安全存储 Token，不要硬编码
- 使用 HTTPS 传输敏感信息

### 2. 错误处理
- 实现重试机制，使用指数退避算法
- 正确处理各种错误码
- 记录详细的错误日志

### 3. 性能优化
- 使用批量接口减少请求次数
- 合理使用分页，避免一次获取过多数据
- 利用 WebSocket 获取实时更新，减少轮询

### 4. 任务管理
- 合理设置任务优先级（0=普通，数字越大优先级越高）
- 让系统自动选择账户，实现负载均衡
- 定期检查失败任务并重试

### 5. 监控和维护
- 定期检查系统健康状态
- 监控账户健康分数
- 及时处理异常和警告

## 速率限制

默认速率限制：
- 认证接口：5 次/分钟
- 上传接口：100 次/小时
- 查询接口：1000 次/小时
- WebSocket 连接：每个 IP 最多 10 个并发连接

超过限制会返回 429 状态码，响应头包含：
- `X-RateLimit-Limit`: 限制数量
- `X-RateLimit-Remaining`: 剩余配额
- `X-RateLimit-Reset`: 重置时间

## 更新日志

### v1.0.0 (2025-07-26)
- 初始版本发布
- 完整的 RESTful API
- JWT 认证系统
- WebSocket 实时通信
- 批量操作支持