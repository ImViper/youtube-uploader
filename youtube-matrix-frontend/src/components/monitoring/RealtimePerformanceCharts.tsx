import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import { Line } from '@ant-design/plots';

interface RealtimePerformanceChartsProps {
  data?: any;
}

const RealtimePerformanceCharts: React.FC<RealtimePerformanceChartsProps> = ({ data }) => {
  // Mock data for real-time performance
  const mockData = Array.from({ length: 60 }, (_, i) => ({
    time: new Date(Date.now() - (60 - i) * 1000).toISOString(),
    cpu: Math.random() * 100,
    memory: Math.random() * 100,
    network: Math.random() * 1000,
  }));

  const cpuConfig = {
    data: mockData,
    xField: 'time',
    yField: 'cpu',
    smooth: true,
    height: 200,
    xAxis: {
      label: {
        formatter: (v: string) => new Date(v).toLocaleTimeString(),
      },
    },
  };

  const memoryConfig = {
    data: mockData,
    xField: 'time',
    yField: 'memory',
    smooth: true,
    height: 200,
    xAxis: {
      label: {
        formatter: (v: string) => new Date(v).toLocaleTimeString(),
      },
    },
  };

  return (
    <Row gutter={[16, 16]}>
      <Col span={12}>
        <Card title="CPU 使用率 (%)">
          <Line {...cpuConfig} />
        </Card>
      </Col>
      <Col span={12}>
        <Card title="内存使用率 (%)">
          <Line {...memoryConfig} />
        </Card>
      </Col>
      <Col span={24}>
        <Row gutter={16}>
          <Col span={8}>
            <Card>
              <Statistic title="当前 CPU" value={`${mockData[mockData.length - 1].cpu.toFixed(1)}%`} />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic title="当前内存" value={`${mockData[mockData.length - 1].memory.toFixed(1)}%`} />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic title="网络流量" value={`${mockData[mockData.length - 1].network.toFixed(0)} KB/s`} />
            </Card>
          </Col>
        </Row>
      </Col>
    </Row>
  );
};

export default RealtimePerformanceCharts;