# 前端 API 映射指南

## 概念映射

YouTube Matrix 系统使用了更通用的"任务(Task)"概念，而不是单纯的"上传(Upload)"。这是因为系统支持多种操作类型：

- **upload** - 上传视频
- **update** - 更新视频信息
- **comment** - 添加评论
- **analytics** - 获取分析数据

## 正确的 API 端点

### 1. 任务管理（前端称为"Uploads"）

前端当前使用的端点应该修改为：

| 前端期望 | 应该使用 | 说明 |
|---------|---------|-----|
| GET /api/uploads | GET /api/tasks?type=upload | 获取上传任务列表 |
| POST /api/uploads | POST /api/tasks | 创建新上传任务 |
| GET /api/uploads/:id | GET /api/tasks/:id | 获取单个任务详情 |
| PATCH /api/uploads/:id | PATCH /api/tasks/:id | 更新任务信息 |
| POST /api/uploads/:id/cancel | POST /api/tasks/:id/cancel | 取消任务 |
| POST /api/uploads/:id/retry | POST /api/tasks/:id/retry | 重试任务 |

### 2. 账号管理

账号管理的端点是正确的，在 `/api/accounts` 下。

### 3. 任务创建示例

创建上传任务时，请求体应该是：

```json
{
  "type": "upload",
  "priority": "normal",
  "accountId": "account-uuid",
  "video": {
    "path": "/path/to/video.mp4",
    "title": "视频标题",
    "description": "视频描述",
    "tags": ["tag1", "tag2"],
    "thumbnail": "/path/to/thumbnail.jpg",
    "publishType": "PUBLIC"
  }
}
```

## 前端修改建议

### 方案一：修改前端使用正确的API（推荐）

1. 修改 `uploadsApi.ts` 中的端点路径
2. 调整请求体格式以匹配任务API
3. 将 "upload" 概念扩展为 "task"，为将来支持其他任务类型做准备

### 方案二：后端添加兼容层（临时方案）

在后端添加 `/api/uploads` 路由，内部转发到 `/api/tasks`。这是我刚才尝试的方案，但不推荐长期使用。

## 数据模型对比

### 前端 Upload 模型
```typescript
interface Upload {
  id: string;
  accountId: string;
  videoPath: string;
  title: string;
  description: string;
  tags: string[];
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  // ...
}
```

### 后端 Task 模型
```typescript
interface Task {
  id: string;
  type: 'upload' | 'update' | 'comment' | 'analytics';
  status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  accountId?: string;
  video?: Video;  // 视频信息在这里
  progress?: number;
  // ...
}
```

## 建议的修改步骤

1. **更新 API 客户端**
   - 修改 `uploadsApi.ts` 使用 `/api/tasks` 端点
   - 添加 `type: 'upload'` 过滤参数

2. **调整数据转换**
   - 将前端的 Upload 模型映射到后端的 Task 模型
   - 提取 `video` 字段中的信息显示在列表中

3. **扩展功能**
   - 考虑将 "Uploads" 页面重命名为 "Tasks"
   - 添加任务类型筛选器
   - 为将来支持其他任务类型做准备

## 总结

YouTube Matrix 的设计是正确的，使用通用的任务系统而不是单一的上传功能。前端应该适配这个设计，而不是让后端迁就前端的限制。这样可以保持系统的扩展性和一致性。