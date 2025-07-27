-- Migration: Fix database issues - queue_stats, system_metrics, and last_health_check
-- Date: 2025-01-27

-- 1. Create queue_stats table (if not exists from views)
-- This table is for queue statistics tracking
CREATE TABLE IF NOT EXISTS queue_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status VARCHAR(50) NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  avg_age_seconds NUMERIC,
  min_priority INTEGER,
  max_priority INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for queue_stats
CREATE INDEX IF NOT EXISTS idx_queue_stats_status ON queue_stats(status);
CREATE INDEX IF NOT EXISTS idx_queue_stats_created_at ON queue_stats(created_at);

-- 2. The system_metrics table already exists from migration 002
-- Just verify it exists and add any missing columns
DO $$
BEGIN
    -- Check if system_metrics table exists
    IF NOT EXISTS (SELECT FROM information_schema.tables 
                   WHERE table_schema = 'public' 
                   AND table_name = 'system_metrics') THEN
        -- Create system_metrics table
        CREATE TABLE system_metrics (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          metric_type VARCHAR(50) NOT NULL,
          metric_value JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Create indexes
        CREATE INDEX idx_system_metrics_created_at ON system_metrics(created_at);
        CREATE INDEX idx_system_metrics_type ON system_metrics(metric_type);
    END IF;
END$$;

-- 3. The last_health_check column should already exist from migration 002
-- But verify and add if missing
DO $$
BEGIN
    -- Check if last_health_check column exists in browser_instances
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'browser_instances' 
                   AND column_name = 'last_health_check') THEN
        -- Add the column
        ALTER TABLE browser_instances
        ADD COLUMN last_health_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END$$;

-- 4. Create custom_metrics table for the recordMetric function
CREATE TABLE IF NOT EXISTS custom_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  value NUMERIC NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  labels JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for custom_metrics
CREATE INDEX IF NOT EXISTS idx_custom_metrics_name ON custom_metrics(name);
CREATE INDEX IF NOT EXISTS idx_custom_metrics_timestamp ON custom_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_custom_metrics_created_at ON custom_metrics(created_at);

-- 5. Drop and recreate task_queue_status view to use correct status values
-- The upload_tasks table uses 'pending', 'active', 'completed', 'failed'
-- But the query in metrics.ts looks for 'queued' and 'processing'
DROP VIEW IF EXISTS task_queue_status;
CREATE VIEW task_queue_status AS
SELECT 
  CASE 
    WHEN status = 'pending' THEN 'queued'
    WHEN status = 'active' THEN 'processing'
    ELSE status
  END as status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at))) as avg_age_seconds,
  MIN(priority) as min_priority,
  MAX(priority) as max_priority
FROM upload_tasks
WHERE status IN ('pending', 'active')
GROUP BY status;

-- 6. Add missing indexes for better performance
CREATE INDEX IF NOT EXISTS idx_browser_instances_last_health_check ON browser_instances(last_health_check);
CREATE INDEX IF NOT EXISTS idx_upload_errors_task_id ON upload_errors(task_id);

-- 7. Update browser_instances with health check timestamp where missing
UPDATE browser_instances 
SET last_health_check = COALESCE(last_activity, created_at)
WHERE last_health_check IS NULL;