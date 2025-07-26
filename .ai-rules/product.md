---
title: Product Vision
description: "Defines the project's core purpose, target users, and main features."
inclusion: always
---

# YouTube Matrix Uploader - Product Vision

## Overview

YouTube Matrix Uploader 是一个为个人工作室设计的多账号YouTube管理工具，基于原始youtube-videos-uploader库扩展，增加了BitBrowser集成、队列管理和监控功能。目前处于起步阶段，优先保证核心功能可用。

## Core Purpose

为个人工作室/自媒体创作者提供一个简单可用的多YouTube账号批量上传工具，通过BitBrowser隔离降低账号关联风险，提高内容发布效率。

## Target Users

### 主要用户
- **个人工作室**: 自用工具，管理多个YouTube频道
- **使用场景**: 批量发布内容到不同的YouTube账号
- **开发阶段**: MVP阶段，功能优先，稳定性其次

### 设计理念
- **简单实用**: 能用就行，不追求完美
- **快速迭代**: 遇到问题再改，不过度设计
- **个人定制**: 根据自己需求调整，不考虑通用性

## Main Features (当前已实现)

### 1. 多账号管理
- 支持20-30个YouTube账号并行管理
- 使用BitBrowser实现账号环境隔离
- 基础的账号健康度监控
- 简单的错误重试机制

### 2. BitBrowser集成
- 完整的BitBrowser API集成
- 浏览器实例池管理（最小2个，最大10个）
- 自动打开/关闭浏览器窗口
- 连接状态监控和重连机制

### 3. 队列管理
- 基于BullMQ的任务队列
- 支持优先级设置
- 失败重试（最多3次）
- 死信队列处理失败任务

### 4. 上传功能
- 批量视频上传
- 视频元数据设置（标题、描述、标签、缩略图）
- 上传进度回调
- 支持原有的Puppeteer stealth模式

### 5. 基础监控
- 简单的Web监控面板（monitoring-dashboard.html）
- 上传任务状态跟踪
- 账号使用统计
- 系统资源监控

### 6. API接口
- RESTful API用于上传和查询
- 支持单个和批量上传
- 任务状态查询
- 系统状态接口

## 技术特点（现状）

1. **并发能力**: 最多支持15个同时上传
2. **成功率**: 目标80%以上即可（目前还在调试）
3. **安全性**: 基础的密码加密存储
4. **监控**: 有基本的监控页面
5. **扩展性**: 模块化设计，方便后续改进

## 实际价值

- **效率提升**: 批量上传，不用手动切换账号
- **风险降低**: BitBrowser隔离，减少关联
- **简单管理**: 统一的任务队列
- **基本可用**: 核心功能能跑起来

## 后续计划（看需求）

- 优化错误处理
- 改进账号选择策略
- 增加定时任务功能
- 完善监控面板
- 提高稳定性

## 限制和注意事项

- 遵守YouTube使用条款（自己把握）
- 内存占用较大（每个浏览器约500MB）
- 需要稳定的网络连接
- BitBrowser需要单独安装和运行