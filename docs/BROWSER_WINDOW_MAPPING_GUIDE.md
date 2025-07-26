# 比特浏览器窗口映射使用指南

## 概述

本系统实现了YouTube账号与比特浏览器窗口的映射功能，每个YouTube账号对应一个预先登录好的比特浏览器窗口，避免了重复登录，提高了上传效率和账号安全性。

## 快速开始

### 1. 环境准备

确保已安装以下软件：
- Node.js 16+
- PostgreSQL 13+
- Redis 6+
- 比特浏览器（BitBrowser）

### 2. 配置文件设置

编辑 `src/config/browser-profiles.ts` 文件，配置账号与窗口的映射关系：

```typescript
export const browserProfiles: BrowserProfileMapping[] = [
  {
    accountEmail: 'youtube001@gmail.com',
    windowName: 'YouTube账号001',  // 必须与比特浏览器中的窗口名称完全一致
    proxy: {
      host: 'proxy1.example.com',
      port: 8080,
      protocol: 'http'
    }
  },
  {
    accountEmail: 'youtube002@gmail.com',
    windowName: 'YouTube账号002',
    // 不使用代理
  },
  // 添加更多账号映射...
];
```

### 3. 比特浏览器窗口准备

1. 打开比特浏览器
2. 创建与配置文件中对应的窗口（窗口名称必须完全一致）
3. 在每个窗口中登录对应的YouTube账号
4. 确保登录状态保持（勾选"记住我"）

### 4. 数据库迁移

运行数据库迁移脚本：

```bash
npm run db:migrate
```

或手动执行SQL：

```bash
psql -U your_user -d youtube_matrix < src/database/migrations/001_add_browser_window_mapping.sql
```

### 5. 初始化窗口映射

运行初始化脚本，将配置的映射关系同步到数据库：

```bash
npm run init:browsers
```

该脚本会：
- 读取配置文件中的映射关系
- 连接比特浏览器API获取窗口信息
- 创建或更新账号信息
- 检查每个窗口的YouTube登录状态
- 将映射关系保存到数据库

### 6. 检查窗口状态

定期检查所有窗口的状态和登录情况：

```bash
npm run check:browsers
```

输出示例：
```
=== Browser Status Report ===

Total Profiles: 3
Logged In: 2
Not Logged In: 1

┌─────────────────────┬──────────────────────────────────────┬─────────────────────┬────────┬────────┬───────────┬─────────┐
│     Window Name     │              Window ID               │       Account       │ Status │ Health │ Logged In │  Error  │
├─────────────────────┼──────────────────────────────────────┼─────────────────────┼────────┼────────┼───────────┼─────────┤
│   YouTube账号001    │ profile-001-xxxxx                    │ youtube001@gmail.com│ active │   100  │     ✓     │    -    │
│   YouTube账号002    │ profile-002-xxxxx                    │ youtube002@gmail.com│ active │   100  │     ✓     │    -    │
│   YouTube账号003    │ profile-003-xxxxx                    │ youtube003@gmail.com│ active │   100  │     ✗     │    -    │
└─────────────────────┴──────────────────────────────────────┴─────────────────────┴────────┴────────┴───────────┴─────────┘
```

## API使用

### 获取窗口映射列表

```bash
GET /api/browser/mappings
```

响应示例：
```json
{
  "success": true,
  "data": [
    {
      "windowId": "profile-001-xxxxx",
      "windowName": "YouTube账号001",
      "status": "idle",
      "account": {
        "id": "uuid",
        "email": "youtube001@gmail.com",
        "status": "active",
        "healthScore": 100,
        "isLoggedIn": true
      },
      "profile": {
        "isLoggedIn": true,
        "lastHealthCheck": "2024-01-26T10:00:00Z"
      },
      "configured": true
    }
  ]
}
```

### 手动映射账号到窗口

```bash
POST /api/browser/map
Content-Type: application/json

{
  "accountEmail": "youtube004@gmail.com",
  "windowId": "profile-004-xxxxx",
  "windowName": "YouTube账号004"
}
```

### 检查窗口登录状态

```bash
POST /api/browser/check-login
Content-Type: application/json

{
  "windowId": "profile-001-xxxxx"
}
```

### 同步配置文件映射

```bash
POST /api/browser/sync-mappings
```

## 上传工作流程

改造后的上传流程：

1. **获取可用账号**：系统自动选择健康且已登录的账号
2. **获取对应窗口**：根据账号映射找到对应的比特浏览器窗口
3. **连接浏览器**：通过Puppeteer连接到已打开的窗口
4. **验证登录状态**：快速检查是否仍然登录
5. **执行上传**：直接进行视频上传，无需登录步骤

## 故障排除

### 窗口未找到

**问题**：初始化时提示"Window not found in BitBrowser"

**解决方案**：
1. 确保比特浏览器正在运行
2. 检查窗口名称是否与配置文件完全一致（包括空格）
3. 使用比特浏览器API工具查看所有窗口列表

### 登录状态丢失

**问题**：窗口显示未登录

**解决方案**：
1. 手动在比特浏览器窗口中重新登录YouTube
2. 确保勾选"记住我"选项
3. 运行 `npm run check:browsers` 更新登录状态

### 上传失败

**问题**：上传时提示"No available account with logged-in browser window"

**解决方案**：
1. 运行 `npm run check:browsers` 查看窗口状态
2. 确保至少有一个窗口是登录状态
3. 检查账号健康度是否大于70

## 最佳实践

1. **定期检查**：每天运行一次 `npm run check:browsers` 确保所有窗口正常
2. **窗口命名**：使用统一的命名规范，如"YouTube账号001"
3. **代理配置**：为每个账号配置独立的代理，提高账号安全性
4. **备份配置**：定期备份 `browser-profiles.ts` 配置文件
5. **监控健康度**：关注账号健康度，及时处理异常账号

## 安全建议

1. **密码管理**：由于使用预登录窗口，账号密码可以留空，避免明文存储
2. **窗口隔离**：每个窗口使用独立的浏览器配置文件
3. **访问控制**：限制比特浏览器API的访问权限
4. **日志审计**：定期检查上传日志，发现异常行为

## 扩展功能

### 自动登录检查

设置环境变量启用自动登录检查：

```env
AUTO_LOGIN_CHECK=true
LOGIN_CHECK_INTERVAL=3600000  # 每小时检查一次
```

### 窗口池管理

系统支持窗口池管理，自动分配空闲窗口给上传任务，避免并发冲突。

### 健康度管理

- 上传成功：健康度+2（最高100）
- 上传失败：健康度-10（最低0）
- 健康度低于30：账号自动暂停使用

## 总结

通过账号与窗口的映射系统，我们实现了：
- ✅ 免登录上传，提高效率
- ✅ 降低账号风险，避免频繁登录
- ✅ 简化配置管理，易于扩展
- ✅ 完善的监控和健康检查机制