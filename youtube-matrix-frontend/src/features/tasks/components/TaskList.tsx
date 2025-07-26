import React, { useState } from 'react';
import {
  Table,
  Tag,
  Space,
  Button,
  Progress,
  Tooltip,
  Typography,
  Badge,
  Tabs,
  Card,
  Dropdown,
} from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  DeleteOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { Task } from '../tasksSlice';

const { Text } = Typography;

interface TaskListProps {
  tasks: Task[];
  loading?: boolean;
  onView: (task: Task) => void;
  onRetry: (taskId: string) => void;
  onCancel: (taskId: string) => void;
  onPause?: (taskId: string) => void;
  onResume?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
}

const TaskList: React.FC<TaskListProps> = ({
  tasks,
  loading = false,
  onView,
  onRetry,
  onCancel,
  onPause,
  onResume,
  onDelete,
}) => {
  const [activeTab, setActiveTab] = useState<Task['status'] | 'all'>('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const getStatusTag = (status: Task['status']) => {
    const statusConfig = {
      pending: { color: 'default', icon: <ClockCircleOutlined />, text: '等待中' },
      running: { color: 'processing', icon: <LoadingOutlined spin />, text: '执行中' },
      completed: { color: 'success', icon: <CheckCircleOutlined />, text: '已完成' },
      failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' },
      cancelled: { color: 'default', icon: <CloseCircleOutlined />, text: '已取消' },
      paused: { color: 'warning', icon: <PauseCircleOutlined />, text: '已暂停' },
    };

    const config = statusConfig[status];
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  const getTypeTag = (type: Task['type']) => {
    const typeConfig = {
      upload: { color: 'blue', text: '上传' },
      update: { color: 'orange', text: '更新' },
      comment: { color: 'green', text: '评论' },
      delete: { color: 'red', text: '删除' },
    };

    const config = typeConfig[type];
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getPriorityBadge = (priority: Task['priority']) => {
    const priorityConfig = {
      high: { status: 'error' as const, text: '高' },
      medium: { status: 'warning' as const, text: '中' },
      low: { status: 'default' as const, text: '低' },
    };

    const config = priorityConfig[priority];
    return <Badge status={config.status} text={config.text} />;
  };

  const columns: ColumnsType<Task> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      ellipsis: true,
      render: (id) => (
        <Tooltip title={id}>
          <Text copyable={{ text: id }}>{id.substring(0, 8)}...</Text>
        </Tooltip>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      filters: [
        { text: '上传', value: 'upload' },
        { text: '更新', value: 'update' },
        { text: '评论', value: 'comment' },
        { text: '删除', value: 'delete' },
      ],
      onFilter: (value, record) => record.type === value,
      render: (type) => getTypeTag(type),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      filters: [
        { text: '等待中', value: 'pending' },
        { text: '执行中', value: 'running' },
        { text: '已完成', value: 'completed' },
        { text: '失败', value: 'failed' },
        { text: '已取消', value: 'cancelled' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status) => getStatusTag(status),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      filters: [
        { text: '高', value: 'high' },
        { text: '中', value: 'medium' },
        { text: '低', value: 'low' },
      ],
      onFilter: (value, record) => record.priority === value,
      render: (priority) => getPriorityBadge(priority),
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      width: 150,
      render: (progress, record) => {
        if (record.status === 'pending') return '-';

        return (
          <Progress
            percent={progress}
            size="small"
            status={
              record.status === 'failed'
                ? 'exception'
                : record.status === 'completed'
                  ? 'success'
                  : 'active'
            }
          />
        );
      },
    },
    {
      title: '账户',
      dataIndex: 'accountId',
      key: 'accountId',
      width: 120,
      ellipsis: true,
      render: (accountId) => <Tooltip title={accountId}>{accountId.substring(0, 8)}...</Tooltip>,
    },
    {
      title: '重试次数',
      key: 'attempts',
      width: 100,
      render: (_, record) => (
        <Space>
          <Text>{record.attempts}</Text>
          <Text type="secondary">/ {record.maxAttempts}</Text>
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      render: (createdAt) => (
        <Tooltip title={new Date(createdAt).toLocaleString('zh-CN')}>
          {formatDistanceToNow(new Date(createdAt), {
            addSuffix: true,
            locale: zhCN,
          })}
        </Tooltip>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 120,
      render: (_, record) => {
        const menuItems: any[] = [
          {
            key: 'view',
            label: '查看详情',
            icon: <EyeOutlined />,
            onClick: () => onView(record),
          },
        ];

        if (record.status === 'running' && onPause) {
          menuItems.push({
            key: 'pause',
            label: '暂停',
            icon: <PauseCircleOutlined />,
            onClick: () => onPause(record.id),
          });
        }

        if (record.status === 'paused' && onResume) {
          menuItems.push({
            key: 'resume',
            label: '恢复',
            icon: <PlayCircleOutlined />,
            onClick: () => onResume(record.id),
          });
        }

        if (['running', 'paused', 'pending'].includes(record.status)) {
          menuItems.push({
            key: 'cancel',
            label: '取消',
            icon: <CloseCircleOutlined />,
            danger: true,
            onClick: () => onCancel(record.id),
          });
        }

        if (record.status === 'failed' && record.attempts < record.maxAttempts) {
          menuItems.push({
            key: 'retry',
            label: '重试',
            icon: <ReloadOutlined />,
            onClick: () => onRetry(record.id),
          });
        }

        if (['completed', 'failed', 'cancelled'].includes(record.status) && onDelete) {
          menuItems.push({
            key: 'divider',
            type: 'divider' as const,
          });
          menuItems.push({
            key: 'delete',
            label: '删除',
            icon: <DeleteOutlined />,
            danger: true,
            onClick: () => onDelete(record.id),
          });
        }

        return (
          <Space size="small">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onView(record)}
            />
            <Dropdown menu={{ items: menuItems }} trigger={['click']}>
              <Button type="text" size="small" icon={<MoreOutlined />} />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  const expandedRowRender = (record: Task) => {
    return (
      <div style={{ padding: '16px 0' }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          {record.error && (
            <div>
              <Text strong>错误信息：</Text>
              <Text type="danger" style={{ marginLeft: 8 }}>
                {record.error}
              </Text>
            </div>
          )}

          {record.scheduledAt && (
            <div>
              <Text strong>计划执行时间：</Text>
              <Text style={{ marginLeft: 8 }}>
                {new Date(record.scheduledAt).toLocaleString('zh-CN')}
              </Text>
            </div>
          )}

          {record.startedAt && (
            <div>
              <Text strong>开始时间：</Text>
              <Text style={{ marginLeft: 8 }}>
                {new Date(record.startedAt).toLocaleString('zh-CN')}
              </Text>
            </div>
          )}

          {record.completedAt && (
            <div>
              <Text strong>完成时间：</Text>
              <Text style={{ marginLeft: 8 }}>
                {new Date(record.completedAt).toLocaleString('zh-CN')}
              </Text>
              <Text type="secondary" style={{ marginLeft: 8 }}>
                (耗时: {formatDistanceToNow(new Date(record.startedAt!), { locale: zhCN })})
              </Text>
            </div>
          )}

          {record.uploadId && (
            <div>
              <Text strong>关联上传：</Text>
              <Text copyable style={{ marginLeft: 8 }}>
                {record.uploadId}
              </Text>
            </div>
          )}

          {record.metadata && Object.keys(record.metadata).length > 0 && (
            <div>
              <Text strong>附加信息：</Text>
              <pre
                style={{
                  marginTop: 8,
                  padding: 8,
                  backgroundColor: '#f5f5f5',
                  borderRadius: 4,
                  overflow: 'auto',
                }}
              >
                {JSON.stringify(record.metadata, null, 2)}
              </pre>
            </div>
          )}
        </Space>
      </div>
    );
  };

  const filteredTasks =
    activeTab === 'all' ? tasks : tasks.filter((task) => task.status === activeTab);

  const tabItems = [
    { key: 'all', label: '全部', count: tasks.length },
    { key: 'pending', label: '待处理', count: tasks.filter((t) => t.status === 'pending').length },
    { key: 'running', label: '运行中', count: tasks.filter((t) => t.status === 'running').length },
    { key: 'paused', label: '已暂停', count: tasks.filter((t) => t.status === 'paused').length },
    {
      key: 'completed',
      label: '已完成',
      count: tasks.filter((t) => t.status === 'completed').length,
    },
    { key: 'failed', label: '失败', count: tasks.filter((t) => t.status === 'failed').length },
    {
      key: 'cancelled',
      label: '已取消',
      count: tasks.filter((t) => t.status === 'cancelled').length,
    },
  ];

  return (
    <Card bodyStyle={{ padding: 0 }}>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as any)}
        style={{ padding: '16px 16px 0' }}
        items={tabItems.map((item) => ({
          key: item.key,
          label: (
            <Badge count={item.count} showZero={false} offset={[10, 0]}>
              {item.label}
            </Badge>
          ),
        }))}
      />

      <Table
        columns={columns}
        dataSource={filteredTasks}
        rowKey="id"
        loading={loading}
        expandable={{
          expandedRowRender,
          rowExpandable: (record) =>
            !!record.error || !!record.metadata || !!record.uploadId || !!record.scheduledAt,
        }}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          defaultPageSize: 20,
          pageSizeOptions: ['10', '20', '50', '100'],
        }}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
          getCheckboxProps: (record) => ({
            disabled: ['running', 'pending'].includes(record.status),
          }),
        }}
        scroll={{ x: 1200 }}
      />
    </Card>
  );
};

export default TaskList;
