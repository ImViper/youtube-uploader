import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Slider,
  InputNumber,
  Switch,
  Select,
  TimePicker,
  Space,
  Button,
  Progress,
  Statistic,
  Alert,
  Tooltip,
  Badge,
  Divider,
} from 'antd';
import {
  ThunderboltOutlined,
  ClockCircleOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  RocketOutlined,
  InfoCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/redux';
import dayjs from 'dayjs';

const { Option } = Select;

interface QueueMetrics {
  activeUploads: number;
  queuedUploads: number;
  completedToday: number;
  averageSpeed: number;
  estimatedTime: number;
}

const QueueConfiguration: React.FC = () => {
  const { t } = useTranslation();
  const _dispatch = useAppDispatch();

  // State
  const [concurrency, setConcurrency] = useState(3);
  const [rateLimit, setRateLimit] = useState(0);
  const [pauseDuration, setPauseDuration] = useState(0);
  const [priorityMode, setPriorityMode] = useState('fifo');
  const [schedulingEnabled, setSchedulingEnabled] = useState(false);
  const [scheduleStart, setScheduleStart] = useState(dayjs('00:00', 'HH:mm'));
  const [scheduleEnd, setScheduleEnd] = useState(dayjs('23:59', 'HH:mm'));
  const [isQueuePaused, setIsQueuePaused] = useState(false);

  // Mock queue metrics
  const queueMetrics: QueueMetrics = {
    activeUploads: 2,
    queuedUploads: 15,
    completedToday: 48,
    averageSpeed: 45.2, // MB/s
    estimatedTime: 720, // minutes
  };

  // Handle concurrency change
  const handleConcurrencyChange = (value: number | null) => {
    if (value !== null) {
      setConcurrency(value);
    }
  };

  // Handle rate limit change
  const handleRateLimitChange = (value: number | null) => {
    if (value !== null) {
      setRateLimit(value);
    }
  };

  // Get queue status color
  const getQueueStatusColor = () => {
    if (isQueuePaused) return '#ff4d4f';
    if (queueMetrics.activeUploads === 0) return '#faad14';
    return '#52c41a';
  };

  // Format time remaining
  const formatTimeRemaining = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <div className="queue-configuration">
      {/* Queue Status Overview */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('settings.activeUploads')}
              value={queueMetrics.activeUploads}
              prefix={<ThunderboltOutlined />}
              suffix={`/ ${concurrency}`}
              valueStyle={{ color: getQueueStatusColor() }}
            />
            <Progress
              percent={(queueMetrics.activeUploads / concurrency) * 100}
              showInfo={false}
              strokeColor={getQueueStatusColor()}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('settings.queuedUploads')}
              value={queueMetrics.queuedUploads}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('settings.completedToday')}
              value={queueMetrics.completedToday}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('settings.estimatedTime')}
              value={formatTimeRemaining(queueMetrics.estimatedTime)}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Queue Control */}
      <Card
        title={t('settings.queueControl')}
        extra={
          <Space>
            <Button
              type={isQueuePaused ? 'primary' : 'default'}
              icon={isQueuePaused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
              onClick={() => setIsQueuePaused(!isQueuePaused)}
              danger={!isQueuePaused}
            >
              {isQueuePaused ? t('settings.resumeQueue') : t('settings.pauseQueue')}
            </Button>
            <Button icon={<SettingOutlined />}>{t('settings.advancedSettings')}</Button>
          </Space>
        }
        className="mb-4"
      >
        <Alert
          message={isQueuePaused ? t('settings.queuePaused') : t('settings.queueRunning')}
          type={isQueuePaused ? 'warning' : 'success'}
          showIcon
          className="mb-4"
        />

        <Row gutter={[24, 24]}>
          {/* Concurrency Setting */}
          <Col span={24}>
            <div className="setting-item">
              <div className="setting-header mb-2">
                <Space>
                  <RocketOutlined />
                  <span className="font-medium">{t('settings.concurrentUploads')}</span>
                  <Tooltip title={t('settings.concurrentUploadsHelp')}>
                    <InfoCircleOutlined className="text-gray-400" />
                  </Tooltip>
                </Space>
              </div>
              <Row gutter={16} align="middle">
                <Col span={16}>
                  <Slider
                    min={1}
                    max={10}
                    value={concurrency}
                    onChange={handleConcurrencyChange}
                    marks={{
                      1: '1',
                      3: '3',
                      5: '5',
                      7: '7',
                      10: '10',
                    }}
                  />
                </Col>
                <Col span={8}>
                  <InputNumber
                    min={1}
                    max={10}
                    value={concurrency}
                    onChange={handleConcurrencyChange}
                    className="w-full"
                  />
                </Col>
              </Row>
              <div className="mt-2 text-sm text-gray-500">
                {t('settings.recommendedConcurrency')}
              </div>
            </div>
          </Col>

          <Divider />

          {/* Rate Limiting */}
          <Col span={24}>
            <div className="setting-item">
              <div className="setting-header mb-2">
                <Space>
                  <ThunderboltOutlined />
                  <span className="font-medium">{t('settings.uploadRateLimit')}</span>
                  <Tooltip title={t('settings.rateLimitHelp')}>
                    <InfoCircleOutlined className="text-gray-400" />
                  </Tooltip>
                </Space>
              </div>
              <Row gutter={16} align="middle">
                <Col span={16}>
                  <Slider
                    min={0}
                    max={1000}
                    step={10}
                    value={rateLimit}
                    onChange={handleRateLimitChange}
                    marks={{
                      0: t('settings.unlimited'),
                      250: '250 MB/s',
                      500: '500 MB/s',
                      750: '750 MB/s',
                      1000: '1 GB/s',
                    }}
                  />
                </Col>
                <Col span={8}>
                  <InputNumber
                    min={0}
                    max={1000}
                    step={10}
                    value={rateLimit}
                    onChange={handleRateLimitChange}
                    addonAfter="MB/s"
                    className="w-full"
                  />
                </Col>
              </Row>
              {rateLimit > 0 && (
                <div className="mt-2">
                  <Progress
                    percent={(queueMetrics.averageSpeed / rateLimit) * 100}
                    format={() => `${queueMetrics.averageSpeed.toFixed(1)} MB/s`}
                    status="active"
                  />
                </div>
              )}
            </div>
          </Col>

          <Divider />

          {/* Priority Strategy */}
          <Col xs={24} md={12}>
            <div className="setting-item">
              <div className="setting-header mb-2">
                <Space>
                  <span className="font-medium">{t('settings.priorityStrategy')}</span>
                  <Tooltip title={t('settings.priorityStrategyHelp')}>
                    <InfoCircleOutlined className="text-gray-400" />
                  </Tooltip>
                </Space>
              </div>
              <Select value={priorityMode} onChange={setPriorityMode} className="w-full">
                <Option value="fifo">
                  <Space>
                    <Badge status="processing" />
                    {t('settings.fifo')}
                  </Space>
                </Option>
                <Option value="lifo">
                  <Space>
                    <Badge status="warning" />
                    {t('settings.lifo')}
                  </Space>
                </Option>
                <Option value="priority">
                  <Space>
                    <Badge status="success" />
                    {t('settings.priority')}
                  </Space>
                </Option>
                <Option value="size">
                  <Space>
                    <Badge status="default" />
                    {t('settings.smallestFirst')}
                  </Space>
                </Option>
              </Select>
            </div>
          </Col>

          {/* Pause Between Uploads */}
          <Col xs={24} md={12}>
            <div className="setting-item">
              <div className="setting-header mb-2">
                <Space>
                  <span className="font-medium">{t('settings.pauseBetweenUploads')}</span>
                  <Tooltip title={t('settings.pauseBetweenUploadsHelp')}>
                    <InfoCircleOutlined className="text-gray-400" />
                  </Tooltip>
                </Space>
              </div>
              <InputNumber
                min={0}
                max={300}
                value={pauseDuration}
                onChange={(value) => setPauseDuration(value || 0)}
                addonAfter="s"
                className="w-full"
              />
            </div>
          </Col>
        </Row>
      </Card>

      {/* Scheduling */}
      <Card title={t('settings.uploadScheduling')} className="mb-4">
        <Row gutter={[24, 24]}>
          <Col span={24}>
            <div className="setting-item">
              <Space className="w-full justify-between">
                <Space>
                  <ClockCircleOutlined />
                  <span className="font-medium">{t('settings.enableScheduling')}</span>
                  <Tooltip title={t('settings.schedulingHelp')}>
                    <InfoCircleOutlined className="text-gray-400" />
                  </Tooltip>
                </Space>
                <Switch checked={schedulingEnabled} onChange={setSchedulingEnabled} />
              </Space>
            </div>
          </Col>

          {schedulingEnabled && (
            <>
              <Col xs={24} md={12}>
                <div className="setting-item">
                  <div className="setting-header mb-2">
                    <span className="font-medium">{t('settings.scheduleStart')}</span>
                  </div>
                  <TimePicker
                    value={scheduleStart}
                    onChange={(time) => setScheduleStart(time || dayjs('00:00', 'HH:mm'))}
                    format="HH:mm"
                    className="w-full"
                  />
                </div>
              </Col>
              <Col xs={24} md={12}>
                <div className="setting-item">
                  <div className="setting-header mb-2">
                    <span className="font-medium">{t('settings.scheduleEnd')}</span>
                  </div>
                  <TimePicker
                    value={scheduleEnd}
                    onChange={(time) => setScheduleEnd(time || dayjs('23:59', 'HH:mm'))}
                    format="HH:mm"
                    className="w-full"
                  />
                </div>
              </Col>
              <Col span={24}>
                <Alert
                  message={t('settings.scheduleInfo')}
                  description={t('settings.scheduleInfoDescription', {
                    start: scheduleStart.format('HH:mm'),
                    end: scheduleEnd.format('HH:mm'),
                  })}
                  type="info"
                  showIcon
                />
              </Col>
            </>
          )}
        </Row>
      </Card>

      {/* Queue Preview */}
      <Card title={t('settings.queuePreview')}>
        <div className="queue-visualization">
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {/* Active uploads */}
            {Array.from({ length: queueMetrics.activeUploads }).map((_, index) => (
              <div
                key={`active-${index}`}
                className="flex-shrink-0 w-20 h-20 bg-green-500 rounded flex items-center justify-center text-white font-bold"
              >
                <PlayCircleOutlined className="text-2xl" />
              </div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: concurrency - queueMetrics.activeUploads }).map((_, index) => (
              <div
                key={`empty-${index}`}
                className="flex-shrink-0 w-20 h-20 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400"
              >
                <PauseCircleOutlined className="text-2xl" />
              </div>
            ))}

            {/* Separator */}
            {queueMetrics.queuedUploads > 0 && (
              <div className="flex-shrink-0 flex items-center px-2">
                <div className="h-12 w-0.5 bg-gray-300" />
              </div>
            )}

            {/* Queued uploads */}
            {Array.from({ length: Math.min(queueMetrics.queuedUploads, 5) }).map((_, index) => (
              <div
                key={`queued-${index}`}
                className="flex-shrink-0 w-20 h-20 bg-blue-500 rounded flex items-center justify-center text-white font-bold"
              >
                {index + 1}
              </div>
            ))}

            {queueMetrics.queuedUploads > 5 && (
              <div className="flex-shrink-0 w-20 h-20 bg-gray-500 rounded flex items-center justify-center text-white">
                +{queueMetrics.queuedUploads - 5}
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-between text-sm text-gray-600">
            <span>{t('settings.activeSlots')}</span>
            <span>{t('settings.queuedItems')}</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default QueueConfiguration;
