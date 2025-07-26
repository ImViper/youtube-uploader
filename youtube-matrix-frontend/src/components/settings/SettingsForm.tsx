import React, { useEffect, useState } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Switch,
  Select,
  Button,
  Space,
  Tabs,
  Divider,
  Alert,
  Tooltip,
  message,
  Spin,
  Row,
  Col,
  Modal,
} from 'antd';
import {
  SaveOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  LockOutlined,
  GlobalOutlined,
  CloudServerOutlined,
  RocketOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppSelector, useAppDispatch } from '@/hooks/redux';
import {
  selectSettings,
  selectSettingsLoadingState,
  updateSettings,
} from '@/features/settings/settingsSlice';
import { useGetSettingsQuery, useUpdateSettingsMutation } from '@/features/settings/settingsApi';

const { TabPane } = Tabs;
const { Option } = Select;
const { TextArea } = Input;

const SettingsForm: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('general');
  const [hasChanges, setHasChanges] = useState(false);

  const settings = useAppSelector(selectSettings);
  const loadingState = useAppSelector(selectSettingsLoadingState);

  // API hooks
  const { refetch } = useGetSettingsQuery();
  const [updateSettingsApi, { isLoading: isSaving }] = useUpdateSettingsMutation();

  // Initialize form with settings
  useEffect(() => {
    if (settings) {
      form.setFieldsValue(settings);
    }
  }, [settings, form]);

  // Handle form changes
  const handleFormChange = () => {
    setHasChanges(true);
  };

  // Handle save
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await updateSettingsApi(values).unwrap();
      dispatch(updateSettings(values));
      message.success(t('settings.savedSuccessfully'));
      setHasChanges(false);
    } catch {
      message.error(t('settings.saveFailed'));
    }
  };

  // Handle reset
  const handleReset = () => {
    form.resetFields();
    if (settings) {
      form.setFieldsValue(settings);
    }
    setHasChanges(false);
  };

  // Handle restore defaults
  const handleRestoreDefaults = () => {
    Modal.confirm({
      title: t('settings.restoreDefaults'),
      content: t('settings.restoreDefaultsConfirm'),
      onOk: async () => {
        try {
          await updateSettingsApi({ restoreDefaults: true }).unwrap();
          await refetch();
          message.success(t('settings.defaultsRestored'));
          setHasChanges(false);
        } catch {
          message.error(t('settings.restoreDefaultsFailed'));
        }
      },
    });
  };

  if (loadingState === 'loading' && !settings) {
    return (
      <div className="text-center py-8">
        <Spin size="large" tip={t('settings.loadingSettings')} />
      </div>
    );
  }

  return (
    <div className="settings-form">
      <Alert
        message={t('settings.notice')}
        description={t('settings.noticeDescription')}
        type="info"
        showIcon
        className="mb-4"
      />

      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleFormChange}
        className="settings-form"
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          {/* General Settings */}
          <TabPane
            tab={
              <span>
                <GlobalOutlined />
                {t('settings.general')}
              </span>
            }
            key="general"
          >
            <Card>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['general', 'siteName']}
                    label={t('settings.siteName')}
                    rules={[{ required: true }]}
                  >
                    <Input placeholder={t('settings.siteNamePlaceholder')} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['general', 'language']}
                    label={t('settings.defaultLanguage')}
                    rules={[{ required: true }]}
                  >
                    <Select>
                      <Option value="en">English</Option>
                      <Option value="zh">中文</Option>
                      <Option value="es">Español</Option>
                      <Option value="fr">Français</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['general', 'timezone']}
                    label={t('settings.timezone')}
                    rules={[{ required: true }]}
                  >
                    <Select showSearch>
                      <Option value="UTC">UTC</Option>
                      <Option value="America/New_York">America/New York</Option>
                      <Option value="Europe/London">Europe/London</Option>
                      <Option value="Asia/Shanghai">Asia/Shanghai</Option>
                      <Option value="Asia/Tokyo">Asia/Tokyo</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name={['general', 'dateFormat']} label={t('settings.dateFormat')}>
                    <Select>
                      <Option value="YYYY-MM-DD">YYYY-MM-DD</Option>
                      <Option value="DD/MM/YYYY">DD/MM/YYYY</Option>
                      <Option value="MM/DD/YYYY">MM/DD/YYYY</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Divider />

              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Form.Item
                    name={['general', 'enableMaintenance']}
                    label={t('settings.maintenanceMode')}
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  <Form.Item
                    name={['general', 'maintenanceMessage']}
                    label={t('settings.maintenanceMessage')}
                  >
                    <TextArea rows={3} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </TabPane>

          {/* Upload Settings */}
          <TabPane
            tab={
              <span>
                <CloudServerOutlined />
                {t('settings.upload')}
              </span>
            }
            key="upload"
          >
            <Card>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['upload', 'maxFileSize']}
                    label={
                      <Space>
                        {t('settings.maxFileSize')}
                        <Tooltip title={t('settings.maxFileSizeHelp')}>
                          <InfoCircleOutlined />
                        </Tooltip>
                      </Space>
                    }
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={100} max={10240} addonAfter="MB" className="w-full" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['upload', 'chunkSize']}
                    label={
                      <Space>
                        {t('settings.chunkSize')}
                        <Tooltip title={t('settings.chunkSizeHelp')}>
                          <InfoCircleOutlined />
                        </Tooltip>
                      </Space>
                    }
                  >
                    <InputNumber min={1} max={100} addonAfter="MB" className="w-full" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name={['upload', 'maxRetries']} label={t('settings.maxRetries')}>
                    <InputNumber min={0} max={10} className="w-full" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name={['upload', 'retryDelay']} label={t('settings.retryDelay')}>
                    <InputNumber min={1} max={300} addonAfter="s" className="w-full" />
                  </Form.Item>
                </Col>
              </Row>

              <Divider />

              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Form.Item
                    name={['upload', 'allowedFormats']}
                    label={t('settings.allowedFormats')}
                  >
                    <Select mode="multiple">
                      <Option value="mp4">MP4</Option>
                      <Option value="avi">AVI</Option>
                      <Option value="mov">MOV</Option>
                      <Option value="wmv">WMV</Option>
                      <Option value="flv">FLV</Option>
                      <Option value="mkv">MKV</Option>
                      <Option value="webm">WebM</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['upload', 'autoGenerateThumbnail']}
                    label={t('settings.autoGenerateThumbnail')}
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['upload', 'enableWatermark']}
                    label={t('settings.enableWatermark')}
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </TabPane>

          {/* Queue Settings */}
          <TabPane
            tab={
              <span>
                <RocketOutlined />
                {t('settings.queue')}
              </span>
            }
            key="queue"
          >
            <Card>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['queue', 'maxConcurrentUploads']}
                    label={
                      <Space>
                        {t('settings.maxConcurrentUploads')}
                        <Tooltip title={t('settings.maxConcurrentUploadsHelp')}>
                          <InfoCircleOutlined />
                        </Tooltip>
                      </Space>
                    }
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={1} max={10} className="w-full" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['queue', 'uploadRateLimit']}
                    label={t('settings.uploadRateLimit')}
                  >
                    <InputNumber
                      min={0}
                      max={1000}
                      addonAfter="MB/s"
                      className="w-full"
                      placeholder="0 = unlimited"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['queue', 'priorityStrategy']}
                    label={t('settings.priorityStrategy')}
                  >
                    <Select>
                      <Option value="fifo">{t('settings.fifo')}</Option>
                      <Option value="lifo">{t('settings.lifo')}</Option>
                      <Option value="priority">{t('settings.priority')}</Option>
                      <Option value="size">{t('settings.smallestFirst')}</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['queue', 'pauseBetweenUploads']}
                    label={t('settings.pauseBetweenUploads')}
                  >
                    <InputNumber min={0} max={3600} addonAfter="s" className="w-full" />
                  </Form.Item>
                </Col>
              </Row>

              <Divider />

              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['queue', 'enableScheduling']}
                    label={t('settings.enableScheduling')}
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['queue', 'scheduleWindow']}
                    label={t('settings.scheduleWindow')}
                  >
                    <Input placeholder="00:00-23:59" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </TabPane>

          {/* Security Settings */}
          <TabPane
            tab={
              <span>
                <LockOutlined />
                {t('settings.security')}
              </span>
            }
            key="security"
          >
            <Card>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['security', 'sessionTimeout']}
                    label={t('settings.sessionTimeout')}
                  >
                    <InputNumber
                      min={5}
                      max={1440}
                      addonAfter={t('settings.minutes')}
                      className="w-full"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['security', 'maxLoginAttempts']}
                    label={t('settings.maxLoginAttempts')}
                  >
                    <InputNumber min={3} max={10} className="w-full" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['security', 'enableTwoFactor']}
                    label={t('settings.enableTwoFactor')}
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['security', 'enforceHttps']}
                    label={t('settings.enforceHttps')}
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>

              <Divider />

              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Form.Item
                    name={['security', 'allowedIPs']}
                    label={t('settings.ipWhitelist')}
                    extra={t('settings.ipWhitelistHelp')}
                  >
                    <TextArea
                      rows={4}
                      placeholder="192.168.1.0/24&#10;10.0.0.0/8"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </TabPane>

          {/* Notification Settings */}
          <TabPane
            tab={
              <span>
                <BellOutlined />
                {t('settings.notifications')}
              </span>
            }
            key="notifications"
          >
            <Card>
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <h4 className="mb-4">{t('settings.emailNotifications')}</h4>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['notifications', 'emailEnabled']}
                    label={t('settings.enableEmail')}
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name={['notifications', 'emailFrom']} label={t('settings.fromEmail')}>
                    <Input type="email" />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item name={['notifications', 'smtpHost']} label={t('settings.smtpHost')}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name={['notifications', 'smtpPort']} label={t('settings.smtpPort')}>
                    <InputNumber min={1} max={65535} className="w-full" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['notifications', 'smtpSecure']}
                    label={t('settings.smtpSecure')}
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>

              <Divider />

              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <h4 className="mb-4">{t('settings.notificationTypes')}</h4>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['notifications', 'onUploadSuccess']}
                    label={t('settings.onUploadSuccess')}
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['notifications', 'onUploadFailure']}
                    label={t('settings.onUploadFailure')}
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['notifications', 'onQueueComplete']}
                    label={t('settings.onQueueComplete')}
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name={['notifications', 'onSystemError']}
                    label={t('settings.onSystemError')}
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </TabPane>
        </Tabs>
      </Form>

      {/* Action Buttons */}
      <Card className="mt-4">
        <Space className="w-full justify-between" wrap>
          <Button onClick={handleRestoreDefaults} icon={<ReloadOutlined />}>
            {t('settings.restoreDefaults')}
          </Button>
          <Space>
            <Button onClick={handleReset} disabled={!hasChanges}>
              {t('common.cancel')}
            </Button>
            <Button
              type="primary"
              onClick={handleSave}
              loading={isSaving}
              disabled={!hasChanges}
              icon={<SaveOutlined />}
            >
              {t('common.save')}
            </Button>
          </Space>
        </Space>
      </Card>
    </div>
  );
};

export default SettingsForm;
