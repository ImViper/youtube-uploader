# BitBrowser 集成文档

## 概述

YouTube Matrix 系统已完整集成 BitBrowser 窗口管理功能，实现了自动窗口发现、状态同步和预登录窗口使用。

## 功能特性

1. **自动窗口发现**：根据窗口名称自动查找对应的 BitBrowser 窗口 ID
2. **状态同步**：定期同步窗口状态，检测窗口是否存在和登录状态
3. **预登录支持**：使用已登录 YouTube 的 BitBrowser 窗口进行上传
4. **窗口管理**：支持打开、关闭和管理 BitBrowser 窗口

## 技术架构

### 前端改动

1. **账号表单** (`AccountFormModal.tsx`)
   - 新增浏览器窗口名称输入字段
   - 用户输入窗口名称而非窗口 ID

2. **账号列表** (`AccountList.tsx`)
   - 显示窗口名称
   - 显示窗口登录状态（已登录/未登录）

3. **Redux Store** (`accountsSlice.ts`)
   - 新增字段：
     - `browserWindowName`: 窗口名称
     - `browserWindowId`: 窗口 ID（自动获取）
     - `isWindowLoggedIn`: 窗口登录状态

### 后端实现

1. **BitBrowser 客户端** (`src/bitbrowser/client.ts`)
   ```typescript
   export class BitBrowserClient {
     // 列出所有窗口
     async listWindows(): Promise<BitBrowserWindow[]>
     
     // 根据名称查找窗口
     async findWindowByName(windowName: string): Promise<BitBrowserWindow | null>
     
     // 打开窗口
     async openWindow(windowId: string): Promise<boolean>
     
     // 关闭窗口
     async closeWindow(windowId: string): Promise<boolean>
   }
   ```

2. **账号管理器** (`src/accounts/manager.ts`)
   - 创建账号时自动查找窗口 ID
   - 支持窗口状态同步
   - 更新窗口登录状态

3. **API 端点**
   - `POST /api/accounts` - 创建账号时包含窗口名称
   - `PATCH /api/accounts/:id/window-login` - 更新窗口登录状态
   - `POST /api/accounts/sync-windows` - 同步所有窗口状态

## 配置说明

### 环境变量

后端 `.env` 文件：
```env
# BitBrowser API 配置
BITBROWSER_API_URL=http://127.0.0.1:54345
```

### 端口配置

- **BitBrowser API**: 54345
- **后端服务**: 5989
- **PostgreSQL**: 5987
- **Redis**: 5988

## 使用流程

### 1. 准备 BitBrowser 窗口

1. 启动 BitBrowser
2. 创建新窗口并命名（如 "YouTube账号1"）
3. 在窗口中登录 YouTube 账号
4. 保持窗口运行状态

### 2. 添加账号

1. 在系统中点击"添加账号"
2. 填写账号信息
3. 在"浏览器窗口名称"字段输入 BitBrowser 中的窗口名称
4. 系统自动查找并关联窗口

### 3. 窗口状态管理

- 系统会定期同步窗口状态
- 窗口删除或离线会自动更新状态
- 可手动触发窗口同步

## 测试方法

使用提供的测试脚本验证集成：

```bash
node test-bitbrowser-integration.js
```

测试脚本会：
1. 列出所有 BitBrowser 窗口
2. 创建测试账号并关联窗口
3. 同步窗口状态
4. 测试账号连接
5. 更新窗口登录状态

## 故障排除

### 常见问题

1. **无法连接 BitBrowser**
   - 检查 BitBrowser 是否运行
   - 确认 API 端口是否为 54345
   - 检查防火墙设置

2. **窗口未找到**
   - 确认窗口名称完全匹配（区分大小写）
   - 检查窗口是否存在
   - 尝试手动同步窗口

3. **登录状态不正确**
   - 手动更新窗口登录状态
   - 检查 YouTube 登录是否有效
   - 清除浏览器缓存重新登录

### 日志位置

- 后端日志：查看控制台输出
- BitBrowser 日志：BitBrowser 安装目录下的 logs 文件夹

## API 参考

### BitBrowser API

基础 URL: `http://127.0.0.1:54345`

#### 列出窗口
```
GET /browser/list
```

响应示例：
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "id": "abc123",
        "name": "YouTube账号1",
        "status": 1,
        "groupId": "default"
      }
    ]
  }
}
```

#### 打开窗口
```
POST /browser/open
Body: { "id": "abc123" }
```

#### 关闭窗口
```
POST /browser/close
Body: { "id": "abc123" }
```

## 注意事项

1. **窗口命名**：使用清晰、唯一的窗口名称
2. **登录保持**：确保 YouTube 登录状态有效
3. **资源管理**：及时关闭不使用的窗口
4. **定期同步**：建议定期执行窗口同步

## 未来改进

1. 自动检测窗口登录状态
2. 批量窗口管理界面
3. 窗口使用统计和报告
4. 自动窗口分配策略