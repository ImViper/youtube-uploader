import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Select,
  DatePicker,
  Switch,
  Tag,
  Space,
  Button,
  Tooltip,
  Typography,
  Divider,
} from 'antd';
import { InfoCircleOutlined, SaveOutlined, CopyOutlined, PlusOutlined } from '@ant-design/icons';
import type { Upload } from '../uploadsSlice';

const { TextArea } = Input;
const { Text } = Typography;

interface MetadataEditorProps {
  metadata?: Partial<Upload>;
  templates?: MetadataTemplate[];
  onSave: (metadata: VideoMetadata) => void;
  onSaveAsTemplate?: (template: MetadataTemplate) => void;
}

export interface VideoMetadata {
  title: string;
  description: string;
  tags: string[];
  categoryId?: string;
  privacy: 'public' | 'unlisted' | 'private';
  publishAt?: string;
  scheduledAt?: string;
  playlist?: string;
  language?: string;
  location?: string;
  recordingDate?: string;
  gameTitle?: string;
  madeForKids: boolean;
  ageRestriction: boolean;
  allowComments: boolean;
  allowRatings: boolean;
  allowEmbedding: boolean;
}

interface MetadataTemplate {
  id: string;
  name: string;
  metadata: Partial<VideoMetadata>;
}

const YOUTUBE_CATEGORIES = [
  { value: '1', label: '电影和动画' },
  { value: '2', label: '汽车' },
  { value: '10', label: '音乐' },
  { value: '15', label: '宠物和动物' },
  { value: '17', label: '体育' },
  { value: '19', label: '旅游和活动' },
  { value: '20', label: '游戏' },
  { value: '22', label: '人物和博客' },
  { value: '23', label: '喜剧' },
  { value: '24', label: '娱乐' },
  { value: '25', label: '新闻和政治' },
  { value: '26', label: '时尚' },
  { value: '27', label: '教育' },
  { value: '28', label: '科学和技术' },
];

const LANGUAGES = [
  { value: 'zh-CN', label: '中文（简体）' },
  { value: 'zh-TW', label: '中文（繁体）' },
  { value: 'en', label: '英语' },
  { value: 'ja', label: '日语' },
  { value: 'ko', label: '韩语' },
  { value: 'es', label: '西班牙语' },
  { value: 'fr', label: '法语' },
  { value: 'de', label: '德语' },
];

