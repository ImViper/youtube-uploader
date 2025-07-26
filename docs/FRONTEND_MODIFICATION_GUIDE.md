# 前端改造指南 - 窗口映射功能（简化版）

## 概述

前端需要支持在添加账号时指定对应的比特浏览器窗口，让系统能够使用预登录的窗口进行上传。

## 改造要点

### 1. 更新账号类型定义

文件：`youtube-matrix-frontend/src/features/accounts/accountsSlice.ts`

```typescript
export interface Account extends BaseEntity {
  username: string;
  email: string;
  status: 'active' | 'inactive' | 'suspended' | 'error';
  healthScore: number;
  lastActive: string | null;
  uploadsCount: number;
  successRate: number;
  // 新增字段
  bitbrowserWindowName?: string;  // 比特浏览器窗口名称
  isWindowLoggedIn?: boolean;      // 窗口是否已登录（只读）
  proxy?: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
  cookies?: string;
  notes?: string;
}
```

### 2. 修改添加账号对话框

文件：`youtube-matrix-frontend/src/features/accounts/components/AddAccountModal.tsx`（或类似文件）

在添加账号的表单中增加一个输入框：

```tsx
import { Form, Input, Modal, Select } from 'antd';

const AddAccountModal = () => {
  return (
    <Modal title="添加账号">
      <Form>
        <Form.Item
          name="email"
          label="邮箱"
          rules={[{ required: true, message: '请输入邮箱' }]}
        >
          <Input placeholder="youtube001@gmail.com" />
        </Form.Item>

        <Form.Item
          name="password"
          label="密码"
          rules={[{ required: true, message: '请输入密码' }]}
        >
          <Input.Password placeholder="账号密码" />
        </Form.Item>

        {/* 新增：窗口名称输入 */}
        <Form.Item
          name="bitbrowserWindowName"
          label="浏览器窗口"
          rules={[{ required: true, message: '请输入比特浏览器窗口名称' }]}
          extra="请输入比特浏览器中的窗口名称，如：YouTube账号001"
        >
          <Input placeholder="YouTube账号001" />
        </Form.Item>

        {/* 其他字段... */}
      </Form>
    </Modal>
  );
};
```

### 3. 修改账号列表显示

文件：`youtube-matrix-frontend/src/features/accounts/components/AccountList.tsx`

在账号列表中显示窗口名称：

```tsx
const columns: ColumnsType<Account> = [
  {
    title: '账号',
    dataIndex: 'email',
    key: 'email',
    render: (email: string, record: Account) => (
      <Space>
        <Avatar icon={<UserOutlined />} />
        <div>
          <div>{email}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {record.username}
          </div>
        </div>
      </Space>
    ),
  },
  // 新增列：显示窗口信息
  {
    title: '浏览器窗口',
    dataIndex: 'bitbrowserWindowName',
    key: 'window',
    render: (windowName: string, record: Account) => (
      <Space>
        <span>{windowName || '-'}</span>
        {record.isWindowLoggedIn !== undefined && (
          <Tag color={record.isWindowLoggedIn ? 'success' : 'warning'}>
            {record.isWindowLoggedIn ? '已登录' : '未登录'}
          </Tag>
        )}
      </Space>
    ),
  },
  // 其他列...
];
```

### 4. 修改API调用

文件：`youtube-matrix-frontend/src/features/accounts/accountsApi.ts`

添加账号时包含窗口名称：

```typescript
export const accountsApi = createApi({
  endpoints: (builder) => ({
    addAccount: builder.mutation<Account, {
      email: string;
      password: string;
      bitbrowserWindowName?: string;  // 新增
      proxy?: any;
      notes?: string;
    }>({
      query: (data) => ({
        url: '/accounts',
        method: 'POST',
        body: {
          email: data.email,
          password: data.password,
          metadata: {
            bitbrowserWindowName: data.bitbrowserWindowName,  // 传递窗口名称
            proxy: data.proxy,
            notes: data.notes,
          },
        },
      }),
    }),
  }),
});
```

### 5. 简单的窗口状态提示

在账号列表或详情页显示简单提示：

```tsx
// 在账号卡片或列表项中
{account.bitbrowserWindowName ? (
  <div style={{ marginTop: 8 }}>
    <Text type="secondary">
      窗口：{account.bitbrowserWindowName}
    </Text>
    {account.isWindowLoggedIn === false && (
      <Alert
        message="窗口未登录，请在比特浏览器中登录YouTube"
        type="warning"
        showIcon
        style={{ marginTop: 8 }}
      />
    )}
  </div>
) : (
  <Alert
    message="未配置浏览器窗口"
    type="info"
    showIcon
    style={{ marginTop: 8 }}
  />
)}
```

## 实现步骤

1. **第一步**：更新类型定义，添加 `bitbrowserWindowName` 和 `isWindowLoggedIn` 字段
2. **第二步**：修改添加账号表单，增加窗口名称输入框
3. **第三步**：更新API调用，确保窗口名称被传递到后端
4. **第四步**：在账号列表中显示窗口信息
5. **第五步**：添加简单的状态提示

## 注意事项

1. **窗口名称必须准确**：用户输入的窗口名称必须与比特浏览器中的名称完全一致
2. **预先登录**：用户需要先在比特浏览器窗口中登录YouTube账号
3. **密码可选**：如果使用预登录窗口，密码字段可以设为可选
4. **状态只读**：`isWindowLoggedIn` 是后端返回的状态，前端只展示不修改

## 使用流程

1. 用户在比特浏览器中创建窗口（如"YouTube账号001"）并登录YouTube
2. 在前端添加账号时，输入邮箱和对应的窗口名称
3. 系统自动建立账号与窗口的关联
4. 上传时直接使用预登录的窗口，无需重复登录

## 可选功能（后期考虑）

如果后续需要更完善的功能，可以考虑：

- 窗口名称下拉选择（从后端获取可用窗口列表）
- 批量检查窗口登录状态
- 窗口映射管理页面
- 自动同步窗口状态

但目前只需要实现基础功能即可。