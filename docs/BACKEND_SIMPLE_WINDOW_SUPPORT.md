# 后端简化窗口支持

## 修改AccountManager以支持添加账号时指定窗口

为了支持前端在添加账号时直接指定窗口名称，需要对`AccountManager`的`addAccount`方法进行小幅修改：

### 修改 src/accounts/manager.ts

```typescript
/**
 * Add a new account
 */
async addAccount(email: string, password: string, metadata?: Record<string, any>): Promise<AccountProfile> {
  logger.info({ email }, 'Adding new account');

  try {
    // Encrypt password
    const encryptedPassword = await bcrypt.hash(password, this.encryptionSaltRounds);
    
    // Generate browser profile ID
    const browserProfileId = `profile-${email.replace('@', '-at-')}-${Date.now()}`;

    // 提取窗口名称（如果提供）
    const windowName = metadata?.bitbrowserWindowName;
    let windowId = null;
    
    // 如果提供了窗口名称，尝试查找对应的窗口ID
    if (windowName) {
      try {
        const bitBrowserManager = new BitBrowserManager();
        const windows = await bitBrowserManager.listBrowsers();
        const window = windows.find(w => w.windowName === windowName);
        if (window) {
          windowId = window.id;
        }
      } catch (error) {
        logger.warn({ windowName, error }, 'Failed to find window ID');
      }
    }

    // Insert into database
    const result = await this.db.query<AccountProfile>(
      `INSERT INTO accounts (
        email, 
        encrypted_credentials, 
        browser_profile_id, 
        bitbrowser_window_name,
        bitbrowser_window_id,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        email,
        JSON.stringify({ email, encryptedPassword }),
        browserProfileId,
        windowName || null,
        windowId || null,
        JSON.stringify(metadata || {})
      ]
    );

    const account = this.mapDatabaseRow(result.rows[0]);
    logger.info({ accountId: account.id, email, windowName }, 'Account added successfully');
    
    return account;

  } catch (error: any) {
    if (error?.code === '23505') { // Unique constraint violation
      throw new Error(`Account with email ${email} already exists`);
    }
    logger.error({ email, error }, 'Failed to add account');
    throw error;
  }
}
```

## 使用示例

### API调用

```bash
POST /api/accounts
Content-Type: application/json

{
  "email": "youtube001@gmail.com",
  "password": "password123",
  "metadata": {
    "bitbrowserWindowName": "YouTube账号001",
    "notes": "主账号"
  }
}
```

### 响应

```json
{
  "id": "uuid",
  "email": "youtube001@gmail.com",
  "status": "active",
  "healthScore": 100,
  "bitbrowserWindowName": "YouTube账号001",
  "bitbrowserWindowId": "profile-001-xxxxx"
}
```

## 工作流程

1. 用户在比特浏览器中创建窗口并登录YouTube
2. 前端调用添加账号API，包含窗口名称
3. 后端自动查找窗口ID并建立映射
4. 上传时使用映射的窗口，无需登录

## 注意事项

1. 窗口名称必须与比特浏览器中的名称完全一致
2. 如果找不到对应窗口，账号仍会创建成功，但窗口映射为空
3. 可以后续通过API更新窗口映射