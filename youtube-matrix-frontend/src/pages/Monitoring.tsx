import React from 'react';
import { PageHeader } from '@ant-design/pro-components';
import { Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import PerformanceDashboard from '@/components/monitoring/PerformanceDashboard';
import UploadStatistics from '@/components/monitoring/UploadStatistics';
import AccountPerformanceRanking from '@/components/monitoring/AccountPerformanceRanking';
import ReportGeneration from '@/components/monitoring/ReportGeneration';

const { TabPane } = Tabs;

const Monitoring: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div>
      <PageHeader title={t('monitoring.title')} subTitle={t('monitoring.subtitle')} />

      <div className="p-6">
        <Tabs defaultActiveKey="performance" type="card">
          <TabPane tab={t('monitoring.performance')} key="performance">
            <PerformanceDashboard />
          </TabPane>

          <TabPane tab={t('monitoring.uploadStats')} key="uploadStats">
            <UploadStatistics />
          </TabPane>

          <TabPane tab={t('monitoring.accountPerformance')} key="accountPerformance">
            <AccountPerformanceRanking />
          </TabPane>

          <TabPane tab={t('monitoring.reports')} key="reports">
            <ReportGeneration />
          </TabPane>
        </Tabs>
      </div>
    </div>
  );
};

export default Monitoring;
