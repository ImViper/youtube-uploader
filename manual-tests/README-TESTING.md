# YouTube Matrix 测试指南

## 测试流程

### 1. 启动 Worker
```bash
cd manual-tests
node start-worker-0629.js
```
Worker 会持续运行，处理上传任务。保持这个窗口开启。

### 2. 创建并执行上传任务
在新的终端窗口运行：
```bash
cd manual-tests
node create-upload-task-0629.js
```
这个脚本会：
- 检查视频文件是否存在
- 验证 BitBrowser 窗口 0629
- 创建上传任务
- 监控上传进度

## 核心测试脚本

### 主要脚本
- `start-worker-0629.js` - 启动 Upload Worker V2
- `create-upload-task-0629.js` - 创建上传任务并监控进度

### 辅助工具
- `check-queue-status.js` - 检查队列和任务状态
- `check-task-error.js` - 查看失败任务的错误信息
- `clean-failed-tasks.js` - 清理失败的任务
- `check-bitbrowser-windows.js` - 检查 BitBrowser 窗口列表
- `test-bitbrowser-open.js` - 测试打开指定窗口

## 前置条件

1. **视频文件**：`C:\Users\75662\Downloads\aaa.mp4`
2. **BitBrowser 窗口**：名为 "0629" 的窗口
3. **服务运行**：
   - PostgreSQL 数据库
   - Redis 服务
   - BitBrowser 服务（端口 54345）
4. **账户配置**：至少一个 active 状态的账户

## 故障排查

### Worker 无法启动
- 检查数据库连接：`node test-db-connection.js`
- 检查 Redis 连接：`redis-cli ping`

### 找不到窗口 0629
- 运行 `node check-bitbrowser-windows.js` 查看所有窗口
- 在 BitBrowser 中创建名为 "0629" 的窗口

### 上传失败
- 运行 `node check-task-error.js` 查看错误详情
- 运行 `node check-queue-status.js` 查看队列状态
- 检查 BitBrowser 窗口中的 YouTube 登录状态

## 注意事项

1. Worker 使用 BullMQ，会在构造函数中自动启动，不需要调用 start() 方法
2. 队列名称必须是 'youtube-uploads'，不能包含冒号
3. BitBrowser API 的分页参数从 page: 0 开始，不是 page: 1
4. 确保账户的 bitbrowser_window_name 字段设置为 "0629"