# 快速启动指南

## 环境要求

1. **PostgreSQL** - 端口 5987
2. **Redis** - 端口 5988
3. **比特浏览器** - 端口 54345
4. **Node.js** - v16+

## 数据库设置

1. 确保 PostgreSQL 运行在端口 5987
2. 创建数据库 `youtube_uploader`
3. 运行迁移脚本：
```bash
node run-migrations.js
```

## 启动后端

```bash
cd youtube-uploader
npm install
npm run build
npm start
```

后端将运行在 http://localhost:5989

## 启动前端

```bash
cd youtube-matrix-frontend
npm install
npm run dev
```

前端将运行在 http://localhost:5173

## 默认登录

- 用户名: admin
- 密码: admin123

## 比特浏览器窗口功能

1. 确保比特浏览器服务运行在 http://127.0.0.1:54345
2. 在比特浏览器中创建窗口并登录 YouTube
3. 添加账号时输入窗口名称（必须与比特浏览器中的名称完全一致）
4. 系统会自动查找并关联窗口

## 常见问题

### WebSocket 连接失败
- 检查后端是否运行在 5989 端口
- 检查前端 .env 文件配置是否正确

### 数据库连接失败
- 检查 PostgreSQL 是否运行在 5987 端口
- 检查数据库用户名和密码是否正确

### 比特浏览器连接失败
- 检查比特浏览器服务是否运行
- 默认端口应该是 54345