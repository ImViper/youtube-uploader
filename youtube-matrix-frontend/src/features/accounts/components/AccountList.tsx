import React, { useState } from 'react';
import { Table, Tag, Space, Button, Tooltip, Progress, Avatar, Dropdown } from 'antd';
import type { ColumnsType, TableRowSelection } from 'antd/es/table/interface';
import {
  UserOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PauseCircleOutlined,
  ExclamationCircleOutlined,
  GlobalOutlined,
  UploadOutlined,
  PercentageOutlined,
} from '@ant-design/icons';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { Account } from '../accountsSlice';

interface AccountListProps {
  accounts: Account[];
  loading?: boolean;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onEdit: (account: Account) => void;
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onStatusChange: (id: string, status: Account['status']) => void;
}

const getStatusColor = (status: Account['status']) => {
  switch (status) {
    case 'active':
      return 'success';
    case 'inactive':
      return 'default';
    case 'suspended':
      return 'warning';
    case 'error':
      return 'error';
    default:
      return 'default';
  }
};

const getStatusIcon = (status: Account['status']) => {
  switch (status) {
    case 'active':
      return <CheckCircleOutlined />;
    case 'inactive':
      return <PauseCircleOutlined />;
    case 'suspended':
      return <ExclamationCircleOutlined />;
    case 'error':
      return <CloseCircleOutlined />;
    default:
      return null;
  }
};

const getHealthScoreColor = (score: number) => {
  if (score >= 80) return '#52c41a';
  if (score >= 60) return '#faad14';
  if (score >= 40) return '#fa8c16';
  return '#ff4d4f';
};

