-- BitBrowser Matrix Integration Database Schema
-- PostgreSQL 13+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  encrypted_credentials TEXT NOT NULL,
  browser_profile_id VARCHAR(255) UNIQUE NOT NULL,
  bitbrowser_window_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'limited', 'suspended', 'error')),
  daily_upload_count INTEGER DEFAULT 0,
  daily_upload_limit INTEGER DEFAULT 2,
  last_upload_time TIMESTAMP,
  health_score INTEGER DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Upload tasks table
CREATE TABLE IF NOT EXISTS upload_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  video_data JSONB NOT NULL,
  priority INTEGER DEFAULT 0 CHECK (priority >= 0 AND priority <= 10),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'failed')),
  error TEXT,
  result JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  scheduled_for TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Browser instances table
CREATE TABLE IF NOT EXISTS browser_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  window_id VARCHAR(255) UNIQUE NOT NULL,
  debug_url VARCHAR(255),
  status VARCHAR(50) DEFAULT 'idle' CHECK (status IN ('idle', 'busy', 'error')),
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  error_count INTEGER DEFAULT 0,
  upload_count INTEGER DEFAULT 0,
  last_activity TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Upload history table
CREATE TABLE IF NOT EXISTS upload_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES upload_tasks(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  browser_instance_id UUID REFERENCES browser_instances(id) ON DELETE SET NULL,
  video_url TEXT,
  upload_duration INTEGER, -- in seconds
  success BOOLEAN NOT NULL,
  error_details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
CREATE INDEX IF NOT EXISTS idx_accounts_health_score ON accounts(health_score);
CREATE INDEX IF NOT EXISTS idx_accounts_daily_upload_count ON accounts(daily_upload_count);
CREATE INDEX IF NOT EXISTS idx_upload_tasks_status ON upload_tasks(status);
CREATE INDEX IF NOT EXISTS idx_upload_tasks_priority ON upload_tasks(priority DESC);
CREATE INDEX IF NOT EXISTS idx_upload_tasks_scheduled_for ON upload_tasks(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_upload_tasks_account_id ON upload_tasks(account_id);
CREATE INDEX IF NOT EXISTS idx_browser_instances_status ON browser_instances(status);
CREATE INDEX IF NOT EXISTS idx_browser_instances_account_id ON browser_instances(account_id);
CREATE INDEX IF NOT EXISTS idx_upload_history_account_id ON upload_history(account_id);
CREATE INDEX IF NOT EXISTS idx_upload_history_created_at ON upload_history(created_at);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to reset daily upload counts
CREATE OR REPLACE FUNCTION reset_daily_upload_counts()
RETURNS void AS $$
BEGIN
  UPDATE accounts SET daily_upload_count = 0;
END;
$$ LANGUAGE plpgsql;

-- View for account health summary
DROP VIEW IF EXISTS account_health_summary CASCADE;
CREATE VIEW account_health_summary AS
SELECT 
  a.id,
  a.email,
  a.status,
  a.health_score,
  a.daily_upload_count,
  a.daily_upload_limit,
  COUNT(DISTINCT uh.id) FILTER (WHERE uh.success = true AND uh.created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours') as successful_uploads_24h,
  COUNT(DISTINCT uh.id) FILTER (WHERE uh.success = false AND uh.created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours') as failed_uploads_24h,
  ROUND(
    CASE 
      WHEN COUNT(DISTINCT uh.id) FILTER (WHERE uh.created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours') > 0
      THEN (COUNT(DISTINCT uh.id) FILTER (WHERE uh.success = true AND uh.created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours')::numeric / 
            COUNT(DISTINCT uh.id) FILTER (WHERE uh.created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours')) * 100
      ELSE 100
    END, 2
  ) as success_rate_24h
FROM accounts a
LEFT JOIN upload_history uh ON a.id = uh.account_id
GROUP BY a.id, a.email, a.status, a.health_score, a.daily_upload_count, a.daily_upload_limit;

-- View for task queue status
DROP VIEW IF EXISTS task_queue_status CASCADE;
CREATE VIEW task_queue_status AS
SELECT 
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at))) as avg_age_seconds,
  MIN(priority) as min_priority,
  MAX(priority) as max_priority
FROM upload_tasks
WHERE status IN ('pending', 'active')
GROUP BY status;

-- Metrics history table for time-series data
CREATE TABLE IF NOT EXISTS metrics_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMP NOT NULL,
  metric_type VARCHAR(50) NOT NULL,
  metric_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_metrics_history_timestamp ON metrics_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_history_type ON metrics_history(metric_type);