# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在处理此代码库时提供指导。

## 常用命令

### 构建
```bash
npm run build
```
使用 TypeScript 编译器将 `src/` 目录下的 TypeScript 文件编译到 `dist/` 目录。

### 开发服务器
```bash
npm run dev
# 或
npm run server
```
构建并启动开发服务器 (server.js)。

```bash
npm run dev:simple
```
构建并启动简化版服务器。

### 测试
```bash
npm test
```
使用 Jest 运行所有测试。

```bash
npm run test:watch
```
在监视模式下运行测试。

```bash
npm run test:coverage
```
运行测试并生成覆盖率报告。

```bash
npm run test:task
```
仅运行任务相关的测试。

### 数据库迁移
```bash
npm run db:migrate
```
从 `dist/database/migrate.js` 运行数据库迁移。

### 浏览器初始化
```bash
npm run init:browsers
```
初始化自动化所需的浏览器配置文件。

```bash
npm run check:browsers
```
检查浏览器配置文件的状态。

### 代码格式化
```bash
npm run format
```
使用 Prettier 格式化 `src/` 目录下的所有 TypeScript 文件，配置如下：
- 无分号
- 单引号
- 无尾随逗号
- 120 字符行宽
- 4 空格制表符

### 安装依赖
```bash
npm ci
```
从 package-lock.json 安装精确版本的依赖，确保构建一致性。

## 架构概览

本项目从一个 YouTube 上传自动化库演进为一个综合性的 YouTube Matrix 系统，具备完整的 API 服务器功能。

### 核心结构
- **主库导出**: `src/index.ts` 从 `src/upload.ts` 导出上传功能
- **服务器组件**: 
  - `src/server.js` - 带 WebSocket 支持的主 API 服务器
  - `src/server-simple.js` - 简化版服务器
- **API 结构**: 
  - `/api/v1/` - 版本化的 API 端点
  - `/api/matrix/` - YouTube Matrix 端点
  - `/api/task/` - 任务管理端点
  - `/api/account/` - 账户管理端点
- **浏览器自动化**: 使用 Puppeteer 配合 puppeteer-extra-plugin-stealth 避免检测

### 关键组件

#### 上传库 (`src/upload.ts`)
- `upload()` - 上传视频到 YouTube，支持进度跟踪
- `update()` - 更新视频元数据
- `comment()` - 添加评论（支持常规视频、Shorts 和直播）
- 支持多频道、播放列表、盈利选项

#### 类型定义 (`src/types.ts`)
- `Video` - 视频上传配置
- `VideoToEdit` - 视频更新配置  
- `Comment` - 评论配置
- `Credentials` - YouTube 账户凭证
- `MessageTransport` - 日志记录和用户交互回调
- `GameData` - 游戏分类数据

#### API 层
- 使用 Socket.IO 实现实时通信的 Express 服务器
- 使用 bcrypt 进行密码哈希的 JWT 身份验证
- PostgreSQL 数据库集成
- Redis/BullMQ 任务队列管理
- 使用 Pino 进行结构化日志记录

### 测试
- 支持 TypeScript 的 Jest 测试框架
- 测试结构位于 `src/__tests__/`
- 单元测试和集成测试
- 覆盖率报告
- 测试工具位于 `src/__tests__/setup.ts`

### 主要依赖
- **puppeteer** & **puppeteer-extra**: 浏览器自动化
- **express**: Web 框架
- **socket.io**: 实时通信
- **pg**: PostgreSQL 客户端
- **ioredis** & **bullmq**: Redis 和任务队列
- **jsonwebtoken**: JWT 身份验证
- **bcrypt**: 密码哈希
- **pino**: 结构化日志
- **zod**: 模式验证

### 构建配置
- TypeScript 目标: ES2017
- 模块系统: CommonJS
- 输出目录: `dist/`
- 启用严格模式
- 生成源码映射和声明文件
- 启用 JSON 模块解析

## 已知问题和解决方案

### Express 5.x req.query 只读问题

**问题描述**：
在 Express 5.x 版本中，`req.query` 属性是只读的，不能直接重新赋值。这会导致验证中间件报错：
```
TypeError: Cannot set property query of #<IncomingMessage> which has only a getter
```

**解决方案**：
验证中间件不应直接修改 `req.query`，而是将验证后的数据存储在自定义属性中：
```typescript
// 错误做法
req.query = await config.query.parseAsync(req.query);

// 正确做法
const validatedQuery = await config.query.parseAsync(req.query);
(req as any).validatedQuery = validatedQuery;
```

然后在控制器中使用：
```typescript
const queryParams = (req as any).validatedQuery || req.query;
```

**预防措施**：
- Express 版本已锁定为 5.1.0（无 ^ 符号）
- 验证中间件已更新为兼容方式