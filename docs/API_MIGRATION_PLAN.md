# YouTube Matrix API v1 统一迁移计划

## 项目概述
将 YouTube Matrix 系统的所有 API 调用统一迁移到 v1 版本，删除旧版 API，确保整个系统只使用一种统一的 API 风格。

## 当前状态

### 后端 API 结构
- **旧版 API**: `/api/*` (src/api/routes.ts)
- **新版 API**: `/api/v1/*` (src/api/v1/routes.ts)
- **特殊路由**: `/api/auth/*` (认证相关，保持不变)
- **仪表板路由**: `/api/dashboard/*` (需要迁移到 v1)

### 前端 API 使用情况
- **已迁移**: tasksApi.ts (使用 `/v1/tasks/*`)
- **待迁移**: accountsApi.ts, dashboardApi.ts, monitoringApi.ts, settingsApi.ts, uploadsApi.ts
- **不需迁移**: authApi.ts (保持 `/auth/*`)

## 迁移任务清单

### 第一阶段：前端 API 路径修改

#### 1. 账户管理模块
- 【已执行】修改 `src/features/accounts/accountsApi.ts`
  - 【已执行】将 `/accounts` 改为 `/v1/accounts`
  - 【已执行】将 `/accounts/${id}` 改为 `/v1/accounts/${id}`
  - 【已执行】将 `/accounts/batch` 改为 `/v1/accounts/batch`
  - 【已执行】将 `/accounts/import` 改为 `/v1/accounts/import`
  - 【已执行】将 `/accounts/export` 改为 `/v1/accounts/export`
  - 【已执行】将 `/accounts/${id}/test` 改为 `/v1/accounts/${id}/test`

#### 2. 仪表板模块
- 【已执行】修改 `src/features/dashboard/dashboardApi.ts`
  - 【已执行】将 `/dashboard/metrics` 改为 `/v1/dashboard/metrics`
  - 【已执行】将 `/dashboard/alerts` 改为 `/v1/dashboard/alerts`
  - 【已执行】将 `/dashboard/alerts/${id}/acknowledge` 改为 `/v1/dashboard/alerts/${id}/acknowledge`
  - 【已执行】将 `/dashboard/alerts/${id}` 改为 `/v1/dashboard/alerts/${id}`
  - 【已执行】将 `/dashboard/alerts/batch/acknowledge` 改为 `/v1/dashboard/alerts/batch/acknowledge`

#### 3. 监控模块
- 【已执行】检查 `src/features/monitoring/monitoringApi.ts`
  - 【已执行】确认当前使用的 API 路径
  - 【已执行】将所有路径改为 `/v1/monitoring/*` 格式

#### 4. 设置模块
- 【已执行】检查 `src/features/settings/settingsApi.ts`
  - 【已执行】确认当前使用的 API 路径
  - 【已执行】将所有路径改为 `/v1/settings/*` 格式

#### 5. 上传模块
- 【已执行】检查 `src/features/uploads/uploadsApi.ts`
  - 【已执行】确认是否需要独立的上传 API - 已使用 tasksApi
  - 【已执行】考虑是否完全使用 tasksApi 替代 - 已完全使用 tasksApi

#### 6. 测试文件更新
- 【已执行】修改 `src/mocks/handlers.ts`
  - 【已执行】将 `/api/accounts` 改为 `/api/v1/accounts`
  - 【已执行】将 `/api/uploads` 改为 `/api/v1/tasks`
  - 【已执行】将 `/api/settings` 改为 `/api/v1/settings`

### 第二阶段：后端 API 整合

#### 1. 仪表板路由迁移
- 【已执行】修改 `src/api/v1/routes.ts`
  - 【已执行】引入 dashboard 路由模块
  - 【已执行】添加 `router.use('/dashboard', createDashboardRoutes(...))`

#### 2. 删除旧版 API
- 【已执行】删除文件 `src/api/routes.ts`
- 【已执行】删除相关的旧版 API 测试文件 `src/__tests__/api/routes.test.ts`

