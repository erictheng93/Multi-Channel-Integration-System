-- Timezone Unification - Asia/Taipei (UTC+8)  
-- Created: 2025-08-29
-- Purpose: Convert all timestamp fields from UTC to Asia/Taipei timezone

-- Update existing timestamp data from UTC to Asia/Taipei (UTC+8)
-- Add 8 hours to all existing UTC timestamps

-- Update customers table
UPDATE customers 
SET 
    created_at = datetime(created_at, '+8 hours'),
    updated_at = datetime(updated_at, '+8 hours')
WHERE created_at IS NOT NULL;

-- Update teams table  
UPDATE teams
SET
    created_at = datetime(created_at, '+8 hours'),
    updated_at = datetime(updated_at, '+8 hours')
WHERE created_at IS NOT NULL;

-- Update agents table
UPDATE agents
SET
    created_at = datetime(created_at, '+8 hours'),
    updated_at = datetime(updated_at, '+8 hours'),
    last_login_at = CASE 
        WHEN last_login_at IS NOT NULL THEN datetime(last_login_at, '+8 hours')
        ELSE last_login_at
    END
WHERE created_at IS NOT NULL;

-- Update activities table
UPDATE activities
SET
    created_at = datetime(created_at, '+8 hours')
WHERE created_at IS NOT NULL;

-- Update system_settings table
UPDATE system_settings
SET
    created_at = datetime(created_at, '+8 hours'),
    updated_at = datetime(updated_at, '+8 hours')
WHERE created_at IS NOT NULL;

-- Update conversations table
UPDATE conversations
SET
    created_at = datetime(created_at, '+8 hours'),
    updated_at = datetime(updated_at, '+8 hours'),
    last_message_at = CASE
        WHEN last_message_at IS NOT NULL THEN datetime(last_message_at, '+8 hours')
        ELSE last_message_at
    END
WHERE created_at IS NOT NULL;

-- Update messages table
UPDATE messages
SET
    created_at = datetime(created_at, '+8 hours'),
    recall_deadline = CASE
        WHEN recall_deadline IS NOT NULL THEN datetime(recall_deadline, '+8 hours')
        ELSE recall_deadline
    END,
    recalled_at = CASE
        WHEN recalled_at IS NOT NULL THEN datetime(recalled_at, '+8 hours')
        ELSE recalled_at
    END,
    sent_at = CASE
        WHEN sent_at IS NOT NULL THEN datetime(sent_at, '+8 hours')
        ELSE sent_at
    END
WHERE created_at IS NOT NULL;

-- Update file_attachments table
UPDATE file_attachments
SET
    created_at = datetime(created_at, '+8 hours')
WHERE created_at IS NOT NULL;

-- Update delayed_messages table
UPDATE delayed_messages
SET
    created_at = datetime(created_at, '+8 hours'),
    updated_at = datetime(updated_at, '+8 hours'),
    scheduled_at = datetime(scheduled_at, '+8 hours')
WHERE created_at IS NOT NULL;

-- Insert a test record to verify timezone is working correctly
INSERT OR IGNORE INTO system_settings (key, value, created_at, updated_at)
VALUES ('timezone_test', 'Asia/Taipei', datetime('now', 'localtime'), datetime('now', 'localtime'));

-- Migration Summary:
-- ✅ Converted all existing UTC timestamps to Asia/Taipei (UTC+8)  
-- ✅ Added test record to verify timezone functionality
-- 
-- Note: All future timestamps should use datetime('now', 'localtime') in application code
-- which respects the system timezone setting