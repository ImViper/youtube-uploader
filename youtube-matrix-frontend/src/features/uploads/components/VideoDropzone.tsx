import React, { useState } from 'react';
import { Upload, Card, Space, Typography, Button, message, Tag, Tooltip } from 'antd';
import {
  CloudUploadOutlined,
  DeleteOutlined,
  VideoCameraOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import type { UploadFile, RcFile } from 'antd/es/upload/interface';
import { UI } from '@/utils/constants';

const { Dragger } = Upload;
const { Text } = Typography;

interface VideoFile extends UploadFile {
  videoMetadata?: {
    duration: number;
    width: number;
    height: number;
    size: number;
  };
}

interface VideoDropzoneProps {
  maxFiles?: number;
  onFilesChange: (files: VideoFile[]) => void;
  uploading?: boolean;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
};

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

const VideoDropzone: React.FC<VideoDropzoneProps> = ({
  maxFiles = 10,
  onFilesChange,
  uploading = false,
}) => {
  const [fileList, setFileList] = useState<VideoFile[]>([]);
  const [validating, setValidating] = useState(false);

  const validateVideoFile = async (file: RcFile): Promise<boolean> => {
    // 检查文件类型
    const isVideo = UI.SUPPORTED_VIDEO_FORMATS.some((format) =>
      file.name.toLowerCase().endsWith(format),
    );

    if (!isVideo) {
      message.error(`不支持的文件格式。支持的格式：${UI.SUPPORTED_VIDEO_FORMATS.join(', ')}`);
      return false;
    }

    // 检查文件大小
    if (file.size > UI.MAX_FILE_SIZE) {
      message.error(`文件大小超过限制（最大 ${formatFileSize(UI.MAX_FILE_SIZE)}）`);
      return false;
    }

    // 检查文件数量
    if (fileList.length >= maxFiles) {
      message.error(`最多只能上传 ${maxFiles} 个文件`);
      return false;
    }

    return true;
  };

  const extractVideoMetadata = (file: File): Promise<VideoFile['videoMetadata']> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        resolve({
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          size: file.size,
        });
        URL.revokeObjectURL(video.src);
      };

      video.onerror = () => {
        resolve(undefined);
        URL.revokeObjectURL(video.src);
      };

      video.src = URL.createObjectURL(file);
    });
  };

  const handleBeforeUpload = async (file: RcFile): Promise<false> => {
    setValidating(true);

    try {
      const isValid = await validateVideoFile(file);
      if (!isValid) {
        return false;
      }

      // 提取视频元数据
      const metadata = await extractVideoMetadata(file);

      const newFile: VideoFile = {
        uid: file.uid,
        name: file.name,
        size: file.size,
        type: file.type,
        originFileObj: file,
        status: 'done',
        videoMetadata: metadata,
      };

      const newFileList = [...fileList, newFile];
      setFileList(newFileList);
      onFilesChange(newFileList);

      message.success(`${file.name} 添加成功`);
    } catch (error) {
      message.error('文件处理失败');
    } finally {
      setValidating(false);
    }

    return false; // 阻止自动上传
  };

  const handleRemove = (file: VideoFile) => {
    const newFileList = fileList.filter((f) => f.uid !== file.uid);
    setFileList(newFileList);
    onFilesChange(newFileList);
  };

  const clearAll = () => {
    setFileList([]);
    onFilesChange([]);
    message.info('已清空所有文件');
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {fileList.length < maxFiles && (
        <Dragger
          multiple
          showUploadList={false}
          beforeUpload={handleBeforeUpload}
          disabled={uploading || validating}
          accept={UI.SUPPORTED_VIDEO_FORMATS.join(',')}
        >
          <p className="ant-upload-drag-icon">
            <CloudUploadOutlined style={{ fontSize: 48, color: '#1890ff' }} />
          </p>
          <p className="ant-upload-text">点击或拖拽视频文件到此区域</p>
          <p className="ant-upload-hint">
            支持格式：{UI.SUPPORTED_VIDEO_FORMATS.join('、')}
            <br />
            最大文件大小：{formatFileSize(UI.MAX_FILE_SIZE)}
            <br />
            可同时上传多个文件（最多 {maxFiles} 个）
          </p>
        </Dragger>
      )}

      {fileList.length > 0 && (
        <Card
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>已选择 {fileList.length} 个视频</span>
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={clearAll}
                disabled={uploading}
              >
                清空全部
              </Button>
            </div>
          }
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {fileList.map((file) => (
              <Card key={file.uid} size="small" style={{ backgroundColor: '#fafafa' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <VideoCameraOutlined style={{ fontSize: 32, color: '#1890ff' }} />

                  <div style={{ flex: 1 }}>
                    <div>
                      <Text strong>{file.name}</Text>
                    </div>

                    <Space size="small" wrap>
                      <Tag color="blue">{formatFileSize(file.size || 0)}</Tag>

                      {file.videoMetadata && (
                        <>
                          <Tag color="green">{formatDuration(file.videoMetadata.duration)}</Tag>
                          <Tag>
                            {file.videoMetadata.width}x{file.videoMetadata.height}
                          </Tag>
                        </>
                      )}

                      <Tag icon={<CheckCircleOutlined />} color="success">
                        已准备
                      </Tag>
                    </Space>
                  </div>

                  <Tooltip title="移除">
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemove(file)}
                      disabled={uploading}
                    />
                  </Tooltip>
                </div>
              </Card>
            ))}
          </Space>
        </Card>
      )}
    </Space>
  );
};

export default VideoDropzone;
