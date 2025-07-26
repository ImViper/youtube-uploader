import React from 'react';
import { PageHeader } from '@ant-design/pro-components';
import { Tabs } from 'antd';
import type { TabsProps } from 'antd';
import { useTranslation } from 'react-i18next';
import PerformanceDashboard from '@/components/monitoring/PerformanceDashboard';
import UploadStatistics from '@/components/monitoring/UploadStatistics';
import AccountPerformanceRanking from '@/components/monitoring/AccountPerformanceRanking';
import ReportGeneration from '@/components/monitoring/ReportGeneration';

const Monitoring: React.FC = () => {
  const { t } = useTranslation();

  const items: TabsProps['items'] = [
    {
      key: 'performance',
      label: t('monitoring.performance'),
      children: <PerformanceDashboard />,
    },
    {
      key: 'uploadStats',
      label: t('monitoring.uploadStats'),
      children: <UploadStatistics />,
    },
    {
      key: 'accountPerformance',
      label: t('monitoring.accountPerformance'),
      children: <AccountPerformanceRanking />,
    },
    {
      key: 'reports',
      label: t('monitoring.reports'),
      children: <ReportGeneration />,
    },
  ];

  return (
    <div>
      <PageHeader title={t('monitoring.title')} subTitle={t('monitoring.subtitle')} />

      <div className="p-6">
        <Tabs defaultActiveKey="performance" type="card" items={items} />
      </div>
    </div>
  );
};

export default Monitoring;
