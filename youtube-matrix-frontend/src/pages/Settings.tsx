import React from 'react';
import { PageHeader } from '@ant-design/pro-components';
import { Tabs } from 'antd';
import type { TabsProps } from 'antd';
import { useTranslation } from 'react-i18next';
import SettingsForm from '@/components/settings/SettingsForm';
import QueueConfiguration from '@/components/settings/QueueConfiguration';

const Settings: React.FC = () => {
  const { t } = useTranslation();

  const items: TabsProps['items'] = [
    {
      key: 'general',
      label: t('settings.generalSettings'),
      children: <SettingsForm />,
    },
    {
      key: 'queue',
      label: t('settings.queueConfiguration'),
      children: <QueueConfiguration />,
    },
  ];

  return (
    <div>
      <PageHeader title={t('settings.title')} subTitle={t('settings.subtitle')} />

      <div className="p-6">
        <Tabs defaultActiveKey="general" type="card" items={items} />
      </div>
    </div>
  );
};

export default Settings;
