import React from 'react';
import { Card, Row, Col } from 'antd';
import { Line, Column, Pie } from '@ant-design/plots';

interface PerformanceChartsProps {
  data?: any;
}

export const PerformanceCharts: React.FC<PerformanceChartsProps> = ({ data }) => {
  // Mock data for charts
  const lineData = [
    { date: '2024-01', value: 3 },
    { date: '2024-02', value: 4 },
    { date: '2024-03', value: 3.5 },
    { date: '2024-04', value: 5 },
    { date: '2024-05', value: 4.9 },
    { date: '2024-06', value: 6 },
  ];

  const columnData = [
    { type: '成功', value: 38 },
    { type: '失败', value: 52 },
    { type: '进行中', value: 61 },
    { type: '等待中', value: 145 },
  ];

  const pieData = [
    { type: '账户A', value: 27 },
    { type: '账户B', value: 25 },
    { type: '账户C', value: 18 },
    { type: '账户D', value: 15 },
    { type: '其他', value: 15 },
  ];

  const lineConfig = {
    data: lineData,
    xField: 'date',
    yField: 'value',
    smooth: true,
    height: 300,
  };

  const columnConfig = {
    data: columnData,
    xField: 'type',
    yField: 'value',
    height: 300,
  };

  const pieConfig = {
    data: pieData,
    angleField: 'value',
    colorField: 'type',
    radius: 0.8,
    label: {
      type: 'outer',
      content: '{name} {percentage}',
    },
    height: 300,
  };

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Card title="上传趋势">
          <Line {...lineConfig} />
        </Card>
      </Col>
      <Col span={12}>
        <Card title="任务状态分布">
          <Column {...columnConfig} />
        </Card>
      </Col>
      <Col span={12}>
        <Card title="账户上传占比">
          <Pie {...pieConfig} />
        </Card>
      </Col>
    </Row>
  );
};

export default PerformanceCharts;