const MetadataEditor: React.FC<MetadataEditorProps> = ({
  metadata,
  templates = [],
  onSave,
  onSaveAsTemplate,
}) => {
  const [form] = Form.useForm<VideoMetadata>();
  const [tags, setTags] = useState<string[]>([]);
  const [inputTag, setInputTag] = useState('');
  const [titleLength, setTitleLength] = useState(0);
  const [descriptionLength, setDescriptionLength] = useState(0);

  useEffect(() => {
    if (metadata) {
      form.setFieldsValue({
        ...metadata,
        tags: metadata.tags || [],
      });
      setTags(metadata.tags || []);
      setTitleLength(metadata.title?.length || 0);
      setDescriptionLength(metadata.description?.length || 0);
    }
  }, [metadata, form]);

  const handleAddTag = () => {
    if (inputTag && !tags.includes(inputTag)) {
      const newTags = [...tags, inputTag];
      setTags(newTags);
      form.setFieldValue('tags', newTags);
      setInputTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    const newTags = tags.filter((t) => t !== tag);
    setTags(newTags);
    form.setFieldValue('tags', newTags);
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      form.setFieldsValue(template.metadata);
      setTags(template.metadata.tags || []);
      setTitleLength(template.metadata.title?.length || 0);
      setDescriptionLength(template.metadata.description?.length || 0);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      onSave({ ...values, tags });
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const handleSaveAsTemplate = () => {
    const values = form.getFieldsValue();
    const templateName = prompt('请输入模板名称:');
    if (templateName && onSaveAsTemplate) {
      onSaveAsTemplate({
        id: Date.now().toString(),
        name: templateName,
        metadata: { ...values, tags },
      });
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        privacy: 'public',
        madeForKids: false,
        ageRestriction: false,
        allowComments: true,
        allowRatings: true,
        allowEmbedding: true,
        language: 'zh-CN',
        categoryId: '22',
      }}
    >
      {/* 模板选择 */}
      {templates.length > 0 && (
        <Form.Item label="使用模板">
          <Space>
            <Select
              placeholder="选择模板"
              style={{ width: 200 }}
              onChange={handleTemplateSelect}
              allowClear
            >
              {templates.map((template) => (
                <Select.Option key={template.id} value={template.id}>
                  {template.name}
                </Select.Option>
              ))}
            </Select>
            <Button icon={<SaveOutlined />} onClick={handleSaveAsTemplate}>
              保存为模板
            </Button>
          </Space>
        </Form.Item>
      )}

      <Divider />

      {/* 基本信息 */}
      <Form.Item
        name="title"
        label={
          <Space>
            标题
            <Text type="secondary">({titleLength}/100)</Text>
          </Space>
        }
        rules={[
          { required: true, message: '请输入视频标题' },
          { max: 100, message: '标题最多100个字符' },
        ]}
      >
        <Input
          placeholder="输入引人注目的标题"
          showCount
          maxLength={100}
          onChange={(e) => setTitleLength(e.target.value.length)}
        />
      </Form.Item>

      <Form.Item
        name="description"
        label={
          <Space>
            描述
            <Text type="secondary">({descriptionLength}/5000)</Text>
          </Space>
        }
        rules={[{ max: 5000, message: '描述最多5000个字符' }]}
      >
        <TextArea
          placeholder="详细描述您的视频内容..."
          rows={6}
          showCount
          maxLength={5000}
          onChange={(e) => setDescriptionLength(e.target.value.length)}
        />
      </Form.Item>

      <Form.Item
        label={
          <Space>
            标签
            <Tooltip title="标签有助于观众发现您的视频">
              <InfoCircleOutlined />
            </Tooltip>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <Input
              placeholder="输入标签后按回车或点击添加"
              value={inputTag}
              onChange={(e) => setInputTag(e.target.value)}
              onPressEnter={handleAddTag}
              style={{ width: 300 }}
            />
            <Button icon={<PlusOutlined />} onClick={handleAddTag} disabled={!inputTag}>
              添加
            </Button>
          </Space>
          <div>
            {tags.map((tag) => (
              <Tag
                key={tag}
                closable
                onClose={() => handleRemoveTag(tag)}
                style={{ marginBottom: 8 }}
              >
                {tag}
              </Tag>
            ))}
          </div>
        </Space>
      </Form.Item>

      <Divider />

      {/* 详细设置 */}
      <Space size="large" style={{ width: '100%' }} direction="vertical">
        <Space size="large" wrap>
          <Form.Item name="categoryId" label="类别" style={{ minWidth: 200 }}>
            <Select placeholder="选择视频类别">
              {YOUTUBE_CATEGORIES.map((cat) => (
                <Select.Option key={cat.value} value={cat.value}>
                  {cat.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="language" label="语言" style={{ minWidth: 200 }}>
            <Select placeholder="选择视频语言">
              {LANGUAGES.map((lang) => (
                <Select.Option key={lang.value} value={lang.value}>
                  {lang.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Space>

        <Space size="large" wrap>
          <Form.Item name="privacy" label="隐私设置" style={{ minWidth: 200 }}>
            <Select>
              <Select.Option value="public">公开</Select.Option>
              <Select.Option value="unlisted">不公开</Select.Option>
              <Select.Option value="private">私享</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="publishAt" label="定时发布" style={{ minWidth: 200 }}>
            <DatePicker showTime placeholder="选择发布时间" style={{ width: '100%' }} />
          </Form.Item>
        </Space>

        <Form.Item name="playlist" label="播放列表">
          <Input placeholder="输入要添加到的播放列表名称（可选）" />
        </Form.Item>

        <Form.Item name="location" label="拍摄地点">
          <Input placeholder="例如：北京市朝阳区（可选）" />
        </Form.Item>

        <Form.Item name="gameTitle" label="游戏标题" tooltip="如果这是游戏视频，请输入游戏名称">
          <Input placeholder="输入游戏名称（可选）" />
        </Form.Item>

        <Divider />

        {/* 高级设置 */}
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text strong>高级设置</Text>

          <Form.Item name="madeForKids" label="专为儿童打造" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="ageRestriction" label="年龄限制" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="allowComments" label="允许评论" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="allowRatings" label="允许评分" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="allowEmbedding" label="允许嵌入" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Space>
      </Space>

      <Divider />

      <Form.Item>
        <Space>
          <Button type="primary" onClick={handleSubmit}>
            保存元数据
          </Button>
          <Button
            icon={<CopyOutlined />}
            onClick={() => {
              const values = form.getFieldsValue();
              navigator.clipboard.writeText(JSON.stringify({ ...values, tags }, null, 2));
            }}
          >
            复制为JSON
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default MetadataEditor;
