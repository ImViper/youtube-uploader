# YouTube Matrix 视频上传流程详解

本文档详细说明了 YouTube Matrix 系统的视频上传流程，包括窗口管理、上传执行、进度跟踪和成功/失败判断逻辑。

## 目录

1. [系统架构概览](#系统架构概览)
2. [窗口管理和打开流程](#窗口管理和打开流程)
3. [上传执行流程](#上传执行流程)
4. [成功/失败判断逻辑](#成功失败判断逻辑)
5. [窗口与账户的关联](#窗口与账户的关联)
6. [关键代码位置](#关键代码位置)

## 系统架构概览

YouTube Matrix 系统采用分布式架构，主要组件包括：

- **BitBrowser Manager**: 管理浏览器窗口的打开、关闭和连接
- **Account Manager**: 管理 YouTube 账户信息和凭证
- **Upload Worker**: 实际执行上传任务的工作进程
- **Queue Manager**: 使用 Redis/BullMQ 管理上传任务队列
- **WebSocket Manager**: 实时推送上传进度和状态

## 窗口管理和打开流程

### 1. 账户选择

系统通过智能选择器选择可用账户：

```typescript
// src/workers/upload-worker.ts
accountProfile = requestedAccountId 
  ? await this.config.accountManager.getAccount(requestedAccountId)
  : await this.config.accountSelector.selectAccount(taskId);
```

选择条件：
- 账户状态为 `active`
- 健康分数 >= 70
- 当日上传次数未达到限制
- 有关联的 BitBrowser 窗口

### 2. 窗口打开

通过 BitBrowser API 打开指定窗口：

```typescript
// src/bitbrowser/manager.ts
async openBrowser(windowId: string): Promise<BrowserInstance> {
  // 准备浏览器参数
  const args = [
    `--window-position=${this.config.windowPosition.x},${this.config.windowPosition.y}`,
    '--disable-blink-features=AutomationControlled'
  ];

  // 通过 BitBrowser API 打开浏览器
  const response = await this.apiClient.openBrowser(windowId, args);
  const debugUrl = `http://${response.data.http}`;

  // 连接 Puppeteer
  await this.connectPuppeteer(instance);
}
```

### 3. 登录状态检查

系统会检查窗口是否已登录 YouTube：

```typescript
// src/bitbrowser/manager.ts
async checkYouTubeLogin(instanceId: string): Promise<boolean> {
  await page.goto('https://studio.youtube.com');
  
  const isLoggedIn = await page.evaluate(() => {
    const accountButton = document.querySelector('[aria-label*="Account"]');
    const avatarButton = document.querySelector('#avatar-btn');
    return !!(accountButton || avatarButton);
  });
  
  return isLoggedIn;
}
```

## 上传执行流程

### 1. 进度跟踪

上传过程分为多个阶段，每个阶段都会通过 WebSocket 实时推送进度：

```typescript
// 进度阶段
const stages = {
  acquiring_account: 10,    // 获取账户
  acquiring_browser: 20,    // 获取浏览器
  uploading: 30,           // 开始上传
  processing: 60,          // 处理中
  completed: 100           // 完成
};

// 实时检查上传百分比
progressChecker = setInterval(async () => {
  let curProgress = await page.evaluate(() => {
    let items = document.querySelectorAll('span.progress-label.ytcp-video-upload-progress');
    for (let i = 0; i < items.length; i++) {
      if (items.item(i).textContent.indexOf('%') === -1) continue;
      return items.item(i).textContent;
    }
  });
  // 更新进度
}, 500);
```

### 2. 上传步骤

1. **打开上传页面**：
   ```typescript
   await page.goto('https://www.youtube.com/upload?persist_gl=1&gl=US&persist_hl=1&hl=en');
   ```

2. **选择文件**：
   ```typescript
   const [fileChooser] = await Promise.all([
     page.waitForFileChooser(),
     selectBtn[0].click()
   ]);
   await fileChooser.accept([pathToFile]);
   ```

3. **填写视频信息**：
   - 标题（最多100字符）
   - 描述（最多5000字符）
   - 缩略图
   - 播放列表
   - 游戏类别
   - 等等

### 3. 错误检测

系统会实时检测各种错误情况：

```typescript
// 检查 YouTube 错误消息
const errorMessage = await page.evaluate(() =>
  document.querySelector('.error-area.style-scope.ytcp-uploads-dialog')?.innerText.trim()
);

// 检查每日上传限制
const dailyUploadPromise = page
  .waitForXPath('//div[contains(text(),"Daily upload limit reached")]')
  .then(() => 'dailyUploadReached');

// 超时保护（默认30分钟）
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Upload timeout')), 1800000);
});
```

## 成功/失败判断逻辑

### 成功判断标准

1. **等待上传完成标志**：
   ```typescript
   await page.waitForXPath(
     '//ytcp-video-upload-progress/span[contains(@class,"progress-label") and contains(text(),"Upload complete")]'
   );
   ```

2. **获取视频链接**：
   ```typescript
   const uploadedLinkHandle = await page.$('#uploads-button tp-yt-paper-item-body yt-formatted-string a');
   let uploadedLink;
   do {
     await page.waitForTimeout(500);
     uploadedLink = await page.evaluate((e) => e.getAttribute('href'), uploadedLinkHandle);
   } while (uploadedLink === videoBaseLink || uploadedLink === shortVideoBaseLink);
   ```

3. **验证链接格式**：
   - 长视频：`https://youtu.be/xxxxx` 或 `https://youtube.com/watch?v=xxxxx`
   - 短视频：`https://youtube.com/shorts/xxxxx`

### 失败判断标准

1. **YouTube 返回错误**：页面显示错误消息
2. **每日限制**：达到每日上传限制
3. **超时**：超过设定的最大上传时间（默认30分钟）
4. **无效链接**：无法获取有效的视频链接
5. **连接断开**：Puppeteer 与浏览器连接中断

### 数据库记录

**成功记录**：
```sql
UPDATE upload_history 
SET success = true, 
    video_id = $1, 
    upload_duration = $2,
    completed_at = CURRENT_TIMESTAMP
WHERE id = $3
```

**失败记录**：
```sql
UPDATE upload_history 
SET success = false, 
    error_message = $1,
    upload_duration = $2,
    completed_at = CURRENT_TIMESTAMP
WHERE id = $3
```

## 窗口与账户的关联

### 账户创建时的关联

创建账户时可以指定 BitBrowser 窗口：

```json
POST /api/v1/accounts
{
  "email": "user@example.com",
  "password": "password",
  "browserWindowName": "window-001"
}
```

### 数据库存储

账户信息存储在 `accounts` 表中：

| 字段 | 说明 |
|------|------|
| `id` | 账户唯一标识 |
| `email` | YouTube 邮箱 |
| `bitbrowser_window_name` | BitBrowser 窗口名称 |
| `bitbrowser_window_id` | BitBrowser 窗口 ID |
| `is_window_logged_in` | 窗口是否已登录 |

### 窗口管理策略

1. **持久化窗口**：
   - 标记为 `isPersistent` 的窗口不会在上传后关闭
   - 适合高频使用的账户
   - 保持登录状态，避免重复登录

2. **临时窗口**：
   - 上传完成后自动关闭
   - 节省系统资源
   - 适合低频使用的账户

## 关键代码位置

- **上传核心逻辑**：`src/upload.ts`
- **BitBrowser 管理**：`src/bitbrowser/manager.ts`
- **账户管理**：`src/accounts/manager.ts`
- **上传工作进程**：`src/workers/upload-worker.ts`
- **任务队列管理**：`src/queue/manager.ts`
- **WebSocket 通信**：`src/api/websocket.ts`

## 配置参数

```typescript
// 默认配置
const config = {
  browserPool: {
    minInstances: 0,      // 最小浏览器实例数
    maxInstances: 10,     // 最大浏览器实例数
  },
  queue: {
    concurrency: 5,       // 并发上传数
  },
  maxUploadTime: 1800000, // 最大上传时间（30分钟）
  bitBrowserUrl: 'http://127.0.0.1:54345', // BitBrowser API 地址
};
```

## 注意事项

1. **账户健康管理**：
   - 上传成功会提高账户健康分数
   - 上传失败会降低健康分数
   - 健康分数过低的账户会被暂时禁用

2. **错误恢复**：
   - 失败的任务会进入重试队列
   - 默认重试3次
   - 超过重试次数进入死信队列

3. **资源管理**：
   - 及时释放不用的浏览器实例
   - 监控内存和 CPU 使用
   - 合理设置并发数

4. **安全考虑**：
   - 账户密码加密存储
   - 使用环境变量管理敏感信息
   - 定期更新 cookies 和登录状态

---

最后更新时间：2025-01-27