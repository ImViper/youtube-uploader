import React from 'react';
import { Card, Row, Col, Progress, Space, Typography } from 'antd';
import { Area, Column } from '@ant-design/plots';

const { Text } = Typography;

interface NetworkDiskChartsProps {
  data?: any;
}

const NetworkDiskCharts: React.FC<NetworkDiskChartsProps> = ({ data }) => {
  // Mock network data
  const networkData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    upload: Math.random() * 100,
    download: Math.random() * 200,
  }));

  // Mock disk usage data
  const diskData = [
    { name: 'System', used: 45, total: 100 },
    { name: 'Videos', used: 120, total: 500 },
    { name: 'Temp', used: 15, total: 50 },
    { name: 'Logs', used: 8, total: 20 },
  ];

  const networkConfig = {
    data: networkData,
    xField: 'hour',
    yField: ['upload', 'download'],
    smooth: true,
    height: 300,
  };

  const diskConfig = {
    data: diskData,
    xField: 'name',
    yField: 'used',
    height: 300,
  };

  return (
    <Row gutter={[16, 16]}>
      <Col span={12}>
        <Card title="网络流量 (MB)">
          <Area {...networkConfig} />
        </Card>
      </Col>
      <Col span={12}>
        <Card title="磁盘使用">
          <Column {...diskConfig} />
          <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
            {diskData.map((disk) => (
              <div key={disk.name}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Text>{disk.name}</Text>
                  <Text type="secondary">{disk.used}GB / {disk.total}GB</Text>
                </Space>
                <Progress percent={(disk.used / disk.total) * 100} showInfo={false} />
              </div>
            ))}
          </Space>
        </Card>
      </Col>
    </Row>
  );
};

export default NetworkDiskCharts;