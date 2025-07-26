# YouTube矩阵自动化完整技术方案
## 基于BitBrowser和youtube-uploader的企业级解决方案

---

## 目录

1. [系统概述](#1-系统概述)
2. [技术原理详解](#2-技术原理详解)
3. [系统架构设计](#3-系统架构设计)
4. [BitBrowser API详解](#4-bitbrowser-api详解)
5. [核心模块实现](#5-核心模块实现)
6. [完整代码实现](#6-完整代码实现)
7. [部署与运维](#7-部署与运维)
8. [性能优化](#8-性能优化)
9. [安全与合规](#9-安全与合规)
10. [故障处理](#10-故障处理)

---

## 1. 系统概述

### 1.1 项目背景

本方案旨在构建一个企业级的YouTube视频矩阵自动化发布系统，支持管理20-30个YouTube账号，每个账号每天发布2个视频，实现完全自动化的内容发布流程。

### 1.2 技术栈选型

| 组件 | 技术选型 | 版本要求 | 说明 |
|------|---------|----------|------|
| **运行环境** | Node.js | >= 16.0 | JavaScript运行时 |
| **反检测浏览器** | BitBrowser | 最新版 | 提供独立浏览器环境 |
| **自动化框架** | Puppeteer | ^14.4.1 | 浏览器自动化 |
| **上传工具** | youtube-videos-uploader | ^2.0.26 | YouTube上传核心 |
| **任务队列** | Bull | ^4.10.0 | 基于Redis的任务队列 |
| **数据库** | PostgreSQL | >= 13 | 存储账号和任务数据 |
| **缓存** | Redis | >= 6.0 | 任务队列和缓存 |
| **监控** | Prometheus + Grafana | 最新版 | 系统监控 |
| **日志** | Winston | ^3.8.0 | 日志管理 |

### 1.3 系统特性

- ✅ **多账号矩阵管理**：支持20-30个YouTube账号并行操作
- ✅ **完整发布功能**：上传、元数据设置、定时发布、播放列表管理
- ✅ **智能任务调度**：基于账号健康度的负载均衡
- ✅ **故障自动恢复**：断点续传、失败重试、自动切换备用账号
- ✅ **实时监控告警**：账号状态、上传进度、异常检测
- ✅ **指纹隔离**：每个账号独立的浏览器环境和代理配置
- ✅ **可扩展架构**：支持水平扩展，可增加更多账号

---

## 2. 技术原理详解

### 2.1 BitBrowser工作原理

BitBrowser（比特浏览器）是一个基于Chromium的反检测浏览器，其核心原理：

```
┌─────────────────────────────────────────────────────────┐
│                    BitBrowser架构                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌────────────┐ │
│  │   Profile 1  │    │   Profile 2  │    │  Profile N │ │
│  │  ┌─────────┐ │    │  ┌─────────┐ │    │ ┌────────┐ │ │
│  │  │浏览器实例│ │    │  │浏览器实例│ │    │ │浏览器实例│ │ │
│  │  │独立Cookie│ │    │  │独立Cookie│ │    │ │独立Cookie│ │ │
│  │  │独立指纹  │ │    │  │独立指纹  │ │    │ │独立指纹 │ │ │
│  │  │独立代理  │ │    │  │独立代理  │ │    │ │独立代理 │ │ │
│  │  └─────────┘ │    │  └─────────┘ │    │ └────────┘ │ │
│  └─────────────┘    └─────────────┘    └────────────┘ │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Local API Server                    │   │
│  │            (Default: 127.0.0.1:54345)           │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**关键特性：**
1. **浏览器指纹隔离**：每个Profile有独立的Canvas、WebGL、字体等指纹
2. **网络隔离**：支持每个Profile使用不同的代理IP
3. **存储隔离**：Cookie、LocalStorage等完全独立
4. **API控制**：通过本地API接口实现自动化控制

### 2.2 youtube-uploader工作流程

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   登录流程    │ --> │   上传流程    │ --> │   发布流程    │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ 1.打开YouTube │     │ 1.点击上传按钮 │     │ 1.填写标题    │
│ 2.输入账号    │     │ 2.选择视频文件 │     │ 2.填写描述    │
│ 3.输入密码    │     │ 3.等待上传完成 │     │ 3.设置标签    │
│ 4.处理2FA    │     │ 4.处理进度条   │     │ 4.选择缩略图  │
│ 5.保存Cookie │     │ 5.检测完成状态 │     │ 5.设置发布时间 │
└──────────────┘     └──────────────┘     └──────────────┘
```

### 2.3 集成原理

```javascript
// 核心集成流程
BitBrowser创建Profile -> 获取WebSocket地址 -> Puppeteer连接 -> youtube-uploader执行
```

---

## 3. 系统架构设计

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         前端管理界面                              │
│                    (React + Ant Design)                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Gateway                              │
│                    (Express + Auth中间件)                         │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│ 任务调度服务  │       │ 账号管理服务  │       │ 监控告警服务  │
│   (Bull)     │       │  (Account)   │       │ (Monitoring) │
└──────────────┘       └──────────────┘       └──────────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      上传执行器集群                               │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌─────────┐  │
│  │ Worker 1   │  │ Worker 2   │  │ Worker 3   │  │ Worker N │  │
│  │┌──────────┐│  │┌──────────┐│  │┌──────────┐│  │┌────────┐│  │
│  ││BitBrowser││  ││BitBrowser││  ││BitBrowser││  ││BitBrowser│  │
│  ││+Uploader ││  ││+Uploader ││  ││+Uploader ││  ││+Uploader│  │
│  │└──────────┘│  │└──────────┘│  │└──────────┘│  │└────────┘│  │
│  └────────────┘  └────────────┘  └────────────┘  └─────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  PostgreSQL  │       │    Redis     │       │   文件存储    │
│   (主数据库)  │       │  (缓存+队列)  │       │  (视频/图片)  │
└──────────────┘       └──────────────┘       └──────────────┘
```

### 3.2 数据流设计

```sql
-- 账号表
CREATE TABLE youtube_accounts (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_encrypted TEXT NOT NULL,
    recovery_email VARCHAR(255),
    channel_name VARCHAR(255),
    channel_id VARCHAR(255),
    profile_id VARCHAR(255),  -- BitBrowser Profile ID
    status VARCHAR(50) DEFAULT 'active',  -- active/suspended/banned
    daily_upload_count INT DEFAULT 0,
    last_upload_time TIMESTAMP,
    health_score INT DEFAULT 100,
    proxy_config JSONB,
    fingerprint_config JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 上传任务表
CREATE TABLE upload_tasks (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(255) UNIQUE NOT NULL,
    account_id INT REFERENCES youtube_accounts(id),
    video_path TEXT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    tags TEXT[],
    thumbnail_path TEXT,
    publish_type VARCHAR(50),  -- PUBLIC/PRIVATE/UNLISTED/SCHEDULE
    publish_at TIMESTAMP,
    playlist_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',  -- pending/processing/completed/failed
    retry_count INT DEFAULT 0,
    result_url TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- 系统日志表
CREATE TABLE system_logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20),  -- info/warn/error
    category VARCHAR(50),  -- upload/account/system
    account_id INT,
    task_id VARCHAR(255),
    message TEXT,
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 账号健康度历史
CREATE TABLE account_health_history (
    id SERIAL PRIMARY KEY,
    account_id INT REFERENCES youtube_accounts(id),
    health_score INT,
    upload_success_rate DECIMAL(5,2),
    error_count INT,
    daily_uploads INT,
    recorded_at TIMESTAMP DEFAULT NOW()
);
```

---

## 4. BitBrowser API详解

### 4.1 API基础配置

```javascript
// BitBrowser API配置
const BITBROWSER_CONFIG = {
  API_URL: 'http://127.0.0.1:54345',  // 默认本地API地址
  API_ENDPOINTS: {
    // 浏览器管理
    BROWSER_LIST: '/browser/list',      // 获取所有浏览器配置
    BROWSER_CREATE: '/browser/create',  // 创建新配置
    BROWSER_UPDATE: '/browser/update',  // 更新配置
    BROWSER_DELETE: '/browser/delete',  // 删除配置
    BROWSER_OPEN: '/browser/open',      // 打开浏览器
    BROWSER_CLOSE: '/browser/close',    // 关闭浏览器
    BROWSER_ACTIVE: '/browser/active',  // 获取活动浏览器
    
    // 窗口管理
    WINDOW_LIST: '/window/list',        // 获取窗口列表
    WINDOW_DETAIL: '/window/detail',    // 获取窗口详情
    
    // 配置管理
    PROXY_CHECK: '/proxy/check',        // 检查代理
    FINGERPRINT_RANDOM: '/fingerprint/random'  // 生成随机指纹
  }
};
```

### 4.2 API请求示例

```javascript
// bitbrowser-client.js - BitBrowser API客户端
const axios = require('axios');
const crypto = require('crypto');

class BitBrowserClient {
  constructor(config = {}) {
    this.apiUrl = config.apiUrl || BITBROWSER_CONFIG.API_URL;
    this.axios = axios.create({
      baseURL: this.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // 请求拦截器
    this.axios.interceptors.request.use(
      config => {
        // 添加时间戳防止缓存
        config.params = {
          ...config.params,
          _t: Date.now()
        };
        console.log(`[BitBrowser API] ${config.method.toUpperCase()} ${config.url}`);
        return config;
      },
      error => Promise.reject(error)
    );
    
    // 响应拦截器
    this.axios.interceptors.response.use(
      response => {
        if (response.data.success === false) {
          throw new Error(response.data.msg || 'BitBrowser API Error');
        }
        return response.data;
      },
      error => {
        console.error('[BitBrowser API Error]', error.message);
        throw error;
      }
    );
  }

  // 获取浏览器配置列表
  async getBrowserList(page = 1, pageSize = 100) {
    const response = await this.axios.post('/browser/list', {
      page,
      pageSize
    });
    return response.data;
  }

  // 创建浏览器配置
  async createBrowserProfile(profileData) {
    const defaultConfig = {
      name: `YouTube_${Date.now()}`,
      groupId: '0',  // 默认分组
      platform: 'windows',  // windows/mac/linux
      platformVersion: '10',
      kernelVersion: '104',  // Chrome内核版本
      
      // 代理配置
      proxyMethod: 2,  // 0:不使用代理 1:系统代理 2:自定义代理
      proxyType: 'http',  // http/https/socks5
      host: '',
      port: '',
      proxyUserName: '',
      proxyPassword: '',
      
      // User-Agent配置
      userAgent: '',  // 空字符串表示随机
      
      // 分辨率
      resolutionType: '1',  // 0:自定义 1:随机常见分辨率
      resolution: '1920x1080',
      
      // 语言
      languages: 'zh-CN,zh,en',
      
      // 定位
      isIpCreatePosition: 1,  // 根据IP自动定位
      lat: '',
      lng: '',
      accuracy: '',
      
      // WebRTC
      webRTC: '2',  // 0:真实 1:禁用 2:替换
      
      // 字体
      fontType: '1',  // 0:使用系统字体 1:随机字体列表
      
      // Canvas指纹
      canvas: '1',  // 0:关闭 1:噪音模式
      
      // WebGL
      webGL: '2',  // 0:关闭 1:噪音 2:自定义
      webGLMeta: '1',  // 0:关闭 1:掩盖 2:自定义
      
      // 音频
      audio: '1',  // 0:关闭 1:噪音
      
      // 时区
      isIpCreateTimeZone: 1,  // 根据IP自动设置时区
      timeZone: '',
      
      // 其他
      mediaDevice: '1',  // 0:关闭 1:噪音 2:自定义设备数量
      hardwareConcurrency: '4',  // CPU核心数
      deviceMemory: '8',  // 设备内存
      
      // 启动参数
      browserSettings: {
        isPassword: false,
        password: '',
        disableGpu: false,
        enableBackgroundMode: false,
        muteAudio: false
      }
    };

    const config = { ...defaultConfig, ...profileData };
    const response = await this.axios.post('/browser/create', config);
    return response.data;
  }

  // 更新浏览器配置
  async updateBrowserProfile(profileId, updateData) {
    const response = await this.axios.post('/browser/update', {
      id: profileId,
      ...updateData
    });
    return response.data;
  }

  // 删除浏览器配置
  async deleteBrowserProfile(profileId) {
    const response = await this.axios.post('/browser/delete', {
      id: profileId
    });
    return response.data;
  }

  // 打开浏览器
  async openBrowser(profileId, options = {}) {
    const defaultOptions = {
      id: profileId,
      isHeadless: false,  // 是否无头模式
      isLoadExtensions: false,  // 是否加载扩展
      isLoadBookmarks: false,  // 是否加载书签
      isLoadPassword: false,  // 是否加载密码
      isAddCookie: false,  // 是否添加Cookie
      args: [  // 额外的Chrome启动参数
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--disable-notifications'
      ],
      loadExtensionPath: [],  // 加载的扩展路径
      cookie: []  // 要添加的Cookie
    };

    const config = { ...defaultOptions, ...options };
    const response = await this.axios.post('/browser/open', config);
    
    // 返回格式：
    // {
    //   success: true,
    //   data: {
    //     id: "profile_id",
    //     ws: "ws://127.0.0.1:9222/devtools/browser/xxx",
    //     http: "http://127.0.0.1:9222",
    //     chromeDriverPath: "C:\\...\\chromedriver.exe",
    //     createTime: 1234567890
    //   }
    // }
    return response.data;
  }

  // 关闭浏览器
  async closeBrowser(profileId) {
    const response = await this.axios.post('/browser/close', {
      id: profileId
    });
    return response.data;
  }

  // 获取活动的浏览器列表
  async getActiveBrowsers() {
    const response = await this.axios.post('/browser/active');
    return response.data || [];
  }

  // 检查代理
  async checkProxy(proxyConfig) {
    const response = await this.axios.post('/proxy/check', {
      proxyType: proxyConfig.type,
      host: proxyConfig.host,
      port: proxyConfig.port,
      proxyUserName: proxyConfig.username,
      proxyPassword: proxyConfig.password
    });
    return response.data;
  }

  // 生成随机指纹
  async generateRandomFingerprint(platform = 'windows') {
    const response = await this.axios.post('/fingerprint/random', {
      platform
    });
    return response.data;
  }

  // 批量操作
  async batchOperation(operation, profileIds) {
    const results = [];
    for (const profileId of profileIds) {
      try {
        let result;
        switch (operation) {
          case 'open':
            result = await this.openBrowser(profileId);
            break;
          case 'close':
            result = await this.closeBrowser(profileId);
            break;
          case 'delete':
            result = await this.deleteBrowserProfile(profileId);
            break;
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
        results.push({ profileId, success: true, data: result });
      } catch (error) {
        results.push({ profileId, success: false, error: error.message });
      }
    }
    return results;
  }

  // 等待浏览器启动完成
  async waitForBrowserReady(profileId, maxRetries = 30, retryDelay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const activeBrowsers = await this.getActiveBrowsers();
        const browser = activeBrowsers.find(b => b.id === profileId);
        
        if (browser && browser.ws) {
          // 验证WebSocket连接
          const ws = require('ws');
          const client = new ws(browser.ws);
          
          return new Promise((resolve, reject) => {
            client.on('open', () => {
              client.close();
              resolve(browser);
            });
            
            client.on('error', () => {
              client.close();
              reject(new Error('WebSocket connection failed'));
            });
            
            setTimeout(() => {
              client.close();
              reject(new Error('WebSocket connection timeout'));
            }, 5000);
          });
        }
      } catch (error) {
        // 继续重试
      }
      
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
    
    throw new Error(`Browser ${profileId} failed to start after ${maxRetries} attempts`);
  }
}

module.exports = BitBrowserClient;
```

### 4.3 指纹配置详解

```javascript
// fingerprint-manager.js - 指纹管理器
class FingerprintManager {
  constructor(bitBrowserClient) {
    this.client = bitBrowserClient;
  }

  // 生成YouTube账号专用指纹
  async generateYouTubeFingerprint(accountInfo) {
    // 基础指纹配置
    const baseFingerprint = {
      // 平台选择（根据目标受众）
      platform: this.selectPlatform(accountInfo.targetRegion),
      
      // User-Agent（保持一致性）
      userAgent: this.generateConsistentUA(accountInfo),
      
      // 分辨率（常见分辨率）
      resolution: this.selectCommonResolution(),
      
      // 语言（根据目标市场）
      languages: this.selectLanguages(accountInfo.targetRegion),
      
      // 时区（与IP地理位置匹配）
      timeZone: this.selectTimeZone(accountInfo.proxyLocation),
      
      // WebRTC（防止IP泄露）
      webRTC: '2',  // 替换模式
      
      // Canvas指纹（轻度噪音）
      canvas: '1',
      
      // WebGL（保持稳定）
      webGL: '1',
      
      // 音频指纹
      audio: '1',
      
      // 硬件信息（合理范围）
      hardwareConcurrency: this.selectCPUCores(),
      deviceMemory: this.selectMemory(),
      
      // 媒体设备（YouTube需要）
      mediaDevice: '2',  // 自定义设备
      mediaDeviceNum: {
        audioinput: 1,
        audiooutput: 2,
        videoinput: 1
      }
    };

    return baseFingerprint;
  }

  // 选择平台
  selectPlatform(targetRegion) {
    const platformDistribution = {
      'US': { windows: 0.7, mac: 0.2, linux: 0.1 },
      'CN': { windows: 0.9, mac: 0.08, linux: 0.02 },
      'EU': { windows: 0.75, mac: 0.15, linux: 0.1 }
    };

    const distribution = platformDistribution[targetRegion] || platformDistribution['US'];
    const random = Math.random();
    
    if (random < distribution.windows) return 'windows';
    if (random < distribution.windows + distribution.mac) return 'mac';
    return 'linux';
  }

  // 生成一致的User-Agent
  generateConsistentUA(accountInfo) {
    // 为每个账号生成固定但看起来真实的UA
    const seed = this.hashCode(accountInfo.email);
    const chromeVersions = ['120', '121', '122', '123', '124'];
    const version = chromeVersions[seed % chromeVersions.length];
    
    const templates = {
      windows: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`,
      mac: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`,
      linux: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`
    };

    return templates[accountInfo.platform || 'windows'];
  }

  // 选择常见分辨率
  selectCommonResolution() {
    const resolutions = [
      '1920x1080',  // 1080p - 最常见
      '2560x1440',  // 1440p
      '1366x768',   // 笔记本常见
      '1536x864',   // Surface
      '1440x900',   // Mac
      '1600x900'    // 宽屏笔记本
    ];
    
    // 加权选择，1080p概率最高
    const weights = [40, 20, 15, 10, 10, 5];
    return this.weightedRandom(resolutions, weights);
  }

  // 选择语言
  selectLanguages(targetRegion) {
    const languageProfiles = {
      'US': ['en-US', 'en'],
      'UK': ['en-GB', 'en'],
      'CN': ['zh-CN', 'zh', 'en'],
      'JP': ['ja', 'en'],
      'ES': ['es-ES', 'es', 'en'],
      'FR': ['fr-FR', 'fr', 'en'],
      'DE': ['de-DE', 'de', 'en'],
      'BR': ['pt-BR', 'pt', 'en']
    };

    const languages = languageProfiles[targetRegion] || languageProfiles['US'];
    return languages.join(',');
  }

  // 选择时区
  selectTimeZone(proxyLocation) {
    // 根据代理IP位置选择合适的时区
    const timeZoneMap = {
      'US-East': 'America/New_York',
      'US-Central': 'America/Chicago',
      'US-West': 'America/Los_Angeles',
      'UK': 'Europe/London',
      'EU-Central': 'Europe/Berlin',
      'Asia-East': 'Asia/Shanghai',
      'Asia-Southeast': 'Asia/Singapore',
      'AU': 'Australia/Sydney'
    };

    return timeZoneMap[proxyLocation] || 'America/New_York';
  }

  // 选择CPU核心数
  selectCPUCores() {
    const cores = [2, 4, 6, 8, 12, 16];
    const weights = [10, 40, 25, 15, 8, 2];
    return this.weightedRandom(cores, weights);
  }

  // 选择内存大小
  selectMemory() {
    const memory = [2, 4, 8, 16, 32];
    const weights = [5, 25, 45, 20, 5];
    return this.weightedRandom(memory, weights);
  }

  // 工具函数：加权随机
  weightedRandom(items, weights) {
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return items[i];
      }
    }
    
    return items[items.length - 1];
  }

  // 工具函数：字符串哈希
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  // 验证指纹一致性
  async validateFingerprint(profileId) {
    const activeBrowser = await this.client.getActiveBrowsers();
    const browser = activeBrowser.find(b => b.id === profileId);
    
    if (!browser) {
      throw new Error('Browser not found');
    }

    // 连接到浏览器并检查指纹
    const puppeteer = require('puppeteer-core');
    const browserInstance = await puppeteer.connect({
      browserWSEndpoint: browser.ws,
      defaultViewport: null
    });

    const page = await browserInstance.newPage();
    await page.goto('https://browserleaks.com/javascript');
    
    const fingerprint = await page.evaluate(() => {
      return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: navigator.deviceMemory,
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        languages: navigator.languages.join(',')
      };
    });

    await page.close();
    await browserInstance.disconnect();

    return fingerprint;
  }
}

module.exports = FingerprintManager;
```

---

## 5. 核心模块实现

### 5.1 YouTube上传器适配器

```javascript
// youtube-uploader-adapter.js - 适配youtube-uploader以支持BitBrowser
const { upload } = require('youtube-videos-uploader');
const puppeteer = require('puppeteer-core');

class YouTubeUploaderAdapter {
  constructor(bitBrowserClient) {
    this.bitBrowserClient = bitBrowserClient;
    this.activeConnections = new Map();
  }

  // 修改youtube-uploader以支持外部浏览器实例
  async uploadWithBitBrowser(profileId, credentials, videos, options = {}) {
    let browserData = null;
    let browser = null;
    
    try {
      // 1. 启动BitBrowser
      console.log(`[Uploader] Starting BitBrowser for profile: ${profileId}`);
      browserData = await this.bitBrowserClient.openBrowser(profileId, {
        isHeadless: options.headless || false,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--no-sandbox'
        ]
      });

      // 2. 等待浏览器就绪
      await this.bitBrowserClient.waitForBrowserReady(profileId);

      // 3. 连接Puppeteer
      console.log(`[Uploader] Connecting Puppeteer to: ${browserData.ws}`);
      browser = await puppeteer.connect({
        browserWSEndpoint: browserData.ws,
        defaultViewport: null,
        slowMo: 50  // 减慢操作速度，更像人类
      });

      // 4. 保存连接信息
      this.activeConnections.set(profileId, {
        browser,
        browserData,
        startTime: Date.now()
      });

      // 5. Monkey patch youtube-uploader
      const originalLaunch = puppeteer.launch;
      puppeteer.launch = async () => browser;

      try {
        // 6. 执行上传
        console.log(`[Uploader] Starting upload process`);
        const results = await upload(credentials, videos, {
          ...options,
          headless: false,  // BitBrowser已经控制了headless
          // 其他选项会被忽略，因为我们提供了browser实例
        });

        console.log(`[Uploader] Upload completed:`, results);
        return results;

      } finally {
        // 7. 恢复原始launch方法
        puppeteer.launch = originalLaunch;
      }

    } catch (error) {
      console.error(`[Uploader] Error:`, error);
      throw error;
      
    } finally {
      // 8. 清理资源
      if (browser) {
        try {
          await browser.disconnect();
        } catch (e) {
          console.error('[Uploader] Error disconnecting browser:', e);
        }
      }

      if (browserData) {
        try {
          await this.bitBrowserClient.closeBrowser(profileId);
        } catch (e) {
          console.error('[Uploader] Error closing BitBrowser:', e);
        }
      }

      this.activeConnections.delete(profileId);
    }
  }

  // 批量上传（串行执行，避免资源竞争）
  async batchUpload(uploadTasks) {
    const results = [];
    
    for (const task of uploadTasks) {
      const startTime = Date.now();
      
      try {
        console.log(`\n${'='.repeat(50)}`);
        console.log(`[Batch] Processing task ${task.id}`);
        console.log(`Account: ${task.accountEmail}`);
        console.log(`Video: ${task.video.title}`);
        console.log(`${'='.repeat(50)}\n`);

        const result = await this.uploadWithBitBrowser(
          task.profileId,
          task.credentials,
          [task.video],
          task.options
        );

        const duration = Math.round((Date.now() - startTime) / 1000);
        
        results.push({
          taskId: task.id,
          success: true,
          accountEmail: task.accountEmail,
          videoTitle: task.video.title,
          url: result[0],
          duration: `${duration}s`,
          timestamp: new Date().toISOString()
        });

        console.log(`[Batch] Task completed in ${duration}s`);

        // 任务间隔，避免触发限制
        if (uploadTasks.indexOf(task) < uploadTasks.length - 1) {
          const delay = 30000 + Math.random() * 30000; // 30-60秒随机延迟
          console.log(`[Batch] Waiting ${Math.round(delay/1000)}s before next task...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (error) {
        const duration = Math.round((Date.now() - startTime) / 1000);
        
        results.push({
          taskId: task.id,
          success: false,
          accountEmail: task.accountEmail,
          videoTitle: task.video.title,
          error: error.message,
          duration: `${duration}s`,
          timestamp: new Date().toISOString()
        });

        console.error(`[Batch] Task failed after ${duration}s:`, error.message);
      }
    }

    return results;
  }

  // 并行上传（高级功能，需要更多资源）
  async parallelUpload(uploadTasks, maxConcurrency = 3) {
    const results = [];
    const queue = [...uploadTasks];
    const running = [];

    while (queue.length > 0 || running.length > 0) {
      // 启动新任务
      while (running.length < maxConcurrency && queue.length > 0) {
        const task = queue.shift();
        const promise = this.uploadWithBitBrowser(
          task.profileId,
          task.credentials,
          [task.video],
          task.options
        ).then(result => ({
          taskId: task.id,
          success: true,
          result
        })).catch(error => ({
          taskId: task.id,
          success: false,
          error: error.message
        }));

        running.push(promise);
      }

      // 等待任一任务完成
      if (running.length > 0) {
        const completed = await Promise.race(running);
        results.push(completed);
        
        // 移除已完成的任务
        const index = running.findIndex(p => p === completed);
        running.splice(index, 1);
      }
    }

    return results;
  }

  // 获取活动连接状态
  getActiveConnections() {
    const connections = [];
    
    for (const [profileId, connection] of this.activeConnections) {
      connections.push({
        profileId,
        duration: Math.round((Date.now() - connection.startTime) / 1000),
        browserEndpoint: connection.browserData.ws
      });
    }

    return connections;
  }

  // 强制关闭所有连接
  async closeAllConnections() {
    const promises = [];
    
    for (const [profileId, connection] of this.activeConnections) {
      promises.push(
        connection.browser.disconnect()
          .then(() => this.bitBrowserClient.closeBrowser(profileId))
          .catch(error => console.error(`Error closing ${profileId}:`, error))
      );
    }

    await Promise.all(promises);
    this.activeConnections.clear();
  }
}

module.exports = YouTubeUploaderAdapter;
```

### 5.2 账号管理器

```javascript
// account-manager.js - 账号管理核心模块
const { Pool } = require('pg');
const crypto = require('crypto');

class AccountManager {
  constructor(dbConfig, bitBrowserClient) {
    this.db = new Pool(dbConfig);
    this.bitBrowserClient = bitBrowserClient;
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-this';
  }

  // 加密密码
  encryptPassword(password) {
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  // 解密密码
  decryptPassword(encryptedPassword) {
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encryptedPassword, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // 添加新账号
  async addAccount(accountData) {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // 1. 创建BitBrowser配置
      const profileData = {
        name: `YouTube_${accountData.channelName || accountData.email}`,
        groupId: accountData.groupId || '0',
        proxyMethod: accountData.proxy ? 2 : 0,
        proxyType: accountData.proxy?.type || 'http',
        host: accountData.proxy?.host || '',
        port: accountData.proxy?.port || '',
        proxyUserName: accountData.proxy?.username || '',
        proxyPassword: accountData.proxy?.password || ''
      };

      const profile = await this.bitBrowserClient.createBrowserProfile(profileData);

      // 2. 保存账号信息到数据库
      const query = `
        INSERT INTO youtube_accounts (
          email, password_encrypted, recovery_email, channel_name,
          profile_id, proxy_config, fingerprint_config, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const values = [
        accountData.email,
        this.encryptPassword(accountData.password),
        accountData.recoveryEmail,
        accountData.channelName,
        profile.id,
        JSON.stringify(accountData.proxy || {}),
        JSON.stringify(profile.fingerprint || {}),
        'active'
      ];

      const result = await client.query(query, values);
      
      await client.query('COMMIT');
      
      console.log(`[AccountManager] Account added: ${accountData.email}`);
      return result.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[AccountManager] Error adding account:', error);
      
      // 如果Profile已创建，尝试删除
      if (profile?.id) {
        try {
          await this.bitBrowserClient.deleteBrowserProfile(profile.id);
        } catch (e) {
          console.error('[AccountManager] Failed to cleanup profile:', e);
        }
      }
      
      throw error;
    } finally {
      client.release();
    }
  }

  // 获取账号信息
  async getAccount(accountId) {
    const query = 'SELECT * FROM youtube_accounts WHERE id = $1';
    const result = await this.db.query(query, [accountId]);
    
    if (result.rows.length === 0) {
      throw new Error(`Account ${accountId} not found`);
    }

    const account = result.rows[0];
    account.password = this.decryptPassword(account.password_encrypted);
    delete account.password_encrypted;
    
    return account;
  }

  // 获取所有活跃账号
  async getActiveAccounts() {
    const query = `
      SELECT * FROM youtube_accounts 
      WHERE status = 'active' 
      ORDER BY health_score DESC, last_upload_time ASC
    `;
    
    const result = await this.db.query(query);
    
    return result.rows.map(account => {
      account.password = this.decryptPassword(account.password_encrypted);
      delete account.password_encrypted;
      return account;
    });
  }

  // 更新账号状态
  async updateAccountStatus(accountId, status, reason = null) {
    const query = `
      UPDATE youtube_accounts 
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await this.db.query(query, [accountId, status]);
    
    // 记录状态变更日志
    await this.logAccountEvent(accountId, 'status_change', {
      newStatus: status,
      reason: reason
    });

    return result.rows[0];
  }

  // 更新账号健康度
  async updateAccountHealth(accountId, metrics) {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // 计算健康度分数
      const healthScore = this.calculateHealthScore(metrics);

      // 更新账号表
      const updateQuery = `
        UPDATE youtube_accounts 
        SET 
          health_score = $2,
          daily_upload_count = $3,
          last_upload_time = $4,
          updated_at = NOW()
        WHERE id = $1
      `;

      await client.query(updateQuery, [
        accountId,
        healthScore,
        metrics.dailyUploads,
        metrics.lastUploadTime
      ]);

      // 记录健康度历史
      const historyQuery = `
        INSERT INTO account_health_history (
          account_id, health_score, upload_success_rate, 
          error_count, daily_uploads
        ) VALUES ($1, $2, $3, $4, $5)
      `;

      await client.query(historyQuery, [
        accountId,
        healthScore,
        metrics.successRate,
        metrics.errorCount,
        metrics.dailyUploads
      ]);

      await client.query('COMMIT');
      
      return healthScore;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // 计算健康度分数
  calculateHealthScore(metrics) {
    let score = 100;

    // 成功率影响（权重40%）
    score -= (1 - metrics.successRate) * 40;

    // 错误次数影响（权重30%）
    if (metrics.errorCount > 0) {
      score -= Math.min(metrics.errorCount * 5, 30);
    }

    // 每日上传量影响（权重20%）
    if (metrics.dailyUploads >= 50) {
      score -= 20;  // 达到YouTube限制
    } else if (metrics.dailyUploads >= 40) {
      score -= 10;  // 接近限制
    }

    // 连续失败影响（权重10%）
    if (metrics.consecutiveFailures >= 3) {
      score -= 10;
    }

    return Math.max(0, Math.round(score));
  }

  // 获取最佳上传账号
  async getBestAccountForUpload() {
    const query = `
      SELECT * FROM youtube_accounts 
      WHERE 
        status = 'active' 
        AND health_score > 50
        AND daily_upload_count < 40
        AND (last_upload_time IS NULL OR last_upload_time < NOW() - INTERVAL '30 minutes')
      ORDER BY 
        health_score DESC,
        daily_upload_count ASC,
        last_upload_time ASC
      LIMIT 1
    `;

    const result = await this.db.query(query);
    
    if (result.rows.length === 0) {
      throw new Error('No suitable account available for upload');
    }

    const account = result.rows[0];
    account.password = this.decryptPassword(account.password_encrypted);
    delete account.password_encrypted;
    
    return account;
  }

  // 重置每日计数器
  async resetDailyCounters() {
    const query = `
      UPDATE youtube_accounts 
      SET daily_upload_count = 0 
      WHERE daily_upload_count > 0
    `;

    const result = await this.db.query(query);
    console.log(`[AccountManager] Reset daily counters for ${result.rowCount} accounts`);
    
    return result.rowCount;
  }

  // 记录账号事件
  async logAccountEvent(accountId, eventType, details) {
    const query = `
      INSERT INTO system_logs (
        level, category, account_id, message, details
      ) VALUES ($1, $2, $3, $4, $5)
    `;

    await this.db.query(query, [
      'info',
      'account',
      accountId,
      eventType,
      JSON.stringify(details)
    ]);
  }

  // 批量导入账号
  async bulkImportAccounts(accounts) {
    const results = {
      success: [],
      failed: []
    };

    for (const account of accounts) {
      try {
        const result = await this.addAccount(account);
        results.success.push({
          email: account.email,
          id: result.id
        });
      } catch (error) {
        results.failed.push({
          email: account.email,
          error: error.message
        });
      }
    }

    return results;
  }

  // 导出账号配置
  async exportAccountConfigs() {
    const accounts = await this.getActiveAccounts();
    
    const configs = accounts.map(account => ({
      email: account.email,
      channelName: account.channel_name,
      profileId: account.profile_id,
      proxyConfig: account.proxy_config,
      fingerprintConfig: account.fingerprint_config,
      healthScore: account.health_score,
      status: account.status
    }));

    return configs;
  }

  // 清理无效账号
  async cleanupInvalidAccounts() {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // 查找需要清理的账号
      const query = `
        SELECT id, profile_id FROM youtube_accounts 
        WHERE status = 'banned' OR health_score < 10
      `;
      
      const result = await client.query(query);
      
      for (const account of result.rows) {
        // 删除BitBrowser配置
        try {
          await this.bitBrowserClient.deleteBrowserProfile(account.profile_id);
        } catch (e) {
          console.error(`[AccountManager] Failed to delete profile ${account.profile_id}:`, e);
        }

        // 标记账号为已删除
        await client.query(
          'UPDATE youtube_accounts SET status = $2 WHERE id = $1',
          [account.id, 'deleted']
        );
      }

      await client.query('COMMIT');
      
      console.log(`[AccountManager] Cleaned up ${result.rows.length} invalid accounts`);
      return result.rows.length;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = AccountManager;
```

### 5.3 任务调度器

```javascript
// task-scheduler.js - 任务调度核心模块
const Bull = require('bull');
const { v4: uuidv4 } = require('uuid');

class TaskScheduler {
  constructor(redisConfig, accountManager, uploaderAdapter) {
    this.accountManager = accountManager;
    this.uploaderAdapter = uploaderAdapter;
    
    // 创建任务队列
    this.uploadQueue = new Bull('youtube-upload', {
      redis: redisConfig
    });

    // 创建定时任务队列
    this.scheduledQueue = new Bull('youtube-scheduled', {
      redis: redisConfig
    });

    // 初始化队列处理器
    this.initializeQueueProcessors();
    
    // 任务统计
    this.stats = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      active: 0
    };
  }

  // 初始化队列处理器
  initializeQueueProcessors() {
    // 上传任务处理器
    this.uploadQueue.process(3, async (job) => {
      const { taskId, accountId, video, options } = job.data;
      
      try {
        console.log(`[Scheduler] Processing upload task: ${taskId}`);
        
        // 获取账号信息
        const account = await this.accountManager.getAccount(accountId);
        
        // 准备上传任务
        const uploadTask = {
          id: taskId,
          profileId: account.profile_id,
          accountEmail: account.email,
          credentials: {
            email: account.email,
            pass: account.password,
            recoveryemail: account.recovery_email
          },
          video: video,
          options: options || {}
        };

        // 执行上传
        const results = await this.uploaderAdapter.batchUpload([uploadTask]);
        const result = results[0];

        if (result.success) {
          // 更新账号状态
          await this.accountManager.updateAccountHealth(accountId, {
            successRate: 1,
            errorCount: 0,
            dailyUploads: account.daily_upload_count + 1,
            lastUploadTime: new Date(),
            consecutiveFailures: 0
          });

          // 更新任务状态
          await this.updateTaskStatus(taskId, 'completed', {
            url: result.url,
            duration: result.duration
          });

          this.stats.succeeded++;
          return result;
          
        } else {
          throw new Error(result.error);
        }

      } catch (error) {
        console.error(`[Scheduler] Task ${taskId} failed:`, error);
        
        // 更新账号健康度
        if (accountId) {
          const account = await this.accountManager.getAccount(accountId);
          await this.accountManager.updateAccountHealth(accountId, {
            successRate: 0,
            errorCount: (account.error_count || 0) + 1,
            dailyUploads: account.daily_upload_count,
            lastUploadTime: account.last_upload_time,
            consecutiveFailures: (account.consecutive_failures || 0) + 1
          });
        }

        // 更新任务状态
        await this.updateTaskStatus(taskId, 'failed', {
          error: error.message,
          stack: error.stack
        });

        this.stats.failed++;
        throw error;
      } finally {
        this.stats.active--;
      }
    });

    // 定时任务处理器
    this.scheduledQueue.process(async (job) => {
      const { taskId, scheduledTime } = job.data;
      
      console.log(`[Scheduler] Processing scheduled task: ${taskId}`);
      
      // 将任务添加到上传队列
      await this.uploadQueue.add(job.data, {
        delay: new Date(scheduledTime).getTime() - Date.now()
      });
      
      return { scheduled: true, taskId };
    });

    // 队列事件监听
    this.uploadQueue.on('completed', (job, result) => {
      console.log(`[Scheduler] Job ${job.id} completed:`, result);
    });

    this.uploadQueue.on('failed', (job, error) => {
      console.error(`[Scheduler] Job ${job.id} failed:`, error);
    });

    this.uploadQueue.on('stalled', (job) => {
      console.warn(`[Scheduler] Job ${job.id} stalled`);
    });
  }

  // 创建上传任务
  async createUploadTask(taskData) {
    const taskId = taskData.taskId || uuidv4();
    
    // 保存任务到数据库
    await this.saveTaskToDatabase({
      task_id: taskId,
      account_id: taskData.accountId,
      video_path: taskData.video.path,
      title: taskData.video.title,
      description: taskData.video.description,
      tags: taskData.video.tags,
      thumbnail_path: taskData.video.thumbnail,
      publish_type: taskData.video.publishType,
      publish_at: taskData.video.publishAt,
      playlist_name: taskData.video.playlist,
      status: 'pending'
    });

    // 根据发布类型处理
    if (taskData.video.publishType === 'SCHEDULE' && taskData.video.publishAt) {
      // 定时发布任务
      const scheduledTime = new Date(taskData.video.publishAt);
      
      await this.scheduledQueue.add({
        taskId,
        scheduledTime,
        ...taskData
      }, {
        delay: scheduledTime.getTime() - Date.now()
      });
      
      console.log(`[Scheduler] Scheduled task ${taskId} for ${scheduledTime}`);
      
    } else {
      // 立即执行任务
      await this.uploadQueue.add({
        taskId,
        ...taskData
      }, {
        priority: taskData.priority || 0,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60000  // 1分钟
        }
      });
      
      console.log(`[Scheduler] Created immediate task ${taskId}`);
    }

    this.stats.active++;
    return taskId;
  }

  // 批量创建任务
  async createBatchTasks(videos, options = {}) {
    const tasks = [];
    const accounts = await this.accountManager.getActiveAccounts();
    
    if (accounts.length === 0) {
      throw new Error('No active accounts available');
    }

    // 智能分配策略
    const allocation = this.allocateVideosToAccounts(videos, accounts, options);
    
    for (const { video, accountId } of allocation) {
      const taskId = await this.createUploadTask({
        accountId,
        video,
        priority: options.priority || 0
      });
      
      tasks.push(taskId);
    }

    console.log(`[Scheduler] Created ${tasks.length} batch tasks`);
    return tasks;
  }

  // 智能分配视频到账号
  allocateVideosToAccounts(videos, accounts, options) {
    const allocation = [];
    
    // 按健康度排序账号
    const sortedAccounts = accounts.sort((a, b) => {
      // 优先使用健康度高的账号
      if (b.health_score !== a.health_score) {
        return b.health_score - a.health_score;
      }
      // 其次考虑今日上传数量
      if (a.daily_upload_count !== b.daily_upload_count) {
        return a.daily_upload_count - b.daily_upload_count;
      }
      // 最后考虑上次上传时间
      return (a.last_upload_time || 0) - (b.last_upload_time || 0);
    });

    // 轮询分配
    let accountIndex = 0;
    for (const video of videos) {
      // 跳过不健康的账号
      while (sortedAccounts[accountIndex].health_score < 50 || 
             sortedAccounts[accountIndex].daily_upload_count >= 40) {
        accountIndex = (accountIndex + 1) % sortedAccounts.length;
        
        // 如果所有账号都不可用，抛出错误
        if (accountIndex === 0) {
          throw new Error('All accounts have reached their limits');
        }
      }

      allocation.push({
        video,
        accountId: sortedAccounts[accountIndex].id
      });

      // 更新账号的预期上传数
      sortedAccounts[accountIndex].daily_upload_count++;
      
      // 移动到下一个账号
      accountIndex = (accountIndex + 1) % sortedAccounts.length;
    }

    return allocation;
  }

  // 获取任务状态
  async getTaskStatus(taskId) {
    const job = await this.uploadQueue.getJob(taskId);
    
    if (!job) {
      const scheduledJob = await this.scheduledQueue.getJob(taskId);
      if (scheduledJob) {
        return {
          taskId,
          status: 'scheduled',
          scheduledTime: scheduledJob.opts.delay 
            ? new Date(Date.now() + scheduledJob.opts.delay) 
            : null
        };
      }
      
      // 从数据库查询
      return await this.getTaskFromDatabase(taskId);
    }

    return {
      taskId: job.id,
      status: await job.getState(),
      progress: job.progress(),
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn
    };
  }

  // 取消任务
  async cancelTask(taskId) {
    // 尝试从上传队列取消
    const job = await this.uploadQueue.getJob(taskId);
    if (job) {
      await job.remove();
      await this.updateTaskStatus(taskId, 'cancelled');
      return true;
    }

    // 尝试从定时队列取消
    const scheduledJob = await this.scheduledQueue.getJob(taskId);
    if (scheduledJob) {
      await scheduledJob.remove();
      await this.updateTaskStatus(taskId, 'cancelled');
      return true;
    }

    return false;
  }

  // 重试失败任务
  async retryFailedTask(taskId) {
    const task = await this.getTaskFromDatabase(taskId);
    
    if (!task || task.status !== 'failed') {
      throw new Error('Task not found or not in failed state');
    }

    // 重置任务状态
    await this.updateTaskStatus(taskId, 'pending', {
      retry_count: task.retry_count + 1
    });

    // 重新创建任务
    return await this.createUploadTask({
      taskId: task.task_id,
      accountId: task.account_id,
      video: {
        path: task.video_path,
        title: task.title,
        description: task.description,
        tags: task.tags,
        thumbnail: task.thumbnail_path,
        publishType: task.publish_type,
        publishAt: task.publish_at,
        playlist: task.playlist_name
      },
      priority: 1  // 提高优先级
    });
  }

  // 获取队列统计
  async getQueueStats() {
    const uploadStats = await this.uploadQueue.getJobCounts();
    const scheduledStats = await this.scheduledQueue.getJobCounts();
    
    return {
      upload: {
        waiting: uploadStats.waiting,
        active: uploadStats.active,
        completed: uploadStats.completed,
        failed: uploadStats.failed,
        delayed: uploadStats.delayed
      },
      scheduled: {
        waiting: scheduledStats.waiting,
        active: scheduledStats.active,
        completed: scheduledStats.completed,
        failed: scheduledStats.failed,
        delayed: scheduledStats.delayed
      },
      overall: this.stats
    };
  }

  // 清理已完成的任务
  async cleanCompletedJobs(grace = 86400000) { // 默认保留24小时
    const uploadCleaned = await this.uploadQueue.clean(grace, 'completed');
    const scheduledCleaned = await this.scheduledQueue.clean(grace, 'completed');
    
    console.log(`[Scheduler] Cleaned ${uploadCleaned.length + scheduledCleaned.length} completed jobs`);
    
    return {
      upload: uploadCleaned.length,
      scheduled: scheduledCleaned.length
    };
  }

  // 数据库操作方法
  async saveTaskToDatabase(taskData) {
    // 实现数据库保存逻辑
    const db = this.accountManager.db;
    const query = `
      INSERT INTO upload_tasks (
        task_id, account_id, video_path, title, description,
        tags, thumbnail_path, publish_type, publish_at,
        playlist_name, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;
    
    const values = [
      taskData.task_id,
      taskData.account_id,
      taskData.video_path,
      taskData.title,
      taskData.description,
      taskData.tags,
      taskData.thumbnail_path,
      taskData.publish_type,
      taskData.publish_at,
      taskData.playlist_name,
      taskData.status
    ];
    
    await db.query(query, values);
  }

  async updateTaskStatus(taskId, status, details = {}) {
    const db = this.accountManager.db;
    const query = `
      UPDATE upload_tasks 
      SET 
        status = $2,
        result_url = $3,
        error_message = $4,
        completed_at = CASE WHEN $2 IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE NULL END,
        updated_at = NOW()
      WHERE task_id = $1
    `;
    
    await db.query(query, [
      taskId,
      status,
      details.url || null,
      details.error || null
    ]);
  }

  async getTaskFromDatabase(taskId) {
    const db = this.accountManager.db;
    const query = 'SELECT * FROM upload_tasks WHERE task_id = $1';
    const result = await db.query(query, [taskId]);
    
    return result.rows[0] || null;
  }

  // 定时任务
  setupCronJobs() {
    // 每天凌晨重置计数器
    this.uploadQueue.add('reset-daily-counters', {}, {
      repeat: {
        cron: '0 0 * * *'  // 每天0点
      }
    });

    // 每小时清理完成的任务
    this.uploadQueue.add('clean-completed-jobs', {}, {
      repeat: {
        cron: '0 * * * *'  // 每小时
      }
    });

    // 处理定时任务
    this.uploadQueue.process('reset-daily-counters', async () => {
      await this.accountManager.resetDailyCounters();
    });

    this.uploadQueue.process('clean-completed-jobs', async () => {
      await this.cleanCompletedJobs();
    });
  }
}

module.exports = TaskScheduler;
```

---

## 6. 完整代码实现

### 6.1 主应用入口

```javascript
// app.js - 主应用程序
require('dotenv').config();
const express = require('express');
const winston = require('winston');
const { Pool } = require('pg');
const Redis = require('ioredis');

// 核心模块
const BitBrowserClient = require('./lib/bitbrowser-client');
const AccountManager = require('./lib/account-manager');
const YouTubeUploaderAdapter = require('./lib/youtube-uploader-adapter');
const TaskScheduler = require('./lib/task-scheduler');
const FingerprintManager = require('./lib/fingerprint-manager');

// API路由
const accountRoutes = require('./routes/accounts');
const taskRoutes = require('./routes/tasks');
const monitorRoutes = require('./routes/monitor');

class YouTubeMatrixApp {
  constructor() {
    this.app = express();
    this.logger = this.setupLogger();
    this.config = this.loadConfig();
  }

  // 设置日志
  setupLogger() {
    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({ 
          filename: 'logs/error.log', 
          level: 'error' 
        }),
        new winston.transports.File({ 
          filename: 'logs/combined.log' 
        })
      ]
    });
  }

  // 加载配置
  loadConfig() {
    return {
      server: {
        port: process.env.PORT || 3000,
        host: process.env.HOST || '0.0.0.0'
      },
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'youtube_matrix',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB || 0
      },
      bitbrowser: {
        apiUrl: process.env.BITBROWSER_API_URL || 'http://127.0.0.1:54345'
      }
    };
  }

  // 初始化服务
  async initialize() {
    try {
      this.logger.info('Initializing YouTube Matrix App...');

      // 初始化数据库连接
      this.db = new Pool(this.config.database);
      await this.db.query('SELECT NOW()');
      this.logger.info('Database connected');

      // 初始化Redis连接
      this.redis = new Redis(this.config.redis);
      await this.redis.ping();
      this.logger.info('Redis connected');

      // 初始化BitBrowser客户端
      this.bitBrowserClient = new BitBrowserClient(this.config.bitbrowser);
      this.logger.info('BitBrowser client initialized');

      // 初始化核心服务
      this.accountManager = new AccountManager(this.config.database, this.bitBrowserClient);
      this.fingerprintManager = new FingerprintManager(this.bitBrowserClient);
      this.uploaderAdapter = new YouTubeUploaderAdapter(this.bitBrowserClient);
      this.taskScheduler = new TaskScheduler(
        this.config.redis,
        this.accountManager,
        this.uploaderAdapter
      );

      // 设置定时任务
      this.taskScheduler.setupCronJobs();

      // 设置Express中间件
      this.setupMiddleware();

      // 设置路由
      this.setupRoutes();

      // 错误处理
      this.setupErrorHandling();

      this.logger.info('Application initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize application:', error);
      throw error;
    }
  }

  // 设置中间件
  setupMiddleware() {
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    
    // CORS设置
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // 请求日志
    this.app.use((req, res, next) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      next();
    });

    // 注入依赖
    this.app.use((req, res, next) => {
      req.services = {
        logger: this.logger,
        db: this.db,
        redis: this.redis,
        bitBrowserClient: this.bitBrowserClient,
        accountManager: this.accountManager,
        fingerprintManager: this.fingerprintManager,
        uploaderAdapter: this.uploaderAdapter,
        taskScheduler: this.taskScheduler
      };
      next();
    });
  }

  // 设置路由
  setupRoutes() {
    // API路由
    this.app.use('/api/accounts', accountRoutes);
    this.app.use('/api/tasks', taskRoutes);
    this.app.use('/api/monitor', monitorRoutes);

    // 健康检查
    this.app.get('/health', async (req, res) => {
      try {
        await this.db.query('SELECT 1');
        await this.redis.ping();
        
        res.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services: {
            database: 'connected',
            redis: 'connected',
            bitbrowser: 'connected'
          }
        });
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          error: error.message
        });
      }
    });

    // 首页
    this.app.get('/', (req, res) => {
      res.json({
        name: 'YouTube Matrix Automation System',
        version: '1.0.0',
        endpoints: {
          health: '/health',
          accounts: '/api/accounts',
          tasks: '/api/tasks',
          monitor: '/api/monitor'
        }
      });
    });
  }

  // 错误处理
  setupErrorHandling() {
    // 404处理
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        path: req.path
      });
    });

    // 全局错误处理
    this.app.use((err, req, res, next) => {
      this.logger.error('Unhandled error:', err);
      
      res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    });
  }

  // 启动服务器
  async start() {
    try {
      await this.initialize();
      
      this.server = this.app.listen(this.config.server.port, this.config.server.host, () => {
        this.logger.info(`Server running at http://${this.config.server.host}:${this.config.server.port}`);
      });

      // 优雅关闭
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());

    } catch (error) {
      this.logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  // 关闭服务
  async shutdown() {
    this.logger.info('Shutting down server...');
    
    try {
      // 关闭服务器
      if (this.server) {
        await new Promise((resolve) => this.server.close(resolve));
      }

      // 关闭所有浏览器连接
      if (this.uploaderAdapter) {
        await this.uploaderAdapter.closeAllConnections();
      }

      // 关闭数据库连接
      if (this.db) {
        await this.db.end();
      }

      // 关闭Redis连接
      if (this.redis) {
        this.redis.disconnect();
      }

      this.logger.info('Server shutdown complete');
      process.exit(0);

    } catch (error) {
      this.logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// 启动应用
if (require.main === module) {
  const app = new YouTubeMatrixApp();
  app.start();
}

module.exports = YouTubeMatrixApp;
```

### 6.2 API路由实现

```javascript
// routes/accounts.js - 账号管理API
const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parse');
const fs = require('fs').promises;

// 文件上传配置
const upload = multer({ dest: 'uploads/' });

// 获取所有账号
router.get('/', async (req, res) => {
  try {
    const { accountManager } = req.services;
    const accounts = await accountManager.getActiveAccounts();
    
    res.json({
      total: accounts.length,
      accounts: accounts.map(account => ({
        id: account.id,
        email: account.email,
        channelName: account.channel_name,
        status: account.status,
        healthScore: account.health_score,
        dailyUploads: account.daily_upload_count,
        lastUpload: account.last_upload_time,
        profileId: account.profile_id
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个账号详情
router.get('/:id', async (req, res) => {
  try {
    const { accountManager } = req.services;
    const account = await accountManager.getAccount(req.params.id);
    
    res.json({
      id: account.id,
      email: account.email,
      channelName: account.channel_name,
      channelId: account.channel_id,
      status: account.status,
      healthScore: account.health_score,
      dailyUploads: account.daily_upload_count,
      lastUpload: account.last_upload_time,
      profileId: account.profile_id,
      proxyConfig: account.proxy_config,
      createdAt: account.created_at,
      updatedAt: account.updated_at
    });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// 添加新账号
router.post('/', async (req, res) => {
  try {
    const { accountManager, fingerprintManager } = req.services;
    
    // 验证必填字段
    const { email, password, channelName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // 生成指纹配置
    const fingerprint = await fingerprintManager.generateYouTubeFingerprint({
      email,
      targetRegion: req.body.targetRegion || 'US',
      proxyLocation: req.body.proxy?.location || 'US-West'
    });

    // 添加账号
    const account = await accountManager.addAccount({
      email,
      password,
      recoveryEmail: req.body.recoveryEmail,
      channelName: channelName || email.split('@')[0],
      proxy: req.body.proxy,
      fingerprint
    });

    res.status(201).json({
      id: account.id,
      email: account.email,
      channelName: account.channel_name,
      profileId: account.profile_id,
      status: account.status
    });
    
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 批量导入账号（CSV）
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    const { accountManager } = req.services;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // 读取CSV文件
    const fileContent = await fs.readFile(req.file.path, 'utf-8');
    
    // 解析CSV
    const records = await new Promise((resolve, reject) => {
      csv.parse(fileContent, {
        columns: true,
        skip_empty_lines: true
      }, (err, records) => {
        if (err) reject(err);
        else resolve(records);
      });
    });

    // 验证CSV格式
    const requiredColumns = ['email', 'password'];
    const columns = Object.keys(records[0] || {});
    const missingColumns = requiredColumns.filter(col => !columns.includes(col));
    
    if (missingColumns.length > 0) {
      return res.status(400).json({ 
        error: `Missing required columns: ${missingColumns.join(', ')}` 
      });
    }

    // 导入账号
    const accounts = records.map(record => ({
      email: record.email,
      password: record.password,
      recoveryEmail: record.recovery_email || record.recoveryEmail,
      channelName: record.channel_name || record.channelName || record.email.split('@')[0],
      proxy: record.proxy ? JSON.parse(record.proxy) : null
    }));

    const results = await accountManager.bulkImportAccounts(accounts);

    // 清理临时文件
    await fs.unlink(req.file.path);

    res.json({
      total: accounts.length,
      success: results.success.length,
      failed: results.failed.length,
      results
    });
    
  } catch (error) {
    // 清理临时文件
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    res.status(500).json({ error: error.message });
  }
});

// 更新账号状态
router.patch('/:id/status', async (req, res) => {
  try {
    const { accountManager } = req.services;
    const { status, reason } = req.body;
    
    if (!['active', 'suspended', 'banned'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const account = await accountManager.updateAccountStatus(
      req.params.id, 
      status, 
      reason
    );

    res.json({
      id: account.id,
      email: account.email,
      status: account.status,
      updatedAt: account.updated_at
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 测试账号连接
router.post('/:id/test', async (req, res) => {
  try {
    const { accountManager, bitBrowserClient, uploaderAdapter } = req.services;
    
    // 获取账号信息
    const account = await accountManager.getAccount(req.params.id);
    
    // 测试BitBrowser连接
    const browserData = await bitBrowserClient.openBrowser(account.profile_id);
    
    // 测试结果
    const testResult = {
      accountId: account.id,
      email: account.email,
      profileId: account.profile_id,
      browserConnection: !!browserData.ws,
      browserEndpoint: browserData.ws
    };

    // 关闭浏览器
    await bitBrowserClient.closeBrowser(account.profile_id);

    res.json({
      success: true,
      test: testResult
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// 获取账号健康度历史
router.get('/:id/health-history', async (req, res) => {
  try {
    const { db } = req.services;
    const { days = 7 } = req.query;
    
    const query = `
      SELECT * FROM account_health_history 
      WHERE account_id = $1 
        AND recorded_at > NOW() - INTERVAL '${parseInt(days)} days'
      ORDER BY recorded_at DESC
    `;
    
    const result = await db.query(query, [req.params.id]);
    
    res.json({
      accountId: req.params.id,
      days: parseInt(days),
      history: result.rows
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除账号
router.delete('/:id', async (req, res) => {
  try {
    const { accountManager, bitBrowserClient } = req.services;
    
    // 获取账号信息
    const account = await accountManager.getAccount(req.params.id);
    
    // 删除BitBrowser配置
    await bitBrowserClient.deleteBrowserProfile(account.profile_id);
    
    // 标记账号为删除
    await accountManager.updateAccountStatus(req.params.id, 'deleted');
    
    res.json({
      success: true,
      message: `Account ${account.email} deleted successfully`
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

```javascript
// routes/tasks.js - 任务管理API
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// 视频上传配置
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/videos/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const videoUpload = multer({ 
  storage: videoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024  // 5GB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|avi|mov|mkv|webm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
});

// 创建上传任务
router.post('/upload', async (req, res) => {
  try {
    const { taskScheduler } = req.services;
    const { accountId, video } = req.body;
    
    // 验证必填字段
    if (!accountId || !video || !video.path || !video.title) {
      return res.status(400).json({ 
        error: 'Account ID, video path and title are required' 
      });
    }

    // 创建任务
    const taskId = await taskScheduler.createUploadTask({
      accountId,
      video: {
        path: video.path,
        title: video.title,
        description: video.description || '',
        tags: video.tags || [],
        thumbnail: video.thumbnail,
        publishType: video.publishType || 'PUBLIC',
        publishAt: video.publishAt,
        playlist: video.playlist
      },
      priority: req.body.priority || 0
    });

    res.status(201).json({
      taskId,
      status: 'created',
      accountId,
      videoTitle: video.title
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 批量创建任务
router.post('/batch', async (req, res) => {
  try {
    const { taskScheduler } = req.services;
    const { videos, options } = req.body;
    
    if (!Array.isArray(videos) || videos.length === 0) {
      return res.status(400).json({ error: 'Videos array is required' });
    }

    // 验证每个视频
    for (const video of videos) {
      if (!video.path || !video.title) {
        return res.status(400).json({ 
          error: 'Each video must have path and title' 
        });
      }
    }

    // 创建批量任务
    const taskIds = await taskScheduler.createBatchTasks(videos, options);

    res.status(201).json({
      total: taskIds.length,
      taskIds,
      status: 'created'
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 上传视频文件
router.post('/upload-video', videoUpload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }

    // 处理缩略图
    let thumbnailPath = null;
    if (req.body.thumbnail) {
      // 如果是base64格式的缩略图
      const thumbnailData = req.body.thumbnail.replace(/^data:image\/\w+;base64,/, '');
      const thumbnailBuffer = Buffer.from(thumbnailData, 'base64');
      thumbnailPath = `uploads/thumbnails/${Date.now()}.jpg`;
      await fs.writeFile(thumbnailPath, thumbnailBuffer);
    }

    res.json({
      videoPath: req.file.path,
      thumbnailPath,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取任务状态
router.get('/:taskId', async (req, res) => {
  try {
    const { taskScheduler } = req.services;
    const status = await taskScheduler.getTaskStatus(req.params.taskId);
    
    if (!status) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(status);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取任务列表
router.get('/', async (req, res) => {
  try {
    const { db } = req.services;
    const { status, accountId, limit = 50, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM upload_tasks WHERE 1=1';
    const params = [];
    
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    
    if (accountId) {
      params.push(accountId);
      query += ` AND account_id = $${params.length}`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    
    const result = await db.query(query, params);
    
    res.json({
      total: result.rowCount,
      limit: parseInt(limit),
      offset: parseInt(offset),
      tasks: result.rows
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 取消任务
router.post('/:taskId/cancel', async (req, res) => {
  try {
    const { taskScheduler } = req.services;
    const cancelled = await taskScheduler.cancelTask(req.params.taskId);
    
    if (!cancelled) {
      return res.status(404).json({ error: 'Task not found or already completed' });
    }

    res.json({
      taskId: req.params.taskId,
      status: 'cancelled'
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 重试失败任务
router.post('/:taskId/retry', async (req, res) => {
  try {
    const { taskScheduler } = req.services;
    const newTaskId = await taskScheduler.retryFailedTask(req.params.taskId);
    
    res.json({
      originalTaskId: req.params.taskId,
      newTaskId,
      status: 'retrying'
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取队列统计
router.get('/stats/queue', async (req, res) => {
  try {
    const { taskScheduler } = req.services;
    const stats = await taskScheduler.getQueueStats();
    
    res.json(stats);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取今日统计
router.get('/stats/today', async (req, res) => {
  try {
    const { db } = req.services;
    
    const query = `
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'processing') as processing,
        COUNT(*) FILTER (WHERE status = 'pending') as pending
      FROM upload_tasks
      WHERE created_at >= CURRENT_DATE
    `;
    
    const result = await db.query(query);
    
    res.json(result.rows[0]);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 清理已完成任务
router.post('/cleanup', async (req, res) => {
  try {
    const { taskScheduler } = req.services;
    const { gracePeriod = 86400000 } = req.body;  // 默认24小时
    
    const cleaned = await taskScheduler.cleanCompletedJobs(gracePeriod);
    
    res.json({
      cleaned,
      message: `Cleaned ${cleaned.upload + cleaned.scheduled} completed jobs`
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

```javascript
// routes/monitor.js - 监控API
const express = require('express');
const router = express.Router();
const os = require('os');

// 获取系统状态
router.get('/system', async (req, res) => {
  try {
    const { db, redis, bitBrowserClient } = req.services;
    
    // 系统信息
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
      loadAverage: os.loadavg()
    };

    // 数据库状态
    const dbStatus = await db.query('SELECT COUNT(*) FROM youtube_accounts');
    const taskStatus = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM upload_tasks
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);

    // Redis状态
    const redisInfo = await redis.info();
    const redisMemory = redisInfo.split('\n').find(line => line.startsWith('used_memory_human:'));

    // BitBrowser状态
    let activeBrowsers = [];
    try {
      activeBrowsers = await bitBrowserClient.getActiveBrowsers();
    } catch (e) {
      // BitBrowser可能未运行
    }

    res.json({
      system: systemInfo,
      database: {
        totalAccounts: parseInt(dbStatus.rows[0].count),
        tasks24h: taskStatus.rows[0]
      },
      redis: {
        connected: redis.status === 'ready',
        memory: redisMemory?.split(':')[1]?.trim()
      },
      bitbrowser: {
        activeBrowsers: activeBrowsers.length
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取实时活动
router.get('/activity', async (req, res) => {
  try {
    const { db, uploaderAdapter } = req.services;
    const { minutes = 5 } = req.query;
    
    // 最近的上传活动
    const recentUploads = await db.query(`
      SELECT 
        t.task_id,
        t.title as video_title,
        t.status,
        t.created_at,
        t.completed_at,
        a.email as account_email,
        a.channel_name
      FROM upload_tasks t
      JOIN youtube_accounts a ON t.account_id = a.id
      WHERE t.created_at >= NOW() - INTERVAL '${parseInt(minutes)} minutes'
      ORDER BY t.created_at DESC
      LIMIT 20
    `);

    // 活动的浏览器连接
    const activeConnections = uploaderAdapter.getActiveConnections();

    res.json({
      recentUploads: recentUploads.rows,
      activeConnections,
      period: `${minutes} minutes`
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取账号健康度概览
router.get('/health', async (req, res) => {
  try {
    const { db } = req.services;
    
    const healthOverview = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE health_score >= 80) as healthy,
        COUNT(*) FILTER (WHERE health_score >= 50 AND health_score < 80) as warning,
        COUNT(*) FILTER (WHERE health_score < 50) as critical,
        COUNT(*) FILTER (WHERE status = 'suspended') as suspended,
        COUNT(*) FILTER (WHERE status = 'banned') as banned,
        AVG(health_score) as avg_health_score,
        AVG(daily_upload_count) as avg_daily_uploads
      FROM youtube_accounts
      WHERE status != 'deleted'
    `);

    res.json(healthOverview.rows[0]);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取错误日志
router.get('/errors', async (req, res) => {
  try {
    const { db } = req.services;
    const { hours = 24, limit = 50 } = req.query;
    
    const errors = await db.query(`
      SELECT * FROM system_logs
      WHERE level = 'error'
        AND created_at >= NOW() - INTERVAL '${parseInt(hours)} hours'
      ORDER BY created_at DESC
      LIMIT ${parseInt(limit)}
    `);

    res.json({
      total: errors.rowCount,
      period: `${hours} hours`,
      errors: errors.rows
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取性能指标
router.get('/metrics', async (req, res) => {
  try {
    const { db } = req.services;
    
    // 上传成功率
    const successRate = await db.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as success,
        ROUND(
          COUNT(*) FILTER (WHERE status = 'completed')::numeric / 
          COUNT(*)::numeric * 100, 2
        ) as success_rate
      FROM upload_tasks
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    // 平均处理时间
    const processingTime = await db.query(`
      SELECT 
        DATE(created_at) as date,
        AVG(
          EXTRACT(EPOCH FROM (completed_at - started_at))
        ) as avg_processing_seconds
      FROM upload_tasks
      WHERE status = 'completed'
        AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    res.json({
      successRate: successRate.rows,
      processingTime: processingTime.rows
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket实时监控
router.ws('/realtime', (ws, req) => {
  const { logger } = req.services;
  
  logger.info('WebSocket connection established');
  
  // 发送初始状态
  ws.send(JSON.stringify({
    type: 'connected',
    timestamp: new Date().toISOString()
  }));

  // 定期发送更新
  const interval = setInterval(async () => {
    try {
      const { taskScheduler, uploaderAdapter } = req.services;
      
      const stats = await taskScheduler.getQueueStats();
      const connections = uploaderAdapter.getActiveConnections();
      
      ws.send(JSON.stringify({
        type: 'update',
        data: {
          queue: stats,
          connections,
          timestamp: new Date().toISOString()
        }
      }));
    } catch (error) {
      logger.error('WebSocket update error:', error);
    }
  }, 5000);  // 每5秒更新

  // 清理
  ws.on('close', () => {
    clearInterval(interval);
    logger.info('WebSocket connection closed');
  });
});

module.exports = router;
```

---

## 7. 部署与运维

### 7.1 Docker部署

```dockerfile
# Dockerfile
FROM node:16-alpine

# 安装必要的系统依赖
RUN apk add --no-cache \
  python3 \
  make \
  g++ \
  cairo-dev \
  jpeg-dev \
  pango-dev \
  giflib-dev

# 创建应用目录
WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制应用代码
COPY . .

# 创建必要的目录
RUN mkdir -p logs uploads/videos uploads/thumbnails

# 设置环境变量
ENV NODE_ENV=production

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

# 启动应用
CMD ["node", "app.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  # PostgreSQL数据库
  postgres:
    image: postgres:13-alpine
    environment:
      POSTGRES_DB: youtube_matrix
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    restart: unless-stopped

  # Redis缓存
  redis:
    image: redis:6-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped

  # 主应用
  app:
    build: .
    environment:
      NODE_ENV: production
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: youtube_matrix
      DB_USER: postgres
      DB_PASSWORD: ${DB_PASSWORD:-postgres}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      BITBROWSER_API_URL: ${BITBROWSER_API_URL:-http://host.docker.internal:54345}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    extra_hosts:
      - "host.docker.internal:host-gateway"

  # Prometheus监控
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    restart: unless-stopped

  # Grafana可视化
  grafana:
    image: grafana/grafana:latest
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD:-admin}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./grafana/datasources:/etc/grafana/provisioning/datasources
    ports:
      - "3001:3000"
    depends_on:
      - prometheus
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:
```

### 7.2 生产环境配置

```bash
# .env.production
NODE_ENV=production
PORT=3000

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=youtube_matrix_prod
DB_USER=youtube_app
DB_PASSWORD=strong_password_here

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password_here

# BitBrowser配置
BITBROWSER_API_URL=http://127.0.0.1:54345

# 加密密钥（必须修改）
ENCRYPTION_KEY=your-32-character-encryption-key-here

# 日志级别
LOG_LEVEL=info

# 监控配置
PROMETHEUS_PORT=9091
METRICS_ENABLED=true
```

### 7.3 初始化脚本

```sql
-- init.sql - 数据库初始化脚本
CREATE DATABASE youtube_matrix;
\c youtube_matrix;

-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 账号表
CREATE TABLE youtube_accounts (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_encrypted TEXT NOT NULL,
    recovery_email VARCHAR(255),
    channel_name VARCHAR(255),
    channel_id VARCHAR(255),
    profile_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    daily_upload_count INT DEFAULT 0,
    last_upload_time TIMESTAMP,
    health_score INT DEFAULT 100,
    proxy_config JSONB,
    fingerprint_config JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 上传任务表
CREATE TABLE upload_tasks (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(255) UNIQUE NOT NULL,
    account_id INT REFERENCES youtube_accounts(id),
    video_path TEXT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    tags TEXT[],
    thumbnail_path TEXT,
    publish_type VARCHAR(50),
    publish_at TIMESTAMP,
    playlist_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    retry_count INT DEFAULT 0,
    result_url TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- 系统日志表
CREATE TABLE system_logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20),
    category VARCHAR(50),
    account_id INT,
    task_id VARCHAR(255),
    message TEXT,
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 账号健康度历史
CREATE TABLE account_health_history (
    id SERIAL PRIMARY KEY,
    account_id INT REFERENCES youtube_accounts(id),
    health_score INT,
    upload_success_rate DECIMAL(5,2),
    error_count INT,
    daily_uploads INT,
    recorded_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_accounts_status ON youtube_accounts(status);
CREATE INDEX idx_accounts_health ON youtube_accounts(health_score);
CREATE INDEX idx_tasks_status ON upload_tasks(status);
CREATE INDEX idx_tasks_account ON upload_tasks(account_id);
CREATE INDEX idx_tasks_created ON upload_tasks(created_at);
CREATE INDEX idx_logs_created ON system_logs(created_at);
CREATE INDEX idx_health_history_account ON account_health_history(account_id);

-- 创建触发器
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_accounts_updated_at
BEFORE UPDATE ON youtube_accounts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();
```

### 7.4 部署脚本

```bash
#!/bin/bash
# deploy.sh - 生产环境部署脚本

set -e

echo "Starting YouTube Matrix deployment..."

# 加载环境变量
source .env.production

# 检查必要的服务
echo "Checking required services..."
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed. Aborting." >&2; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "Docker Compose is required but not installed. Aborting." >&2; exit 1; }

# 检查BitBrowser是否运行
echo "Checking BitBrowser connection..."
curl -f -s $BITBROWSER_API_URL/status || { echo "BitBrowser is not running. Please start it first." >&2; exit 1; }

# 创建必要的目录
echo "Creating directories..."
mkdir -p uploads/videos uploads/thumbnails logs

# 构建Docker镜像
echo "Building Docker images..."
docker-compose build

# 启动服务
echo "Starting services..."
docker-compose up -d

# 等待数据库就绪
echo "Waiting for database..."
sleep 10

# 运行数据库迁移
echo "Running database migrations..."
docker-compose exec app node scripts/migrate.js

# 检查健康状态
echo "Checking application health..."
sleep 5
curl -f http://localhost:3000/health || { echo "Health check failed" >&2; exit 1; }

echo "Deployment completed successfully!"
echo "Application is running at http://localhost:3000"
echo "Grafana is available at http://localhost:3001 (admin/admin)"
```

---

## 8. 性能优化

### 8.1 缓存策略

```javascript
// cache-manager.js - 缓存管理器
const Redis = require('ioredis');

class CacheManager {
  constructor(redisClient) {
    this.redis = redisClient;
    this.ttl = {
      account: 300,      // 5分钟
      profile: 600,      // 10分钟
      stats: 60,         // 1分钟
      health: 120        // 2分钟
    };
  }

  // 生成缓存键
  key(type, id) {
    return `youtube:${type}:${id}`;
  }

  // 获取或设置缓存
  async getOrSet(key, ttl, fetchFunction) {
    // 尝试从缓存获取
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    // 获取新数据
    const data = await fetchFunction();
    
    // 存入缓存
    await this.redis.setex(key, ttl, JSON.stringify(data));
    
    return data;
  }

  // 账号信息缓存
  async getAccount(accountId, fetchFunction) {
    return this.getOrSet(
      this.key('account', accountId),
      this.ttl.account,
      fetchFunction
    );
  }

  // 清除账号缓存
  async invalidateAccount(accountId) {
    await this.redis.del(this.key('account', accountId));
  }

  // 批量预热缓存
  async warmupCache(accountManager) {
    console.log('[Cache] Warming up cache...');
    
    const accounts = await accountManager.getActiveAccounts();
    const promises = accounts.map(account => 
      this.redis.setex(
        this.key('account', account.id),
        this.ttl.account,
        JSON.stringify(account)
      )
    );
    
    await Promise.all(promises);
    console.log(`[Cache] Warmed up ${accounts.length} accounts`);
  }

  // 缓存统计
  async getStats() {
    const keys = await this.redis.keys('youtube:*');
    const stats = {
      total: keys.length,
      byType: {}
    };
    
    for (const key of keys) {
      const type = key.split(':')[1];
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    }
    
    return stats;
  }
}

module.exports = CacheManager;
```

### 8.2 数据库优化

```javascript
// db-optimizer.js - 数据库优化
class DatabaseOptimizer {
  constructor(db) {
    this.db = db;
  }

  // 批量插入优化
  async batchInsert(table, records, chunkSize = 1000) {
    const chunks = this.chunkArray(records, chunkSize);
    const results = [];
    
    for (const chunk of chunks) {
      const columns = Object.keys(chunk[0]);
      const values = chunk.map(record => columns.map(col => record[col]));
      
      const query = this.buildBatchInsertQuery(table, columns, values);
      const result = await this.db.query(query.text, query.values);
      results.push(...result.rows);
    }
    
    return results;
  }

  // 构建批量插入查询
  buildBatchInsertQuery(table, columns, values) {
    const placeholders = values.map((row, i) => 
      `(${row.map((_, j) => `$${i * row.length + j + 1}`).join(', ')})`
    ).join(', ');
    
    return {
      text: `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders} RETURNING *`,
      values: values.flat()
    };
  }

  // 数组分块
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // 连接池监控
  async monitorConnectionPool() {
    const pool = this.db;
    
    setInterval(() => {
      console.log('[DB Pool]', {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      });
    }, 60000);  // 每分钟
  }

  // 查询性能分析
  async analyzeQuery(query) {
    const explainQuery = `EXPLAIN ANALYZE ${query}`;
    const result = await this.db.query(explainQuery);
    return result.rows;
  }

  // 自动清理旧数据
  async setupAutoCleanup() {
    // 每天凌晨3点清理30天前的日志
    const cleanupQuery = `
      DELETE FROM system_logs 
      WHERE created_at < NOW() - INTERVAL '30 days'
    `;
    
    // 每周清理90天前的任务记录
    const cleanupTasksQuery = `
      DELETE FROM upload_tasks 
      WHERE completed_at < NOW() - INTERVAL '90 days'
        AND status IN ('completed', 'cancelled')
    `;
    
    // 设置定时任务
    setInterval(async () => {
      try {
        const logsDeleted = await this.db.query(cleanupQuery);
        console.log(`[Cleanup] Deleted ${logsDeleted.rowCount} old logs`);
      } catch (error) {
        console.error('[Cleanup] Error cleaning logs:', error);
      }
    }, 24 * 60 * 60 * 1000);  // 每天
    
    setInterval(async () => {
      try {
        const tasksDeleted = await this.db.query(cleanupTasksQuery);
        console.log(`[Cleanup] Deleted ${tasksDeleted.rowCount} old tasks`);
      } catch (error) {
        console.error('[Cleanup] Error cleaning tasks:', error);
      }
    }, 7 * 24 * 60 * 60 * 1000);  // 每周
  }
}

module.exports = DatabaseOptimizer;
```

### 8.3 任务队列优化

```javascript
// queue-optimizer.js - 队列优化
class QueueOptimizer {
  constructor(uploadQueue, scheduledQueue) {
    this.uploadQueue = uploadQueue;
    this.scheduledQueue = scheduledQueue;
  }

  // 优化队列并发
  async optimizeConcurrency() {
    const systemInfo = {
      cpus: os.cpus().length,
      memory: os.totalmem(),
      freeMemory: os.freemem()
    };
    
    // 根据系统资源动态调整并发数
    let concurrency = 3;  // 默认值
    
    if (systemInfo.cpus >= 8 && systemInfo.freeMemory > 4 * 1024 * 1024 * 1024) {
      concurrency = 5;  // 高配置
    } else if (systemInfo.cpus >= 4 && systemInfo.freeMemory > 2 * 1024 * 1024 * 1024) {
      concurrency = 4;  // 中等配置
    }
    
    console.log(`[Queue] Setting concurrency to ${concurrency}`);
    return concurrency;
  }

  // 任务优先级管理
  calculatePriority(task) {
    let priority = 0;
    
    // 重试任务优先级更高
    if (task.retryCount > 0) {
      priority += 10;
    }
    
    // VIP账号优先级更高
    if (task.account?.vip) {
      priority += 20;
    }
    
    // 定时发布临近的优先级更高
    if (task.publishAt) {
      const hoursUntilPublish = (new Date(task.publishAt) - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilPublish < 1) {
        priority += 50;  // 1小时内要发布
      } else if (hoursUntilPubl