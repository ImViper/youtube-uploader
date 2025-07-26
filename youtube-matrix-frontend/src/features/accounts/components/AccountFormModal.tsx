import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Space, Checkbox, Divider, Alert } from 'antd';
import {
  EyeInvisibleOutlined,
  EyeTwoTone,
  GlobalOutlined,
  UserOutlined,
  MailOutlined,
  LockOutlined,
} from '@ant-design/icons';
import type { Account } from '../accountsSlice';

interface AccountFormModalProps {
  visible: boolean;
  account?: Account | null;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (values: AccountFormValues) => void;
}

export interface AccountFormValues {
  username: string;
  email: string;
  password: string;
  proxy?: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
  cookies?: string;
  notes?: string;
}

const AccountFormModal: React.FC<AccountFormModalProps> = ({
  visible,
  account,
  loading = false,
  onCancel,
  onSubmit,
}) => {
  const [form] = Form.useForm<AccountFormValues>();
  const [useProxy, setUseProxy] = useState(false);
  const [proxyAuth, setProxyAuth] = useState(false);

  useEffect(() => {
    if (visible) {
      if (account) {
        // 编辑模式
        form.setFieldsValue({
          username: account.username,
          email: account.email,
          password: '', // 安全起见，不显示密码
          proxy: account.proxy,
          cookies: account.cookies,
          notes: account.notes,
        });
        setUseProxy(!!account.proxy);
        setProxyAuth(!!account.proxy?.username);
      } else {
        // 新建模式
        form.resetFields();
        setUseProxy(false);
        setProxyAuth(false);
      }
    }
  }, [visible, account, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // 如果不使用代理，删除代理字段
      if (!useProxy) {
        delete values.proxy;
      } else if (!proxyAuth) {
        // 如果代理不需要认证，删除用户名和密码
        if (values.proxy) {
          delete values.proxy.username;
          delete values.proxy.password;
        }
      }

      // 编辑模式下，如果密码为空，则不更新密码
      if (account && !values.password) {
        delete (values as any).password;
      }

      onSubmit(values);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const validateEmail = (_: any, value: string) => {
    if (!value) {
      return Promise.reject(new Error('请输入邮箱地址'));
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return Promise.reject(new Error('请输入有效的邮箱地址'));
    }
    return Promise.resolve();
  };

  return (
    <Modal
      title={account ? '编辑账户' : '新建账户'}
      open={visible}
      onCancel={onCancel}
      width={600}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
          {account ? '更新' : '创建'}
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical" autoComplete="off">
        {account && (
          <Alert
            message="编辑模式"
            description="用户名和邮箱不可修改。如需修改密码，请输入新密码，留空则保持原密码不变。"
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Form.Item
          name="username"
          label="用户名"
          rules={[
            { required: true, message: '请输入用户名' },
            { min: 3, message: '用户名至少3个字符' },
            { max: 50, message: '用户名最多50个字符' },
            { pattern: /^[a-zA-Z0-9_-]+$/, message: '用户名只能包含字母、数字、下划线和横线' },
          ]}
        >
          <Input prefix={<UserOutlined />} placeholder="请输入用户名" disabled={!!account} />
        </Form.Item>

        <Form.Item
          name="email"
          label="邮箱"
          rules={[{ required: true, message: '请输入邮箱地址' }, { validator: validateEmail }]}
        >
          <Input prefix={<MailOutlined />} placeholder="请输入邮箱地址" disabled={!!account} />
        </Form.Item>

        <Form.Item
          name="password"
          label={account ? '新密码（留空保持不变）' : '密码'}
          rules={
            account
              ? []
              : [
                  { required: true, message: '请输入密码' },
                  { min: 6, message: '密码至少6个字符' },
                ]
          }
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder={account ? '留空保持原密码' : '请输入密码'}
            iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
          />
        </Form.Item>

        <Divider />

        <div style={{ marginBottom: 16 }}>
          <Checkbox checked={useProxy} onChange={(e) => setUseProxy(e.target.checked)}>
            使用代理
          </Checkbox>
        </div>

        {useProxy && (
          <>
            <Space style={{ width: '100%' }} size={16}>
              <Form.Item
                name={['proxy', 'host']}
                label="代理地址"
                rules={[{ required: useProxy, message: '请输入代理地址' }]}
                style={{ flex: 1, marginBottom: 0 }}
              >
                <Input prefix={<GlobalOutlined />} placeholder="例如: proxy.example.com" />
              </Form.Item>

              <Form.Item
                name={['proxy', 'port']}
                label="端口"
                rules={[
                  { required: useProxy, message: '请输入端口' },
                  { pattern: /^\d+$/, message: '端口必须是数字' },
                  {
                    validator: (_, value) => {
                      if (value && (value < 1 || value > 65535)) {
                        return Promise.reject(new Error('端口范围: 1-65535'));
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
                style={{ width: 120, marginBottom: 0 }}
              >
                <Input placeholder="8080" />
              </Form.Item>
            </Space>

            <div style={{ marginTop: 16, marginBottom: 16 }}>
              <Checkbox checked={proxyAuth} onChange={(e) => setProxyAuth(e.target.checked)}>
                代理需要认证
              </Checkbox>
            </div>

            {proxyAuth && (
              <Space style={{ width: '100%' }} size={16}>
                <Form.Item
                  name={['proxy', 'username']}
                  label="代理用户名"
                  rules={[{ required: proxyAuth, message: '请输入代理用户名' }]}
                  style={{ flex: 1, marginBottom: 0 }}
                >
                  <Input placeholder="代理用户名" />
                </Form.Item>

                <Form.Item
                  name={['proxy', 'password']}
                  label="代理密码"
                  rules={[{ required: proxyAuth, message: '请输入代理密码' }]}
                  style={{ flex: 1, marginBottom: 0 }}
                >
                  <Input.Password
                    placeholder="代理密码"
                    iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                  />
                </Form.Item>
              </Space>
            )}
          </>
        )}

        <Divider />

        <Form.Item
          name="cookies"
          label="Cookies（可选）"
          extra="如果有已登录的cookies，可以直接粘贴在这里"
        >
          <Input.TextArea
            rows={4}
            placeholder="粘贴cookies字符串..."
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
        </Form.Item>

        <Form.Item name="notes" label="备注（可选）">
          <Input.TextArea rows={3} placeholder="添加备注信息..." maxLength={500} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AccountFormModal;
