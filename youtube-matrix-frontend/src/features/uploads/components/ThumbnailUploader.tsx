import React, { useState } from 'react';
import { Upload, Card, Button, Space, Typography, message, Spin } from 'antd';
import { PictureOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import type { RcFile } from 'antd/es/upload/interface';
import { UI } from '@/utils/constants';

const { Text } = Typography;

interface ThumbnailUploadProps {
  value?: string;
  onChange?: (url: string | undefined) => void;
  disabled?: boolean;
}

const ThumbnailUpload: React.FC<ThumbnailUploadProps> = ({ value, onChange, disabled = false }) => {
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(value);

  const beforeUpload = async (file: RcFile): Promise<false> => {
    // 验证文件类型
    const isImage = UI.SUPPORTED_IMAGE_FORMATS.some((format) =>
      file.name.toLowerCase().endsWith(format),
    );

    if (!isImage) {
      message.error(`不支持的图片格式。支持的格式：${UI.SUPPORTED_IMAGE_FORMATS.join(', ')}`);
      return false;
    }

    // 验证文件大小（缩略图限制 2MB）
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      message.error('缩略图大小不能超过 2MB');
      return false;
    }

    // 验证图片尺寸
    setLoading(true);
    try {
      const dimensions = await getImageDimensions(file);

      // YouTube 推荐缩略图尺寸：1280x720
      if (dimensions.width < 640 || dimensions.height < 360) {
        message.warning('建议使用至少 640x360 的图片，推荐 1280x720');
      }

      // 创建预览 URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      // 通知父组件
      onChange?.(url);

      message.success('缩略图已选择');
    } catch (error) {
      message.error('图片处理失败');
    } finally {
      setLoading(false);
    }

    return false;
  };

  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height,
        });
        URL.revokeObjectURL(img.src);
      };

      img.onerror = () => {
        reject(new Error('无法读取图片'));
        URL.revokeObjectURL(img.src);
      };

      img.src = URL.createObjectURL(file);
    });
  };

  const handleRemove = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(undefined);
    onChange?.(undefined);
    message.info('缩略图已移除');
  };

  const handlePreview = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  return (
    <Card
      title={
        <Space>
          <PictureOutlined />
          <span>视频缩略图</span>
        </Space>
      }
      extra={
        previewUrl && (
          <Space>
            <Button size="small" icon={<EyeOutlined />} onClick={handlePreview}>
              预览
            </Button>
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={handleRemove}
              disabled={disabled}
            >
              移除
            </Button>
          </Space>
        )
      }
    >
      <Spin spinning={loading}>
        {previewUrl ? (
          <div style={{ textAlign: 'center' }}>
            <img
              src={previewUrl}
              alt="缩略图预览"
              style={{
                maxWidth: '100%',
                maxHeight: 300,
                objectFit: 'contain',
                border: '1px solid #d9d9d9',
                borderRadius: 4,
              }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">建议尺寸：1280x720（16:9）</Text>
            </div>
          </div>
        ) : (
          <Upload.Dragger
            showUploadList={false}
            beforeUpload={beforeUpload}
            disabled={disabled || loading}
            accept={UI.SUPPORTED_IMAGE_FORMATS.join(',')}
          >
            <p className="ant-upload-drag-icon">
              <PictureOutlined style={{ fontSize: 48, color: '#1890ff' }} />
            </p>
            <p className="ant-upload-text">点击或拖拽图片到此区域</p>
            <p className="ant-upload-hint">
              支持格式：{UI.SUPPORTED_IMAGE_FORMATS.join('、')}
              <br />
              推荐尺寸：1280x720（16:9）
              <br />
              最大大小：2MB
            </p>
          </Upload.Dragger>
        )}
      </Spin>
    </Card>
  );
};

export default ThumbnailUpload;
