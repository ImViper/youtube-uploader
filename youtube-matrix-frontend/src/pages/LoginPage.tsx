import React, { useEffect } from 'react';
import { Card, Typography, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { selectIsAuthenticated } from '@/app/selectors';
import Logo from '@/components/common/Logo';
import LoginForm from '@/features/auth/components/LoginForm';

const { Title, Text } = Typography;

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Logo size="large" />
        </div>
        <Title level={2} className="mt-6 text-center">
          Sign in to your account
        </Title>
        <Text className="mt-2 text-center text-gray-600 block">
          Manage your YouTube uploads with ease
        </Text>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <LoginForm />

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  Multi-account YouTube management system
                </span>
              </div>
            </div>
          </div>

          <Space direction="vertical" className="w-full mt-6 text-center">
            <Text className="text-gray-500 text-xs">© 2024 YouTube Matrix Upload System</Text>
            <Text className="text-gray-500 text-xs">Version 1.0.0</Text>
          </Space>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
