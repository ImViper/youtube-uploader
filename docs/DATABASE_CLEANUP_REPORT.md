# Database Cleanup Report

## 概述
本文档记录了2025年7月28日进行的数据库清理工作，包括删除的冗余表和字段。

## 清理前的问题

### 字段名称不一致
- 发现 `bitbrowser_window_name` 字段在代码中有多种写法（camelCase vs snake_case）
- 统一为 snake_case 格式

### 冗余表
以下表在系统中未被使用：
1. **bitbrowser_profiles** - 被 browser_instances 表替代
2. **queue_stats** - 被 metrics_history 和系统视图替代
3. **custom_metrics** - 被 metrics_history 表替代

### 冗余字段
accounts 表中的以下字段未被使用：
1. **bitbrowser_window_id** - 被 bitbrowser_window_name 替代
2. **is_window_logged_in** - 登录状态现在在 browser_instances 表中管理

browser_instances 表中的以下字段未被使用：
1. **window_name** - 与 window_id 重复
2. **is_persistent** - 所有实例现在都是持久的

## 清理过程

### 1. 创建清理迁移脚本
文件：`src/database/migrations/006_cleanup_redundant_tables_and_fields.sql`

```sql
-- 1. 迁移 bitbrowser_profiles 数据到 browser_instances
INSERT INTO browser_instances (window_id, debug_url, status, is_logged_in, profile_data, last_health_check)
SELECT 
  window_id,
  debug_url,
  CASE WHEN is_logged_in THEN 'idle' ELSE 'error' END,
  is_logged_in,
  jsonb_build_object(
    'proxy', proxy,
    'userAgent', user_agent,
    'metadata', metadata
  ),
  CURRENT_TIMESTAMP
FROM bitbrowser_profiles
ON CONFLICT (window_id) DO UPDATE SET
  debug_url = EXCLUDED.debug_url,
  is_logged_in = EXCLUDED.is_logged_in,
  profile_data = EXCLUDED.profile_data;

-- 2. 删除冗余表
DROP TABLE IF EXISTS bitbrowser_profiles CASCADE;
DROP TABLE IF EXISTS queue_stats CASCADE;
DROP TABLE IF EXISTS custom_metrics CASCADE;

-- 3. 删除冗余字段
ALTER TABLE accounts 
DROP COLUMN IF EXISTS bitbrowser_window_id,
DROP COLUMN IF EXISTS is_window_logged_in;

ALTER TABLE browser_instances
DROP COLUMN IF EXISTS window_name,
DROP COLUMN IF EXISTS is_persistent;
```

### 2. 更新受影响的代码

#### AccountManager (`src/accounts/manager.ts`)
- 移除 `bitbrowser_window_id` 和 `is_window_logged_in` 字段引用
- 删除相关的查询方法

#### API路由 (`src/api/browser/browser-mapping.routes.ts`)
- 从使用 `bitbrowser_profiles` 改为使用 `browser_instances`
- 更新字段引用

#### 监控模块 (`src/monitoring/metrics.ts`)
- 更新 `recordMetric` 方法以使用 `metrics_history` 而不是 `custom_metrics`

#### 脚本文件
- 更新 `check-browser-status.ts` 和 `init-browser-profiles.ts`
- 移除对已删除字段和表的引用

### 3. 执行清理
```bash
node manual-tests/cleanup-database.js
```

## 清理结果

### 成功删除的表
- ✅ bitbrowser_profiles
- ✅ queue_stats  
- ✅ custom_metrics

### 成功删除的字段
- ✅ accounts.bitbrowser_window_id
- ✅ accounts.is_window_logged_in
- ✅ browser_instances.window_name
- ✅ browser_instances.is_persistent

### 保留的核心表
- accounts
- browser_instances
- metrics_history
- system_metrics
- upload_errors
- upload_history
- upload_tasks
- migrations

## 验证

### 数据库结构验证
运行 `test-main-flow-clean.js` 确认：
- 所有冗余表已成功删除
- 所有冗余字段已成功删除
- `bitbrowser_window_name` 字段正确保留在 accounts 表中

### 功能验证
- ✅ 登录功能正常
- ✅ 账户创建功能正常（包括 bitbrowser_window_name 字段）
- ✅ 任务创建功能正常
- ✅ BitBrowser 窗口连接正常（test-window-0629.js）

## 后续建议

1. **定期审查**：每季度审查一次数据库结构，识别未使用的表和字段
2. **命名规范**：严格遵循 snake_case 命名规范
3. **文档同步**：确保 DATABASE_SCHEMA.md 与实际数据库结构保持同步
4. **测试覆盖**：为所有数据库操作添加测试用例

## 附录：更新的数据库架构
完整的更新后架构已保存在 `src/database/schema-updated.sql`