import React, { useState, useMemo } from 'react';
import { Card, Table, Tag, Progress, Space, Select, Button, Tooltip, Avatar } from 'antd';
import {
  TrophyOutlined,
  CrownOutlined,
  FireOutlined,
  RiseOutlined,
  FallOutlined,
  UserOutlined,
  ExportOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/hooks/redux';
import { selectUploadStatistics, selectTimeRange } from '@/features/monitoring/monitoringSlice';
import { useGetUploadStatisticsQuery } from '@/features/monitoring/monitoringApi';
import type { ColumnsType } from 'antd/es/table';

const { Option } = Select;

interface AccountPerformanceData {
  accountId: string;
  username: string;
  uploadsCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageUploadTime: number;
  rank?: number;
  trend?: 'up' | 'down' | 'stable';
  avatar?: string;
}

const AccountPerformanceRanking: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<'uploads' | 'successRate' | 'avgTime'>('uploads');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const timeRange = useAppSelector(selectTimeRange);
  const uploadStats = useAppSelector(selectUploadStatistics);

  // Fetch statistics
  const { refetch, isLoading } = useGetUploadStatisticsQuery({ timeRange });

  // Process and rank accounts
  const rankedAccounts = useMemo(() => {
    if (!uploadStats?.accountPerformance) return [];

    let accounts = [...uploadStats.accountPerformance];

    // Apply filters
    if (filterStatus === 'active') {
      accounts = accounts.filter((acc) => acc.uploadsCount > 0);
    } else if (filterStatus === 'inactive') {
      accounts = accounts.filter((acc) => acc.uploadsCount === 0);
    }

    // Sort based on selected criteria
    switch (sortBy) {
      case 'uploads':
        accounts.sort((a, b) => b.uploadsCount - a.uploadsCount);
        break;
      case 'successRate':
        accounts.sort((a, b) => b.successRate - a.successRate);
        break;
      case 'avgTime':
        accounts.sort((a, b) => a.averageUploadTime - b.averageUploadTime);
        break;
    }

    // Add rank and mock trend data
    return accounts.map((account, index) => ({
      ...account,
      rank: index + 1,
      trend: Math.random() > 0.5 ? 'up' : Math.random() > 0.5 ? 'down' : 'stable',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${account.username}`,
    }));
  }, [uploadStats, sortBy, filterStatus]);

  // Get medal icon based on rank
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <CrownOutlined style={{ color: '#ffd700', fontSize: 20 }} />;
      case 2:
        return <TrophyOutlined style={{ color: '#c0c0c0', fontSize: 18 }} />;
      case 3:
        return <TrophyOutlined style={{ color: '#cd7f32', fontSize: 18 }} />;
      default:
        return rank <= 10 ? <FireOutlined style={{ color: '#ff6b6b', fontSize: 16 }} /> : null;
    }
  };

  // Get performance color
  const getPerformanceColor = (rate: number) => {
    if (rate >= 90) return '#52c41a';
    if (rate >= 70) return '#faad14';
    return '#ff4d4f';
  };

  const columns: ColumnsType<AccountPerformanceData> = [
    {
      title: t('monitoring.rank'),
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      fixed: 'left',
      render: (rank: number) => (
        <Space>
          {getRankIcon(rank)}
          <span className={rank <= 3 ? 'font-bold text-lg' : ''}>#{rank}</span>
        </Space>
      ),
    },
    {
      title: t('monitoring.account'),
      dataIndex: 'username',
      key: 'username',
      width: 200,
      render: (username: string, record) => (
        <Space>
          <Avatar src={record.avatar} icon={<UserOutlined />} />
          <div>
            <div className="font-medium">{username}</div>
            <div className="text-xs text-gray-500">{record.accountId.slice(0, 8)}...</div>
          </div>
          {record.trend === 'up' && <RiseOutlined style={{ color: '#52c41a' }} />}
          {record.trend === 'down' && <FallOutlined style={{ color: '#ff4d4f' }} />}
        </Space>
      ),
    },
    {
      title: t('monitoring.totalUploads'),
      dataIndex: 'uploadsCount',
      key: 'uploadsCount',
      sorter: (a, b) => a.uploadsCount - b.uploadsCount,
      render: (count: number) => <span className="font-medium">{count.toLocaleString()}</span>,
    },
    {
      title: t('monitoring.successful'),
      dataIndex: 'successCount',
      key: 'successCount',
      render: (count: number) => <Tag color="green">{count.toLocaleString()}</Tag>,
    },
    {
      title: t('monitoring.failed'),
      dataIndex: 'failureCount',
      key: 'failureCount',
      render: (count: number) => <Tag color="red">{count.toLocaleString()}</Tag>,
    },
    {
      title: t('monitoring.successRate'),
      dataIndex: 'successRate',
      key: 'successRate',
      width: 200,
      sorter: (a, b) => a.successRate - b.successRate,
      render: (rate: number) => (
        <div>
          <Progress
            percent={rate}
            strokeColor={getPerformanceColor(rate)}
            format={(percent) => `${percent?.toFixed(1)}%`}
            size="small"
          />
        </div>
      ),
    },
    {
      title: t('monitoring.avgUploadTime'),
      dataIndex: 'averageUploadTime',
      key: 'averageUploadTime',
      sorter: (a, b) => a.averageUploadTime - b.averageUploadTime,
      render: (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = time % 60;
        return (
          <Tooltip title={t('monitoring.averageTimeTooltip')}>
            <span>{minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`}</span>
          </Tooltip>
        );
      },
    },
    {
      title: t('monitoring.actions'),
      key: 'actions',
      fixed: 'right',
      width: 100,
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => navigate(`/accounts/${record.accountId}`)}>
          {t('common.viewDetails')}
        </Button>
      ),
    },
  ];

  // Calculate top performers summary
  const topPerformers = rankedAccounts.slice(0, 3);

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Export account performance data');
  };

  return (
    <div className="account-performance-ranking">
      {/* Controls */}
      <Card className="mb-4">
        <Space className="w-full justify-between" wrap>
          <Space>
            <Select
              value={sortBy}
              onChange={setSortBy}
              style={{ width: 150 }}
              placeholder={t('monitoring.sortBy')}
            >
              <Option value="uploads">{t('monitoring.uploads')}</Option>
              <Option value="successRate">{t('monitoring.successRate')}</Option>
              <Option value="avgTime">{t('monitoring.uploadTime')}</Option>
            </Select>
            <Select
              value={filterStatus}
              onChange={setFilterStatus}
              style={{ width: 120 }}
              placeholder={t('monitoring.filter')}
            >
              <Option value="all">{t('common.all')}</Option>
              <Option value="active">{t('monitoring.active')}</Option>
              <Option value="inactive">{t('monitoring.inactive')}</Option>
            </Select>
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>
              {t('common.refresh')}
            </Button>
            <Button icon={<ExportOutlined />} onClick={handleExport}>
              {t('common.export')}
            </Button>
          </Space>
        </Space>
      </Card>

      {/* Top Performers Highlight */}
      {topPerformers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {topPerformers.map((account, index) => (
            <Card
              key={account.accountId}
              className={`text-center ${index === 0 ? 'border-yellow-400 border-2' : ''}`}
              bodyStyle={{ padding: '20px' }}
            >
              <div className="mb-3">{getRankIcon(index + 1)}</div>
              <Avatar size={64} src={account.avatar} icon={<UserOutlined />} className="mb-3" />
              <h3 className="text-lg font-semibold mb-1">{account.username}</h3>
              <div className="text-sm text-gray-500 mb-3">
                {account.uploadsCount} {t('monitoring.uploads')}
              </div>
              <Progress
                type="circle"
                percent={account.successRate}
                width={80}
                strokeColor={getPerformanceColor(account.successRate)}
                format={(percent) => `${percent?.toFixed(1)}%`}
              />
            </Card>
          ))}
        </div>
      )}

      {/* Performance Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={rankedAccounts}
          rowKey="accountId"
          loading={isLoading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => t('common.totalItems', { total }),
          }}
          scroll={{ x: 1000 }}
          rowClassName={(record) => {
            if (record.rank === 1) return 'bg-yellow-50';
            if (record.rank === 2) return 'bg-gray-50';
            if (record.rank === 3) return 'bg-orange-50';
            return '';
          }}
        />
      </Card>
    </div>
  );
};

export default AccountPerformanceRanking;
