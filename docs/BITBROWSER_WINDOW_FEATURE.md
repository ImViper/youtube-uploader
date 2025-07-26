# 比特浏览器窗口集成功能

## 功能概述

本功能允许用户在添加YouTube账号时，关联已在比特浏览器中创建并登录的窗口，从而避免重复登录。

## 使用步骤

### 1. 在比特浏览器中准备窗口

1. 打开比特浏览器
2. 创建一个新的浏览器窗口
3. 给窗口命名（例如："YouTube账号1"）
4. 在该窗口中登录YouTube账号
5. 保持窗口状态

### 2. 在系统中添加账号

1. 打开账号管理页面
2. 点击"添加账号"按钮
3. 填写账号信息：
   - 用户名
   - 邮箱
   - 密码
   - **比特浏览器窗口名称**（输入步骤1中的窗口名称）
4. 点击"创建"按钮

### 3. 查看账号状态

在账号列表中，您可以看到：
- 窗口名称：显示关联的比特浏览器窗口
- 登录状态：显示窗口是否已登录（已登录/未登录）

## 技术实现

### 前端改动

1. **AccountFormModal.tsx**
   - 添加了窗口名称输入框
   - 使用 WindowsOutlined 图标标识

2. **AccountList.tsx**
   - 在列表中添加"浏览器窗口"列
   - 显示窗口名称和登录状态
   - 在展开详情中显示窗口ID

3. **accountsSlice.ts**
   - 添加了窗口相关字段：
     - browserWindowName
     - browserWindowId
     - isWindowLoggedIn

### 后端改动

1. **AccountManager**
   - 修改 addAccount 方法支持窗口名称
   - 添加 findBitBrowserWindowId 方法（占位实现）
   - 添加 checkWindowLoginStatus 方法（占位实现）

2. **API Routes**
   - 修改 POST /accounts 接收窗口名称
   - 在账号列表和详情接口中返回窗口信息

## 注意事项

1. **比特浏览器API**：系统已集成比特浏览器API，会自动查找对应名称的窗口ID。确保比特浏览器服务正在运行（默认端口：54345）。

2. **登录状态检查**：当前需要手动确认窗口登录状态。可以通过API端点 `PATCH /api/accounts/:id/window-login` 更新登录状态。

3. **窗口名称唯一性**：窗口名称必须与比特浏览器中的窗口名称完全一致，包括大小写和空格。

4. **窗口同步**：可以调用 `POST /api/accounts/sync-windows` 来同步窗口状态，自动清理不存在的窗口映射。

## API端点

### 更新窗口登录状态
```
PATCH /api/accounts/:id/window-login
Body: {
  "isLoggedIn": true
}
```

### 同步比特浏览器窗口
```
POST /api/accounts/sync-windows
```

## 环境变量

- `BITBROWSER_API_URL`：比特浏览器API地址（默认：http://127.0.0.1:54345）

## 后续优化建议

1. 实现自动登录状态检测（使用Playwright连接窗口检查YouTube登录状态）
2. 添加窗口状态实时监控
3. 支持批量导入已有窗口
4. 添加窗口健康检查功能