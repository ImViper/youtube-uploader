-- Migration: Add metrics_history table
-- Date: 2025-01-27

-- Create metrics_history table for historical metric tracking
CREATE TABLE IF NOT EXISTS metrics_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metric_type VARCHAR(100) NOT NULL,
  metric_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_metrics_history_timestamp ON metrics_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_history_metric_type ON metrics_history(metric_type);
CREATE INDEX IF NOT EXISTS idx_metrics_history_created_at ON metrics_history(created_at);

-- Create index for time-series queries
CREATE INDEX IF NOT EXISTS idx_metrics_history_type_timestamp ON metrics_history(metric_type, timestamp DESC);

-- Add partition for better performance with time-series data (optional)
-- This will automatically partition by month
-- COMMENT: Enable this if you have high volume of metrics
-- ALTER TABLE metrics_history SET (timescaledb.create_default_indexes=false);
-- SELECT create_hypertable('metrics_history', 'timestamp', if_not_exists => TRUE);