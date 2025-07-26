-- Migration: Add missing tables for metrics
-- Date: 2025-01-26

-- Create upload_errors table for error tracking
CREATE TABLE IF NOT EXISTS upload_errors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES upload_tasks(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  error_category VARCHAR(100) NOT NULL,
  error_message TEXT,
  error_stack TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for upload_errors
CREATE INDEX IF NOT EXISTS idx_upload_errors_created_at ON upload_errors(created_at);
CREATE INDEX IF NOT EXISTS idx_upload_errors_category ON upload_errors(error_category);
CREATE INDEX IF NOT EXISTS idx_upload_errors_account_id ON upload_errors(account_id);

-- Add missing columns to browser_instances
ALTER TABLE browser_instances
ADD COLUMN IF NOT EXISTS last_health_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create system_metrics table for monitoring
CREATE TABLE IF NOT EXISTS system_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_type VARCHAR(50) NOT NULL,
  metric_value JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for system_metrics
CREATE INDEX IF NOT EXISTS idx_system_metrics_created_at ON system_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_system_metrics_type ON system_metrics(metric_type);

-- Insert default admin user if not exists
INSERT INTO accounts (email, encrypted_credentials, browser_profile_id, status, health_score, metadata)
VALUES (
  'admin@youtube-matrix.com',
  '{"email":"admin@youtube-matrix.com","encryptedPassword":"$2b$10$VXJhVXJhVXJhVXJhVXJhVu5KyOBsb4VYoYoGBh5wCvGvS8dD2JQm6"}', -- Password: admin123
  'profile-admin-default',
  'active',
  100,
  '{"role": "admin", "isDefault": true}'
) ON CONFLICT (email) DO NOTHING;