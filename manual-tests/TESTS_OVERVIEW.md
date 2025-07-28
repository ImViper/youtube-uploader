# Manual Tests Overview

## 测试文件分类

### 0. 单元测试（新增）

位于 `unit-tests/` 目录下，包含从 `src/__tests__` 迁移过来的所有单元测试：
- `unit-tests/api/auth.test.ts` - 认证模块单元测试
- `unit-tests/api/account/*.test.ts` - 账户管理单元测试
- `unit-tests/api/task/*.test.ts` - 任务管理单元测试
- `unit-tests/api/matrix/*.test.ts` - Matrix 模块单元测试
- `unit-tests/api/v1/routes.test.ts` - API v1 路由单元测试

### 1. 核心功能测试（保留）

#### 账户管理测试
- `test-account-creation.js` - 账户创建功能测试
- `test-account-bitbrowser.js` - 账户与BitBrowser映射测试
- `test-final-bitbrowser.js` - BitBrowser集成测试（最新）

#### 上传功能测试
- `test-window-0629.js` - 0629窗口连接测试（用户确认可用）
- `test-upload-with-popup-handling.js` - 带弹窗处理的上传测试
- `test-unified-upload.js` - 统一上传流程测试

#### 主流程测试
- `test-main-flow-clean.js` - 数据库清理后的主流程测试（最新）

### 2. 工具脚本（保留）

#### 数据库管理
- `cleanup-database.js` - 数据库清理脚本
- `create-admin.js` - 创建管理员账户

#### 服务器管理
- `start-server.js` - 启动服务器
- `stop-server.bat` - 停止服务器（Windows）
- `build.js` - 构建脚本

### 3. API测试（保留部分）
- `api-auth.test.js` - 认证API测试
- `api-accounts-detailed.test.js` - 账户API详细测试
- `api-endpoints.test.js` - API端点测试

### 4. 待删除的旧测试

以下测试文件功能重复或已过时，建议删除：
- `test-add-to-queue.js` - 被unified-upload替代
- `test-bitbrowser-connection.js` - 被final-bitbrowser替代
- `test-bitbrowser-upload.js` - 被unified-upload替代
- `test-complete-upload-flow.js` - 被unified-upload替代
- `test-direct-upload.js` - 被unified-upload替代
- `test-full-flow.js` - 被main-flow-clean替代
- `test-queue-check.js` - 被unified-upload替代
- `test-queue-simple.js` - 被unified-upload替代
- `test-integration-upload.js` - 被unified-upload替代
- `test-upload-logged-in.js` - 被unified-upload替代
- `test-upload-via-queue.js` - 被unified-upload替代
- `test-task-creation.js` - 被main-flow-clean替代
- `test-real-task.js` - 被unified-upload替代
- `test-quick-upload.js` - 被unified-upload替代
- `test-debug-metadata.js` - 调试用，可删除
- `test-account-debug.js` - 调试用，可删除
- `test-direct-db.js` - 直接数据库测试，可删除
- `test-main-flow-after-cleanup.js` - 被main-flow-clean替代

## 建议的测试执行顺序

1. **环境准备**
   ```bash
   # 构建项目
   node build.js
   
   # 启动服务器
   node start-server.js
   
   # 创建管理员账户
   node create-admin.js
   ```

2. **核心功能测试**
   ```bash
   # 测试主流程
   node test-main-flow-clean.js
   
   # 测试BitBrowser集成
   node test-final-bitbrowser.js
   
   # 测试0629窗口
   node test-window-0629.js
   
   # 测试统一上传流程
   node test-unified-upload.js
   ```

3. **API测试**
   ```bash
   # 测试认证API
   node api-auth.test.js
   
   # 测试账户API
   node api-accounts-detailed.test.js
   ```

## 注意事项

1. 确保服务器在运行测试前已启动
2. 确保数据库已正确配置
3. 确保BitBrowser服务在运行
4. 测试后可使用 `stop-server.bat` 停止服务器