# 登录问题排查指南

## 正确的登录凭据

- **用户名**: `admin` (注意：不是邮箱地址)
- **密码**: `admin123`

## 常见问题

### 1. 401 Unauthorized 错误

**可能原因**：
- 输入了邮箱而不是用户名
- 密码错误
- 大小写敏感（用户名和密码都区分大小写）

**解决方法**：
- 确保在用户名字段输入 `admin`，而不是 `admin@example.com`
- 确保密码是 `admin123`

### 2. WebSocket 连接失败

**检查项**：
- 后端是否运行在端口 5989
- 前端 .env 文件是否正确配置

**验证方法**：
```bash
# 检查后端健康状态
curl http://localhost:5989/api/health

# 使用测试脚本验证登录
node test-login.js
```

### 3. 登录后立即返回登录页面

**可能原因**：
- Token 存储失败
- 前端状态管理问题
- 导入路径错误

**已修复的问题**：
- 修正了 STORAGE_KEYS 的导入路径
- 修正了错误处理逻辑

## 调试步骤

1. **打开浏览器开发者工具**
   - 查看 Network 标签
   - 检查登录请求的请求体和响应

2. **检查请求内容**
   - 请求应该发送到: `POST http://localhost:5989/api/auth/login`
   - 请求体应该包含: `{ "username": "admin", "password": "admin123" }`

3. **检查响应内容**
   - 成功响应: `{ "user": {...}, "accessToken": "...", "refreshToken": "..." }`
   - 失败响应: `{ "error": "Invalid credentials" }`

4. **检查 LocalStorage**
   - 登录成功后应该有:
     - `auth_token`: JWT访问令牌
     - `refresh_token`: 刷新令牌

## 手动测试 API

使用 curl 命令测试：
```bash
curl -X POST http://localhost:5989/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

## 前端代码已修复

1. **authSlice.ts**: 修正了 STORAGE_KEYS 导入路径
2. **useAuth.ts**: 改进了错误处理，同时检查 `error` 和 `message` 字段
3. **LoginForm.tsx**: 改进了错误显示逻辑

## 重新测试

修复后，请：
1. 刷新前端页面（强制刷新: Ctrl+F5）
2. 清除浏览器缓存和 LocalStorage
3. 使用用户名 `admin` 和密码 `admin123` 重新登录