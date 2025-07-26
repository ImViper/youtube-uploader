import React, { useMemo } from 'react';
import { Card, Row, Col } from 'antd';
import ReactECharts from 'echarts-for-react';

interface ChartData {
  uploadsLast24Hours?: Array<{
    hour: string;
    count: number;
  }>;
  uploadDistribution?: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
}

interface DashboardChartsProps {
  data: ChartData;
  loading?: boolean;
}

const DashboardCharts: React.FC<DashboardChartsProps> = ({ data, loading }) => {
  const trendChartOption = useMemo(() => {
    const hours = data.uploadsLast24Hours?.map((item) => item.hour) || [];
    const counts = data.uploadsLast24Hours?.map((item) => item.count) || [];

    return {
      title: {
        text: '24-Hour Upload Trend',
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 500,
        },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          label: {
            backgroundColor: '#6a7985',
          },
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: hours,
        axisLabel: {
          rotate: 45,
          interval: 2,
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: '{value}',
        },
      },
      series: [
        {
          name: 'Uploads',
          type: 'line',
          data: counts,
          smooth: true,
          symbol: 'none',
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(24, 144, 255, 0.8)' },
                { offset: 1, color: 'rgba(24, 144, 255, 0.1)' },
              ],
            },
          },
          lineStyle: {
            color: '#1890ff',
            width: 2,
          },
          emphasis: {
            focus: 'series',
          },
        },
      ],
    };
  }, [data.uploadsLast24Hours]);

  const distributionChartOption = useMemo(() => {
    const pieData =
      data.uploadDistribution?.map((item) => ({
        value: item.count,
        name: item.status.charAt(0).toUpperCase() + item.status.slice(1),
        percentage: item.percentage,
      })) || [];

    const getColor = (status: string) => {
      switch (status.toLowerCase()) {
        case 'completed':
        case 'success':
          return '#52c41a';
        case 'failed':
        case 'error':
          return '#ff4d4f';
        case 'processing':
        case 'in_progress':
          return '#1890ff';
        case 'queued':
        case 'pending':
          return '#faad14';
        default:
          return '#d9d9d9';
      }
    };

    return {
      title: {
        text: 'Upload Distribution',
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 500,
        },
      },
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
      },
      legend: {
        bottom: '5%',
        left: 'center',
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: false,
            position: 'center',
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 20,
              fontWeight: 'bold',
              formatter: '{b}\n{c} ({d}%)',
            },
          },
          labelLine: {
            show: false,
          },
          data: pieData.map((item) => ({
            ...item,
            itemStyle: {
              color: getColor(item.name),
            },
          })),
        },
      ],
    };
  }, [data.uploadDistribution]);

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={14}>
        <Card loading={loading} bodyStyle={{ padding: '24px' }} className="h-full">
          <ReactECharts
            option={trendChartOption}
            style={{ height: '350px' }}
            showLoading={loading}
          />
        </Card>
      </Col>
      <Col xs={24} lg={10}>
        <Card loading={loading} bodyStyle={{ padding: '24px' }} className="h-full">
          <ReactECharts
            option={distributionChartOption}
            style={{ height: '350px' }}
            showLoading={loading}
          />
        </Card>
      </Col>
    </Row>
  );
};

export default DashboardCharts;
