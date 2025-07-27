import React, { useState } from 'react';
import { Card, Space, Row, Col, Statistic, Tabs } from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import {
  useGetTasksQuery,
  useCancelTaskMutation,
  useRetryTaskMutation,
  usePauseTaskMutation,
  useResumeTaskMutation,
} from '@/features/tasks/tasksApi';
import { useGetAccountsQuery } from '@/features/accounts/accountsApi';
import { setFilter } from '@/features/tasks/tasksSlice';
import { TaskList, TaskDetailModal, TaskFilters } from '@/features/tasks/components';
import type { Task } from '@/features/tasks/tasksApi';

const TasksPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { filter } = useAppSelector((state) => state.tasks);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<Task['status'] | 'all'>('all');

  // API Queries
  const { data, isLoading, refetch } = useGetTasksQuery({
    status: filter.status !== 'all' ? (filter.status as any) : undefined,
    type: filter.type !== 'all' ? (filter.type as any) : undefined,
    accountId: filter.accountId || undefined,
    dateFrom: filter.dateRange.start || undefined,
    dateTo: filter.dateRange.end || undefined,
    page: 1,
    pageSize: 100,
  });

  const { data: accountsData } = useGetAccountsQuery({
    page: 1,
    pageSize: 100,
  });

  // Mutations
  const [cancelTask] = useCancelTaskMutation();
  const [retryTask] = useRetryTaskMutation();
  const [pauseTask] = usePauseTaskMutation();
  const [resumeTask] = useResumeTaskMutation();

  const tasks = data?.items || [];
  const accounts = accountsData?.items || [];

  // 任务统计
  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending' || t.status === 'queued').length,
    running: tasks.filter((t) => t.status === 'processing').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    failed: tasks.filter((t) => t.status === 'failed').length,
    paused: 0, // API 中没有 paused 状态
    avgCompletionTime:
      tasks
        .filter((t) => t.status === 'completed' && t.completedAt && t.startedAt)
        .reduce((sum, t) => {
          const duration = new Date(t.completedAt!).getTime() - new Date(t.startedAt!).getTime();
          return sum + duration;
        }, 0) /
      (tasks.filter((t) => t.status === 'completed').length || 1) /
      1000 /
      60, // 转换为分钟
  };

  const handleViewTask = (task: Task) => {
    setSelectedTask(task);
    setDetailModalVisible(true);
  };

  const handleCancelTask = async (id: string) => {
    try {
      await cancelTask(id).unwrap();
      refetch();
    } catch (error) {
      // 错误已由 RTK Query 处理
    }
  };

  const handleRetryTask = async (id: string, options?: any) => {
    try {
      await retryTask(id).unwrap();
      refetch();
      setDetailModalVisible(false);
    } catch (error) {
      // 错误已由 RTK Query 处理
    }
  };

  const handlePauseTask = async (id: string) => {
    try {
      await pauseTask(id).unwrap();
      refetch();
    } catch (error) {
      // 错误已由 RTK Query 处理
    }
  };

  const handleResumeTask = async (id: string) => {
    try {
      await resumeTask(id).unwrap();
      refetch();
    } catch (error) {
      // 错误已由 RTK Query 处理
    }
  };

  const handleFilterChange = (newFilter: Partial<typeof filter>) => {
    dispatch(setFilter(newFilter));
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key as any);
    if (key !== 'all') {
      handleFilterChange({ status: key as any });
    } else {
      handleFilterChange({ status: 'all' });
    }
  };

  const getTasksByTab = (status: string) => {
    if (status === 'all') return tasks;
    // Map UI status to API status
    const statusMap: Record<string, Task['status'][]> = {
      'pending': ['pending', 'queued'],
      'running': ['processing'],
      'completed': ['completed'],
      'failed': ['failed'],
      'cancelled': ['cancelled']
    };
    const mappedStatuses = statusMap[status] || [status as Task['status']];
    return tasks.filter((t) => mappedStatuses.includes(t.status));
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* 统计卡片 */}
      <Row gutter={16}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="总任务数" value={stats.total} prefix={<BarChartOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="运行中"
              value={stats.running}
              valueStyle={{ color: '#1890ff' }}
              prefix={<SyncOutlined spin />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="已完成"
              value={stats.completed}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="失败"
              value={stats.failed}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 过滤器 */}
      <Card>
        <TaskFilters
          filters={filter}
          accounts={accounts}
          onFilterChange={handleFilterChange}
          onSearch={() => {}}
          onRefresh={refetch}
          loading={isLoading}
        />
      </Card>

      {/* 任务列表 */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={[
            {
              key: 'all',
              label: (
                <span>
                  全部
                  <span style={{ marginLeft: 8, color: '#999' }}>({stats.total})</span>
                </span>
              ),
              children: (
                <TaskList
                  tasks={getTasksByTab('all')}
                  loading={isLoading}
                  onView={handleViewTask}
                  onRetry={handleRetryTask}
                  onCancel={handleCancelTask}
                  onPause={handlePauseTask}
                  onResume={handleResumeTask}
                />
              ),
            },
            {
              key: 'pending',
              label: (
                <span>
                  <ClockCircleOutlined /> 等待中
                  <span style={{ marginLeft: 8, color: '#999' }}>({stats.pending})</span>
                </span>
              ),
              children: (
                <TaskList
                  tasks={getTasksByTab('pending')}
                  loading={isLoading}
                  onView={handleViewTask}
                  onRetry={handleRetryTask}
                  onCancel={handleCancelTask}
                  onPause={handlePauseTask}
                  onResume={handleResumeTask}
                />
              ),
            },
            {
              key: 'running',
              label: (
                <span>
                  <SyncOutlined spin /> 运行中
                  <span style={{ marginLeft: 8, color: '#999' }}>({stats.running})</span>
                </span>
              ),
              children: (
                <TaskList
                  tasks={getTasksByTab('running')}
                  loading={isLoading}
                  onView={handleViewTask}
                  onRetry={handleRetryTask}
                  onCancel={handleCancelTask}
                  onPause={handlePauseTask}
                  onResume={handleResumeTask}
                />
              ),
            },
            {
              key: 'completed',
              label: (
                <span>
                  <CheckCircleOutlined /> 已完成
                  <span style={{ marginLeft: 8, color: '#999' }}>({stats.completed})</span>
                </span>
              ),
              children: (
                <TaskList
                  tasks={getTasksByTab('completed')}
                  loading={isLoading}
                  onView={handleViewTask}
                  onRetry={handleRetryTask}
                  onCancel={handleCancelTask}
                  onPause={handlePauseTask}
                  onResume={handleResumeTask}
                />
              ),
            },
            {
              key: 'failed',
              label: (
                <span>
                  <ExclamationCircleOutlined /> 失败
                  <span style={{ marginLeft: 8, color: '#999' }}>({stats.failed})</span>
                </span>
              ),
              children: (
                <TaskList
                  tasks={getTasksByTab('failed')}
                  loading={isLoading}
                  onView={handleViewTask}
                  onRetry={handleRetryTask}
                  onCancel={handleCancelTask}
                  onPause={handlePauseTask}
                  onResume={handleResumeTask}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* 任务详情模态框 */}
      <TaskDetailModal
        visible={detailModalVisible}
        task={selectedTask}
        onCancel={() => setDetailModalVisible(false)}
        onRetry={handleRetryTask}
      />
    </Space>
  );
};

export default TasksPage;
