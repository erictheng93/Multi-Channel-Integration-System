-- Migration 0035: Remove LINE Friend Status columns from customers table
-- This removes the friendStatus feature that was added in migration 0031/0034

-- Step 1: Drop indexes that reference friend_status
DROP INDEX IF EXISTS idx_customers_friend_status;
DROP INDEX IF EXISTS idx_customers_platform_friend_status;

-- Step 2: Drop the friend_status column
ALTER TABLE customers DROP COLUMN friend_status;

-- Step 3: Drop the last_friend_status_check column
ALTER TABLE customers DROP COLUMN last_friend_status_check;
