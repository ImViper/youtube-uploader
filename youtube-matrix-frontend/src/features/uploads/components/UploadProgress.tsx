import React from 'react';
import { Card, Progress, Space, Typography, Button, Tag, Statistic, Row, Col } from 'antd';
import {
  PauseCircleOutlined,
  PlayCircleOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  FieldTimeOutlined,
} from '@ant-design/icons';
import type { Upload } from '../uploadsSlice';

const { Text, Title } = Typography;

interface UploadProgressProps {
  upload: Upload;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
}

const UploadProgress: React.FC<UploadProgressProps> = ({
  upload,
  onPause,
  onResume,
  onCancel,
  onRetry,
}) => {
  const getStatusColor = (status: Upload['status']) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'uploading':
        return 'processing';
      case 'processing':
        return 'warning';
      case 'pending':
        return 'default';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: Upload['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircleOutlined />;
      case 'failed':
        return <CloseCircleOutlined />;
      case 'uploading':
      case 'processing':
        return <ClockCircleOutlined />;
      default:
        return null;
    }
  };

  const formatSpeed = (bytesPerSecond?: number): string => {
    if (!bytesPerSecond) return '0 KB/s';

    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let speed = bytesPerSecond;
    let unitIndex = 0;

    while (speed >= 1024 && unitIndex < units.length - 1) {
      speed /= 1024;
      unitIndex++;
    }

    return `${speed.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatTime = (seconds?: number): string => {
    if (!seconds) return '--:--';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    }
    if (minutes > 0) {
      return `${minutes}分${secs}秒`;
    }
    return `${secs}秒`;
  };

  const renderActions = () => {
    const actions = [];

    if (upload.status === 'uploading') {
      if (onPause) {
        actions.push(
          <Button key="pause" icon={<PauseCircleOutlined />} onClick={() => onPause(upload.id)}>
            暂停
          </Button>,
        );
      }
      if (onCancel) {
        actions.push(
          <Button
            key="cancel"
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => onCancel(upload.id)}
          >
            取消
          </Button>,
        );
      }
    }

    if (upload.status === 'pending' && onResume) {
      actions.push(
        <Button
          key="resume"
          type="primary"
          icon={<PlayCircleOutlined />}
          onClick={() => onResume(upload.id)}
        >
          开始
        </Button>,
      );
    }

    if (upload.status === 'paused' && onResume) {
      actions.push(
        <Button
          key="resume"
          type="primary"
          icon={<PlayCircleOutlined />}
          onClick={() => onResume(upload.id)}
        >
          恢复
        </Button>,
      );
    }

    if (upload.status === 'failed' && onRetry) {
      actions.push(
        <Button
          key="retry"
          type="primary"
          icon={<PlayCircleOutlined />}
          onClick={() => onRetry(upload.id)}
        >
          重试
        </Button>,
      );
    }

    return actions;
  };

  const progressStatus =
    upload.status === 'failed' ? 'exception' : 
    upload.status === 'completed' ? 'success' : 
    upload.status === 'paused' ? 'normal' : 'active';

  return (
    <Card
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Title level={5} style={{ margin: 0 }}>
              {upload.title}
            </Title>
            <Tag color={getStatusColor(upload.status)} icon={getStatusIcon(upload.status)}>
              {upload.status === 'pending' && '等待中'}
              {upload.status === 'uploading' && '上传中'}
              {upload.status === 'processing' && '处理中'}
              {upload.status === 'completed' && '已完成'}
              {upload.status === 'failed' && '失败'}
              {upload.status === 'cancelled' && '已取消'}
              {upload.status === 'paused' && '已暂停'}
            </Tag>
          </Space>
          <Space>{renderActions()}</Space>
        </div>
      }
      style={{ marginBottom: 16 }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* 进度条 */}
        <div>
          <Progress
            percent={upload.progress}
            status={progressStatus}
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
            showInfo={false}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <Text>{upload.progress}% 已完成</Text>
            {upload.status === 'uploading' && upload.uploadSpeed && (
              <Text type="secondary">{formatSpeed(upload.uploadSpeed)}</Text>
            )}
          </div>
        </div>

        {/* 统计信息 */}
        {(upload.status === 'uploading' || upload.status === 'processing') && (
          <Row gutter={16}>
            <Col span={8}>
              <Statistic
                title="上传速度"
                value={formatSpeed(upload.uploadSpeed)}
                prefix={<ThunderboltOutlined />}
                valueStyle={{ fontSize: 16 }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="剩余时间"
                value={formatTime(upload.timeRemaining)}
                prefix={<FieldTimeOutlined />}
                valueStyle={{ fontSize: 16 }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="账户"
                value={upload.accountId.substring(0, 8) + '...'}
                valueStyle={{ fontSize: 16 }}
              />
            </Col>
          </Row>
        )}

        {/* 错误信息 */}
        {upload.status === 'failed' && upload.error && (
          <div
            style={{
              padding: 12,
              backgroundColor: '#fff2f0',
              border: '1px solid #ffccc7',
              borderRadius: 4,
            }}
          >
            <Text type="danger">错误: {upload.error}</Text>
          </div>
        )}

        {/* 完成信息 */}
        {upload.status === 'completed' && upload.url && (
          <div
            style={{
              padding: 12,
              backgroundColor: '#f6ffed',
              border: '1px solid #b7eb8f',
              borderRadius: 4,
            }}
          >
            <Space direction="vertical">
              <Text type="success" strong>
                上传成功！
              </Text>
              <Text copyable={{ text: upload.url }}>视频ID: {upload.videoId}</Text>
              <a href={upload.url} target="_blank" rel="noopener noreferrer">
                在YouTube上查看
              </a>
            </Space>
          </div>
        )}

        {/* 附加信息 */}
        <Space size="large">
          <Text type="secondary">文件: {upload.videoPath}</Text>
          {upload.scheduledAt && (
            <Text type="secondary">
              定时发布: {new Date(upload.scheduledAt).toLocaleString('zh-CN')}
            </Text>
          )}
        </Space>
      </Space>
    </Card>
  );
};

export default UploadProgress;
