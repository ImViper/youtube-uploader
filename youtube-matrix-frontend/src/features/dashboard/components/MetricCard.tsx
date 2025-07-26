import React from 'react';
import { Card, Statistic, Space, Typography } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  UserOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

interface MetricCardProps {
  title: string;
  value: number | string;
  prefix?: React.ReactNode;
  suffix?: string;
  trend?: {
    value: number;
    isUpGood?: boolean;
  };
  loading?: boolean;
  onClick?: () => void;
  type?: 'accounts' | 'uploads' | 'success' | 'failed' | 'queued' | 'load' | 'memory' | 'default';
}

const getIcon = (type?: string): React.ReactNode => {
  switch (type) {
    case 'accounts':
      return <UserOutlined />;
    case 'uploads':
      return <CloudUploadOutlined />;
    case 'success':
      return <CheckCircleOutlined />;
    case 'failed':
      return <CloseCircleOutlined />;
    case 'queued':
      return <ClockCircleOutlined />;
    case 'load':
      return <DashboardOutlined />;
    case 'memory':
      return <DatabaseOutlined />;
    default:
      return null;
  }
};

const getColor = (type?: string): string => {
  switch (type) {
    case 'success':
      return '#52c41a';
    case 'failed':
      return '#ff4d4f';
    case 'queued':
      return '#faad14';
    case 'load':
    case 'memory':
      return '#1890ff';
    default:
      return '#000000';
  }
};

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  prefix,
  suffix,
  trend,
  loading = false,
  onClick,
  type = 'default',
}) => {
  const icon = getIcon(type);
  const color = getColor(type);

  const trendIcon = trend && (
    <Space size={4} style={{ marginLeft: 8 }}>
      {trend.value > 0 ? (
        <ArrowUpOutlined style={{ color: trend.isUpGood ? '#52c41a' : '#ff4d4f' }} />
      ) : (
        <ArrowDownOutlined style={{ color: !trend.isUpGood ? '#52c41a' : '#ff4d4f' }} />
      )}
      <Text
        type={
          trend.value > 0
            ? trend.isUpGood
              ? 'success'
              : 'danger'
            : !trend.isUpGood
              ? 'success'
              : 'danger'
        }
      >
        {Math.abs(trend.value)}%
      </Text>
    </Space>
  );

  return (
    <Card
      hoverable={!!onClick}
      onClick={onClick}
      style={{ height: '100%' }}
      className="transition-all duration-200 hover:shadow-lg"
    >
      <Statistic
        title={
          <Space>
            {icon && <span style={{ color }}>{icon}</span>}
            <span>{title}</span>
            {trendIcon}
          </Space>
        }
        value={value}
        prefix={prefix || (icon && <span style={{ color }}>{icon}</span>)}
        suffix={suffix}
        loading={loading}
        valueStyle={{ color }}
      />
    </Card>
  );
};

export default MetricCard;
