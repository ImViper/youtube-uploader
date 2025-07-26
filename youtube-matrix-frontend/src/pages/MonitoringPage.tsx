import React from 'react';
import { Typography } from 'antd';

const { Title } = Typography;

const MonitoringPage: React.FC = () => {
  return (
    <div>
      <Title level={2}>Monitoring</Title>
      <p>System monitoring and analytics</p>
    </div>
  );
};

export default MonitoringPage;
