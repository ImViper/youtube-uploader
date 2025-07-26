# YouTube账号矩阵系统改造方案 - 比特浏览器窗口映射

## 现状分析

### 当前系统架构
1. **账号管理系统 (AccountManager)**
   - 使用PostgreSQL存储账号信息，包含加密凭据
   - 每个账号有`browserProfileId`字段，但未真正与比特浏览器关联
   - 账号状态管理：active、limited、suspended、error
   - 健康度评分和每日上传限额管理

2. **比特浏览器管理 (BitBrowserManager)**
   - 已实现基础的比特浏览器API集成
   - 支持打开、关闭、列表浏览器窗口
   - 通过Puppeteer连接到浏览器进行自动化操作
   - 浏览器实例状态管理：idle、busy、error

3. **数据库结构**
   - `accounts`表：存储账号信息，但`browser_profile_id`未与实际窗口关联
   - `browser_instances`表：存储浏览器窗口信息，有`account_id`外键但未充分利用

### 问题分析
1. **账号与窗口分离**：账号的`browserProfileId`是虚拟生成的，不对应真实的比特浏览器窗口
2. **窗口未预配置**：系统需要每次登录YouTube账号，而不是使用已登录的比特浏览器窗口
3. **映射关系缺失**：缺少账号名称到比特浏览器窗口ID的映射机制

## 改造方案

### 核心理念
- 每个YouTube账号对应一个预先登录好的比特浏览器窗口
- 系统通过账号名称或ID找到对应的窗口ID
- 直接使用已登录的浏览器窗口进行操作，无需重复登录

### 改造步骤

#### 1. 数据库结构调整

```sql
-- 修改accounts表，添加比特浏览器窗口相关字段
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS bitbrowser_window_id VARCHAR(255);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS bitbrowser_window_name VARCHAR(255);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_window_logged_in BOOLEAN DEFAULT false;

-- 创建窗口映射索引
CREATE INDEX IF NOT EXISTS idx_accounts_bitbrowser_window_id ON accounts(bitbrowser_window_id);
CREATE INDEX IF NOT EXISTS idx_accounts_bitbrowser_window_name ON accounts(bitbrowser_window_name);

-- 添加窗口配置表，存储窗口的详细配置
CREATE TABLE IF NOT EXISTS bitbrowser_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  window_id VARCHAR(255) UNIQUE NOT NULL,
  window_name VARCHAR(255) NOT NULL,
  debug_url VARCHAR(255),
  profile_data JSONB DEFAULT '{}', -- 存储代理、UA等配置
  is_logged_in BOOLEAN DEFAULT false,
  last_health_check TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. 配置文件结构

创建账号与窗口映射配置文件：

```typescript
// src/config/browser-profiles.ts
export interface BrowserProfileMapping {
  accountEmail: string;
  windowName: string;
  windowId?: string; // 可选，可通过API查询获得
  proxy?: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
}

export const browserProfiles: BrowserProfileMapping[] = [
  {
    accountEmail: "account1@gmail.com",
    windowName: "YouTube账号001",
    windowId: "profile-001-xxxxx", // 可选
  },
  {
    accountEmail: "account2@gmail.com", 
    windowName: "YouTube账号002",
    proxy: {
      host: "proxy.example.com",
      port: 8080
    }
  },
  // ... 更多映射
];
```

#### 3. 账号管理器改造

```typescript
// src/accounts/manager.ts 改造要点

export class AccountManager {
  // 新增：同步比特浏览器窗口映射
  async syncBrowserProfiles(): Promise<void> {
    const bitBrowserManager = new BitBrowserManager();
    const windowList = await bitBrowserManager.listBrowsers();
    
    for (const profile of browserProfiles) {
      // 根据窗口名称查找窗口ID
      const window = windowList.find(w => w.name === profile.windowName);
      if (window) {
        // 更新账号的窗口映射
        await this.updateAccountBrowserMapping(
          profile.accountEmail,
          window.id,
          profile.windowName
        );
      }
    }
  }

  // 新增：更新账号的浏览器窗口映射
  async updateAccountBrowserMapping(
    email: string,
    windowId: string,
    windowName: string
  ): Promise<void> {
    await this.db.query(
      `UPDATE accounts 
       SET bitbrowser_window_id = $1, 
           bitbrowser_window_name = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE email = $3`,
      [windowId, windowName, email]
    );
  }

  // 修改：获取健康账号时，确保窗口已配置
  async getHealthyAccount(): Promise<AccountProfile | null> {
    const result = await this.db.query<AccountProfile>(
      `SELECT * FROM accounts 
       WHERE status = 'active' 
       AND daily_upload_count < daily_upload_limit
       AND health_score >= 70
       AND bitbrowser_window_id IS NOT NULL
       AND is_window_logged_in = true
       ORDER BY health_score DESC, daily_upload_count ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`
    );
    // ...
  }
}
```

#### 4. 上传工作流程改造

```typescript
// src/workers/upload-worker.ts 改造要点

