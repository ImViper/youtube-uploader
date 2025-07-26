-- Migration: Add browser window mapping fields
-- Date: 2024-01-26

-- Add browser window mapping fields to accounts table
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS bitbrowser_window_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS bitbrowser_window_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_window_logged_in BOOLEAN DEFAULT false;

-- Create indexes for window mapping
CREATE INDEX IF NOT EXISTS idx_accounts_bitbrowser_window_id ON accounts(bitbrowser_window_id);
CREATE INDEX IF NOT EXISTS idx_accounts_bitbrowser_window_name ON accounts(bitbrowser_window_name);

-- Create browser profiles table to store window configurations
CREATE TABLE IF NOT EXISTS bitbrowser_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  window_id VARCHAR(255) UNIQUE NOT NULL,
  window_name VARCHAR(255) NOT NULL,
  debug_url VARCHAR(255),
  profile_data JSONB DEFAULT '{}', -- stores proxy, UA, and other configurations
  is_logged_in BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_health_check TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for window lookup
CREATE INDEX IF NOT EXISTS idx_bitbrowser_profiles_window_name ON bitbrowser_profiles(window_name);
CREATE INDEX IF NOT EXISTS idx_bitbrowser_profiles_is_active ON bitbrowser_profiles(is_active);

-- Update browser_instances table to track window persistence
ALTER TABLE browser_instances
ADD COLUMN IF NOT EXISTS is_persistent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS window_name VARCHAR(255);

-- Add trigger to update updated_at for bitbrowser_profiles
CREATE TRIGGER update_bitbrowser_profiles_updated_at BEFORE UPDATE ON bitbrowser_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create view for account-window mapping status
CREATE OR REPLACE VIEW account_window_mapping AS
SELECT 
  a.id as account_id,
  a.email,
  a.status as account_status,
  a.health_score,
  a.bitbrowser_window_id,
  a.bitbrowser_window_name,
  a.is_window_logged_in,
  bp.window_id,
  bp.debug_url,
  bp.is_active as window_active,
  bp.last_health_check,
  bi.status as instance_status
FROM accounts a
LEFT JOIN bitbrowser_profiles bp ON a.bitbrowser_window_id = bp.window_id
LEFT JOIN browser_instances bi ON bp.window_id = bi.window_id
ORDER BY a.email;