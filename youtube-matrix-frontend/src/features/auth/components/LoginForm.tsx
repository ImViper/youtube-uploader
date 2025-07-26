import React, { useState } from 'react';
import { Form, Input, Button, Checkbox, Alert } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '@/hooks/useAuth';
import type { LoginCredentials } from '@/hooks/useAuth';

interface LoginFormProps {
  onSuccess?: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const [form] = Form.useForm();
  const { login, isLoggingIn } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (values: LoginCredentials) => {
    setError(null);
    try {
      await login(values);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err?.data?.message || 'Login failed. Please try again.');
    }
  };

  return (
    <Form
      form={form}
      name="login"
      className="w-full"
      initialValues={{ rememberMe: true }}
      onFinish={handleSubmit}
      autoComplete="off"
      layout="vertical"
      size="large"
    >
      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          closable
          className="mb-4"
          onClose={() => setError(null)}
        />
      )}

      <Form.Item
        name="username"
        rules={[
          { required: true, message: 'Please enter your username!' },
          { min: 3, message: 'Username must be at least 3 characters long' },
        ]}
      >
        <Input
          prefix={<UserOutlined className="text-gray-400" />}
          placeholder="Username"
          autoFocus
        />
      </Form.Item>

      <Form.Item
        name="password"
        rules={[
          { required: true, message: 'Please enter your password!' },
          { min: 6, message: 'Password must be at least 6 characters long' },
        ]}
      >
        <Input.Password
          prefix={<LockOutlined className="text-gray-400" />}
          placeholder="Password"
        />
      </Form.Item>

      <Form.Item>
        <div className="flex items-center justify-between">
          <Form.Item name="rememberMe" valuePropName="checked" noStyle>
            <Checkbox>Remember me</Checkbox>
          </Form.Item>
          <a className="text-primary hover:text-primary/80" href="#">
            Forgot password?
          </a>
        </div>
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" className="w-full" loading={isLoggingIn}>
          Log in
        </Button>
      </Form.Item>
    </Form>
  );
};

export default LoginForm;
