# YouTube Matrix 融合上传流程设计文档

## 📋 目录

1. [核心设计理念](#核心设计理念)
2. [系统架构](#系统架构)
3. [完整流程图](#完整流程图)
4. [技术实现细节](#技术实现细节)
5. [状态管理](#状态管理)
6. [错误处理策略](#错误处理策略)
7. [优势总结](#优势总结)

## 核心设计理念

本设计旨在创建一个统一的上传系统，既支持已登录的 BitBrowser 窗口，也保留原有的登录功能，避免维护两套代码。

### 设计原则

1. **单一代码路径**：所有上传逻辑统一在 `upload.ts` 中
2. **BitBrowser 专用**：所有浏览器操作都通过 BitBrowser 进行
3. **智能适配**：自动检测浏览器登录状态，必要时执行登录
4. **默认优化**：默认假设浏览器已登录，但会进行验证
5. **可扩展性**：易于添加新功能和处理新场景

## 系统架构

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Task Service   │────▶│  Upload Worker   │────▶│   Upload Core    │
│  (任务管理)     │     │  (队列处理)      │     │   (上传核心)     │
└─────────────────┘     └──────────────────┘     └──────────────────┘
                               │                           │
                               ▼                           ▼
                        ┌──────────────────┐     ┌──────────────────┐
                        │ BitBrowser Mgr   │     │  Login Detector  │
                        │ (浏览器管理)     │     │  (登录检测)      │
                        └──────────────────┘     └──────────────────┘
```

## 完整流程图

```
[上传任务开始]
    ↓
[1. 任务准备阶段（Worker层）]
    ├─ 获取任务详情（task_id, video_data）
    ├─ 选择或获取账户（account_id）
    ├─ 获取账户的窗口名称（window_name）
    └─ 验证视频文件存在性
    ↓
[2. 浏览器获取阶段（Worker层）]
    ├─ 使用 BitBrowserManager
    ├─ 通过 window_name 打开指定窗口
    ├─ 获取 browser 实例和连接
    ├─ 准备账户凭证（备用）
    └─ 等待浏览器完全启动
    ↓
[3. 调用 upload 函数（Worker → upload.ts）]
    └─ 传入 browser 实例和凭证
    ↓
[4. 登录状态检测（upload.ts内）]
    ├─ 导航到 YouTube（如果不在）
    ├─ 检查登录标识
    │   ├─ 用户头像（#avatar-btn）
    │   ├─ 登录按钮（反向检查）
    │   └─ Cookie 验证
    │
    ├─ 已登录 → 跳到步骤5
    └─ 未登录 → 执行登录流程
    ↓
[5. 统一上传执行（upload.ts内）]
    ├─ 导航到上传页面
    ├─ 处理弹窗
    │   ├─ YouTube 政策提醒
    │   ├─ 功能更新提示
    │   └─ 其他系统消息
    ├─ 上传视频文件
    ├─ 填写视频信息
    │   ├─ 标题（最大100字符）
    │   ├─ 描述（最大5000字符）
    │   └─ 标签（数组处理）
    ├─ 设置视频属性
    │   ├─ 儿童内容设置
    │   ├─ 隐私设置
    │   └─ 其他高级设置
    └─ 完成上传
        ├─ 等待处理完成
        ├─ 获取视频链接
        └─ 点击完成按钮
    ↓
[6. 结果处理（Worker层）]
    ├─ 更新任务状态
    ├─ 更新账户统计
    ├─ 记录上传历史
    └─ 断开浏览器连接（保持窗口）
```

## 技术实现细节

### 1. 修改 upload.ts 接口

```typescript
// 增强的选项接口
interface UploadOptions extends PuppeteerNodeLaunchOptions {
  browser?: Browser;      // 可选：已连接的浏览器实例
  skipLogin?: boolean;    // 是否跳过登录检查（默认 false）
  onProgress?: (progress: VideoProgress) => void;
  onLog?: (message: string) => void;
}

// 修改后的 upload 函数签名
export const upload = async (
  credentials: Credentials,
  videos: Video[],
  options?: UploadOptions,
  messageTransport: MessageTransport = defaultMessageTransport
) => {
  // 使用提供的浏览器实例（来自 BitBrowser）
  if (options?.browser) {
    browser = options.browser;
    page = (await browser.pages())[0] || await browser.newPage();
    messageTransport.log('Using provided BitBrowser instance');
  } else {
    // 保持向后兼容，但建议总是提供 browser 实例
    messageTransport.warn('No browser instance provided. This is deprecated.');
    // 可以选择：1) 抛出错误 2) 尝试创建新浏览器（不推荐）
    throw new Error('Browser instance is required. The browser should be obtained through BitBrowserManager in the Worker.');
  }
  
  // 检测登录状态
  const isLoggedIn = await checkIfLoggedIn(page);
  messageTransport.log(`Login status: ${isLoggedIn ? 'Logged in' : 'Not logged in'}`);
  
  // 条件登录
  if (!isLoggedIn && !options?.skipLogin) {
    messageTransport.log('Attempting to login...');
    await loadAccount(credentials, messageTransport, !options?.userDataDir);
  }
  
  // 执行统一的上传流程
  return await performUpload(videos, page, messageTransport);
}
```

### 2. 登录检测逻辑

```typescript
async function checkIfLoggedIn(page: Page): Promise<boolean> {
  try {
    // 确保在 YouTube 页面
    const currentUrl = page.url();
    if (!currentUrl.includes('youtube.com')) {
      await page.goto(homePageURL, { waitUntil: 'networkidle2' });
      await page.waitForTimeout(2000);
    }
    
    // 方法1：检查用户头像
    const avatarButton = await page.$('#avatar-btn');
    if (avatarButton) {
      return true;
    }
    
    // 方法2：检查登录按钮（存在说明未登录）
    const signInButton = await page.$('tp-yt-paper-button[aria-label*="Sign in"]');
    if (signInButton) {
      return false;
    }
    
    // 方法3：检查特定 cookie
    const cookies = await page.cookies();
    const hasAuthCookie = cookies.some(cookie => 
      cookie.name === 'SAPISID' || cookie.name === 'SID'
    );
    
    return hasAuthCookie;
  } catch (error) {
    // 默认认为未登录，触发登录流程
    return false;
  }
}
```

### 3. 统一的上传执行函数

```typescript
async function performUpload(
  videos: Video[], 
  page: Page, 
  messageTransport: MessageTransport
): Promise<string[]> {
  const uploadedLinks: string[] = [];
  
  for (const video of videos) {
    try {
      messageTransport.log(`Starting upload for: ${video.title}`);
      
      // 导航到上传页面
      await page.goto(uploadURL, { waitUntil: 'networkidle2' });
      await page.waitForTimeout(2000);
      
      // 处理可能的弹窗
      await handlePotentialPopups(page, messageTransport);
      
      // 查找并上传文件
      const fileInput = await findFileInput(page);
      await fileInput.uploadFile(video.path);
      messageTransport.log('File selected for upload');
      
      // 等待并填写视频信息
      await fillVideoDetails(page, video, messageTransport);
      
      // 设置视频属性
      await setVideoProperties(page, video, messageTransport);
      
      // 完成上传并获取链接
      const videoLink = await completeUpload(page, messageTransport);
      
      uploadedLinks.push(videoLink);
      messageTransport.log(`Upload completed: ${videoLink}`);
      
      // 触发成功回调
      if (video.onSuccess) {
        video.onSuccess(videoLink, video);
      }
      
    } catch (error) {
      messageTransport.error(`Upload failed for ${video.title}: ${error}`);
      throw error;
    }
  }
  
  return uploadedLinks;
}
```

### 4. 弹窗处理增强

```typescript
async function handlePotentialPopups(page: Page, messageTransport: MessageTransport): Promise<void> {
  messageTransport.debug('Checking for popups...');
  
  // YouTube 政策提醒弹窗
  const policyCloseSelectors = [
    'tp-yt-paper-dialog button:has-text("Close")',
    'button[aria-label="Close"]',
    '.ytcp-uploads-still-processing-dialog button',
    'tp-yt-paper-button:contains("Close")'
  ];
  
  for (const selector of policyCloseSelectors) {
    try {
      const button = await page.$(selector);
      if (button && await button.isVisible()) {
        await button.click();
        await page.waitForTimeout(1000);
        messageTransport.log('Closed popup dialog');
        break;
      }
    } catch (e) {
      // 继续尝试其他选择器
    }
  }
  
  // 使用页面脚本作为备选方案
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, tp-yt-paper-button'));
    const closeButton = buttons.find(btn => 
      btn.textContent?.trim().toLowerCase() === 'close'
    );
    if (closeButton) {
      (closeButton as HTMLElement).click();
    }
  });
}
```

### 5. 文件输入查找逻辑

```typescript
async function findFileInput(page: Page): Promise<any> {
  // 尝试多种选择器
  const fileInputSelectors = [
    'input[type="file"]',
    'input[name="Filedata"]',
    '#content > input[type="file"]',
    'ytcp-uploads-file-picker input[type="file"]'
  ];
  
  for (const selector of fileInputSelectors) {
    const fileInput = await page.$(selector);
    if (fileInput) {
      return fileInput;
    }
  }
  
  // 如果找不到，尝试点击上传按钮触发
  const uploadButtonSelectors = [
    '#select-files-button',
    'button[id*="select-files"]',
    '#upload-prompt-box',
    'ytcp-uploads-dialog'
  ];
  
  for (const selector of uploadButtonSelectors) {
    try {
      await page.click(selector);
      await page.waitForTimeout(1000);
      
      // 再次查找文件输入
      for (const inputSelector of fileInputSelectors) {
        const fileInput = await page.$(inputSelector);
        if (fileInput) {
          return fileInput;
        }
      }
    } catch (e) {
      // 继续尝试
    }
  }
  
  throw new Error('Unable to find file input element');
}
```

### 6. UploadWorkerV2 完整流程

```typescript
// 在 UploadWorkerV2 中的完整流程
async processUpload(job: Job<UploadJobData>): Promise<UploadJobResult> {
  const { taskId, accountId: requestedAccountId } = job.data;
  
  // 1. 获取任务详情
  const task = await getTaskFromDatabase(taskId);
  const videoData = task.video_data;
  
  // 2. 获取或选择账户
  let account;
  if (requestedAccountId) {
    // 使用指定的账户
    account = await accountManager.getAccount(requestedAccountId);
  } else {
    // 自动选择健康的账户
    account = await accountManager.getHealthyAccount();
  }
  
  if (!account) {
    throw new Error('No available account for upload');
  }
  
  // 3. 获取账户的窗口名称
  const windowName = account.bitbrowser_window_name;
  if (!windowName) {
    throw new Error(`Account ${account.email} has no BitBrowser window assigned`);
  }
  
  logger.info({ 
    accountId: account.id, 
    email: account.email, 
    windowName 
  }, 'Selected account for upload');
  
  // 4. 通过窗口名称打开 BitBrowser
  let browserInstance;
  try {
    browserInstance = await bitBrowserManager.openBrowserByName(windowName);
  } catch (error) {
    // 如果通过名称失败，尝试通过 ID（如果有）
    if (account.browser_profile_id) {
      browserInstance = await bitBrowserManager.openBrowser(account.browser_profile_id);
    } else {
      throw error;
    }
  }
  
  // 5. 获取账户凭证（用于可能的登录）
  const credentials = await accountManager.getAccountCredentials(account.id);
  
  // 6. 调用 upload 函数
  try {
    const uploadResults = await upload(
      credentials,  // 账户凭证，可能用于登录（如果需要）
      [videoData],
      {
        browser: browserInstance.browser,  // 传入 BitBrowser 实例
        skipLogin: false,  // 不跳过检测，让系统自动判断是否需要登录
        onProgress: (progress) => {
          job.updateProgress({ 
            status: 'uploading', 
            progress: 30 + (progress * 0.6)
          });
        },
        onLog: (message) => {
          logger.debug({ taskId, message }, 'Upload log');
        }
      }
    );
    
    return {
      success: true,
      videoId: uploadResults[0],
      accountId: account.id,
      windowName: windowName
    };
    
  } finally {
    // 7. 断开浏览器连接（保持窗口打开）
    if (browserInstance?.browser) {
      await browserInstance.browser.disconnect();
    }
  }
}
```

## 状态管理

### 任务状态流转

```
pending → active → uploading → completed/failed
   ↑                              ↓
   └────────── retry ←────────────┘
```

### 账户状态管理

```
available → in_use → available
              ↓
         needs_attention (登录失败时)
```

### 数据库状态更新

1. **任务状态更新**
   ```sql
   -- 开始处理
   UPDATE upload_tasks 
   SET status = 'active', started_at = NOW(), account_id = $2 
   WHERE id = $1;
   
   -- 完成处理
   UPDATE upload_tasks 
   SET status = 'completed', completed_at = NOW(), result = $2 
   WHERE id = $1;
   ```

2. **账户统计更新**
   ```sql
   UPDATE accounts 
   SET daily_upload_count = daily_upload_count + 1,
       last_upload_time = NOW(),
       health_score = health_score + 1
   WHERE id = $1;
   ```

## 错误处理策略

### 1. 登录失败处理

```typescript
if (!isLoggedIn && loginAttemptFailed) {
  // 标记账户状态
  await markAccountNeedsAttention(accountId);
  
  // 尝试选择其他账户
  const alternativeAccount = await selectHealthyAccount();
  if (alternativeAccount) {
    return retryWithAccount(alternativeAccount);
  }
  
  throw new Error('No available accounts for upload');
}
```

### 2. 上传超时处理

```typescript
const uploadPromise = performUpload(videos, page, messageTransport);
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Upload timeout')), maxUploadTime);
});

try {
  const result = await Promise.race([uploadPromise, timeoutPromise]);
  return result;
} catch (error) {
  if (error.message === 'Upload timeout') {
    await handleUploadTimeout(taskId);
  }
  throw error;
}
```

### 3. 弹窗处理失败

```typescript
const MAX_POPUP_RETRIES = 3;
let retries = 0;

while (retries < MAX_POPUP_RETRIES) {
  try {
    await handlePotentialPopups(page);
    break;
  } catch (error) {
    retries++;
    if (retries >= MAX_POPUP_RETRIES) {
      // 截图保存当前状态
      await page.screenshot({ 
        path: `popup-error-${Date.now()}.png` 
      });
      throw new Error('Unable to handle popups');
    }
    await page.waitForTimeout(2000);
  }
}
```

### 4. 浏览器连接失败

```typescript
try {
  browserInstance = await bitBrowserManager.openBrowserByName(windowName);
} catch (error) {
  logger.error({ windowName, error }, 'Failed to open browser by name');
  
  // 尝试通过 ID 打开（备选方案）
  if (account.browser_profile_id) {
    try {
      browserInstance = await bitBrowserManager.openBrowser(
        account.browser_profile_id
      );
    } catch (idError) {
      // 如果都失败，标记账户需要人工处理
      await markAccountNeedsAttention(account.id, 'Browser connection failed');
      throw new Error(`Unable to connect to BitBrowser for account ${account.email}`);
    }
  } else {
    throw new Error('Unable to connect to browser: no window name or profile ID');
  }
}
```

## 优势总结

### 1. 代码统一性
- 只需维护一套上传逻辑
- 减少代码重复和维护成本
- 确保功能一致性

### 2. 智能适配
- 自动检测 BitBrowser 窗口的登录状态
- 已登录时直接上传，未登录时自动登录
- 统一的错误处理和恢复机制

### 3. 易于扩展
- 新功能只需在一处添加
- 清晰的代码结构
- 良好的模块化设计

### 4. 向后兼容
- 保持原有 API 不变
- 现有调用代码无需修改
- 平滑的升级路径

### 5. 错误恢复能力
- 完善的错误处理机制
- 自动重试和降级策略
- 详细的错误日志

### 6. 性能优化
- 避免不必要的登录流程
- 减少页面加载时间
- 提高上传成功率

## 配置建议

### 环境变量

```bash
# 上传相关配置
UPLOAD_MAX_TIME=1800000        # 最大上传时间（30分钟）
UPLOAD_RETRY_COUNT=3           # 上传重试次数
UPLOAD_POPUP_TIMEOUT=5000      # 弹窗处理超时时间

# BitBrowser 配置
BITBROWSER_API_URL=http://127.0.0.1:54345
BITBROWSER_WINDOW_POSITION_X=1380
BITBROWSER_WINDOW_POSITION_Y=400

# 功能开关
SKIP_LOGIN_CHECK=false         # 是否跳过登录检查
USE_LOGGED_IN_BROWSERS=true    # 是否使用已登录浏览器
```

### 日志级别

```typescript
// 开发环境
LOG_LEVEL=debug

// 生产环境
LOG_LEVEL=info
```

## 总结

这个融合的上传流程设计实现了一个灵活、可靠、易维护的系统。它既满足了使用已登录 BitBrowser 的需求，又保持了系统的完整性和可扩展性。通过智能的状态检测和条件执行，系统能够自动适应不同的使用场景，提供最佳的用户体验。