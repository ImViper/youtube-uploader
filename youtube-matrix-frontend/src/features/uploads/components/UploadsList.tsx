import React from 'react';
import { Space, Empty } from 'antd';
import UploadProgress from './UploadProgress';
import type { Upload } from '../uploadsSlice';

interface UploadsListProps {
  uploads: Upload[];
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
}

const UploadsList: React.FC<UploadsListProps> = ({
  uploads,
  onPause,
  onResume,
  onCancel,
  onRetry,
}) => {
  if (uploads.length === 0) {
    return <Empty description="暂无上传任务" />;
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {uploads.map((upload) => (
        <UploadProgress
          key={upload.id}
          upload={upload}
          onPause={onPause}
          onResume={onResume}
          onCancel={onCancel}
          onRetry={onRetry}
        />
      ))}
    </Space>
  );
};

export default UploadsList;