class UploadWorker {
  async processUpload(task: UploadTask): Promise<void> {
    // 1. 获取可用账号
    const account = await this.accountManager.getHealthyAccount();
    if (!account || !account.bitbrowserWindowId) {
      throw new Error('No available account with browser window');
    }

    // 2. 打开对应的比特浏览器窗口（已登录）
    const browserInstance = await this.bitBrowserManager.openBrowser(
      account.bitbrowserWindowId
    );

    // 3. 连接Puppeteer
    await this.bitBrowserManager.connectPuppeteer(browserInstance);

    // 4. 直接进行上传操作（无需登录）
    const page = browserInstance.page!;
    await page.goto('https://studio.youtube.com');
    
    // 验证是否已登录
    const isLoggedIn = await this.verifyYouTubeLogin(page);
    if (!isLoggedIn) {
      // 标记窗口需要重新登录
      await this.accountManager.updateAccount(account.id, {
        is_window_logged_in: false
      });
      throw new Error('Browser window not logged in');
    }

    // 5. 执行上传
    await this.performUpload(page, task.videoData);
  }

  // 新增：验证YouTube登录状态
  private async verifyYouTubeLogin(page: Page): Promise<boolean> {
    try {
      // 检查是否存在登录后的元素
      await page.waitForSelector('[aria-label="Account"]', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}
```

#### 5. 初始化脚本

创建初始化脚本，用于设置账号与窗口的映射关系：

```typescript
// src/scripts/init-browser-profiles.ts

async function initializeBrowserProfiles() {
  const accountManager = new AccountManager();
  const bitBrowserManager = new BitBrowserManager();

  // 1. 获取所有比特浏览器窗口
  const windows = await bitBrowserManager.listBrowsers();
  console.log(`Found ${windows.length} browser windows`);

  // 2. 对每个配置的映射进行处理
  for (const profile of browserProfiles) {
    console.log(`Processing profile: ${profile.windowName}`);
    
    // 查找对应的窗口
    const window = windows.find(w => w.name === profile.windowName);
    if (!window) {
      console.warn(`Window not found: ${profile.windowName}`);
      continue;
    }

    // 检查账号是否存在
    let account = await accountManager.getAccountByEmail(profile.accountEmail);
    if (!account) {
      // 创建账号（密码留空，因为使用已登录的窗口）
      account = await accountManager.addAccount(
        profile.accountEmail,
        '', // 空密码
        {
          windowName: profile.windowName,
          windowId: window.id
        }
      );
    }

    // 更新窗口映射
    await accountManager.updateAccountBrowserMapping(
      profile.accountEmail,
      window.id,
      profile.windowName
    );

    // 验证窗口登录状态
    const browserInstance = await bitBrowserManager.openBrowser(window.id);
    const isLoggedIn = await verifyWindowLogin(browserInstance);
    
    await accountManager.updateAccount(account.id, {
      is_window_logged_in: isLoggedIn
    });

    console.log(`Profile ${profile.windowName}: ${isLoggedIn ? 'Logged in' : 'Not logged in'}`);
  }
}
```

#### 6. API接口改造

```typescript
// src/api/account/account.controller.ts

// 新增：列出所有窗口及其账号映射状态
router.get('/browser-mappings', async (req, res) => {
  const bitBrowserManager = new BitBrowserManager();
  const accountManager = new AccountManager();
  
  const windows = await bitBrowserManager.listBrowsers();
  const accounts = await accountManager.listAccounts();
  
  const mappings = windows.map(window => {
    const account = accounts.find(a => a.bitbrowserWindowId === window.id);
    return {
      windowId: window.id,
      windowName: window.name,
      status: window.status,
      accountEmail: account?.email || null,
      isLoggedIn: account?.is_window_logged_in || false,
      accountStatus: account?.status || 'unmapped'
    };
  });
  
  res.json({ success: true, data: mappings });
});

// 新增：手动映射账号到窗口
router.post('/map-browser', async (req, res) => {
  const { accountEmail, windowId } = req.body;
  
  const accountManager = new AccountManager();
  await accountManager.updateAccountBrowserMapping(
    accountEmail,
    windowId,
    '' // 窗口名称可以后续更新
  );
  
  res.json({ success: true });
});
```

## 实施计划

### 第一阶段：基础改造（1-2天）
1. 执行数据库结构调整
2. 创建配置文件结构
3. 实现账号管理器的窗口映射功能

### 第二阶段：核心功能（2-3天）
1. 改造上传工作流程，使用预登录窗口
2. 实现登录状态验证
3. 添加窗口健康检查机制

### 第三阶段：管理工具（1-2天）
1. 开发初始化脚本
2. 添加API接口
3. 创建窗口映射管理界面

### 第四阶段：测试优化（1天）
1. 完整的端到端测试
2. 性能优化
3. 错误处理完善

## 注意事项

1. **窗口预登录**：需要手动在比特浏览器中登录好所有YouTube账号
2. **窗口命名规范**：建议使用统一的命名规范，如"YouTube账号001"
3. **登录状态监控**：定期检查窗口登录状态，及时发现需要重新登录的窗口
4. **并发控制**：确保同一窗口不会被多个上传任务同时使用
5. **错误恢复**：窗口崩溃或登录失效时的自动恢复机制

## 预期效果

1. **简化流程**：无需每次上传都登录账号
2. **提高效率**：直接使用已登录窗口，减少登录时间
3. **降低风险**：减少频繁登录导致的账号风险
4. **易于管理**：清晰的账号与窗口映射关系
5. **灵活扩展**：轻松添加新的账号和窗口映射