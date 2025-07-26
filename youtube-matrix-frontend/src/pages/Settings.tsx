import React from 'react';
import { PageHeader } from '@ant-design/pro-components';
import { Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import SettingsForm from '@/components/settings/SettingsForm';
import QueueConfiguration from '@/components/settings/QueueConfiguration';

const { TabPane } = Tabs;

const Settings: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div>
      <PageHeader title={t('settings.title')} subTitle={t('settings.subtitle')} />

      <div className="p-6">
        <Tabs defaultActiveKey="general" type="card">
          <TabPane tab={t('settings.generalSettings')} key="general">
            <SettingsForm />
          </TabPane>

          <TabPane tab={t('settings.queueConfiguration')} key="queue">
            <QueueConfiguration />
          </TabPane>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
