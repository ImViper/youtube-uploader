-- Migration to add BitBrowser window mapping columns to accounts table
-- These columns store the BitBrowser window name and ID for the account

-- Add bitbrowser_window_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'accounts' 
        AND column_name = 'bitbrowser_window_name'
    ) THEN
        ALTER TABLE accounts ADD COLUMN bitbrowser_window_name VARCHAR(255);
    END IF;
END $$;

-- Add bitbrowser_window_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'accounts' 
        AND column_name = 'bitbrowser_window_id'
    ) THEN
        ALTER TABLE accounts ADD COLUMN bitbrowser_window_id VARCHAR(255);
    END IF;
END $$;

-- Add is_window_logged_in column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'accounts' 
        AND column_name = 'is_window_logged_in'
    ) THEN
        ALTER TABLE accounts ADD COLUMN is_window_logged_in BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Create indexes for better performance when querying by window name and ID
CREATE INDEX IF NOT EXISTS idx_accounts_bitbrowser_window_name ON accounts(bitbrowser_window_name);
CREATE INDEX IF NOT EXISTS idx_accounts_bitbrowser_window_id ON accounts(bitbrowser_window_id);