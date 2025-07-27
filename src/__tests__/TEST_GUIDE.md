# YouTube Matrix 测试指南

## 测试结构

本项目的测试文件已经统一整理到 `src/__tests__` 目录下，采用清晰的目录结构组织：

```
src/__tests__/
├── api/                    # API 路由和控制器测试
│   ├── account/           # 账户管理模块测试
│   ├── matrix/            # Matrix 模块测试
│   ├── task/              # 任务管理模块测试
│   ├── v1/                # API v1 版本测试
│   ├── auth.test.ts       # 认证中间件测试
│   ├── dashboard.test.ts  # 仪表板路由测试
│   ├── routes.test.ts     # 主 API 路由测试
│   └── websocket.test.ts  # WebSocket 连接测试
├── integration/           # 集成测试
│   └── websocket.integration.test.ts
├── unit/                  # 单元测试
│   └── websocket.simple.test.ts
└── setup.ts              # Jest 测试环境设置
```

## 测试分类

### API 路由测试 (必需)
这些测试验证 API 端点的正确性：
- **routes.test.ts**: 测试主 API 路由，包括健康检查、状态、指标等
- **v1/routes.test.ts**: 测试 v1 API 路由的集成和模块加载
- **account/\*.test.ts**: 账户管理的完整测试套件
- **matrix/\*.test.ts**: Matrix 功能的完整测试套件
- **task/\*.test.ts**: 任务队列管理的完整测试套件

### 认证和安全测试
- **auth.test.ts**: JWT 认证、角色验证等安全功能测试
- **dashboard.test.ts**: 仪表板访问权限和数据展示测试

### WebSocket 测试
- **websocket.test.ts**: WebSocket 连接、订阅、事件发送测试
- **websocket.integration.test.ts**: WebSocket 集成场景测试
- **websocket.simple.test.ts**: WebSocket 基础功能单元测试

## 运行测试

### 运行所有测试
```bash
npm test
```

### 运行特定模块的测试
```bash
# 运行账户管理测试
npm test -- account

# 运行 API 路由测试
npm test -- api/routes

# 运行 WebSocket 测试
npm test -- websocket
```

### 运行测试覆盖率报告
```bash
npm run test:coverage
```

### 观察模式（开发时使用）
```bash
npm run test:watch
```

## 测试编写规范

### 1. 测试文件命名
- 单元测试：`*.test.ts`
- 集成测试：`*.integration.test.ts`
- 端到端测试：`*.e2e.test.ts`

### 2. 测试结构
```typescript
describe('模块名称', () => {
  // 设置和清理
  beforeEach(() => {
    // 初始化测试环境
  });

  afterEach(() => {
    // 清理测试数据
  });

  describe('功能组', () => {
    it('应该执行某个具体功能', () => {
      // 准备
      // 执行
      // 断言
    });
  });
});
```

### 3. Mock 使用
- 使用 `src/tests/mocks/` 目录下的预定义 mock
- 保持 mock 的一致性和可重用性
- 每个测试后清理 mock 状态

### 4. 测试覆盖率要求
- 单元测试覆盖率目标：≥80%
- 集成测试覆盖率目标：≥70%
- 关键业务逻辑必须有 100% 覆盖率

## 重要测试场景

### API 路由测试必需场景
1. **成功响应**: 验证正确输入的成功响应
2. **错误处理**: 验证各种错误情况的处理
3. **认证授权**: 验证需要认证的端点
4. **数据验证**: 验证输入数据的验证逻辑
5. **分页排序**: 验证列表端点的分页和排序

### WebSocket 测试必需场景
1. **连接建立**: 验证客户端能成功连接
2. **认证验证**: 验证 JWT token 认证
3. **订阅管理**: 验证订阅和取消订阅
4. **事件发送**: 验证事件正确发送给订阅者
5. **断线重连**: 验证断线后的清理工作

## 常见问题

### 1. 导入路径错误
测试文件已移到 `__tests__` 目录，导入源代码时需要使用相对路径：
```typescript
// 正确
import { createAccountRoutes } from '../../../api/account/account.routes';

// 错误
import { createAccountRoutes } from './account.routes';
```

### 2. Mock 未正确清理
确保在 `afterEach` 中调用 `jest.clearAllMocks()` 清理所有 mock。

### 3. 异步测试超时
对于涉及数据库或网络的测试，可以增加超时时间：
```typescript
it('应该处理长时间运行的操作', async () => {
  // 测试代码
}, 10000); // 10 秒超时
```

## 维护指南

1. **保持测试独立性**: 每个测试应该能独立运行
2. **及时更新测试**: 功能变更时同步更新相关测试
3. **定期审查覆盖率**: 确保新代码有充分的测试覆盖
4. **重构测试代码**: 保持测试代码的可读性和可维护性