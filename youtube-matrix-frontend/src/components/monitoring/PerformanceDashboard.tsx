import React, { useState } from 'react';
import { Card, Select, Space, Button, Tooltip, Row, Col, Spin, Alert } from 'antd';
import {
  ReloadOutlined,
  FullscreenOutlined,
  ExportOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppSelector, useAppDispatch } from '@/hooks/redux';
import {
  selectMonitoringLoadingState,
  selectMonitoringError,
  selectTimeRange,
  setTimeRange,
  setRefreshInterval,
  selectLastUpdated,
} from '@/features/monitoring/monitoringSlice';
import { useGetPerformanceMetricsQuery } from '@/features/monitoring/monitoringApi';
import RealtimePerformanceCharts from './RealtimePerformanceCharts';
import NetworkDiskCharts from './NetworkDiskCharts';
import SystemHealthIndicators from './SystemHealthIndicators';

const { Option } = Select;

const PerformanceDashboard: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const timeRange = useAppSelector(selectTimeRange);
  const loadingState = useAppSelector(selectMonitoringLoadingState);
  const error = useAppSelector(selectMonitoringError);
  const lastUpdated = useAppSelector(selectLastUpdated);

  // Fetch performance metrics
  const { refetch } = useGetPerformanceMetricsQuery(
    { timeRange },
    {
      pollingInterval: autoRefresh ? 60000 : undefined, // Poll every minute if auto-refresh is on
      skip: false,
    },
  );

  // Handle time range change
  const handleTimeRangeChange = (value: string) => {
    dispatch(setTimeRange(value as '1h' | '6h' | '24h' | '7d' | '30d'));
  };

  // Handle refresh interval change
  const handleRefreshIntervalChange = (value: number) => {
    dispatch(setRefreshInterval(value));
    setAutoRefresh(value > 0);
  };

  // Handle manual refresh
  const handleRefresh = () => {
    refetch();
  };

  // Handle fullscreen toggle
  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Handle export
  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Export performance data');
  };

  // Format last updated time
  const formatLastUpdated = () => {
    if (!lastUpdated) return null;
    const date = new Date(lastUpdated);
    return date.toLocaleString();
  };

  return (
    <div className="performance-dashboard">
      {/* Header Controls */}
      <Card className="mb-4">
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col xs={24} sm={12} md={8}>
            <Space>
              <span>{t('monitoring.timeRange')}:</span>
              <Select value={timeRange} onChange={handleTimeRangeChange} style={{ width: 120 }}>
                <Option value="1h">{t('monitoring.1hour')}</Option>
                <Option value="6h">{t('monitoring.6hours')}</Option>
                <Option value="24h">{t('monitoring.24hours')}</Option>
                <Option value="7d">{t('monitoring.7days')}</Option>
                <Option value="30d">{t('monitoring.30days')}</Option>
              </Select>
            </Space>
          </Col>

          <Col xs={24} sm={12} md={8}>
            <Space>
              <span>{t('monitoring.refreshInterval')}:</span>
              <Select
                value={autoRefresh ? 60 : 0}
                onChange={handleRefreshIntervalChange}
                style={{ width: 120 }}
              >
                <Option value={0}>{t('monitoring.manual')}</Option>
                <Option value={30}>30s</Option>
                <Option value={60}>1m</Option>
                <Option value={300}>5m</Option>
                <Option value={600}>10m</Option>
              </Select>
            </Space>
          </Col>

          <Col xs={24} sm={24} md={8}>
            <Space className="float-right">
              <Tooltip title={t('monitoring.refresh')}>
                <Button
                  icon={<ReloadOutlined spin={loadingState === 'loading'} />}
                  onClick={handleRefresh}
                  loading={loadingState === 'loading'}
                />
              </Tooltip>
              <Tooltip title={t('monitoring.fullscreen')}>
                <Button icon={<FullscreenOutlined />} onClick={handleFullscreen} />
              </Tooltip>
              <Tooltip title={t('monitoring.export')}>
                <Button icon={<ExportOutlined />} onClick={handleExport} />
              </Tooltip>
              <Tooltip title={t('monitoring.settings')}>
                <Button icon={<SettingOutlined />} />
              </Tooltip>
            </Space>
          </Col>
        </Row>

        {lastUpdated && (
          <div className="mt-2 text-sm text-gray-500">
            {t('monitoring.lastUpdated')}: {formatLastUpdated()}
          </div>
        )}
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert
          message={t('monitoring.error')}
          description={error}
          type="error"
          closable
          className="mb-4"
        />
      )}

      {/* Loading State */}
      {loadingState === 'loading' && (
        <div className="text-center py-8">
          <Spin size="large" tip={t('monitoring.loadingMetrics')} />
        </div>
      )}

      {/* System Health Indicators */}
      <SystemHealthIndicators />

      {/* Performance Charts */}
      <div className="mt-4">
        <RealtimePerformanceCharts />
      </div>

      {/* Network and Disk I/O Charts */}
      <div className="mt-4">
        <NetworkDiskCharts />
      </div>
    </div>
  );
};

export default PerformanceDashboard;
