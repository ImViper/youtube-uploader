-- Migration: Cleanup redundant tables and fields
-- Date: 2025-01-28
-- Purpose: Remove unused/redundant database elements to simplify schema

-- 1. Migrate necessary data from bitbrowser_profiles to browser_instances
-- First, ensure browser_instances has all necessary columns
ALTER TABLE browser_instances
ADD COLUMN IF NOT EXISTS profile_data JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_logged_in BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Migrate data from bitbrowser_profiles to browser_instances
INSERT INTO browser_instances (window_id, debug_url, status, last_activity, profile_data, is_logged_in, is_active, last_health_check)
SELECT 
  bp.window_id,
  bp.debug_url,
  CASE 
    WHEN bp.is_active = false THEN 'error'
    WHEN bp.is_logged_in = true THEN 'idle'
    ELSE 'idle'
  END as status,
  bp.last_health_check as last_activity,
  bp.profile_data,
  bp.is_logged_in,
  bp.is_active,
  bp.last_health_check
FROM bitbrowser_profiles bp
WHERE NOT EXISTS (
  SELECT 1 FROM browser_instances bi WHERE bi.window_id = bp.window_id
);

-- 2. Drop views that depend on tables we're going to drop
DROP VIEW IF EXISTS account_window_mapping CASCADE;

-- 3. Drop redundant tables
DROP TABLE IF EXISTS bitbrowser_profiles CASCADE;
DROP TABLE IF EXISTS queue_stats CASCADE;
DROP TABLE IF EXISTS custom_metrics CASCADE;

-- 4. Remove redundant columns from accounts table
ALTER TABLE accounts 
DROP COLUMN IF EXISTS bitbrowser_window_id,
DROP COLUMN IF EXISTS is_window_logged_in;

-- 5. Remove redundant columns from browser_instances table
ALTER TABLE browser_instances
DROP COLUMN IF EXISTS window_name,
DROP COLUMN IF EXISTS is_persistent;

-- 6. Drop indexes for removed columns
DROP INDEX IF EXISTS idx_accounts_bitbrowser_window_id;
DROP INDEX IF EXISTS idx_accounts_bitbrowser_window_name;

-- 7. Recreate simplified account window mapping view
CREATE OR REPLACE VIEW account_window_mapping AS
SELECT 
  a.id as account_id,
  a.email,
  a.status as account_status,
  a.health_score,
  a.bitbrowser_window_name,
  bi.window_id,
  bi.debug_url,
  bi.is_active as window_active,
  bi.is_logged_in as window_logged_in,
  bi.last_health_check,
  bi.status as instance_status
FROM accounts a
LEFT JOIN browser_instances bi ON a.bitbrowser_window_name = bi.window_id
ORDER BY a.email;

-- 8. Add comments to document table purposes
COMMENT ON TABLE accounts IS 'YouTube accounts with credentials and upload limits';
COMMENT ON TABLE upload_tasks IS 'Queue of video upload tasks';
COMMENT ON TABLE browser_instances IS 'BitBrowser window instances and their status';
COMMENT ON TABLE upload_history IS 'Historical record of all upload attempts';
COMMENT ON TABLE upload_errors IS 'Detailed error tracking for failed uploads';
COMMENT ON TABLE metrics_history IS 'Time-series metrics for monitoring and analysis';
COMMENT ON TABLE system_metrics IS 'System-level monitoring metrics';

-- 9. Add comments to important columns
COMMENT ON COLUMN accounts.bitbrowser_window_name IS 'Name of the BitBrowser window assigned to this account';
COMMENT ON COLUMN browser_instances.profile_data IS 'Browser profile configuration (proxy, UA, etc)';
COMMENT ON COLUMN browser_instances.is_logged_in IS 'Whether the browser window has an active YouTube session';

-- 10. Log migration completion
INSERT INTO system_metrics (metric_type, metric_value)
VALUES ('migration', jsonb_build_object(
  'migration_name', '006_cleanup_redundant_tables_and_fields',
  'tables_dropped', ARRAY['bitbrowser_profiles', 'queue_stats', 'custom_metrics'],
  'columns_dropped', ARRAY['accounts.bitbrowser_window_id', 'accounts.is_window_logged_in', 'browser_instances.window_name', 'browser_instances.is_persistent'],
  'timestamp', CURRENT_TIMESTAMP
));