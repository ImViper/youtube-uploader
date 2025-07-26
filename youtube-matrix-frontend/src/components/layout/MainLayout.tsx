import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Badge, Space, Button } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  UploadOutlined,
  UnorderedListOutlined,
  LineChartOutlined,
  SettingOutlined,
  LogoutOutlined,
  BellOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAppSelector } from '@/app/hooks';
import { selectUnacknowledgedAlerts } from '@/app/selectors';
import { STORAGE_KEYS } from '@/utils/constants';
import Logo from '@/components/common/Logo';
import type { MenuProps } from 'antd';

const { Header, Sider, Content } = Layout;

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const unacknowledgedAlerts = useAppSelector(selectUnacknowledgedAlerts);

  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED);
    return saved === 'true';
  });

  const toggleCollapsed = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(newCollapsed));
  };

  const menuItems: MenuProps['items'] = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/accounts',
      icon: <UserOutlined />,
      label: 'Accounts',
    },
    {
      key: '/uploads',
      icon: <UploadOutlined />,
      label: 'Uploads',
    },
    {
      key: '/tasks',
      icon: <UnorderedListOutlined />,
      label: 'Tasks',
    },
    {
      key: '/monitoring',
      icon: <LineChartOutlined />,
      label: 'Monitoring',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: 'Settings',
    },
  ];

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
      disabled: true,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      danger: true,
      onClick: logout,
    },
  ];

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
  };

  const selectedKey =
    (menuItems.find((item) => location.pathname.startsWith(item!.key as string))?.key as string) ||
    '/dashboard';

  return (
    <Layout className="min-h-screen">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="light"
        className="shadow-md"
        width={240}
      >
        <div className="h-16 flex items-center justify-center px-4 border-b border-gray-200">
          <Logo size="medium" showText={!collapsed} />
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={handleMenuClick}
          className="border-r-0"
        />
      </Sider>

      <Layout>
        <Header className="bg-white px-4 flex items-center justify-between shadow-sm h-16">
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={toggleCollapsed}
            className="text-lg"
          />

          <Space size="middle">
            <Badge count={unacknowledgedAlerts.length} offset={[-2, 0]}>
              <Button
                type="text"
                icon={<BellOutlined />}
                className="text-lg"
                onClick={() => navigate('/dashboard')}
              />
            </Badge>

            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space className="cursor-pointer">
                <Avatar icon={<UserOutlined />} />
                <span className="text-sm font-medium">{user?.username}</span>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content className="m-6">
          <div className="bg-white rounded-lg shadow-sm p-6 min-h-[calc(100vh-8rem)]">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
