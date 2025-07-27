import React, { useState } from 'react';
import {
  Modal,
  Descriptions,
  Tag,
  Space,
  Typography,
  Button,
  Tabs,
  Timeline,
  Alert,
  Badge,
  Progress,
  InputNumber,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  CopyOutlined,
  CodeOutlined,
  HistoryOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { Task } from '../tasksApi';

const { Text } = Typography;
const { TabPane } = Tabs;

interface TaskDetailModalProps {
  visible: boolean;
  task: Task | null;
  onCancel: () => void;
  onRetry?: (taskId: string, maxAttempts?: number) => void;
}

interface TaskLog {
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  message: string;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ visible, task, onCancel, onRetry }) => {
  const [retryAttempts, setRetryAttempts] = useState(3);
  const [activeTab, setActiveTab] = useState('details');

  if (!task) return null;

  const getStatusColor = (status: Task['status']) => {
    const statusMap = {
      pending: 'default',
      running: 'processing',
      completed: 'success',
      failed: 'error',
      cancelled: 'default',
      paused: 'warning',
    };
    return statusMap[status];
  };

  const getTypeText = (type: Task['type']) => {
    const typeMap: Record<string, string> = {
      upload: '视频上传',
      update: '视频更新',
      comment: '添加评论',
      analytics: '数据分析',
    };
    return typeMap[type] || type;
  };

  const getPriorityText = (priority: Task['priority']) => {
    const priorityMap: Record<string, string> = {
      urgent: '紧急',
      high: '高',
      normal: '中',
      low: '低',
    };
    return priorityMap[priority] || priority;
  };

  const handleRetry = () => {
    if (onRetry && task) {
      onRetry(task.id, retryAttempts);
      message.success(`任务已重新加入队列，最大重试次数：${retryAttempts}`);
      onCancel();
    }
  };

  const copyTaskInfo = () => {
    const taskInfo = {
      id: task.id,
      type: task.type,
      status: task.status,
      accountId: task.accountId,
      error: task.error,
      metadata: task.metadata,
    };
    navigator.clipboard.writeText(JSON.stringify(taskInfo, null, 2));
    message.success('任务信息已复制到剪贴板');
  };

  // 模拟执行日志
  const executionLogs: TaskLog[] = task.startedAt
    ? [
        {
          timestamp: task.createdAt,
          level: 'info',
          message: '任务已创建并加入队列',
        },
        ...(task.scheduledAt
          ? [
              {
                timestamp: task.scheduledAt,
                level: 'info' as const,
                message: '任务计划执行时间已设置',
              },
            ]
          : []),
        ...(task.startedAt
          ? [
              {
                timestamp: task.startedAt,
                level: 'info' as const,
                message: '任务开始执行',
              },
            ]
          : []),
        ...(task.error
          ? [
              {
                timestamp: task.completedAt || new Date().toISOString(),
                level: 'error' as const,
                message: `执行失败: ${task.error}`,
              },
            ]
          : []),
        ...(task.completedAt && task.status === 'completed'
          ? [
              {
                timestamp: task.completedAt,
                level: 'info' as const,
                message: '任务执行成功',
              },
            ]
          : []),
      ]
    : [];

  return (
    <Modal
      title={
        <Space>
          <span>任务详情</span>
          <Tag color={getStatusColor(task.status)}>
            {task.status === 'pending' && '等待中'}
            {task.status === 'running' && '执行中'}
            {task.status === 'completed' && '已完成'}
            {task.status === 'failed' && '失败'}
            {task.status === 'cancelled' && '已取消'}
            {task.status === 'paused' && '已暂停'}
          </Tag>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      width={800}
      footer={[
        <Button key="copy" icon={<CopyOutlined />} onClick={copyTaskInfo}>
          复制信息
        </Button>,
        task.status === 'failed' && onRetry && (
          <Button key="retry" type="primary" icon={<ReloadOutlined />} onClick={handleRetry}>
            重试任务
          </Button>
        ),
        <Button key="close" onClick={onCancel}>
          关闭
        </Button>,
      ]}
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane
          tab={
            <span>
              <SettingOutlined />
              基本信息
            </span>
          }
          key="details"
        >
          <Descriptions column={2} bordered>
            <Descriptions.Item label="任务ID" span={2}>
              <Text copyable>{task.id}</Text>
            </Descriptions.Item>

            <Descriptions.Item label="任务类型">
              <Tag color="blue">{getTypeText(task.type)}</Tag>
            </Descriptions.Item>

            <Descriptions.Item label="优先级">
              <Badge
                status={
                  task.priority === 'high'
                    ? 'error'
                    : task.priority === 'medium'
                      ? 'warning'
                      : 'default'
                }
                text={getPriorityText(task.priority)}
              />
            </Descriptions.Item>

            <Descriptions.Item label="账户ID" span={2}>
              <Text copyable>{task.accountId}</Text>
            </Descriptions.Item>

            {task.uploadId && (
              <Descriptions.Item label="关联上传" span={2}>
                <Text copyable>{task.uploadId}</Text>
              </Descriptions.Item>
            )}

            <Descriptions.Item label="进度">
              <Progress
                percent={task.progress}
                status={
                  task.status === 'failed'
                    ? 'exception'
                    : task.status === 'completed'
                      ? 'success'
                      : 'active'
                }
              />
            </Descriptions.Item>

            <Descriptions.Item label="重试次数">
              <Space>
                <Text>{task.attempts}</Text>
                <Text type="secondary">/ {task.maxAttempts}</Text>
              </Space>
            </Descriptions.Item>

            <Descriptions.Item label="创建时间">
              {new Date(task.createdAt).toLocaleString('zh-CN')}
            </Descriptions.Item>

            <Descriptions.Item label="更新时间">
              {new Date(task.updatedAt).toLocaleString('zh-CN')}
            </Descriptions.Item>

            {task.scheduledAt && (
              <Descriptions.Item label="计划执行时间" span={2}>
                {new Date(task.scheduledAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
            )}

            {task.startedAt && (
              <Descriptions.Item label="开始时间">
                {new Date(task.startedAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
            )}

            {task.completedAt && (
              <Descriptions.Item label="完成时间">
                {new Date(task.completedAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
            )}

            {task.startedAt && task.completedAt && (
              <Descriptions.Item label="执行耗时" span={2}>
                {formatDistanceToNow(new Date(task.startedAt), {
                  locale: zhCN,
                  includeSeconds: true,
                })}
              </Descriptions.Item>
            )}
          </Descriptions>

          {task.error && (
            <Alert
              message="错误信息"
              description={task.error}
              type="error"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}

          {task.status === 'failed' && onRetry && (
            <div style={{ marginTop: 16 }}>
              <Space>
                <Text>设置重试次数：</Text>
                <InputNumber
                  min={1}
                  max={10}
                  value={retryAttempts}
                  onChange={(value) => setRetryAttempts(value || 3)}
                />
              </Space>
            </div>
          )}
        </TabPane>

        <TabPane
          tab={
            <span>
              <HistoryOutlined />
              执行日志
            </span>
          }
          key="logs"
        >
          {executionLogs.length > 0 ? (
            <Timeline mode="left">
              {executionLogs.map((log, index) => (
                <Timeline.Item
                  key={index}
                  color={
                    log.level === 'error' ? 'red' : log.level === 'warning' ? 'orange' : 'blue'
                  }
                  label={new Date(log.timestamp).toLocaleString('zh-CN')}
                >
                  <Space>
                    {log.level === 'error' && (
                      <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                    )}
                    {log.level === 'warning' && (
                      <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                    )}
                    {log.level === 'info' && <CheckCircleOutlined style={{ color: '#1890ff' }} />}
                    <Text>{log.message}</Text>
                  </Space>
                </Timeline.Item>
              ))}
            </Timeline>
          ) : (
            <Alert message="暂无执行日志" description="任务尚未开始执行" type="info" showIcon />
          )}
        </TabPane>

        {task.metadata && Object.keys(task.metadata).length > 0 && (
          <TabPane
            tab={
              <span>
                <CodeOutlined />
                元数据
              </span>
            }
            key="metadata"
          >
            <pre
              style={{
                backgroundColor: '#f5f5f5',
                padding: 16,
                borderRadius: 4,
                overflow: 'auto',
                maxHeight: 400,
              }}
            >
              {JSON.stringify(task.metadata, null, 2)}
            </pre>
          </TabPane>
        )}

        {task.result && (
          <TabPane
            tab={
              <span>
                <CheckCircleOutlined />
                执行结果
              </span>
            }
            key="result"
          >
            <pre
              style={{
                backgroundColor: '#f6ffed',
                border: '1px solid #b7eb8f',
                padding: 16,
                borderRadius: 4,
                overflow: 'auto',
                maxHeight: 400,
              }}
            >
              {JSON.stringify(task.result, null, 2)}
            </pre>
          </TabPane>
        )}
      </Tabs>
    </Modal>
  );
};

export default TaskDetailModal;