const AccountList: React.FC<AccountListProps> = ({
  accounts,
  loading = false,
  selectedIds,
  onSelect,
  onEdit,
  onDelete,
  onBulkDelete,
  onStatusChange,
}) => {
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);

  const rowSelection: TableRowSelection<Account> = {
    selectedRowKeys: selectedIds,
    onChange: (selectedRowKeys) => {
      onSelect(selectedRowKeys as string[]);
    },
    getCheckboxProps: (record) => ({
      disabled: record.status === 'suspended',
    }),
  };

  const handleMenuClick = (key: string, record: Account) => {
    switch (key) {
      case 'edit':
        onEdit(record);
        break;
      case 'delete':
        onDelete(record.id);
        break;
      case 'activate':
        onStatusChange(record.id, 'active');
        break;
      case 'deactivate':
        onStatusChange(record.id, 'inactive');
        break;
      case 'suspend':
        onStatusChange(record.id, 'suspended');
        break;
      default:
        break;
    }
  };

  const columns: ColumnsType<Account> = [
    {
      title: '账户信息',
      dataIndex: 'username',
      key: 'username',
      fixed: 'left',
      width: 250,
      render: (username, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }}>
            {username.charAt(0).toUpperCase()}
          </Avatar>
          <div>
            <div style={{ fontWeight: 500 }}>{username}</div>
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>{record.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      filters: [
        { text: '活跃', value: 'active' },
        { text: '未激活', value: 'inactive' },
        { text: '已暂停', value: 'suspended' },
        { text: '错误', value: 'error' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status) => (
        <Tag color={getStatusColor(status)} icon={getStatusIcon(status)}>
          {status === 'active' && '活跃'}
          {status === 'inactive' && '未激活'}
          {status === 'suspended' && '已暂停'}
          {status === 'error' && '错误'}
        </Tag>
      ),
    },
    {
      title: '健康度',
      dataIndex: 'healthScore',
      key: 'healthScore',
      width: 150,
      sorter: (a, b) => a.healthScore - b.healthScore,
      render: (score) => (
        <Space>
          <Progress
            type="circle"
            percent={score}
            width={40}
            strokeColor={getHealthScoreColor(score)}
            format={(percent) => `${percent}`}
          />
          <div>
            {score >= 80 && <span style={{ color: '#52c41a' }}>优秀</span>}
            {score >= 60 && score < 80 && <span style={{ color: '#faad14' }}>良好</span>}
            {score >= 40 && score < 60 && <span style={{ color: '#fa8c16' }}>一般</span>}
            {score < 40 && <span style={{ color: '#ff4d4f' }}>较差</span>}
          </div>
        </Space>
      ),
    },
    {
      title: '上传统计',
      key: 'stats',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Space>
            <UploadOutlined />
            <span>总计: {record.uploadsCount}</span>
          </Space>
          <Space>
            <PercentageOutlined />
            <span>成功率: {record.successRate}%</span>
          </Space>
        </Space>
      ),
    },
    {
      title: '代理',
      dataIndex: 'proxy',
      key: 'proxy',
      width: 150,
      render: (proxy) =>
        proxy ? (
          <Tooltip title={`${proxy.host}:${proxy.port}`}>
            <Tag icon={<GlobalOutlined />} color="blue">
              已配置
            </Tag>
          </Tooltip>
        ) : (
          <Tag color="default">未配置</Tag>
        ),
    },
    {
      title: '最后活跃',
      dataIndex: 'lastActive',
      key: 'lastActive',
      width: 150,
      sorter: (a, b) => {
        if (!a.lastActive) return 1;
        if (!b.lastActive) return -1;
        return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
      },
      render: (lastActive) =>
        lastActive ? (
          <Tooltip title={new Date(lastActive).toLocaleString('zh-CN')}>
            {formatDistanceToNow(new Date(lastActive), {
              addSuffix: true,
              locale: zhCN,
            })}
          </Tooltip>
        ) : (
          <span style={{ color: '#8c8c8c' }}>从未</span>
        ),
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 120,
      render: (_, record) => {
        const menuItems = [
          {
            key: 'edit',
            icon: <EditOutlined />,
            label: '编辑',
          },
          {
            type: 'divider' as const,
          },
          {
            key: 'activate',
            icon: <CheckCircleOutlined />,
            label: '激活',
            disabled: record.status === 'active',
          },
          {
            key: 'deactivate',
            icon: <PauseCircleOutlined />,
            label: '停用',
            disabled: record.status === 'inactive',
          },
          {
            key: 'suspend',
            icon: <ExclamationCircleOutlined />,
            label: '暂停',
            disabled: record.status === 'suspended',
          },
          {
            type: 'divider' as const,
          },
          {
            key: 'delete',
            icon: <DeleteOutlined />,
            label: '删除',
            danger: true,
          },
        ];

        return (
          <Space size="middle">
            <Button type="link" icon={<EditOutlined />} onClick={() => onEdit(record)} />
            <Dropdown
              menu={{
                items: menuItems,
                onClick: ({ key }) => handleMenuClick(key, record),
              }}
              trigger={['click']}
            >
              <Button type="link" icon={<MoreOutlined />} />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  const expandedRowRender = (record: Account) => {
    return (
      <div style={{ padding: '16px 0' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {record.notes && (
            <div>
              <strong>备注：</strong>
              <span style={{ marginLeft: 8 }}>{record.notes}</span>
            </div>
          )}
          <div>
            <strong>创建时间：</strong>
            <span style={{ marginLeft: 8 }}>
              {new Date(record.createdAt).toLocaleString('zh-CN')}
            </span>
          </div>
          <div>
            <strong>更新时间：</strong>
            <span style={{ marginLeft: 8 }}>
              {new Date(record.updatedAt).toLocaleString('zh-CN')}
            </span>
          </div>
          {record.proxy && (
            <div>
              <strong>代理详情：</strong>
              <span style={{ marginLeft: 8 }}>
                {record.proxy.host}:{record.proxy.port}
                {record.proxy.username && ` (用户: ${record.proxy.username})`}
              </span>
            </div>
          )}
        </Space>
      </div>
    );
  };

  return (
    <>
      {selectedIds.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Space>
            <span>已选择 {selectedIds.length} 个账户</span>
            <Button danger onClick={() => onBulkDelete(selectedIds)} icon={<DeleteOutlined />}>
              批量删除
            </Button>
            <Button onClick={() => onSelect([])}>取消选择</Button>
          </Space>
        </div>
      )}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={accounts}
        loading={loading}
        rowSelection={rowSelection}
        expandable={{
          expandedRowRender,
          expandedRowKeys,
          onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as string[]),
          rowExpandable: (record) => !!record.notes || !!record.proxy,
        }}
        scroll={{ x: 1200 }}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          defaultPageSize: 20,
          pageSizeOptions: ['10', '20', '50', '100'],
        }}
      />
    </>
  );
};

export default AccountList;
