import React, { useState } from 'react';
import { Modal, Tabs, Upload, Button, Alert, Space, Select, Table, Tag, message } from 'antd';
import {
  UploadOutlined,
  DownloadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import type { Account } from '../accountsSlice';

interface ImportExportModalProps {
  visible: boolean;
  accounts?: Account[];
  onCancel: () => void;
  onImport: (file: File, format: 'csv' | 'json') => Promise<ImportResult>;
  onExport: (format: 'csv' | 'json', includePasswords: boolean) => void;
}

interface ImportResult {
  imported: number;
  failed: number;
  errors: Array<{
    row: number;
    error: string;
  }>;
}

const ImportExportModal: React.FC<ImportExportModalProps> = ({
  visible,
  accounts = [],
  onCancel,
  onImport,
  onExport,
}) => {
  const [activeTab, setActiveTab] = useState<string>('import');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [importFormat, setImportFormat] = useState<'csv' | 'json'>('csv');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [includePasswords, setIncludePasswords] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleImportChange = (info: any) => {
    setFileList(info.fileList.slice(-1)); // 只保留最后一个文件
    setImportResult(null);
  };

  const handleImport = async () => {
    if (fileList.length === 0) {
      message.error('请选择要导入的文件');
      return;
    }

    const file = fileList[0].originFileObj as File;
    if (!file) {
      message.error('文件无效');
      return;
    }

    setImporting(true);
    try {
      const result = await onImport(file, importFormat);
      setImportResult(result);

      if (result.imported > 0) {
        message.success(`成功导入 ${result.imported} 个账户`);
      }
      if (result.failed > 0) {
        message.warning(`${result.failed} 个账户导入失败`);
      }
    } catch (error) {
      message.error('导入失败: ' + (error as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const handleExport = () => {
    onExport(exportFormat, includePasswords);
    message.success('导出开始，文件将自动下载');
  };

  const csvTemplate = `username,email,password,proxy_host,proxy_port,proxy_username,proxy_password,cookies,notes
user1,user1@example.com,password123,proxy.example.com,8080,proxyuser,proxypass,,测试账户1
user2,user2@example.com,password456,,,,,,"测试账户2，无代理"`;

  const jsonTemplate = JSON.stringify(
    [
      {
        username: 'user1',
        email: 'user1@example.com',
        password: 'password123',
        proxy: {
          host: 'proxy.example.com',
          port: 8080,
          username: 'proxyuser',
          password: 'proxypass',
        },
        cookies: '',
        notes: '测试账户1',
      },
      {
        username: 'user2',
        email: 'user2@example.com',
        password: 'password456',
        notes: '测试账户2，无代理',
      },
    ],
    null,
    2,
  );

  const downloadTemplate = (format: 'csv' | 'json') => {
    const content = format === 'csv' ? csvTemplate : jsonTemplate;
    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `账户导入模板.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const errorColumns = [
    {
      title: '行号',
      dataIndex: 'row',
      key: 'row',
      width: 80,
    },
    {
      title: '错误信息',
      dataIndex: 'error',
      key: 'error',
      render: (error: string) => <span style={{ color: '#ff4d4f' }}>{error}</span>,
    },
  ];

  return (
    <Modal title="导入/导出账户" open={visible} onCancel={onCancel} width={700} footer={null}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'import',
            label: (
              <span>
                <UploadOutlined />
                导入账户
              </span>
            ),
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <Alert
                  message="导入说明"
                  description={
                    <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                      <li>支持 CSV 和 JSON 格式</li>
                      <li>用户名和邮箱为必填字段</li>
                      <li>重复的用户名或邮箱将被跳过</li>
                      <li>密码字段为空时将生成随机密码</li>
                    </ul>
                  }
                  type="info"
                  showIcon
                />

                <div>
                  <Space>
                    <span>文件格式：</span>
                    <Select value={importFormat} onChange={setImportFormat} style={{ width: 120 }}>
                      <Select.Option value="csv">CSV</Select.Option>
                      <Select.Option value="json">JSON</Select.Option>
                    </Select>
                    <Button
                      icon={<FileTextOutlined />}
                      onClick={() => downloadTemplate(importFormat)}
                    >
                      下载模板
                    </Button>
                  </Space>
                </div>

                <Upload.Dragger
                  fileList={fileList}
                  onChange={handleImportChange}
                  beforeUpload={() => false}
                  accept={importFormat === 'csv' ? '.csv' : '.json'}
                  maxCount={1}
                >
                  <p className="ant-upload-drag-icon">
                    <UploadOutlined />
                  </p>
                  <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                  <p className="ant-upload-hint">
                    支持 {importFormat.toUpperCase()} 格式，文件大小不超过 10MB
                  </p>
                </Upload.Dragger>

                {importResult && (
                  <div>
                    <Space style={{ marginBottom: 16 }}>
                      <Tag icon={<CheckCircleOutlined />} color="success">
                        成功导入: {importResult.imported}
                      </Tag>
                      {importResult.failed > 0 && (
                        <Tag icon={<CloseCircleOutlined />} color="error">
                          导入失败: {importResult.failed}
                        </Tag>
                      )}
                    </Space>

                    {importResult.errors.length > 0 && (
                      <Table
                        size="small"
                        columns={errorColumns}
                        dataSource={importResult.errors}
                        rowKey="row"
                        pagination={false}
                        scroll={{ y: 200 }}
                      />
                    )}
                  </div>
                )}

                <div style={{ textAlign: 'right' }}>
                  <Space>
                    <Button onClick={onCancel}>取消</Button>
                    <Button
                      type="primary"
                      icon={<UploadOutlined />}
                      onClick={handleImport}
                      loading={importing}
                      disabled={fileList.length === 0}
                    >
                      开始导入
                    </Button>
                  </Space>
                </div>
              </Space>
            ),
          },
          {
            key: 'export',
            label: (
              <span>
                <DownloadOutlined />
                导出账户
              </span>
            ),
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <Alert
                  message="导出说明"
                  description={
                    <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                      <li>将导出所有账户数据</li>
                      <li>可选择是否包含密码（不建议）</li>
                      <li>导出的文件可用于备份或迁移</li>
                      <li>当前共有 {accounts.length} 个账户</li>
                    </ul>
                  }
                  type="info"
                  showIcon
                />

                <div>
                  <Space direction="vertical" size="middle">
                    <Space>
                      <span>导出格式：</span>
                      <Select
                        value={exportFormat}
                        onChange={setExportFormat}
                        style={{ width: 120 }}
                      >
                        <Select.Option value="csv">CSV</Select.Option>
                        <Select.Option value="json">JSON</Select.Option>
                      </Select>
                    </Space>

                    <Alert
                      message={
                        <Space>
                          <InfoCircleOutlined />
                          <span>出于安全考虑，不建议导出密码</span>
                        </Space>
                      }
                      type="warning"
                      action={
                        <Button
                          size="small"
                          danger
                          onClick={() => setIncludePasswords(!includePasswords)}
                        >
                          {includePasswords ? '不包含密码' : '包含密码'}
                        </Button>
                      }
                    />
                  </Space>
                </div>

                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <Button
                    type="primary"
                    size="large"
                    icon={<DownloadOutlined />}
                    onClick={handleExport}
                    disabled={accounts.length === 0}
                  >
                    导出 {accounts.length} 个账户
                  </Button>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <Button onClick={onCancel}>关闭</Button>
                </div>
              </Space>
            ),
          },
        ]}
      />
    </Modal>
  );
};

export default ImportExportModal;
