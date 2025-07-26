# API 端点总结

## 已实现的端点

### 1. 认证 (Auth) - ✅ 完整实现
- `POST /api/auth/login` - 登录
- `POST /api/auth/logout` - 登出
- `GET /api/auth/me` - 获取当前用户
- `POST /api/auth/refresh` - 刷新令牌

### 2. 账号管理 (Accounts) - ✅ 基本实现
- `GET /api/accounts` - 获取账号列表
- `GET /api/accounts/:id` - 获取单个账号
- `POST /api/accounts` - 创建账号
- `PATCH /api/accounts/:id` - 更新账号
- `DELETE /api/accounts/:id` - 删除账号
- `POST /api/accounts/:id/test` - 测试账号
- `PATCH /api/accounts/:id/window-login` - 更新窗口登录状态
- `POST /api/accounts/sync-windows` - 同步BitBrowser窗口

**缺失的端点**：
- `DELETE /api/accounts/batch` - 批量删除
- `POST /api/accounts/import` - 导入账号
- `GET /api/accounts/export` - 导出账号

### 3. 任务管理 (Tasks) - ✅ V1 API 实现
**正确的端点路径是 `/api/v1/tasks`**
- `GET /api/v1/tasks` - 获取任务列表
- `GET /api/v1/tasks/:id` - 获取单个任务
- `POST /api/v1/tasks` - 创建任务
- `POST /api/v1/tasks/batch` - 批量创建任务
- `PATCH /api/v1/tasks/:id` - 更新任务
- `POST /api/v1/tasks/:id/cancel` - 取消任务
- `POST /api/v1/tasks/:id/retry` - 重试任务
- `GET /api/v1/tasks/:id/progress` - 获取任务进度
- `POST /api/v1/tasks/:id/schedule` - 安排任务
- `GET /api/v1/tasks/stats` - 任务统计
- `POST /api/v1/tasks/clean` - 清理旧任务

### 4. 仪表板 (Dashboard) - ✅ 实现
- `GET /api/dashboard/metrics` - 获取仪表板指标
- `GET /api/dashboard/alerts` - 获取警报
- `POST /api/dashboard/alerts/:id/acknowledge` - 确认警报
- `DELETE /api/dashboard/alerts/:id` - 删除警报
- `POST /api/dashboard/alerts/batch/acknowledge` - 批量确认警报
- `POST /api/dashboard/alerts` - 创建警报
- `GET /api/dashboard/stats/overview` - 概览统计
- `GET /api/dashboard/stats/tasks` - 任务统计
- `GET /api/dashboard/stats/accounts` - 账号统计
- `GET /api/dashboard/stats/performance` - 性能统计
- `GET /api/dashboard/charts/timeseries` - 时序图表数据
- `GET /api/dashboard/charts/distribution` - 分布图表数据
- `GET /api/dashboard/charts/trends` - 趋势分析

### 5. 设置 (Settings) - ❌ 未实现
前端期望但后端未实现的端点：
- `GET /api/settings`
- `PATCH /api/settings`
- `POST /api/settings/reset`
- `POST /api/settings/test-email`
- `POST /api/settings/backup`
- `POST /api/settings/restore`
- `GET /api/settings/backups`

### 6. 监控 (Monitoring) - ❌ 未实现
前端期望但后端未实现的端点：
- `GET /api/monitoring/performance`
- `GET /api/monitoring/uploads`
- `GET /api/monitoring/errors`
- `POST /api/monitoring/reports`
- `GET /api/monitoring/reports/:id`
- `GET /api/monitoring/reports/:id/download`

## 前端需要的修改

### 1. 立即修改 - 使用正确的任务API
```typescript
// 将所有 /api/uploads 改为 /api/v1/tasks
// uploadsApi.ts 已经修改为使用 tasksApi
```

### 2. 需要实现的后端端点
- Settings API - 用于系统设置管理
- Monitoring API - 用于性能监控和报告生成
- 账号批量操作 - 批量删除、导入、导出

### 3. 数据模型映射
前端的 Upload 概念需要映射到后端的 Task：
- Upload.status 映射规则：
  - `pending` → `pending/queued`
  - `uploading` → `processing`
  - `completed` → `completed`
  - `failed` → `failed`
  - `cancelled` → `cancelled`

## 建议的实施步骤

1. **测试现有功能**
   - 登录功能 ✅
   - 账号列表 ✅ (需要重启后端确保服务初始化)
   - 任务列表（使用 /api/v1/tasks）

2. **实现缺失的端点**
   - Settings API
   - Monitoring API
   - 账号批量操作

3. **统一错误处理**
   - 确保所有端点返回一致的错误格式
   - 添加请求日志和错误追踪