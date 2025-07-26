import React, { useState } from 'react';
import { Card, Space, Input, Button, Form, Typography, Tag, Alert, Tooltip } from 'antd';
import { 
  FolderOpenOutlined, 
  PlusOutlined, 
  DeleteOutlined,
  VideoCameraOutlined,
  CheckCircleOutlined 
} from '@ant-design/icons';

const { Text } = Typography;

interface VideoPath {
  id: string;
  path: string;
  name: string;
}

interface VideoPathInputProps {
  maxFiles?: number;
  onPathsChange: (paths: VideoPath[]) => void;
}

const VideoPathInput: React.FC<VideoPathInputProps> = ({
  maxFiles = 10,
  onPathsChange,
}) => {
  const [paths, setPaths] = useState<VideoPath[]>([]);
  const [inputPath, setInputPath] = useState('');
  const [form] = Form.useForm();

  const handleAddPath = () => {
    const path = form.getFieldValue('path');
    if (!path || !path.trim()) {
      return;
    }

    if (paths.length >= maxFiles) {
      return;
    }

    const filename = path.split(/[/\\]/).pop() || 'Unknown';
    const newPath: VideoPath = {
      id: Date.now().toString(),
      path: path.trim(),
      name: filename,
    };

    const newPaths = [...paths, newPath];
    setPaths(newPaths);
    onPathsChange(newPaths);
    form.resetFields();
  };

  const handleRemovePath = (id: string) => {
    const newPaths = paths.filter(p => p.id !== id);
    setPaths(newPaths);
    onPathsChange(newPaths);
  };

  const clearAll = () => {
    setPaths([]);
    onPathsChange([]);
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Alert
        message="文件路径输入模式"
        description="请输入服务器上的视频文件完整路径。确保服务器可以访问这些文件。"
        type="info"
        showIcon
      />

      {paths.length < maxFiles && (
        <Card>
          <Form form={form} onFinish={handleAddPath}>
            <Form.Item 
              name="path" 
              rules={[
                { required: true, message: '请输入文件路径' },
                { 
                  pattern: /\.(mp4|avi|mov|mkv|flv|wmv|webm|m4v|mpg|mpeg|3gp|3g2)$/i,
                  message: '请输入有效的视频文件路径' 
                }
              ]}
            >
              <Input
                placeholder="输入视频文件完整路径，如: C:\Videos\my-video.mp4 或 /home/user/videos/my-video.mp4"
                prefix={<FolderOpenOutlined />}
                suffix={
                  <Button 
                    type="primary" 
                    icon={<PlusOutlined />} 
                    onClick={() => form.submit()}
                    disabled={paths.length >= maxFiles}
                  >
                    添加
                  </Button>
                }
                onPressEnter={() => form.submit()}
              />
            </Form.Item>
          </Form>
          <Text type="secondary">
            支持格式：.mp4, .avi, .mov, .mkv, .flv, .wmv, .webm, .m4v, .mpg, .mpeg, .3gp, .3g2
          </Text>
        </Card>
      )}

      {paths.length > 0 && (
        <Card
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>已添加 {paths.length} 个视频路径</span>
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={clearAll}
              >
                清空全部
              </Button>
            </div>
          }
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {paths.map((videoPath) => (
              <Card key={videoPath.id} size="small" style={{ backgroundColor: '#fafafa' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <VideoCameraOutlined style={{ fontSize: 32, color: '#1890ff' }} />
                  
                  <div style={{ flex: 1 }}>
                    <div>
                      <Text strong>{videoPath.name}</Text>
                    </div>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>{videoPath.path}</Text>
                    </div>
                    <Tag icon={<CheckCircleOutlined />} color="success">
                      已准备
                    </Tag>
                  </div>

                  <Tooltip title="移除">
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemovePath(videoPath.id)}
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

export default VideoPathInput;