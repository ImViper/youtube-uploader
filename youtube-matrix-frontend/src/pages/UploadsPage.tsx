import React, { useState } from 'react';
import { Card, Button, Space, Steps, Row, Col, Select, message, Modal } from 'antd';
import { CloudUploadOutlined, FormOutlined, CheckCircleOutlined } from '@ant-design/icons';
import {
  useGetUploadsQuery,
  useCreateUploadMutation,
  useCancelUploadMutation,
  useRetryUploadMutation,
} from '@/features/uploads/uploadsApi';
import { useGetAccountsQuery } from '@/features/accounts/accountsApi';
import {
  VideoDropzone,
  MetadataEditor,
  UploadsList,
  ThumbnailUploader,
  type VideoMetadata,
} from '@/features/uploads/components';

const { Step } = Steps;

interface UploadTask {
  file: File;
  metadata: VideoMetadata;
  accountId: string;
  thumbnail?: File;
}

const UploadsPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [tempMetadata, setTempMetadata] = useState<VideoMetadata | undefined>();
  const [tempAccountId, setTempAccountId] = useState<string | undefined>();
  const [tempThumbnail, setTempThumbnail] = useState<File | null>(null);

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

  const handleFilesChanged = (files: any[]) => {
    const rawFiles = files.map((f) => f.originFileObj as File).filter(Boolean);
    setSelectedFiles(rawFiles);
    if (rawFiles.length > 0 && currentStep === 0) {
      setCurrentStep(1);
    }
  };

  const handleMetadataSave = (metadata: VideoMetadata) => {
    if (!tempAccountId) {
      message.error('请选择上传账户');
      return;
    }

    const currentFile = selectedFiles[currentFileIndex];
    const task: UploadTask = {
      file: currentFile,
      metadata,
      accountId: tempAccountId,
      thumbnail: tempThumbnail || undefined,
    };

    const newTasks = [...uploadTasks, task];
    setUploadTasks(newTasks);

    // 如果还有更多文件，继续编辑下一个
    if (currentFileIndex < selectedFiles.length - 1) {
      setCurrentFileIndex(currentFileIndex + 1);
      setTempMetadata(undefined);
      setTempThumbnail(null);
      message.success(`已保存 ${currentFile.name} 的信息`);
    } else {
      // 所有文件都处理完毕
      setCurrentStep(2);
      message.success('所有视频信息已保存');
    }
  };

  const handleStartUpload = async () => {
    Modal.confirm({
      title: '确认上传',
      content: `即将上传 ${uploadTasks.length} 个视频，是否继续？`,
      okText: '开始上传',
      cancelText: '取消',
      onOk: async () => {
        try {
          for (const task of uploadTasks) {
            await createUpload({
              accountId: task.accountId,
              videoFile: task.file,
              title: task.metadata.title,
              description: task.metadata.description,
              tags: task.metadata.tags,
              thumbnailFile: task.thumbnail,
              privacy: task.metadata.privacy,
              category: task.metadata.categoryId,
              language: task.metadata.language,
              scheduledAt: task.metadata.scheduledAt || task.metadata.publishAt,
            }).unwrap();
          }

          message.success('上传任务已创建');
          // 重置状态
          setCurrentStep(0);
          setSelectedFiles([]);
          setUploadTasks([]);
          setCurrentFileIndex(0);
        } catch (error) {
          message.error('创建上传任务失败');
        }
      },
    });
  };

  const handleCancelUpload = async (id: string) => {
    try {
      await cancelUpload(id).unwrap();
      message.success('已取消上传');
    } catch (error) {
      message.error('取消失败');
    }
  };

  const handleRetryUpload = async (id: string) => {
    try {
      await retryUpload(id).unwrap();
      message.success('已重新开始上传');
    } catch (error) {
      message.error('重试失败');
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return <VideoDropzone maxFiles={10} onFilesChange={handleFilesChanged} />;

      case 1:
        const currentFile = selectedFiles[currentFileIndex];
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Card>
              <div style={{ marginBottom: 16 }}>
                <strong>当前编辑：</strong> {currentFile?.name}
                <span style={{ marginLeft: 16, color: '#8c8c8c' }}>
                  ({currentFileIndex + 1}/{selectedFiles.length})
                </span>
              </div>

              <Space style={{ marginBottom: 16 }}>
                <span>选择上传账户：</span>
                <Select
                  style={{ width: 200 }}
                  placeholder="选择账户"
                  value={tempAccountId}
                  onChange={setTempAccountId}
                >
                  {activeAccounts.map((account) => (
                    <Select.Option key={account.id} value={account.id}>
                      {account.username}
                    </Select.Option>
                  ))}
                </Select>
              </Space>
            </Card>

            <Row gutter={16}>
              <Col span={16}>
                <MetadataEditor metadata={tempMetadata} onSave={handleMetadataSave} />
              </Col>
              <Col span={8}>
                <ThumbnailUploader
                  onChange={(url) => {
                    // ThumbnailUploader 返回的是 base64 URL，我们需要转换为 File
                    if (url) {
                      fetch(url)
                        .then((res) => res.blob())
                        .then((blob) => {
                          const file = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
                          setTempThumbnail(file);
                        });
                    } else {
                      setTempThumbnail(null);
                    }
                  }}
                />
              </Col>
            </Row>
          </Space>
        );

      case 2:
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Card>
              <Space direction="vertical" style={{ width: '100%' }}>
                <h3>准备上传的视频：</h3>
                {uploadTasks.map((task, index) => (
                  <div key={index} style={{ padding: '8px 0' }}>
                    <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                    <strong>{task.file.name}</strong> - {task.metadata.title}
                    <span style={{ marginLeft: 16, color: '#8c8c8c' }}>
                      (账户: {activeAccounts.find((a) => a.id === task.accountId)?.username})
                    </span>
                  </div>
                ))}
              </Space>

              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <Space>
                  <Button onClick={() => setCurrentStep(0)}>返回修改</Button>
                  <Button
                    type="primary"
                    size="large"
                    icon={<CloudUploadOutlined />}
                    onClick={handleStartUpload}
                  >
                    开始上传
                  </Button>
                </Space>
              </div>
            </Card>
          </Space>
        );

      default:
        return null;
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* 上传步骤 */}
      <Card>
        <Steps current={currentStep} onChange={setCurrentStep}>
          <Step
            title="选择视频"
            description="选择要上传的视频文件"
            icon={<CloudUploadOutlined />}
          />
          <Step
            title="编辑信息"
            description="填写视频标题、描述等信息"
            icon={<FormOutlined />}
            disabled={selectedFiles.length === 0}
          />
          <Step
            title="确认上传"
            description="检查信息并开始上传"
            icon={<CheckCircleOutlined />}
            disabled={uploadTasks.length === 0}
          />
        </Steps>
      </Card>

      {/* 步骤内容 */}
      {renderStepContent()}

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