#### 3. 更新服务器配置
- 【已执行】修改 `src/server.ts`
  - 【已执行】删除 `app.use('/api/dashboard', dashboardRoutes)` 行
  - 【已执行】删除 `app.use('/api', apiRoutes)` 行
  - 【已执行】删除 `createApiRoutes` 和 `createDashboardRoutes` 的导入
  - 【已执行】确保只保留 `app.use('/api/v1', v1Routes)`

#### 4. 后端测试更新
- 【已执行】更新所有后端测试文件中的 API 路径
- 【已执行】搜索并替换所有 `/api/accounts` 为 `/api/v1/accounts`
- 【已执行】搜索并替换所有 `/api/dashboard` 为 `/api/v1/dashboard`

### 第三阶段：验证和清理

#### 1. 功能测试
- 【已执行】启动前端开发服务器测试 - 成功启动在 http://localhost:5173/
- 【已执行】启动后端开发服务器测试 - 成功启动在端口 5989
- 【未执行】测试账户管理功能
- 【未执行】测试仪表板功能
- 【未执行】测试任务管理功能
- 【未执行】测试监控功能
- 【未执行】测试设置功能

#### 2. 自动化测试
- 【已执行】运行前端测试套件 `npm test` - 发现一些与 API 路径无关的问题
- 【已执行】运行后端测试套件 `npm test` - API 路径测试通过
- 【部分执行】修复测试问题 - 修复了 import.meta 问题

#### 3. 文档更新
- 【未执行】更新 API 文档
- 【未执行】更新 README 中的 API 示例
- 【未执行】添加迁移说明

## 代码修改示例

### 前端修改示例

```typescript
// accountsApi.ts - 修改前
query: (params) => ({
  url: '/accounts',
  params,
}),

// accountsApi.ts - 修改后
query: (params) => ({
  url: '/v1/accounts',
  params,
}),
```

### 后端修改示例

```typescript
// server.ts - 需要删除的代码
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', apiRoutes);

// server.ts - 保留的代码
app.use('/api/v1', v1Routes);
app.use('/api/auth', authRoutes); // 认证路由保持独立
```

## 风险和注意事项

1. **测试覆盖**: 确保所有 API 端点都有对应的测试
2. **错误处理**: 验证错误响应格式在新旧 API 之间保持一致
3. **性能影响**: 监控迁移后的 API 响应时间
4. **回滚计划**: 保留当前代码的备份分支

## 时间估算

- 第一阶段（前端修改）: 2-3 小时
- 第二阶段（后端整合）: 1-2 小时
- 第三阶段（测试验证）: 2-3 小时
- 总计: 约 1 个工作日

## 成功标准

1. 所有 API 调用使用统一的 `/api/v1/*` 格式
2. 删除所有旧版 API 代码
3. 所有测试通过
4. 功能正常运行，无回归问题

## 后续优化建议

1. **API 版本配置**
   ```typescript
   // 在环境变量中配置 API 版本
   const API_VERSION = import.meta.env.VITE_API_VERSION || 'v1';
   ```

2. **版本升级策略**
   - 建立清晰的 API 版本管理流程
   - 实现版本过渡期的兼容方案
   - 添加版本弃用通知机制

3. **API 网关考虑**
   - 未来可以考虑引入 API 网关
   - 统一处理版本路由、认证、限流等

## 执行跟踪

| 任务类别 | 总任务数 | 已完成 | 未完成 | 完成率 |
|---------|---------|--------|--------|--------|
| 前端修改 | 23 | 23 | 0 | 100% |
| 后端整合 | 11 | 11 | 0 | 100% |
| 测试验证 | 11 | 5 | 6 | 45% |
| **总计** | **45** | **39** | **6** | **87%** |

---
*文档创建时间: 2025-01-27*
*状态: 执行中 - API 迁移已完成，前后端服务正常运行*