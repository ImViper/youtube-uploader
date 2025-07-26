import React, { useState } from 'react';
import {
  Card,
  List,
  Badge,
  Button,
  Space,
  Typography,
  Tag,
  Checkbox,
  message,
  Empty,
  Spin,
} from 'antd';
import {
  InfoCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  CheckOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { formatDistanceToNow } from 'date-fns';

const { Text, Title } = Typography;

interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  metadata?: Record<string, any>;
}

interface AlertsListProps {
  alerts: Alert[];
  loading?: boolean;
  onAcknowledge: (id: string) => void;
  onDismiss: (id: string) => void;
  onBatchAcknowledge: (ids: string[]) => void;
  onRefresh?: () => void;
}

const getAlertIcon = (type: Alert['type']) => {
  switch (type) {
    case 'error':
      return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
    case 'warning':
      return <WarningOutlined style={{ color: '#faad14' }} />;
    case 'info':
      return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
  }
};

const getAlertColor = (type: Alert['type']) => {
  switch (type) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
      return 'processing';
  }
};

const AlertsList: React.FC<AlertsListProps> = ({
  alerts,
  loading = false,
  onAcknowledge,
  onDismiss,
  onBatchAcknowledge,
  onRefresh,
}) => {
  const [selectedAlerts, setSelectedAlerts] = useState<string[]>([]);

  const unacknowledgedAlerts = alerts.filter((alert) => !alert.acknowledged);
  const unacknowledgedCount = unacknowledgedAlerts.length;

  const handleSelectAll = () => {
    if (selectedAlerts.length === unacknowledgedAlerts.length) {
      setSelectedAlerts([]);
    } else {
      setSelectedAlerts(unacknowledgedAlerts.map((alert) => alert.id));
    }
  };

  const handleSelectAlert = (alertId: string, checked: boolean) => {
    if (checked) {
      setSelectedAlerts([...selectedAlerts, alertId]);
    } else {
      setSelectedAlerts(selectedAlerts.filter((id) => id !== alertId));
    }
  };

  const handleBatchAcknowledge = () => {
    if (selectedAlerts.length === 0) {
      message.warning('Please select alerts to acknowledge');
      return;
    }
    onBatchAcknowledge(selectedAlerts);
    setSelectedAlerts([]);
    message.success(`${selectedAlerts.length} alerts acknowledged`);
  };

  return (
    <Card
      title={
        <div className="flex justify-between items-center">
          <Space>
            <Title level={4} style={{ margin: 0 }}>
              System Alerts
            </Title>
            {unacknowledgedCount > 0 && <Badge count={unacknowledgedCount} showZero />}
          </Space>
          <Space>
            {selectedAlerts.length > 0 && (
              <Button icon={<CheckOutlined />} onClick={handleBatchAcknowledge}>
                Acknowledge ({selectedAlerts.length})
              </Button>
            )}
            {onRefresh && (
              <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
                Refresh
              </Button>
            )}
          </Space>
        </div>
      }
      style={{ height: '100%' }}
    >
      {loading && alerts.length === 0 ? (
        <div className="flex justify-center items-center h-64">
          <Spin size="large" />
        </div>
      ) : alerts.length === 0 ? (
        <Empty description="No alerts at this time" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <>
          {unacknowledgedAlerts.length > 0 && (
            <div className="mb-4">
              <Checkbox
                indeterminate={
                  selectedAlerts.length > 0 && selectedAlerts.length < unacknowledgedAlerts.length
                }
                checked={selectedAlerts.length === unacknowledgedAlerts.length}
                onChange={handleSelectAll}
              >
                Select all unacknowledged
              </Checkbox>
            </div>
          )}
          <List
            dataSource={alerts}
            renderItem={(alert) => (
              <List.Item
                key={alert.id}
                className={`transition-all duration-200 ${alert.acknowledged ? 'opacity-60' : ''}`}
                actions={[
                  !alert.acknowledged && (
                    <Button
                      size="small"
                      icon={<CheckOutlined />}
                      onClick={() => onAcknowledge(alert.id)}
                    >
                      Acknowledge
                    </Button>
                  ),
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => onDismiss(alert.id)}
                  >
                    Dismiss
                  </Button>,
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  avatar={
                    <Space>
                      {!alert.acknowledged && (
                        <Checkbox
                          checked={selectedAlerts.includes(alert.id)}
                          onChange={(e) => handleSelectAlert(alert.id, e.target.checked)}
                        />
                      )}
                      {getAlertIcon(alert.type)}
                    </Space>
                  }
                  title={
                    <Space>
                      <Text strong>{alert.title}</Text>
                      <Tag color={getAlertColor(alert.type)}>{alert.type.toUpperCase()}</Tag>
                      {alert.acknowledged && <Tag color="default">Acknowledged</Tag>}
                    </Space>
                  }
                  description={
                    <div>
                      <Text>{alert.message}</Text>
                      <div className="mt-1">
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                        </Text>
                      </div>
                      {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                        <div className="mt-2">
                          {Object.entries(alert.metadata).map(([key, value]) => (
                            <Tag key={key} color="default" style={{ marginTop: '4px' }}>
                              {key}: {String(value)}
                            </Tag>
                          ))}
                        </div>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </>
      )}
    </Card>
  );
};

export default AlertsList;
