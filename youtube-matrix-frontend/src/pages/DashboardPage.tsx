import React, { useEffect } from 'react';
import { Row, Col, Space, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  useGetDashboardMetricsQuery,
  useGetDashboardAlertsQuery,
  useAcknowledgeAlertMutation,
  useDismissAlertMutation,
  useBatchAcknowledgeAlertsMutation,
} from '@/features/dashboard/dashboardApi';
import { useAppDispatch } from '@/app/hooks';
import { updateMetrics, addAlert } from '@/features/dashboard/dashboardSlice';
import { MetricCard, DashboardCharts, AlertsList } from '@/features/dashboard/components';
import { useWebSocket } from '@/hooks/useWebSocket';
import { WS_EVENTS } from '@/utils/constants';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { subscribe, unsubscribe } = useWebSocket();

  // API Queries
  const { data: metrics, isLoading: metricsLoading } = useGetDashboardMetricsQuery();
  const {
    data: alertsData,
    isLoading: alertsLoading,
    refetch: refetchAlerts,
  } = useGetDashboardAlertsQuery({ limit: 50 });

  // Mutations
  const [acknowledgeAlert] = useAcknowledgeAlertMutation();
  const [dismissAlert] = useDismissAlertMutation();
  const [batchAcknowledgeAlerts] = useBatchAcknowledgeAlertsMutation();

  // WebSocket subscriptions for real-time updates
  useEffect(() => {
    const handleMetricsUpdate = (data: any) => {
      dispatch(updateMetrics(data));
    };

    const handleSystemAlert = (alert: any) => {
      dispatch(addAlert(alert));
      refetchAlerts();
    };

    subscribe(WS_EVENTS.METRICS_UPDATE, handleMetricsUpdate);
    subscribe(WS_EVENTS.SYSTEM_ALERT, handleSystemAlert);

    return () => {
      unsubscribe(WS_EVENTS.METRICS_UPDATE, handleMetricsUpdate);
      unsubscribe(WS_EVENTS.SYSTEM_ALERT, handleSystemAlert);
    };
  }, [dispatch, subscribe, unsubscribe, refetchAlerts]);

  const handleAcknowledgeAlert = async (id: string) => {
    try {
      await acknowledgeAlert(id).unwrap();
    } catch {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const handleDismissAlert = async (id: string) => {
    try {
      await dismissAlert(id).unwrap();
    } catch {
      console.error('Failed to dismiss alert:', error);
    }
  };

  const handleBatchAcknowledge = async (ids: string[]) => {
    try {
      await batchAcknowledgeAlerts(ids).unwrap();
    } catch {
      console.error('Failed to batch acknowledge alerts:', error);
    }
  };

  if (metricsLoading && !metrics) {
    return (
      <div className="flex justify-center items-center h-96">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Metrics Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <MetricCard
            title="Total Accounts"
            value={metrics?.totalAccounts || 0}
            type="accounts"
            onClick={() => navigate('/accounts')}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <MetricCard
            title="Active Accounts"
            value={metrics?.activeAccounts || 0}
            type="accounts"
            suffix={`/ ${metrics?.totalAccounts || 0}`}
            onClick={() => navigate('/accounts')}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <MetricCard
            title="Total Uploads"
            value={metrics?.totalUploads || 0}
            type="uploads"
            onClick={() => navigate('/uploads')}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <MetricCard
            title="Success Rate"
            value={`${metrics?.uploadSuccessRate?.toFixed(1) || 0}%`}
            type="success"
            trend={{
              value: 2.5,
              isUpGood: true,
            }}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <MetricCard
            title="Successful"
            value={metrics?.successfulUploads || 0}
            type="success"
            onClick={() => navigate('/tasks?status=completed')}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <MetricCard
            title="Failed"
            value={metrics?.failedUploads || 0}
            type="failed"
            onClick={() => navigate('/tasks?status=failed')}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <MetricCard
            title="Queued"
            value={metrics?.queuedUploads || 0}
            type="queued"
            onClick={() => navigate('/tasks?status=queued')}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <MetricCard
            title="Avg Upload Time"
            value={`${(metrics?.averageUploadTime || 0).toFixed(1)}`}
            suffix="min"
            type="default"
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <MetricCard
            title="System Load"
            value={`${(metrics?.systemLoad || 0).toFixed(1)}%`}
            type="load"
            trend={{
              value: -5.2,
              isUpGood: false,
            }}
            onClick={() => navigate('/monitoring')}
          />
        </Col>
        <Col xs={24} sm={12}>
          <MetricCard
            title="Memory Usage"
            value={`${(metrics?.memoryUsage || 0).toFixed(1)}%`}
            type="memory"
            trend={{
              value: 3.1,
              isUpGood: false,
            }}
            onClick={() => navigate('/monitoring')}
          />
        </Col>
      </Row>

      {/* Charts */}
      <DashboardCharts
        data={{
          uploadsLast24Hours: metrics?.uploadsLast24Hours || [],
          uploadDistribution: metrics?.uploadDistribution || [],
        }}
        loading={metricsLoading}
      />

      {/* Alerts */}
      <AlertsList
        alerts={alertsData?.alerts || []}
        loading={alertsLoading}
        onAcknowledge={handleAcknowledgeAlert}
        onDismiss={handleDismissAlert}
        onBatchAcknowledge={handleBatchAcknowledge}
        onRefresh={refetchAlerts}
      />
    </Space>
  );
};

export default DashboardPage;
