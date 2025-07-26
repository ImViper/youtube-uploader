import React, { useState, useRef } from 'react';
import { Card, Row, Col, Select, Statistic, Spin, Empty } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import * as echarts from 'echarts';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/redux';
import { selectUploadStatistics, selectTimeRange } from '@/features/monitoring/monitoringSlice';
import { useGetUploadStatisticsQuery } from '@/features/monitoring/monitoringApi';
import dayjs from 'dayjs';

const { _Option } = Select;

const UploadStatistics: React.FC = () => {
  const { t } = useTranslation();
  const [_dateRange, _setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const volumeChartRef = useRef<HTMLDivElement>(null);
  const successRateChartRef = useRef<HTMLDivElement>(null);
  const failureChartRef = useRef<HTMLDivElement>(null);

  const timeRange = useAppSelector(selectTimeRange);
  const uploadStats = useAppSelector(selectUploadStatistics);

  // Fetch upload statistics
  const { isLoading } = useGetUploadStatisticsQuery({ timeRange });

  // Calculate summary statistics
  const calculateSummaryStats = () => {
    if (!uploadStats) {
      return {
        totalUploads: 0,
        successfulUploads: 0,
        failedUploads: 0,
        pendingUploads: 0,
        averageSuccessRate: 0,
        uploadTrend: 0,
        successTrend: 0,
      };
    }

    const hourlyVolume = uploadStats.hourlyVolume;
    const successRates = uploadStats.successRate;

    // Calculate totals from hourly volume
    const totalUploads = hourlyVolume.reduce((sum, item) => sum + item.value, 0);

    // Calculate average success rate
    const averageSuccessRate =
      successRates.length > 0
        ? successRates.reduce((sum, item) => sum + item.value, 0) / successRates.length
        : 0;

    // Estimate successful and failed uploads
    const successfulUploads = Math.round(totalUploads * (averageSuccessRate / 100));
    const failedUploads = totalUploads - successfulUploads;

    // Calculate trends (compare last period with previous)
    const halfLength = Math.floor(hourlyVolume.length / 2);
    const recentVolume = hourlyVolume.slice(halfLength).reduce((sum, item) => sum + item.value, 0);
    const previousVolume = hourlyVolume
      .slice(0, halfLength)
      .reduce((sum, item) => sum + item.value, 0);
    const uploadTrend =
      previousVolume > 0 ? ((recentVolume - previousVolume) / previousVolume) * 100 : 0;

    const recentSuccessRate =
      successRates.slice(halfLength).reduce((sum, item) => sum + item.value, 0) /
      (successRates.length - halfLength);
    const previousSuccessRate =
      successRates.slice(0, halfLength).reduce((sum, item) => sum + item.value, 0) / halfLength;
    const successTrend = previousSuccessRate > 0 ? recentSuccessRate - previousSuccessRate : 0;

    return {
      totalUploads,
      successfulUploads,
      failedUploads,
      pendingUploads: 0, // This would come from a different API
      averageSuccessRate,
      uploadTrend,
      successTrend,
    };
  };

  const stats = calculateSummaryStats();

  // Initialize charts
  useEffect(() => {
    if (
      !volumeChartRef.current ||
      !successRateChartRef.current ||
      !failureChartRef.current ||
      !uploadStats
    )
      return;

    const volumeChart = echarts.init(volumeChartRef.current);
    const successRateChart = echarts.init(successRateChartRef.current);
    const failureChart = echarts.init(failureChartRef.current);

    // Upload Volume Chart
    const volumeOption: echarts.EChartsOption = {
      title: {
        text: t('monitoring.uploadVolume'),
        left: 'center',
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
      },
      xAxis: {
        type: 'category',
        data: uploadStats.hourlyVolume.map((item) => {
          const date = new Date(item.timestamp);
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }),
      },
      yAxis: {
        type: 'value',
        name: t('monitoring.uploads'),
      },
      series: [
        {
          name: t('monitoring.uploads'),
          type: 'bar',
          data: uploadStats.hourlyVolume.map((item) => item.value),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#1890ff' },
              { offset: 1, color: '#69c0ff' },
            ]),
          },
          emphasis: {
            itemStyle: {
              color: '#096dd9',
            },
          },
        },
      ],
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100,
        },
        {
          start: 0,
          end: 100,
        },
      ],
    };

    // Success Rate Chart
    const successRateOption: echarts.EChartsOption = {
      title: {
        text: t('monitoring.successRate'),
        left: 'center',
      },
      tooltip: {
        trigger: 'axis',
        formatter: '{b0}<br />{a0}: {c0}%',
      },
      xAxis: {
        type: 'category',
        data: uploadStats.successRate.map((item) => {
          const date = new Date(item.timestamp);
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }),
      },
      yAxis: {
        type: 'value',
        name: '%',
        min: 0,
        max: 100,
      },
      series: [
        {
          name: t('monitoring.successRate'),
          type: 'line',
          smooth: true,
          data: uploadStats.successRate.map((item) => item.value),
          lineStyle: {
            color: '#52c41a',
            width: 3,
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(82, 196, 26, 0.3)' },
              { offset: 1, color: 'rgba(82, 196, 26, 0.05)' },
            ]),
          },
          markLine: {
            data: [
              {
                type: 'average',
                name: t('monitoring.average'),
                label: {
                  formatter: '{c}%',
                },
              },
            ],
          },
        },
      ],
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
    };

    // Failure Reasons Pie Chart
    const failureOption: echarts.EChartsOption = {
      title: {
        text: t('monitoring.failureReasons'),
        left: 'center',
      },
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)',
      },
      legend: {
        orient: 'vertical',
        left: 'left',
      },
      series: [
        {
          name: t('monitoring.failureReasons'),
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
            },
          },
          labelLine: {
            show: false,
          },
          data: uploadStats.failureReasons.map((reason) => ({
            value: reason.count,
            name: reason.reason,
            itemStyle: {
              color: getFailureReasonColor(reason.reason),
            },
          })),
        },
      ],
    };

    volumeChart.setOption(volumeOption);
    successRateChart.setOption(successRateOption);
    failureChart.setOption(failureOption);

    // Handle resize
    const handleResize = () => {
      volumeChart.resize();
      successRateChart.resize();
      failureChart.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      volumeChart.dispose();
      successRateChart.dispose();
      failureChart.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, [uploadStats, t]);

  // Get color for failure reason
  const getFailureReasonColor = (reason: string): string => {
    const colorMap: { [key: string]: string } = {
      'Network Error': '#ff4d4f',
      'Authentication Failed': '#fa8c16',
      'File Too Large': '#fadb14',
      'Invalid Format': '#52c41a',
      'Quota Exceeded': '#1890ff',
      'Server Error': '#722ed1',
      Timeout: '#eb2f96',
      Other: '#8c8c8c',
    };
    return colorMap[reason] || '#8c8c8c';
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <Spin size="large" tip={t('monitoring.loadingStatistics')} />
      </div>
    );
  }

  if (!uploadStats) {
    return <Empty description={t('monitoring.noData')} />;
  }

  return (
    <div className="upload-statistics">
      {/* Summary Statistics */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('monitoring.totalUploads')}
              value={stats.totalUploads}
              prefix={stats.uploadTrend > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              suffix={
                <span className={stats.uploadTrend > 0 ? 'text-green-500' : 'text-red-500'}>
                  {stats.uploadTrend > 0 ? '+' : ''}
                  {stats.uploadTrend.toFixed(1)}%
                </span>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('monitoring.successfulUploads')}
              value={stats.successfulUploads}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('monitoring.failedUploads')}
              value={stats.failedUploads}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('monitoring.averageSuccessRate')}
              value={stats.averageSuccessRate}
              precision={2}
              suffix="%"
              valueStyle={{ color: stats.averageSuccessRate > 80 ? '#52c41a' : '#ff4d4f' }}
              prefix={stats.successTrend > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card className="shadow-sm">
            <div ref={volumeChartRef} style={{ height: 400 }} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card className="shadow-sm">
            <div ref={successRateChartRef} style={{ height: 400 }} />
          </Card>
        </Col>
        <Col xs={24}>
          <Card className="shadow-sm">
            <div ref={failureChartRef} style={{ height: 400 }} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default UploadStatistics;
