---
title: Project Structure
description: "Outlines the organization of files, directories, and naming conventions."
inclusion: always
---

# YouTube Matrix Uploader - 项目结构

## 项目概述

个人工作室YouTube多账号管理工具的代码结构，基于原始youtube-uploader扩展，增加了矩阵管理功能。

## Root Directory Structure

```
youtube-uploader/
├── .ai-rules/              # AI助手项目指导文件
├── assets/                 # 静态资源（图片等）
├── auth/                   # 认证相关文件（cookies等）
├── dist/                   # TypeScript编译输出
├── docs/                   # 项目文档（待完善）
├── examples/               # 使用示例
├── node_modules/           # NPM依赖
├── scripts/                # 实用脚本
├── src/                    # 后端源代码
├── test/                   # 测试文件（基本未用）
├── youtube-matrix-frontend/# React前端（可选）
├── .env.example            # 环境变量模板
├── .gitignore              # Git忽略规则
├── .prettierrc             # 代码格式化配置
├── CLAUDE.md               # AI助手说明
├── docker-compose.yml      # Docker配置（快速部署）
├── LICENSE                 # MIT许可证
├── package.json            # 项目配置
├── README-matrix.md        # 当前版本说明文档
├── tsconfig.json           # TypeScript配置
└── monitoring-dashboard.html # 简单的监控面板
```

## Backend Source Structure (`/src`) - 核心模块说明

```
src/
├── accounts/               # 账号管理模块
│   ├── manager.ts          # 账号的增删改查
│   ├── monitor.ts          # 账号健康度监控
│   └── selector.ts         # 智能选择健康账号
│
├── api/                    # API接口（简单的REST API）
│   ├── routes.ts           # 路由定义
│   └── websocket.ts        # 实时状态推送
│
├── bitbrowser/             # BitBrowser集成（核心）
│   ├── api-client.ts       # BitBrowser API封装
│   ├── manager.ts          # 浏览器窗口管理
│   └── pool.ts             # 浏览器实例池
│
├── database/               # 数据库相关
│   ├── connection.ts       # PostgreSQL连接池
│   └── schema.sql          # 数据库表结构
│
├── matrix/                 # 矩阵管理核心
│   └── manager.ts          # 统一调度中心
│
├── queue/                  # 任务队列
│   ├── manager.ts          # BullMQ队列管理
│   └── retry-handler.ts    # 失败重试逻辑
│
├── redis/                  # Redis连接
│   └── connection.ts       # Redis客户端单例
│
├── security/               # 安全相关
│   └── encryption.ts       # 账号密码加密
│
├── workers/                # 后台工作进程
│   └── upload-worker.ts    # 处理上传任务
│
├── server.ts               # API服务器入口
├── types.ts                # TypeScript类型定义
└── upload.ts               # 原始上传功能（兼容）
```

### 核心模块关系
1. **matrix/manager.ts** - 总调度中心，协调其他模块
2. **bitbrowser/** - 提供浏览器环境隔离
3. **queue/** - 任务排队和分发
4. **workers/** - 实际执行上传任务
5. **accounts/** - 管理YouTube账号池

## Frontend Structure (`/youtube-matrix-frontend`) - 可选的React管理界面

**说明**: 前端是可选的，主要功能通过API和简单的monitoring-dashboard.html即可使用。

```
youtube-matrix-frontend/
├── src/                    # 源代码
│   ├── app/                # Redux配置
│   ├── components/         # React组件
│   │   └── common/         # 通用组件
│   ├── features/           # 功能模块
│   │   ├── accounts/       # 账号管理界面
│   │   ├── dashboard/      # 仪表板
│   │   ├── monitoring/     # 监控界面
│   │   └── tasks/          # 任务管理
│   ├── services/           # API调用封装
│   └── utils/              # 工具函数
├── public/                 # 静态文件
├── package.json            # 依赖配置
├── vite.config.ts          # Vite构建配置
└── tailwind.config.js      # Tailwind样式配置
```

### 前端特点
- 基于React + Redux + Ant Design快速搭建
- 主要用于可视化管理，非必需
- 可以通过API直接调用所有功能

## 命名规范（简单实用）

### 文件命名
- **TypeScript文件**: 使用camelCase (`manager.ts`, `apiClient.ts`)
- **React组件**: 使用PascalCase (`AccountList.tsx`)
- **配置文件**: 使用kebab-case (`queue-config.ts`)
- **入口文件**: 使用index.ts导出模块

### 目录组织原则
- **功能聚合**: 相关功能放在同一目录
- **单一职责**: 每个模块只做一件事
- **易于查找**: 命名直观，容易定位代码

## 核心流程说明

### 上传任务流程
1. **接收请求**: API接收上传请求 (`api/routes.ts`)
2. **创建任务**: 任务加入队列 (`queue/manager.ts`)
3. **选择账号**: 智能选择健康账号 (`accounts/selector.ts`)
4. **获取浏览器**: 从池中获取浏览器实例 (`bitbrowser/pool.ts`)
5. **执行上传**: Worker执行上传 (`workers/upload-worker.ts`)
6. **更新状态**: 实时更新任务状态
7. **处理结果**: 成功或失败的后续处理

### BitBrowser集成流程
1. **打开窗口**: 调用BitBrowser API打开指定配置的浏览器
2. **连接Puppeteer**: 通过WebSocket连接到浏览器
3. **执行自动化**: 使用Puppeteer进行页面操作
4. **关闭窗口**: 任务完成后关闭浏览器窗口

## 配置文件说明

### 必需配置（.env）
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/youtube_uploader
REDIS_URL=redis://localhost:6379
BITBROWSER_API_URL=http://localhost:54345
ENCRYPTION_MASTER_KEY=生成的密钥
API_PORT=3000
```

### 可选配置
- `LOG_LEVEL`: 日志级别（debug/info/warn/error）
- `QUEUE_CONCURRENCY`: 并发上传数（默认5）
- `BROWSER_POOL_MAX`: 最大浏览器实例数（默认10）

## 开发建议

### 添加新功能
1. 在相应模块目录下创建新文件
2. 在manager.ts中添加调用逻辑
3. 更新types.ts添加类型定义
4. 简单测试确保功能正常

### 调试技巧
- 使用`LOG_LEVEL=debug`查看详细日志
- 监控面板实时查看任务状态
- PostgreSQL查看任务记录
- Redis查看队列状态

### 常见问题定位
- **上传失败**: 查看worker日志和错误信息
- **账号问题**: 检查accounts表和健康度
- **浏览器问题**: 确认BitBrowser正常运行
- **队列堵塞**: 检查Redis和死信队列