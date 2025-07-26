# 实际字段映射文档 - 基于原始 youtube-uploader 库

## 后端支持的 Video 字段（来自 src/types.ts）

| 字段名 | 类型 | 说明 | 前端表单映射 |
|--------|------|------|-------------|
| **path** | string | 视频文件路径 | ✅ videoFile (需要文件上传处理) |
| **title** | string | 视频标题 | ✅ 标题 |
| **description** | string | 视频描述 | ✅ 描述 |
| **tags** | string[] | 标签数组 | ✅ 标签 |
| **language** | string | 语言代码 | ✅ 语言 |
| **playlist** | string | 播放列表名称 | ✅ 播放列表 |
| **thumbnail** | string | 缩略图路径 | ✅ 视频缩略图 (需要文件上传处理) |
| **publishType** | 'PRIVATE' \| 'UNLISTED' \| 'PUBLIC' | 发布类型 | ✅ 隐私设置 |
| **channelName** | string | 频道名称（用于切换频道） | ⚠️ 前端未显示此字段 |
| **uploadAsDraft** | boolean | 保存为草稿 | ❌ 前端未提供此选项 |
| **isAgeRestriction** | boolean | 年龄限制 | ✅ 年龄限制 |
| **isNotForKid** | boolean | 不适合儿童 | ✅ 专为儿童打造（逻辑相反） |
| **isChannelMonetized** | boolean | 频道是否开启获利 | ❌ 前端未提供此选项 |
| **gameTitleSearch** | string | 游戏标题搜索 | ✅ 游戏标题 |
| **publishToSubscriptionFeedAndNotifySubscribers** | boolean | 发布到订阅源并通知订阅者 | ❌ 前端未提供此选项 |
| **automaticPlaces** | boolean | 自动位置检测 | ⚠️ 位置（只能控制是否自动） |
| **alteredContent** | boolean | 内容是否经过修改 | ❌ 前端未提供此选项 |
| **gameSelector** | function | 游戏选择器函数 | ❌ 不适用于前端 |
| **onSuccess** | function | 成功回调 | ❌ 不适用于前端 |
| **skipProcessingWait** | boolean | 跳过处理等待 | ❌ 不适用于前端 |
| **onProgress** | function | 进度回调 | ❌ 不适用于前端 |

## 前端表单字段 vs 后端支持情况

| 前端字段 | 后端支持情况 | 处理方式 |
|----------|------------|----------|
| 选择上传账户 | ✅ Task.accountId | 支持 |
| 标题 | ✅ video.title | 支持 |
| 描述 | ✅ video.description | 支持 |
| 标签 | ✅ video.tags | 支持 |
| 类别 | ❌ 不支持 | 存储在 metadata.categoryId |
| 语言 | ✅ video.language | 支持 |
| 隐私设置 | ✅ video.publishType | 支持（需要大写转换） |
| 定时发布 | ⚠️ Task.scheduledAt | 任务级别支持，非视频属性 |
| 播放列表 | ✅ video.playlist | 支持 |
| 拍摄地点 | ⚠️ 仅 automaticPlaces | 只能控制自动检测开关 |
| 游戏标题 | ✅ video.gameTitleSearch | 支持 |
| 专为儿童打造 | ✅ video.isNotForKid | 支持（逻辑相反） |
| 年龄限制 | ✅ video.isAgeRestriction | 支持 |
| 允许评论 | ❌ 不支持 | 存储在 metadata |
| 允许评分 | ❌ 不支持 | 存储在 metadata |
| 允许嵌入 | ❌ 不支持 | 存储在 metadata |

## 文件上传问题

前端使用 `File` 对象，后端期望文件路径字符串。需要实现：
1. 文件上传端点
2. 文件存储机制
3. 返回文件路径供后端使用

## 建议

1. **立即可用的字段**：所有标记为 ✅ 的字段都可以直接使用
2. **需要后端改进**：
   - 添加文件上传支持
   - 考虑支持更多 YouTube API 功能（评论、评分、嵌入控制）
3. **前端改进**：
   - 添加 channelName 选择（如果有多频道需求）
   - 添加 uploadAsDraft 选项
   - 添加 isChannelMonetized 选项（如果需要）