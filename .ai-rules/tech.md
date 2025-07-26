---
title: Technology Stack
description: "Documents the project's technology choices, frameworks, and development practices."
inclusion: always
---

# YouTube Matrix Uploader - Technology Stack

## 项目概述

个人工作室使用的YouTube多账号管理工具，基于原始youtube-uploader扩展，增加了BitBrowser集成和矩阵管理功能。

## Languages

### Primary Languages
- **TypeScript** (5.8.3): 主要开发语言，前后端统一使用
- **JavaScript**: 配置文件和一些遗留代码
- **SQL**: PostgreSQL数据库查询
- **HTML/CSS**: 监控面板和前端界面

### 为什么选择TypeScript
- 类型安全，减少运行时错误
- 更好的IDE支持和代码提示
- 前后端代码共享类型定义

## Backend Stack

### 核心框架
- **Node.js** (16+): 运行环境，选择理由：与前端统一技术栈
- **Express.js** (5.1.0): 简单的Web框架，用于API服务
- **TypeScript**: 全栈使用，类型安全

### 数据存储
- **PostgreSQL** (13+): 存储账号信息、任务记录、系统配置
- **Redis** (6.0+): 任务队列、缓存、实时指标
- **本地文件系统**: 视频临时存储（上传后可删除）

### 队列系统
- **BullMQ** (5.1.0): 基于Redis的高级队列，支持优先级、重试、死信队列
- **为什么用BullMQ**: 成熟稳定，功能齐全，文档完善

### 浏览器自动化（核心）
- **Puppeteer** (14.4.1): Chrome自动化基础
- **Puppeteer Extra** (3.3.0): 插件系统支持
- **Puppeteer Extra Plugin Stealth** (2.10.1): 反检测，避免被识别为机器人
- **BitBrowser集成**: 
  - 自定义API客户端 (`src/bitbrowser/api-client.ts`)
  - 浏览器实例池管理 (`src/bitbrowser/pool.ts`)
  - 窗口管理器 (`src/bitbrowser/manager.ts`)

### 安全相关
- **bcrypt** (5.1.1): 密码哈希存储
- **Node.js crypto**: AES-256-GCM加密YouTube凭据
- **为什么这样设计**: 简单够用，不过度设计

### 日志系统
- **Pino** (8.17.2): 高性能JSON日志
- **日志级别**: 通过环境变量LOG_LEVEL控制

### 实时通信
- **Socket.io** (4.8.1): 用于监控面板实时更新
- **使用场景**: 上传进度、系统状态、实时日志

### 工具库
- **uuid** (11.1.0): 生成任务ID
- **fs-extra** (11.2.0): 文件操作
- **Zod** (4.0.8): API参数验证（部分使用）

## Frontend Stack

### 前端框架（React管理面板）
- **React** (18.3.1): 选择理由：熟悉、生态完善
- **Redux Toolkit** (2.8.2): 状态管理，处理复杂的任务状态
- **React Router** (6.30.1): 路由管理

### UI组件库
- **Ant Design** (5.26.6): 快速搭建管理界面，组件齐全
- **Tailwind CSS** (3.4.17): 快速样式调整
- **ECharts** (5.6.0): 数据可视化，显示上传统计

### 构建工具
- **Vite** (7.0.4): 快速的开发服务器和构建工具
- **为什么用Vite**: 启动快，HMR快，配置简单

### 通信
- **Axios** (1.11.0): API请求
- **Socket.io Client** (4.8.1): 实时状态更新

### 简化的监控面板
- **monitoring-dashboard.html**: 独立的HTML文件，无需构建
- **原生JavaScript**: 简单直接，易于调试
- **Socket.io连接**: 实时数据更新

### 测试（基础配置，实际使用较少）
- **Jest**: 单元测试框架
- **Cypress**: E2E测试（配置了但很少用）
- **现状**: 主要依赖手动测试

## Development Tools

### 开发工具
- **VS Code**: 主要IDE，配置了TypeScript支持
- **TypeScript编译器**: 使用tsc进行编译
- **Prettier**: 代码格式化（有配置但不强制）
- **Git**: 版本控制

### 构建流程（简化版）
1. `npm run build`: TypeScript编译
2. `npm start`: 启动API服务器
3. 前端开发: `npm run dev`（在frontend目录）

## Architecture Patterns

### 后端架构
- **模块化设计**: 
  - `/matrix`: 矩阵管理核心
  - `/bitbrowser`: BitBrowser集成
  - `/accounts`: 账号管理
  - `/queue`: 任务队列
  - `/workers`: 上传工作器
- **简单分层**: Controller → Service → Data
- **队列驱动**: 异步任务处理，避免阻塞

### 前端架构
- **功能模块划分**: accounts、tasks、monitoring等
- **Redux管理状态**: 集中管理复杂状态
- **简单够用**: 不过度抽象，保持代码可读性

## External Services

### 必需服务
- **YouTube**: 目标平台（通过浏览器自动化）
- **BitBrowser**: 浏览器配置管理（需要单独安装运行）
  - 默认地址: http://localhost:54345
  - API文档: 参考BitBrowser官方文档
- **PostgreSQL**: 数据库（可用Docker快速部署）
- **Redis**: 队列和缓存（可用Docker快速部署）

### 可选服务
- **代理服务**: 保护账号安全（根据需要配置）
- **云存储**: 目前直接使用本地存储

## Development Practices

### 开发流程
- **快速迭代**: 有问题就改，不追求完美
- **本地开发**: 主要在本地环境开发测试
- **手动测试**: 依赖手动测试验证功能
- **日志调试**: 通过Pino日志排查问题

### 代码规范（宽松）
- **基本的TypeScript类型**: 主要接口都有类型定义
- **模块化**: 功能模块化，便于维护
- **注释**: 关键逻辑有基本注释
- **命名**: 尽量语义化命名

## Performance & Resources

### 资源需求
- **内存**: 每个浏览器实例约500MB（10个实例需要5GB+）
- **CPU**: 建议4核以上，支持并发上传
- **网络**: 上传视频需要稳定的上行带宽
- **存储**: 视频临时存储，上传后可删除

### 性能优化（基础）
- **浏览器池**: 复用浏览器实例，减少启动开销
- **队列并发控制**: 默认5个并发，可调整
- **失败重试**: 自动重试3次，避免临时错误
- **连接池**: PostgreSQL和Redis连接池

## Security（基础安全）

### 数据安全
- **密码加密**: bcrypt哈希存储
- **凭据加密**: AES-256-GCM加密YouTube账号信息
- **环境变量**: 敏感配置通过.env文件管理
- **不包含敏感信息**: 代码库不包含真实账号密码

### 隔离措施
- **BitBrowser隔离**: 每个账号独立的浏览器环境
- **进程隔离**: Worker进程独立运行
- **简单够用**: 个人使用，不需要复杂的权限系统

## Monitoring（基础监控）

### 监控内容
- **上传任务状态**: 实时查看任务进度
- **账号健康度**: 简单的成功率统计
- **系统资源**: 内存、队列长度等基础指标
- **错误日志**: 失败任务和错误信息

### 监控方式
- **Web面板**: monitoring-dashboard.html
- **日志文件**: 通过Pino输出的JSON日志
- **实时更新**: Socket.io推送状态变化

## 部署建议

### 本地部署（推荐）
1. 安装PostgreSQL和Redis（可用Docker）
2. 安装并运行BitBrowser
3. 配置.env文件
4. npm install && npm run build
5. npm start

### 注意事项
- BitBrowser需要图形界面环境
- 确保有足够的内存（建议8GB+）
- 网络要稳定，避免上传中断