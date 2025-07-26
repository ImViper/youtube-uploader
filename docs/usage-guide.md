# YouTube Matrix Upload 使用指南

## 目录

1. [系统概述](#系统概述)
2. [环境准备](#环境准备)
3. [安装配置](#安装配置)
4. [快速开始](#快速开始)
5. [账号管理](#账号管理)
6. [视频上传](#视频上传)
7. [系统监控](#系统监控)
8. [高级配置](#高级配置)
9. [故障排除](#故障排除)
10. [API使用](#api使用)

## 系统概述

YouTube Matrix Upload 是一个支持多账号并行上传的自动化系统，主要特点：

- 🚀 支持20-30个YouTube账号并行管理
- 🔒 使用BitBrowser实现浏览器配置隔离
- 📊 智能账号选择和健康监控
- 🔄 自动重试和错误恢复
- 📈 实时监控和性能分析
- 🛡️ 安全的凭据加密存储

## 环境准备

### 系统要求

- **操作系统**: Windows 10+, macOS 10.15+, Ubuntu 20.04+
- **Node.js**: 16.0.0 或更高版本
- **内存**: 最少 8GB RAM（推荐 16GB）
- **存储**: 至少 50GB 可用空间
- **网络**: 稳定的互联网连接（上传带宽 10Mbps+）

### 依赖服务

1. **PostgreSQL 13+**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install postgresql postgresql-contrib
   
   # macOS
   brew install postgresql
   
   # Windows
   # 下载安装程序: https://www.postgresql.org/download/windows/
   ```

2. **Redis 6.0+**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install redis-server
   
   # macOS
   brew install redis
   
   # Windows
   # 下载: https://github.com/microsoftarchive/redis/releases
   ```

3. **BitBrowser**
   - 下载地址: http://www.bitbrowser.cn/
   - 安装后确保API服务运行在 `http://localhost:54345`

## 安装配置

### 1. 克隆项目

```bash
git clone https://github.com/your-repo/youtube-uploader.git
cd youtube-uploader
```

### 2. 安装依赖

```bash
npm install
```

### 3. 数据库初始化

```bash
# 创建数据库
createdb youtube_uploader

# 运行数据库迁移
psql -U postgres -d youtube_uploader -f src/database/schema.sql
```

### 4. 环境配置

创建 `.env` 文件：

```bash
# 数据库配置
DATABASE_URL=postgresql://postgres:password@localhost:5432/youtube_uploader
DB_HOST=localhost
DB_PORT=5432
DB_NAME=youtube_uploader
DB_USER=postgres
DB_PASSWORD=your_password

# Redis配置
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# BitBrowser配置
BITBROWSER_API_URL=http://localhost:54345

# 加密密钥（重要！请生成自己的密钥）
ENCRYPTION_MASTER_KEY=your_base64_encoded_32_byte_key

# API配置
API_PORT=3000
API_HOST=0.0.0.0

# 日志级别
LOG_LEVEL=info

# 功能开关
FEATURE_MATRIX_MODE=true
```

生成加密密钥：
```bash
# 生成32字节密钥
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 5. 构建项目

```bash
npm run build
```

## 快速开始

### 1. 启动系统

```typescript
// start-server.ts
import { MatrixManager } from './dist/matrix/manager';
import { MetricsCollector } from './dist/monitoring/metrics';
import express from 'express';
import { createApiRoutes } from './dist/api/routes';

async function startServer() {
  // 创建矩阵管理器
  const matrixManager = new MatrixManager({
    browserPool: {
      minInstances: 2,
      maxInstances: 10
    },
    queue: {
      concurrency: 5
    }
  });

  // 初始化
  await matrixManager.initialize();

  // 创建API服务器
  const app = express();
  app.use(express.json());

  const metricsCollector = new MetricsCollector();
  metricsCollector.start();

  const apiRoutes = createApiRoutes({
    matrixManager,
    metricsCollector
  });

  app.use('/api', apiRoutes);

  app.listen(3000, () => {
    console.log('Matrix Upload Server running on http://localhost:3000');
  });
}

startServer();
```

运行服务器：
```bash
node start-server.js
```

### 2. 添加YouTube账号

```bash
# 使用API添加账号
curl -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-youtube@gmail.com",
    "password": "your-password"
  }'
```

或使用代码：
```typescript
// 批量添加账号
await matrixManager.addAccounts([
  { email: 'account1@gmail.com', password: 'password1' },
  { email: 'account2@gmail.com', password: 'password2' },
  { email: 'account3@gmail.com', password: 'password3' }
]);
```

### 3. 上传视频

```typescript
import { Video } from './dist/types';

const video: Video = {
  path: '/path/to/video.mp4',
  title: '我的视频标题',
  description: '这是视频描述',
  tags: ['标签1', '标签2', '标签3'],
  privacyStatus: 'public',  // 'public', 'private', 'unlisted'
  thumbnail: '/path/to/thumbnail.jpg'
};

// 单个视频上传
const result = await matrixManager.uploadVideo(video);
console.log('任务ID:', result.taskId);

// 批量上传
const videos = [video1, video2, video3];
const results = await matrixManager.batchUpload(videos, {
  priority: 1,  // 优先级：0-10
  metadata: {
    campaign: '2024春季推广'
  }
});
```

## 账号管理

### 查看所有账号

```bash
# API方式
curl http://localhost:3000/api/accounts

# 只查看健康账号
curl "http://localhost:3000/api/accounts?minHealthScore=70&status=active"
```

### 账号健康管理

系统自动跟踪每个账号的健康状态：

- **健康分数**: 0-100分
  - 80-100: 优秀
  - 60-79: 良好
  - 40-59: 警告
  - 0-39: 危险

- **自动调整**:
  - 上传成功: +2分
  - 上传失败: -10分
  - 低于30分: 自动暂停

### 更新账号信息

```typescript
// 更新账号状态
await accountManager.updateAccount(accountId, {
  status: 'active',        // 'active', 'limited', 'suspended', 'error'
  dailyUploadLimit: 15,    // 每日上传限制
  metadata: {
    notes: '高级账号'
  }
});
```

### 重置每日限制

```bash
# 每天凌晨自动重置，也可手动重置
curl -X POST http://localhost:3000/api/accounts/reset-limits
```

## 视频上传

### 基本上传

```typescript
const video: Video = {
  path: '/videos/my-video.mp4',
  title: '视频标题',
  description: `视频描述
  
  可以包含多行文字
  支持emoji 😊`,
  tags: ['vlog', '生活', '2024'],
  privacyStatus: 'public',
  thumbnail: '/videos/thumbnail.jpg',
  
  // 可选字段
  playlistId: 'PLxxxxxx',        // 添加到播放列表
  publishAt: new Date('2024-12-25 10:00:00'), // 定时发布
  categoryId: '22',              // YouTube分类ID
  defaultLanguage: 'zh-CN',      // 默认语言
  
  // 高级选项
  embeddable: true,              // 允许嵌入
  publicStatsViewable: true,     // 公开统计数据
  notifySubscribers: true,       // 通知订阅者
  autoLevels: true,              // 自动色彩校正
  stabilize: true,               // 自动防抖
  
  // 字幕文件
  captions: [
    {
      language: 'zh-CN',
      name: '中文字幕',
      path: '/videos/subtitles-zh.srt'
    },
    {
      language: 'en',
      name: 'English',
      path: '/videos/subtitles-en.srt'
    }
  ]
};

const result = await matrixManager.uploadVideo(video);
```

### 批量上传

```typescript
// 准备视频列表
const videos = [
  {
    path: '/videos/video1.mp4',
    title: '系列视频 第1集',
    description: '...',
    tags: ['系列', '教程', '第1集']
  },
  {
    path: '/videos/video2.mp4',
    title: '系列视频 第2集',
    description: '...',
    tags: ['系列', '教程', '第2集']
  }
];

// 批量上传
const results = await matrixManager.batchUpload(videos, {
  priority: 2,              // 较高优先级
  scheduledAt: new Date(),  // 立即开始
  metadata: {
    series: '教程系列',
    season: 1
  }
});

// 跟踪上传进度
for (const result of results) {
  console.log(`视频 ${result.taskId} 已加入队列`);
}
```

### 定时上传

```typescript
// 安排每天上午10点发布
const morningVideo = {
  path: '/videos/morning-content.mp4',
  title: '早安视频',
  description: '新的一天开始了！'
};

const tomorrow10AM = new Date();
tomorrow10AM.setDate(tomorrow10AM.getDate() + 1);
tomorrow10AM.setHours(10, 0, 0, 0);

await matrixManager.uploadVideo(morningVideo, {
  scheduledAt: tomorrow10AM,
  priority: 5  // 高优先级确保准时
});
```

### 查看上传状态

```typescript
// 获取任务状态
const status = await matrixManager.getTaskStatus(taskId);
console.log('状态:', status.status);  // 'queued', 'processing', 'completed', 'failed'

if (status.status === 'completed') {
  console.log('YouTube视频ID:', status.videoId);
} else if (status.status === 'failed') {
  console.log('错误信息:', status.error);
}
```

## 系统监控

### 1. 监控仪表板

在浏览器中打开: `http://localhost:3000/monitoring-dashboard.html`

仪表板显示：
- 系统健康状态
- 24小时上传统计
- 账号健康状态
- 队列深度和处理速度
- 错误率趋势

### 2. 实时指标

```bash
# 获取系统指标
curl http://localhost:3000/api/metrics
```

返回数据包括：
```json
{
  "uploads": {
    "total24h": 245,
    "successful24h": 230,
    "failed24h": 15,
    "averageDuration": 185000,
    "throughput": 10.2
  },
  "accounts": {
    "total": 20,
    "active": 18,
    "healthy": 15,
    "utilizationRate": 75.5
  }
}
```

### 3. 健康检查

```bash
# 系统健康检查
curl http://localhost:3000/api/health
```

### 4. 日志查看

```bash
# 查看实时日志
tail -f logs/app.log | grep -E "(error|warn|info)"

# 查看错误日志
grep "error" logs/app.log | tail -n 50
```

## 高级配置

### 1. 配置文件

创建 `config/matrix.json`:

```json
{
  "bitBrowser": {
    "apiUrl": "http://localhost:54345",
    "timeout": 30000,
    "retryAttempts": 3
  },
  "browserPool": {
    "minInstances": 3,
    "maxInstances": 15,
    "idleTimeout": 300000,
    "healthCheckInterval": 30000
  },
  "queue": {
    "concurrency": 10,
    "maxRetries": 3,
    "retryDelay": 60000,
    "rateLimit": {
      "max": 100,
      "duration": 3600000
    }
  },
  "accounts": {
    "dailyUploadLimit": 10,
    "minHealthScore": 50,
    "selectionStrategy": "health-score"
  },
  "monitoring": {
    "enabled": true,
    "alertThresholds": {
      "errorRate": 10,
      "criticalErrors": 3,
      "lowHealthAccounts": 0.5
    }
  }
}
```

### 2. 代理配置

为每个账号配置不同的代理：

```typescript
// 配置账号代理
await securityManager.configureBrowserProfile(profileId, accountId, {
  proxy: {
    type: 'http',
    host: 'proxy.example.com',
    port: 8080,
    username: 'user',
    password: 'pass'
  },
  timezone: 'America/New_York',
  locale: 'en-US'
});
```

### 3. 性能优化

```typescript
// 根据时间调整并发数
const hour = new Date().getHours();
if (hour >= 2 && hour <= 6) {
  // 凌晨增加并发
  queueManager.setRateLimit(200, 3600000);
} else if (hour >= 18 && hour <= 22) {
  // 高峰期减少并发
  queueManager.setRateLimit(50, 3600000);
}
```

## 故障排除

### 常见问题

1. **BitBrowser连接失败**
   ```bash
   # 检查BitBrowser是否运行
   curl http://localhost:54345/api/browser/list
   
   # 如果失败，重启BitBrowser
   ```

2. **数据库连接错误**
   ```bash
   # 检查PostgreSQL状态
   sudo systemctl status postgresql
   
   # 检查连接
   psql -U postgres -d youtube_uploader -c "SELECT 1"
   ```

3. **Redis连接错误**
   ```bash
   # 检查Redis状态
   redis-cli ping
   
   # 清理Redis（谨慎使用）
   redis-cli FLUSHDB
   ```

4. **上传失败**
   - 检查账号健康分数
   - 查看错误日志
   - 验证视频文件是否存在
   - 检查网络连接

### 日志分析

```bash
# 查找特定错误
grep -n "upload failed" logs/app.log

# 查看账号相关错误
grep "account-id" logs/app.log | grep "error"

# 统计错误类型
grep "error" logs/app.log | awk '{print $5}' | sort | uniq -c
```

### 性能诊断

```typescript
// 获取队列统计
const stats = await queueManager.getStats();
console.log('等待中:', stats.waiting);
console.log('处理中:', stats.active);
console.log('失败:', stats.failed);

// 获取浏览器池状态
const poolStats = browserPool.getStats();
console.log('浏览器使用率:', poolStats.utilization + '%');
```

## API使用

### 认证

如果启用了API认证：

```bash
# 在请求头中添加认证
curl http://localhost:3000/api/accounts \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 主要端点

1. **账号管理**
   - `GET /api/accounts` - 列出账号
   - `POST /api/accounts` - 添加账号
   - `PATCH /api/accounts/:id` - 更新账号
   - `DELETE /api/accounts/:id` - 删除账号

2. **上传管理**
   - `POST /api/upload` - 上传单个视频
   - `POST /api/upload/batch` - 批量上传
   - `GET /api/tasks/:id` - 获取任务状态

3. **队列管理**
   - `GET /api/queue/stats` - 队列统计
   - `POST /api/queue/pause` - 暂停队列
   - `POST /api/queue/resume` - 恢复队列

4. **系统监控**
   - `GET /api/health` - 健康检查
   - `GET /api/status` - 系统状态
   - `GET /api/metrics` - 性能指标

### SDK示例

```typescript
// 创建客户端
import { MatrixClient } from '@youtube-matrix/client';

const client = new MatrixClient({
  baseUrl: 'http://localhost:3000/api',
  apiKey: 'your-api-key'
});

// 上传视频
const result = await client.upload({
  video: {
    path: '/videos/test.mp4',
    title: 'Test Video'
  }
});

// 检查状态
const status = await client.getTaskStatus(result.taskId);
```

## 最佳实践

1. **账号管理**
   - 保持账号健康分数在70以上
   - 设置合理的每日上传限制（建议5-10个）
   - 定期检查和恢复暂停的账号

2. **视频上传**
   - 使用优先级管理重要视频
   - 批量上传时分组处理
   - 为视频添加详细的元数据

3. **性能优化**
   - 根据系统资源调整并发数
   - 定期清理已完成的任务
   - 监控并优化慢查询

4. **安全建议**
   - 定期更换加密密钥
   - 使用代理保护账号
   - 启用API认证
   - 定期备份数据库

5. **监控告警**
   - 设置错误率告警
   - 监控账号健康状态
   - 跟踪上传成功率
   - 定期检查系统日志

## 总结

YouTube Matrix Upload 系统提供了强大的多账号管理和自动化上传功能。通过合理配置和使用，可以大幅提高YouTube内容发布效率。如有问题，请参考故障排除章节或查看详细日志。