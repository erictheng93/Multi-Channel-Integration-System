-- Remove deprecated app_users table
-- This table has been replaced by the agents table
-- All references have been migrated

-- First, ensure all data is migrated to agents table (if not already done)
-- This is a safety check - should be empty in production

-- Drop the deprecated app_users table
DROP TABLE IF EXISTS app_users;

-- Also drop any related indexes (if they exist separately)
DROP INDEX IF EXISTS app_users_username_unique;
DROP INDEX IF EXISTS app_users_email_unique;

-- Remove from sqlite_sequence if exists
DELETE FROM sqlite_sequence WHERE name='app_users';