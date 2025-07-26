# YouTube Matrix Upload - BitBrowser集成版

## 🚀 项目简介

YouTube Matrix Upload 是基于原始 [youtube-uploader](https://github.com/fawdlstty/youtube-uploader) 项目的增强版本，添加了BitBrowser集成，实现了多账号矩阵化管理功能。

### 核心特性

- 📊 **矩阵管理**: 支持20-30个YouTube账号并行管理
- 🌐 **浏览器隔离**: 使用BitBrowser实现完全的浏览器配置隔离
- 🤖 **智能调度**: 自动选择健康账号，智能分配上传任务
- 🔄 **自动恢复**: 失败重试、断点续传、账号自动恢复
- 📈 **实时监控**: 完整的监控仪表板和性能指标
- 🔒 **安全加密**: 所有凭据使用AES-256-GCM加密存储
- 🎯 **高可用性**: 断路器模式、优雅降级、负载均衡

## 📋 系统要求

- Node.js 16+
- PostgreSQL 13+
- Redis 6.0+
- BitBrowser (最新版本)
- 8GB+ RAM (推荐16GB)
- Windows/macOS/Linux

## 🛠️ 快速开始

### 1. 安装依赖服务

```bash
# PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Redis
sudo apt-get install redis-server

# BitBrowser
# 从 http://www.bitbrowser.cn/ 下载并安装
```

### 2. 克隆并安装项目

```bash
git clone https://github.com/your-repo/youtube-uploader.git
cd youtube-uploader
npm install
npm run build
```

### 3. 配置环境

创建 `.env` 文件：

```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/youtube_uploader
REDIS_URL=redis://localhost:6379
BITBROWSER_API_URL=http://localhost:54345
ENCRYPTION_MASTER_KEY=your_base64_key_here
API_PORT=3000
```

### 4. 初始化数据库

```bash
createdb youtube_uploader
psql -U postgres -d youtube_uploader -f src/database/schema.sql
```

### 5. 启动服务

```bash
npm start
```

访问 http://localhost:3000/monitoring-dashboard.html 查看监控面板

## 📖 使用示例

### 添加账号

```typescript
import { MatrixManager } from './dist/matrix/manager';

const matrix = new MatrixManager();
await matrix.initialize();

// 添加YouTube账号
await matrix.addAccounts([
  { email: 'account1@gmail.com', password: 'password1' },
  { email: 'account2@gmail.com', password: 'password2' }
]);
```

### 上传视频

```typescript
// 单个视频上传
const result = await matrix.uploadVideo({
  path: '/videos/my-video.mp4',
  title: '我的视频',
  description: '视频描述',
  tags: ['标签1', '标签2'],
  privacyStatus: 'public'
});

// 批量上传
const videos = [video1, video2, video3];
const results = await matrix.batchUpload(videos, {
  priority: 1,
  metadata: { campaign: '2024推广' }
});
```

### 使用API

```bash
# 上传视频
curl -X POST http://localhost:3000/api/upload \
  -H "Content-Type: application/json" \
  -d '{
    "video": {
      "path": "/videos/test.mp4",
      "title": "测试视频"
    }
  }'

# 查看状态
curl http://localhost:3000/api/status
```

## 🏗️ 系统架构

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│   Web UI/API    │────▶│Matrix Manager│────▶│  BitBrowser │
└─────────────────┘     └──────┬───────┘     └─────────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
              ┌─────────────┐      ┌──────────────┐
              │Account Pool │      │ Task Queue   │
              └─────────────┘      └──────────────┘
                    │                     │
                    ▼                     ▼
              ┌─────────────┐      ┌──────────────┐
              │ PostgreSQL  │      │    Redis     │
              └─────────────┘      └──────────────┘
```

## 📊 性能指标

- **并发上传**: 最多支持15个同时上传
- **账号容量**: 建议20-30个账号
- **上传速度**: 取决于网络，通常10-20个/小时
- **内存使用**: 每个浏览器实例约500MB
- **成功率**: 正常情况下>95%

## 🔧 配置选项

详细配置请参考 [配置文档](docs/configuration.md)

主要配置项：
- 浏览器池大小
- 队列并发数
- 重试策略
- 账号选择策略
- 监控告警阈值

## 📚 文档

- [使用指南](docs/usage-guide.md) - 详细使用说明
- [API文档](docs/api.md) - RESTful API参考
- [性能调优](docs/performance-tuning.md) - 性能优化指南
- [故障排除](docs/troubleshooting.md) - 常见问题解决

## 🔄 从原版迁移

如果你正在使用原版youtube-uploader，可以使用迁移工具：

```bash
npm run migrate -- --cookies-path ./old-cookies.json
```

详见 [迁移指南](docs/migration.md)

## 🛡️ 安全说明

- 所有密码使用bcrypt加密
- 凭据使用AES-256-GCM加密存储
- 支持代理配置保护账号
- 完整的审计日志
- API认证支持

## 🤝 贡献

欢迎提交Issue和Pull Request！

开发环境设置：
```bash
npm install
npm run dev
```

## 📄 许可证

本项目基于原始 [youtube-uploader](https://github.com/fawdlstty/youtube-uploader) 项目开发。

## 🙏 致谢

- 原始项目作者 [@fawdlstty](https://github.com/fawdlstty)
- BitBrowser团队提供的浏览器自动化方案
- 所有贡献者和测试者

## ⚠️ 免责声明

本工具仅供学习和研究使用。使用者需要遵守YouTube的服务条款和相关法律法规。作者不对因使用本工具产生的任何问题负责。

## 📞 联系方式

- Issues: [GitHub Issues](https://github.com/your-repo/youtube-uploader/issues)
- Email: your-email@example.com

---

**注意**: 请确保你有权使用相关的YouTube账号，并遵守YouTube的使用条款。合理使用自动化工具，避免对YouTube服务造成负担。