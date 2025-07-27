import React, { useState } from 'react';
import {
  Card,
  Form,
  Select,
  DatePicker,
  Button,
  Space,
  Table,
  Tag,
  Modal,
  Input,
  Radio,
  message,
  Tooltip,
  Alert,
  Spin,
} from 'antd';
import {
  FileTextOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  DownloadOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ClockCircleOutlined,
  MailOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import {
  useGenerateReportMutation,
  useGetScheduledReportsQuery,
  useCreateScheduledReportMutation,
  useDeleteScheduledReportMutation,
} from '@/features/monitoring/monitoringApi';
import type { ColumnsType } from 'antd/es/table';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

interface ScheduledReport {
  id: string;
  name: string;
  type: string;
  schedule: string;
  recipients: string[];
  lastGenerated: string;
  nextGeneration: string;
}

const ReportGeneration: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [scheduleForm] = Form.useForm();
  const [isScheduleModalVisible, setIsScheduleModalVisible] = useState(false);
  const [editingReport, setEditingReport] = useState<ScheduledReport | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);

  // API hooks
  const [generateReport, { isLoading: isGenerating }] = useGenerateReportMutation();
  const { data: scheduledReports, isLoading: isLoadingReports } = useGetScheduledReportsQuery();
  const [createScheduledReport, { isLoading: isCreating }] = useCreateScheduledReportMutation();
  const [deleteScheduledReport] = useDeleteScheduledReportMutation();

  // Handle instant report generation
  const handleGenerateReport = async (values: {
    reportType: string;
    timeRange?: string;
    dateRange: [dayjs.Dayjs, dayjs.Dayjs];
    format: string;
  }) => {
    try {
      const params = {
        type: values.reportType as 'accounts' | 'uploads' | 'system' | 'performance',
        timeRange: values.timeRange as '24h' | '7d' | '30d' | 'custom' | undefined,
        format: values.format as 'json' | 'csv' | 'pdf',
        customDateRange:
          values.timeRange === 'custom'
            ? {
                start: values.dateRange[0].toISOString(),
                end: values.dateRange[1].toISOString(),
              }
            : undefined,
        filters: {
          accountIds: selectedAccounts.length > 0 ? selectedAccounts : undefined,
        },
      };

      const blob = await generateReport(params).unwrap();

      // Download the file
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `report_${values.reportType}_${dayjs().format('YYYY-MM-DD_HH-mm')}.${values.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      message.success(t('monitoring.reportGeneratedSuccess'));
    } catch {
      message.error(t('monitoring.reportGenerationFailed'));
    }
  };

  // Handle scheduled report creation
  const handleCreateScheduledReport = async (values: {
    name: string;
    reportType: string;
    schedule: string;
    recipients: string;
    timeRange: string;
    format: string;
  }) => {
    try {
      await createScheduledReport({
        name: values.name,
        type: values.reportType,
        schedule: values.schedule,
        recipients: values.recipients.split(',').map((email: string) => email.trim()),
        config: {
          type: values.reportType,
          timeRange: values.timeRange,
          format: values.format,
        },
      }).unwrap();

      message.success(t('monitoring.scheduledReportCreated'));
      setIsScheduleModalVisible(false);
      scheduleForm.resetFields();
    } catch {
      message.error(t('monitoring.scheduledReportCreationFailed'));
    }
  };

  // Handle scheduled report deletion
  const handleDeleteScheduledReport = (id: string) => {
    Modal.confirm({
      title: t('monitoring.confirmDeleteReport'),
      content: t('monitoring.deleteReportWarning'),
      onOk: async () => {
        try {
          await deleteScheduledReport(id).unwrap();
          message.success(t('monitoring.reportDeleted'));
        } catch {
          message.error(t('monitoring.reportDeletionFailed'));
        }
      },
    });
  };

  // Get schedule description
  const getScheduleDescription = (schedule: string) => {
    const scheduleMap: { [key: string]: string } = {
      daily: t('monitoring.daily'),
      weekly: t('monitoring.weekly'),
      monthly: t('monitoring.monthly'),
    };
    return scheduleMap[schedule] || schedule;
  };

  // Scheduled reports table columns
  const columns: ColumnsType<ScheduledReport> = [
    {
      title: t('monitoring.reportName'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <Space>
          <FileTextOutlined />
          <span className="font-medium">{name}</span>
          <Tag>{record.type}</Tag>
        </Space>
      ),
    },
    {
      title: t('monitoring.schedule'),
      dataIndex: 'schedule',
      key: 'schedule',
      render: (schedule: string) => (
        <Space>
          <ClockCircleOutlined />
          <span>{getScheduleDescription(schedule)}</span>
        </Space>
      ),
    },
    {
      title: t('monitoring.recipients'),
      dataIndex: 'recipients',
      key: 'recipients',
      render: (recipients: string[]) => (
        <Space size={4} wrap>
          <MailOutlined />
          <span>
            {recipients.length} {t('monitoring.recipients')}
          </span>
          <Tooltip title={recipients.join(', ')}>
            <Button type="link" size="small">
              {t('common.view')}
            </Button>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: t('monitoring.lastGenerated'),
      dataIndex: 'lastGenerated',
      key: 'lastGenerated',
      render: (date: string) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: t('monitoring.nextGeneration'),
      dataIndex: 'nextGeneration',
      key: 'nextGeneration',
      render: (date: string) => (
        <span className="text-blue-600">{dayjs(date).format('YYYY-MM-DD HH:mm')}</span>
      ),
    },
    {
      title: t('monitoring.actions'),
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title={t('common.edit')}>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingReport(record);
                setIsScheduleModalVisible(true);
              }}
            />
          </Tooltip>
          <Tooltip title={t('common.delete')}>
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteScheduledReport(record.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="report-generation">
      {/* Instant Report Generation */}
      <Card title={t('monitoring.generateInstantReport')} className="mb-6">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleGenerateReport}
          initialValues={{
            reportType: 'performance',
            timeRange: '24h',
            format: 'pdf',
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Form.Item
              name="reportType"
              label={t('monitoring.reportType')}
              rules={[{ required: true }]}
            >
              <Select>
                <Option value="performance">{t('monitoring.performanceReport')}</Option>
                <Option value="uploads">{t('monitoring.uploadsReport')}</Option>
                <Option value="accounts">{t('monitoring.accountsReport')}</Option>
                <Option value="system">{t('monitoring.systemReport')}</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="timeRange"
              label={t('monitoring.timeRange')}
              rules={[{ required: true }]}
            >
              <Select
                onChange={(value) => {
                  if (value !== 'custom') {
                    form.setFieldsValue({ dateRange: undefined });
                  }
                }}
              >
                <Option value="24h">{t('monitoring.last24Hours')}</Option>
                <Option value="7d">{t('monitoring.last7Days')}</Option>
                <Option value="30d">{t('monitoring.last30Days')}</Option>
                <Option value="custom">{t('monitoring.custom')}</Option>
              </Select>
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) =>
                prevValues.timeRange !== currentValues.timeRange
              }
            >
              {({ getFieldValue }) =>
                getFieldValue('timeRange') === 'custom' ? (
                  <Form.Item
                    name="dateRange"
                    label={t('monitoring.dateRange')}
                    rules={[{ required: true }]}
                  >
                    <RangePicker className="w-full" />
                  </Form.Item>
                ) : null
              }
            </Form.Item>

            <Form.Item name="format" label={t('monitoring.format')} rules={[{ required: true }]}>
              <Radio.Group>
                <Radio.Button value="pdf">
                  <FilePdfOutlined /> PDF
                </Radio.Button>
                <Radio.Button value="csv">
                  <FileExcelOutlined /> CSV
                </Radio.Button>
                <Radio.Button value="json">
                  <FileTextOutlined /> JSON
                </Radio.Button>
              </Radio.Group>
            </Form.Item>
          </div>

          <Alert
            message={t('monitoring.reportInfo')}
            description={t('monitoring.reportInfoDescription')}
            type="info"
            showIcon
            className="mb-4"
          />

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<DownloadOutlined />}
              loading={isGenerating}
              size="large"
            >
              {t('monitoring.generateReport')}
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Scheduled Reports */}
      <Card
        title={t('monitoring.scheduledReports')}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingReport(null);
              setIsScheduleModalVisible(true);
            }}
          >
            {t('monitoring.createSchedule')}
          </Button>
        }
      >
        {isLoadingReports ? (
          <div className="text-center py-8">
            <Spin size="large" />
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={scheduledReports || []}
            rowKey="id"
            pagination={false}
          />
        )}
      </Card>

      {/* Schedule Modal */}
      <Modal
        title={
          editingReport
            ? t('monitoring.editScheduledReport')
            : t('monitoring.createScheduledReport')
        }
        visible={isScheduleModalVisible}
        onCancel={() => {
          setIsScheduleModalVisible(false);
          scheduleForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={scheduleForm}
          layout="vertical"
          onFinish={handleCreateScheduledReport}
          initialValues={
            editingReport || {
              reportType: 'performance',
              timeRange: '24h',
              format: 'pdf',
              schedule: 'weekly',
            }
          }
        >
          <Form.Item name="name" label={t('monitoring.reportName')} rules={[{ required: true }]}>
            <Input placeholder={t('monitoring.enterReportName')} />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="reportType"
              label={t('monitoring.reportType')}
              rules={[{ required: true }]}
            >
              <Select>
                <Option value="performance">{t('monitoring.performanceReport')}</Option>
                <Option value="uploads">{t('monitoring.uploadsReport')}</Option>
                <Option value="accounts">{t('monitoring.accountsReport')}</Option>
                <Option value="system">{t('monitoring.systemReport')}</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="schedule"
              label={t('monitoring.frequency')}
              rules={[{ required: true }]}
            >
              <Select>
                <Option value="daily">{t('monitoring.daily')}</Option>
                <Option value="weekly">{t('monitoring.weekly')}</Option>
                <Option value="monthly">{t('monitoring.monthly')}</Option>
              </Select>
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="timeRange"
              label={t('monitoring.dataRange')}
              rules={[{ required: true }]}
            >
              <Select>
                <Option value="24h">{t('monitoring.last24Hours')}</Option>
                <Option value="7d">{t('monitoring.last7Days')}</Option>
                <Option value="30d">{t('monitoring.last30Days')}</Option>
              </Select>
            </Form.Item>

            <Form.Item name="format" label={t('monitoring.format')} rules={[{ required: true }]}>
              <Select>
                <Option value="pdf">PDF</Option>
                <Option value="csv">CSV</Option>
                <Option value="json">JSON</Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item
            name="recipients"
            label={t('monitoring.emailRecipients')}
            rules={[{ required: true }]}
            extra={t('monitoring.separateEmailsWithComma')}
          >
            <TextArea rows={3} placeholder="user1@example.com, user2@example.com" />
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => setIsScheduleModalVisible(false)}>{t('common.cancel')}</Button>
              <Button type="primary" htmlType="submit" loading={isCreating}>
                {editingReport ? t('common.save') : t('common.create')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ReportGeneration;
