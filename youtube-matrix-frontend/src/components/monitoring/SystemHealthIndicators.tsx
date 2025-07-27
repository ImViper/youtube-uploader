import React from 'react';
import { Card, Row, Col, Badge, Space, Typography, Alert, Tag } from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

interface SystemHealthIndicatorsProps {
  data?: any;
}

const SystemHealthIndicators: React.FC<SystemHealthIndicatorsProps> = ({ data }) => {
  // Mock health data
  const services = [
    { name: 'API Server', status: 'healthy', uptime: '99.9%' },
    { name: 'Database', status: 'healthy', uptime: '99.8%' },
    { name: 'Redis Cache', status: 'healthy', uptime: '100%' },
    { name: 'Queue Worker', status: 'warning', uptime: '98.5%' },
    { name: 'File Storage', status: 'healthy', uptime: '99.9%' },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'warning':
        return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
      case 'error':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return <SyncOutlined spin style={{ color: '#1890ff' }} />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge status="success" />;
      case 'warning':
        return <Badge status="warning" />;
      case 'error':
        return <Badge status="error" />;
      default:
        return <Badge status="processing" />;
    }
  };

  const overallHealth = services.every(s => s.status === 'healthy') ? 'healthy' : 
                       services.some(s => s.status === 'error') ? 'error' : 'warning';

  return (
    <Card title="系统健康状态">
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Alert
            message={
              <Space>
                {getStatusIcon(overallHealth)}
                <span>系统整体状态: {overallHealth === 'healthy' ? '健康' : overallHealth === 'warning' ? '警告' : '错误'}</span>
              </Space>
            }
            type={overallHealth === 'healthy' ? 'success' : overallHealth === 'warning' ? 'warning' : 'error'}
            showIcon={false}
          />
        </Col>
        {services.map((service) => (
          <Col span={8} key={service.name}>
            <Card size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  {getStatusBadge(service.status)}
                  <Text strong>{service.name}</Text>
                </Space>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Tag color={service.status === 'healthy' ? 'success' : service.status === 'warning' ? 'warning' : 'error'}>
                    {service.status === 'healthy' ? '正常' : service.status === 'warning' ? '警告' : '异常'}
                  </Tag>
                  <Text type="secondary">可用性: {service.uptime}</Text>
                </Space>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
  );
};

export default SystemHealthIndicators;