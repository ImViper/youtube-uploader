import React, { useState } from 'react';
import { Card, Button, Space, message, Modal, Select } from 'antd';
import { CloudUploadOutlined, PlusOutlined } from '@ant-design/icons';
import {
  useGetUploadsQuery,
  useCreateUploadMutation,
  useCancelUploadMutation,
  useRetryUploadMutation,
} from '@/features/uploads/uploadsApi';
import { useGetAccountsQuery } from '@/features/accounts/accountsApi';
import {
  MetadataEditor,
  UploadsList,
  type VideoMetadata,
} from '@/features/uploads/components';

const UploadsPage: React.FC = () => {
  const [showEditor, setShowEditor] = useState(false);
  const [tempAccountId, setTempAccountId] = useState<string | undefined>();

  // API Queries
  const { data: uploadsData } = useGetUploadsQuery({
    page: 1,
    pageSize: 100,
  });
  const { data: accountsData } = useGetAccountsQuery({
    status: 'active',
    page: 1,
    pageSize: 100,
  });

  // Mutations
  const [createUpload] = useCreateUploadMutation();
  const [cancelUpload] = useCancelUploadMutation();
  const [retryUpload] = useRetryUploadMutation();

  const uploads = uploadsData?.items || [];
  const activeAccounts = accountsData?.items.filter((a) => a.status === 'active') || [];

  const handleMetadataSave = async (metadata: VideoMetadata) => {
    if (!tempAccountId) {
      message.error('请选择上传账户');
      return;
    }

    if (!metadata.videoPath) {
      message.error('请输入视频文件路径');
      return;
    }

    Modal.confirm({
      title: '确认创建上传任务',
      content: `即将为视频 "${metadata.title}" 创建上传任务，是否继续？`,
      okText: '创建任务',
      cancelText: '取消',
      onOk: async () => {
        try {
          await createUpload({
            accountId: tempAccountId,
            videoPath: metadata.videoPath,
            thumbnailPath: metadata.thumbnailPath,
            title: metadata.title,
            description: metadata.description,
            tags: metadata.tags,
            privacy: metadata.privacy,
            categoryId: metadata.categoryId,
            language: metadata.language,
            scheduledAt: metadata.scheduledAt || metadata.publishAt,
            playlist: metadata.playlist,
            location: metadata.location,
            recordingDate: metadata.recordingDate,
            gameTitle: metadata.gameTitle,
            madeForKids: metadata.madeForKids,
            ageRestriction: metadata.ageRestriction,
            channelName: metadata.channelName,
            uploadAsDraft: metadata.uploadAsDraft,
            isChannelMonetized: metadata.isChannelMonetized,
            allowComments: metadata.allowComments,
            allowRatings: metadata.allowRatings,
            allowEmbedding: metadata.allowEmbedding,
          }).unwrap();

          message.success('上传任务已创建');
          setShowEditor(false);
          setTempAccountId(undefined);
        } catch {
          message.error('创建上传任务失败');
        }
      },
    });
  };

  const handleCancelUpload = async (id: string) => {
    try {
      await cancelUpload(id).unwrap();
      message.success('已取消上传');
    } catch {
      message.error('取消失败');
    }
  };

  const handleRetryUpload = async (id: string) => {
    try {
      await retryUpload(id).unwrap();
      message.success('已重新开始上传');
    } catch {
      message.error('重试失败');
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* 创建新上传任务 */}
      <Card>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => setShowEditor(true)}
          >
            创建新的上传任务
          </Button>
        </div>
      </Card>

      {/* 元数据编辑器 */}
      {showEditor && (
        <Card title="创建上传任务">
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <span>选择上传账户：</span>
              <Select
                style={{ width: 300, marginLeft: 10 }}
                placeholder="选择账户"
                value={tempAccountId}
                onChange={setTempAccountId}
              >
                {activeAccounts.map((account) => (
                  <Select.Option key={account.id} value={account.id}>
                    {account.username || account.email}
                  </Select.Option>
                ))}
              </Select>
            </div>

            <MetadataEditor onSave={handleMetadataSave} />

            <div style={{ textAlign: 'right' }}>
              <Button onClick={() => {
                setShowEditor(false);
                setTempAccountId(undefined);
              }}>
                取消
              </Button>
            </div>
          </Space>
        </Card>
      )}

      {/* 上传进度 */}
      {uploads.length > 0 && (
        <Card title="上传进度">
          <UploadsList
            uploads={uploads}
            onPause={() => message.info('暂停功能开发中')}
            onResume={() => message.info('恢复功能开发中')}
            onCancel={handleCancelUpload}
            onRetry={handleRetryUpload}
          />
        </Card>
      )}
    </Space>
  );
};

export default UploadsPage;