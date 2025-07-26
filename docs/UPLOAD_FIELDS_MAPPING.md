# 上传字段映射文档

## 前端表单字段 → 后端 Video 接口映射

| 前端字段 | 前端类型 | 后端字段 | 后端类型 | 支持状态 | 说明 |
|---------|---------|---------|---------|---------|------|
| **基本信息** |
| 选择上传账户 | accountId: string | - | - | ✅ 任务级别 | 在Task.accountId中 |
| 标题 | title: string | title | string | ✅ 支持 | |
| 描述 | description: string | description | string | ✅ 支持 | |
| 标签 | tags: string[] | tags | string[] | ✅ 支持 | |
| 类别 | categoryId: string | - | - | ❌ 缺失 | 需要添加到Video类型 |
| 语言 | language: string | language | string | ✅ 支持 | |
| **发布设置** |
| 隐私设置 | privacy: 'public'\|'unlisted'\|'private' | publishType | 'PRIVATE'\|'UNLISTED'\|'PUBLIC' | ✅ 支持 | 需要大小写转换 |
| 定时发布 | publishAt/scheduledAt: string | - | - | ⚠️ 部分支持 | Task.scheduledAt支持，但Video类型不支持 |
| 播放列表 | playlist: string | playlist | string | ✅ 支持 | |
| **位置信息** |
| 拍摄地点 | location: string | automaticPlaces | boolean | ⚠️ 不同 | 后端只支持自动位置，不支持手动输入 |
| **游戏相关** |
| 游戏标题 | gameTitle: string | gameTitleSearch | string | ✅ 支持 | 字段名不同 |
| **高级设置** |
| 专为儿童打造 | madeForKids: boolean | isNotForKid | boolean | ⚠️ 相反 | 逻辑相反，需要转换 |
| 年龄限制 | ageRestriction: boolean | isAgeRestriction | boolean | ✅ 支持 | |
| 允许评论 | allowComments: boolean | - | - | ❌ 缺失 | YouTube API可能在其他地方控制 |
| 允许评分 | allowRatings: boolean | - | - | ❌ 缺失 | YouTube API可能在其他地方控制 |
| 允许嵌入 | allowEmbedding: boolean | - | - | ❌ 缺失 | YouTube API可能在其他地方控制 |
| **文件相关** |
| 视频文件 | videoFile: File | path | string | ✅ 支持 | 需要处理文件上传 |
| 视频缩略图 | thumbnailFile: File | thumbnail | string | ✅ 支持 | 需要处理文件上传 |

## 需要的修改

### 1. 立即需要的字段映射（在tasksApi.ts中）
```typescript
const taskRequest: CreateTaskRequest = {
  type: 'upload',
  priority: 'normal',
  accountId: body.accountId,
  scheduledAt: body.publishAt || body.scheduledAt, // 定时发布
  video: {
    path: body.videoPath || body.videoFile?.name || '',
    title: body.title,
    description: body.description,
    tags: body.tags,
    thumbnail: body.thumbnailPath || body.thumbnailFile?.name,
    publishType: body.privacy?.toUpperCase() as any || 'PUBLIC',
    language: body.language,
    playlist: body.playlist,
    
    // 游戏相关
    gameTitleSearch: body.gameTitle,
    
    // 年龄和儿童设置
    isNotForKid: body.madeForKids ? false : true, // 注意逻辑相反
    isAgeRestriction: body.ageRestriction || false,
    
    // 其他字段
    channelName: body.channelName,
    uploadAsDraft: false,
  },
  metadata: {
    // 存储前端特有的字段
    categoryId: body.categoryId,
    location: body.location,
    allowComments: body.allowComments,
    allowRatings: body.allowRatings,
    allowEmbedding: body.allowEmbedding,
  }
};
```

### 2. 后端Video类型建议添加的字段
```typescript
export interface Video {
  // ... 现有字段
  
  // 建议添加
  categoryId?: string;        // YouTube类别ID
  location?: string;          // 手动输入的位置信息
  recordingDate?: string;     // 录制日期
  
  // 评论和互动控制可能需要在其他地方处理
}
```

### 3. 文件上传处理
前端使用File对象，后端期望文件路径。需要：
1. 实现文件上传到服务器
2. 获取服务器上的文件路径
3. 将路径传递给任务创建API

### 4. 缺失功能
以下功能可能需要通过YouTube API在上传后单独设置：
- 允许/禁止评论
- 允许/禁止评分
- 允许/禁止嵌入

## 总结
大部分字段都已支持，主要问题是：
1. 文件上传需要实现
2. 一些字段名不同需要映射
3. 部分高级设置可能需要后续通过YouTube API设置