# YouTube Matrix 测试指南

## 快速开始

### 方法一：使用批处理文件（推荐）
```bash
cd manual-tests
run-test.bat
```
然后按照菜单选择操作。

### 方法二：手动执行

#### 步骤 1：启动 Worker（新窗口）
```bash
cd manual-tests
node start-worker-0629.js
```
保持这个窗口运行。

#### 步骤 2：创建上传任务（另一个窗口）
```bash
cd manual-tests
node create-upload-task-0629.js
```

## 核心测试文件说明

### 主要执行文件
| 文件名 | 用途 | 说明 |
|--------|------|------|
| `start-worker-0629.js` | 启动 Worker | 处理上传任务，需要持续运行 |
| `create-upload-task-0629.js` | 创建上传任务 | 创建任务并监控进度 |
| `run-test.bat` | 测试菜单 | 交互式菜单，方便执行各种操作 |

### 辅助工具
| 文件名 | 用途 | 使用场景 |
|--------|------|----------|
| `check-queue-status.js` | 检查队列状态 | 查看等待/活跃/失败的任务 |
| `check-task-error.js` | 查看错误详情 | 任务失败时查看具体原因 |
| `clean-failed-tasks.js` | 清理失败任务 | 清理队列中的失败任务 |
| `check-bitbrowser-windows.js` | 列出所有窗口 | 检查 BitBrowser 窗口列表 |
| `test-bitbrowser-open.js` | 测试窗口打开 | 验证窗口 0629 是否能正常打开 |

## 测试前检查清单

- [ ] 视频文件存在：`C:\Users\75662\Downloads\aaa.mp4`
- [ ] BitBrowser 服务运行中（端口 54345）
- [ ] BitBrowser 中有名为 "0629" 的窗口
- [ ] PostgreSQL 数据库运行中
- [ ] Redis 服务运行中
- [ ] 数据库中有 active 状态的账户

## 常见问题

### Q: 为什么要用 create-upload-task-0629.js 而不是其他测试文件？
A: 这是最精简的版本，专门针对窗口 0629 的测试，包含了所有必要功能：
- 视频文件检查
- BitBrowser 窗口验证
- 账户配置
- 任务创建
- 进度监控

### Q: Worker 启动报错 "Worker is already running"
A: 这是因为 BullMQ Worker 在构造函数中自动启动。我们的 start-worker-0629.js 已经处理了这个问题。

### Q: 找不到窗口 0629
A: 
1. 运行 `node check-bitbrowser-windows.js` 查看所有窗口
2. 在 BitBrowser 中创建一个名为 "0629" 的窗口
3. 确保 BitBrowser API 使用 `page: 0` 而不是 `page: 1`

### Q: 上传任务一直是 pending 状态
A: 
1. 确认 Worker 正在运行
2. 检查队列状态：`node check-queue-status.js`
3. 查看是否有失败任务阻塞：`node clean-failed-tasks.js`

## 测试流程图

```
1. 启动 Worker (start-worker-0629.js)
   ↓
2. 创建任务 (create-upload-task-0629.js)
   ↓
3. Worker 处理任务
   ├─ 成功 → 显示视频链接
   └─ 失败 → 运行 check-task-error.js 查看原因
```

## 已清理的重复文件

以下文件已被删除，因为功能与 `create-upload-task-0629.js` 重复：
- full-upload-test-0629.js
- real-upload-0629.js
- test-upload-0629-final.js
- auto-upload-test.js
- direct-upload-test.js
- 等等...

保留的都是最核心、最精简的测试脚本。