import React, { useState } from 'react';
import {
  Card,
  Button,
  Space,
  Input,
  Select,
  Badge,
  Statistic,
  Row,
  Col,
  message,
  Modal,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  ImportOutlined,
  SearchOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import {
  useGetAccountsQuery,
  useCreateAccountMutation,
  useUpdateAccountMutation,
  useDeleteAccountMutation,
  useDeleteAccountsMutation,
  useImportAccountsMutation,
  useExportAccountsMutation,
} from '@/features/accounts/accountsApi';
import { setFilter, setSelectedIds, clearSelection } from '@/features/accounts/accountsSlice';
import {
  AccountList,
  AccountFormModal,
  ImportExportModal,
  type AccountFormValues,
} from '@/features/accounts/components';
import type { Account } from '@/features/accounts/accountsSlice';

const { Search } = Input;

const AccountsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { filter, selectedIds } = useAppSelector((state) => state.accounts);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [importExportVisible, setImportExportVisible] = useState(false);

  // API Queries
  const { data, isLoading, refetch } = useGetAccountsQuery({
    status: filter.status,
    search: filter.search,
    page: 1,
    pageSize: 100, // 暂时获取所有，后续优化分页
  });

  // Mutations
  const [createAccount, { isLoading: creating }] = useCreateAccountMutation();
  const [updateAccount, { isLoading: updating }] = useUpdateAccountMutation();
  const [deleteAccount] = useDeleteAccountMutation();
  const [deleteAccounts] = useDeleteAccountsMutation();
  const [importAccounts] = useImportAccountsMutation();
  const [exportAccounts] = useExportAccountsMutation();

  const accounts = data?.items || [];

  // 统计数据
  const stats = {
    total: accounts.length,
    active: accounts.filter((a) => a.status === 'active').length,
    inactive: accounts.filter((a) => a.status === 'inactive').length,
    suspended: accounts.filter((a) => a.status === 'suspended').length,
    error: accounts.filter((a) => a.status === 'error').length,
    withProxy: accounts.filter((a) => a.proxy).length,
    avgHealthScore:
      accounts.length > 0
        ? Math.round(accounts.reduce((sum, a) => sum + a.healthScore, 0) / accounts.length)
        : 0,
  };

  const handleCreate = () => {
    setEditingAccount(null);
    setFormModalVisible(true);
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setFormModalVisible(true);
  };

  const handleFormSubmit = async (values: AccountFormValues) => {
    try {
      if (editingAccount) {
        await updateAccount({
          id: editingAccount.id,
          data: values,
        }).unwrap();
        message.success('账户更新成功');
      } else {
        await createAccount(values).unwrap();
        message.success('账户创建成功');
      }
      setFormModalVisible(false);
      refetch();
    } catch {
      message.error(editingAccount ? '更新失败' : '创建失败');
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个账户吗？此操作不可恢复。',
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteAccount(id).unwrap();
          message.success('账户删除成功');
          refetch();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const handleBulkDelete = async (ids: string[]) => {
    Modal.confirm({
      title: '批量删除',
      content: `确定要删除选中的 ${ids.length} 个账户吗？此操作不可恢复。`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteAccounts(ids).unwrap();
          message.success(`成功删除 ${ids.length} 个账户`);
          dispatch(clearSelection());
          refetch();
        } catch {
          message.error('批量删除失败');
        }
      },
    });
  };

  const handleStatusChange = async (id: string, status: Account['status']) => {
    try {
      await updateAccount({
        id,
        data: { status } as any,
      }).unwrap();
      message.success('状态更新成功');
      refetch();
    } catch {
      message.error('状态更新失败');
    }
  };

  const handleImport = async (file: File, format: 'csv' | 'json') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('format', format);

    const result = await importAccounts({
      file: file,
      format: format,
    } as any).unwrap();
    refetch();
    return result;
  };

  const handleExport = async (format: 'csv' | 'json', includePasswords: boolean) => {
    try {
      await exportAccounts({ format, includePasswords });
      // API 应该返回文件URL或直接触发下载
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* 统计卡片 */}
      <Row gutter={16}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="总账户数" value={stats.total} prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="活跃账户"
              value={stats.active}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="异常账户"
              value={stats.error}
              valueStyle={{ color: '#cf1322' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="平均健康度"
              value={stats.avgHealthScore}
              suffix="%"
              valueStyle={{ color: stats.avgHealthScore >= 60 ? '#3f8600' : '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 操作栏 */}
      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <Space wrap>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              新建账户
            </Button>
            <Button icon={<ImportOutlined />} onClick={() => setImportExportVisible(true)}>
              导入/导出
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>
              刷新
            </Button>
          </Space>

          <Space wrap>
            <Select
              value={filter.status}
              onChange={(value) => dispatch(setFilter({ status: value }))}
              style={{ width: 120 }}
            >
              <Select.Option value="all">
                <Badge color="default" text="全部" />
              </Select.Option>
              <Select.Option value="active">
                <Badge color="success" text="活跃" />
              </Select.Option>
              <Select.Option value="inactive">
                <Badge color="default" text="未激活" />
              </Select.Option>
              <Select.Option value="suspended">
                <Badge color="warning" text="已暂停" />
              </Select.Option>
              <Select.Option value="error">
                <Badge color="error" text="错误" />
              </Select.Option>
            </Select>

            <Search
              placeholder="搜索用户名或邮箱"
              allowClear
              enterButton={<SearchOutlined />}
              value={filter.search}
              onChange={(e) => dispatch(setFilter({ search: e.target.value }))}
              style={{ width: 250 }}
            />
          </Space>
        </div>
      </Card>

      {/* 账户列表 */}
      <Card>
        <AccountList
          accounts={accounts}
          loading={isLoading}
          selectedIds={selectedIds}
          onSelect={(ids) => dispatch(setSelectedIds(ids))}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onBulkDelete={handleBulkDelete}
          onStatusChange={handleStatusChange}
        />
      </Card>

      {/* 表单模态框 */}
      <AccountFormModal
        visible={formModalVisible}
        account={editingAccount}
        loading={creating || updating}
        onCancel={() => setFormModalVisible(false)}
        onSubmit={handleFormSubmit}
      />

      {/* 导入导出模态框 */}
      <ImportExportModal
        visible={importExportVisible}
        accounts={accounts}
        onCancel={() => setImportExportVisible(false)}
        onImport={handleImport}
        onExport={handleExport}
      />
    </Space>
  );
};

export default AccountsPage;
