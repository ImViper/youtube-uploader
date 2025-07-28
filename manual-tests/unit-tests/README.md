# Unit Tests

这个目录包含了从 `src/__tests__` 迁移过来的单元测试文件。这些测试用于验证各个 API 模块的功能。

## 目录结构

```
unit-tests/
├── api/
│   ├── account/          # 账户管理模块单元测试
│   │   ├── account.controller.test.ts
│   │   ├── account.routes.test.ts
│   │   ├── account.service.test.ts
│   │   └── index.test.ts
│   ├── matrix/           # Matrix 模块单元测试
│   │   ├── matrix.controller.test.ts
│   │   ├── matrix.routes.test.ts
│   │   ├── matrix.service.test.ts
│   │   └── index.test.ts
│   ├── task/             # 任务管理模块单元测试
│   │   ├── task.controller.test.ts
│   │   ├── task.routes.test.ts
│   │   ├── task.service.test.ts
│   │   └── index.test.ts
│   ├── v1/               # API v1 路由测试
│   │   └── routes.test.ts
│   └── auth.test.ts      # 认证模块测试
└── setup.ts              # Jest 测试环境设置
```

## 运行测试

### 安装依赖
```bash
npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
```

### 运行所有单元测试
```bash
cd ../..  # 回到项目根目录
npm test -- manual-tests/unit-tests
```

### 运行特定模块的测试
```bash
# 运行账户管理测试
npm test -- manual-tests/unit-tests/api/account

# 运行认证测试
npm test -- manual-tests/unit-tests/api/auth.test.ts

# 运行任务管理测试
npm test -- manual-tests/unit-tests/api/task
```

## 测试说明

### 认证测试 (auth.test.ts)
- 测试登录、登出、令牌刷新等认证功能
- 验证 JWT 令牌的生成和验证
- 测试角色权限验证

### 账户管理测试 (account/)
- **controller.test.ts**: 测试控制器层的请求处理
- **service.test.ts**: 测试服务层的业务逻辑
- **routes.test.ts**: 测试路由配置和中间件
- **index.test.ts**: 测试模块导出

### Matrix 测试 (matrix/)
- 测试 Matrix 管理功能
- 验证 CRUD 操作
- 测试分页和过滤

### 任务管理测试 (task/)
- 测试任务队列管理
- 验证任务创建、更新、取消等操作
- 测试批量操作

### API v1 路由测试 (v1/routes.test.ts)
- 测试 API v1 的路由集成
- 验证子模块的正确加载

## 注意事项

1. 这些测试使用了大量的 mock，确保在实际环境中也能正常工作
2. 测试文件的导入路径已经调整为相对于 manual-tests 目录
3. 运行测试前确保项目已经构建（`npm run build`）
4. 某些测试可能需要数据库连接，请确保测试数据库配置正确