import React from 'react';
import { Space, Select, DatePicker, Input, Button } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import type { Task } from '../tasksSlice';

const { RangePicker } = DatePicker;
const { Search } = Input;

interface TaskFiltersProps {
  filters: {
    status: 'all' | Task['status'];
    type: 'all' | Task['type'];
    accountId: string | null;
    dateRange: {
      start: string | null;
      end: string | null;
    };
  };
  accounts?: Array<{ id: string; username: string }>;
  onFilterChange: (filters: any) => void;
  onSearch: (value: string) => void;
  onRefresh: () => void;
  loading?: boolean;
}

const TaskFilters: React.FC<TaskFiltersProps> = ({
  filters,
  accounts = [],
  onFilterChange,
  onSearch,
  onRefresh,
  loading = false,
}) => {
  const handleStatusChange = (value: 'all' | Task['status']) => {
    onFilterChange({ ...filters, status: value });
  };

  const handleTypeChange = (value: 'all' | Task['type']) => {
    onFilterChange({ ...filters, type: value });
  };

  const handleAccountChange = (value: string | null) => {
    onFilterChange({ ...filters, accountId: value });
  };

  const handleDateRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates) {
      onFilterChange({
        ...filters,
        dateRange: {
          start: dates[0]?.toISOString() || null,
          end: dates[1]?.toISOString() || null,
        },
      });
    } else {
      onFilterChange({
        ...filters,
        dateRange: { start: null, end: null },
      });
    }
  };

  return (
    <Space wrap style={{ width: '100%', marginBottom: 16 }}>
      <Select
        value={filters.status}
        onChange={handleStatusChange}
        style={{ width: 120 }}
        placeholder="状态"
      >
        <Select.Option value="all">全部状态</Select.Option>
        <Select.Option value="pending">等待中</Select.Option>
        <Select.Option value="running">执行中</Select.Option>
        <Select.Option value="paused">已暂停</Select.Option>
        <Select.Option value="completed">已完成</Select.Option>
        <Select.Option value="failed">失败</Select.Option>
        <Select.Option value="cancelled">已取消</Select.Option>
      </Select>

      <Select
        value={filters.type}
        onChange={handleTypeChange}
        style={{ width: 120 }}
        placeholder="类型"
      >
        <Select.Option value="all">全部类型</Select.Option>
        <Select.Option value="upload">上传</Select.Option>
        <Select.Option value="update">更新</Select.Option>
        <Select.Option value="comment">评论</Select.Option>
        <Select.Option value="delete">删除</Select.Option>
      </Select>

      <Select
        value={filters.accountId}
        onChange={handleAccountChange}
        style={{ width: 200 }}
        placeholder="选择账户"
        allowClear
        showSearch
        filterOption={(input, option) => {
          const username = accounts.find((a) => a.id === option?.value)?.username;
          if (username) {
            return username.toLowerCase().includes(input.toLowerCase());
          }
          return false;
        }}
      >
        {accounts.map((account) => (
          <Select.Option key={account.id} value={account.id}>
            {account.username}
          </Select.Option>
        ))}
      </Select>

      <RangePicker
        format="YYYY-MM-DD"
        placeholder={['开始日期', '结束日期']}
        onChange={handleDateRangeChange}
      />

      <Search
        placeholder="搜索任务ID或关键词"
        onSearch={onSearch}
        style={{ width: 250 }}
        enterButton={<SearchOutlined />}
      />

      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
    </Space>
  );
};

export default TaskFilters;
