# YouTube Matrix API v1 迁移指南

## 概述

本指南帮助您从旧版 API (`/api/*`) 迁移到新的统一 v1 API (`/api/v1/*`)。v1 API 提供了更一致的接口设计、更好的错误处理和改进的性能。

## 主要变化

### 1. 基础 URL 变更

所有 API 端点现在都使用 `/api/v1` 前缀：

```
旧版: http://localhost:4000/api/accounts
新版: http://localhost:4000/api/v1/accounts
```

### 2. 端点名称变更

| 旧端点 | 新端点 | 说明 |
|--------|--------|------|
| `/api/uploads` | `/api/v1/tasks` | 上传功能重命名为任务 |
| `/api/dashboard/*` | `/api/v1/dashboard/*` | 仪表板端点移至 v1 |
| `/api/accounts` | `/api/v1/accounts` | 账户管理端点 |
| `/api/settings` | `/api/v1/settings` | 设置端点 |
| `/api/monitoring` | `/api/v1/monitoring` | 监控端点 |

### 3. 认证端点保持不变

认证相关的端点保持在 `/api/auth/*`，无需修改：
- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/refresh`
- `/api/auth/register`

## 迁移步骤

### 步骤 1：更新 API 客户端配置

更新您的 API 基础 URL：

```javascript
// 旧版
const API_BASE_URL = 'http://localhost:4000/api';

// 新版
const API_BASE_URL = 'http://localhost:4000/api/v1';
```

### 步骤 2：更新 API 调用

#### 账户管理

```javascript
// 旧版
fetch('/api/accounts')
fetch('/api/accounts/123')
fetch('/api/accounts/batch', { method: 'POST' })

// 新版
fetch('/api/v1/accounts')
fetch('/api/v1/accounts/123')
fetch('/api/v1/accounts/batch', { method: 'POST' })
```

#### 任务管理（原上传管理）

```javascript
// 旧版
fetch('/api/uploads')
fetch('/api/uploads/123')
fetch('/api/uploads', { method: 'POST' })

// 新版
fetch('/api/v1/tasks')
fetch('/api/v1/tasks/123')
fetch('/api/v1/tasks', { method: 'POST' })
```

#### 仪表板

```javascript
// 旧版
fetch('/api/dashboard/metrics')
fetch('/api/dashboard/alerts')

// 新版
fetch('/api/v1/dashboard/metrics')
fetch('/api/v1/dashboard/alerts')
```

#### 监控

```javascript
// 旧版
fetch('/api/monitoring/performance')
fetch('/api/monitoring/uploads')

// 新版
fetch('/api/v1/monitoring/performance')
fetch('/api/v1/monitoring/uploads')
```

#### 设置

```javascript
// 旧版
fetch('/api/settings')
fetch('/api/settings', { method: 'PATCH' })

// 新版
fetch('/api/v1/settings')
fetch('/api/v1/settings', { method: 'PATCH' })
```

### 步骤 3：使用 RTK Query（推荐）

如果您使用 Redux Toolkit Query，更新您的 API 定义：

```typescript
// accountsApi.ts
const accountsApi = createApi({
  reducerPath: 'accountsApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/v1', // 更新基础 URL
    // ... 其他配置
  }),
  endpoints: (builder) => ({
    getAccounts: builder.query({
      query: () => '/accounts', // 相对路径保持不变
    }),
    // ... 其他端点
  }),
});
```

### 步骤 4：更新 WebSocket 连接

WebSocket 连接保持不变，但事件命名可能有所调整：

```javascript
// 连接保持不变
const socket = io('ws://localhost:4000', {
  auth: { token: 'jwt-token' }
});

// 事件名称可能从 upload:* 改为 task:*
socket.on('task:progress', (data) => {
  console.log('任务进度:', data);
});

socket.on('task:complete', (data) => {
  console.log('任务完成:', data);
});
```

## 兼容性说明

### 响应格式

v1 API 保持了与旧版相同的响应格式：

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

### 错误代码

错误代码保持不变，确保错误处理逻辑无需修改。

### 请求头

所有请求头要求保持不变：
- `Authorization: Bearer <token>` （需要认证的端点）
- `Content-Type: application/json` （JSON 请求）

## 测试迁移

### 1. 单元测试更新

更新测试中的 API 路径：

```javascript
// 旧版
describe('Accounts API', () => {
  it('should fetch accounts', async () => {
    const response = await fetch('/api/accounts');
    // ...
  });
});

// 新版
describe('Accounts API', () => {
  it('should fetch accounts', async () => {
    const response = await fetch('/api/v1/accounts');
    // ...
  });
});
```

### 2. 集成测试更新

更新 Mock Service Worker (MSW) 处理器：

```javascript
// 旧版
rest.get('/api/accounts', (req, res, ctx) => {
  return res(ctx.json({ success: true, data: [] }));
});

// 新版
rest.get('/api/v1/accounts', (req, res, ctx) => {
  return res(ctx.json({ success: true, data: [] }));
});
```

## 常见问题

### Q: 旧版 API 还能使用多久？

A: 旧版 API 已被完全移除。请尽快完成迁移到 v1 API。

### Q: 是否有自动迁移工具？

A: 目前没有自动迁移工具，但迁移过程相对简单，主要是 URL 路径的更新。

### Q: 迁移后功能是否有变化？

A: 功能保持不变，只是端点路径和部分命名有所调整（如 uploads 改为 tasks）。

### Q: 如何处理缓存？

A: 建议在迁移后清除客户端缓存，确保使用新的 API 端点。

## 迁移检查清单

- [ ] 更新 API 基础 URL 为 `/api/v1`
- [ ] 更新所有 API 调用端点
- [ ] 更新 Redux/RTK Query 配置
- [ ] 更新 WebSocket 事件监听器
- [ ] 更新单元测试中的 API 路径
- [ ] 更新集成测试和 mock 处理器
- [ ] 清除客户端缓存
- [ ] 测试所有功能确保正常工作

## 需要帮助？

如果在迁移过程中遇到问题，请：

1. 查看 [API 文档](./API.md) 了解详细的端点信息
2. 检查浏览器控制台的错误信息
3. 查看服务器日志了解具体错误
4. 在项目 Issues 中提问

## 更新日志

- **2025-01-27**: 初始迁移指南发布
- 所有旧版 API 端点已移除
- 统一使用 v1 API