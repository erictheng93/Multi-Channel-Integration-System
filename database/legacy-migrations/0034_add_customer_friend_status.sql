-- Migration: 0031_add_customer_friend_status.sql
-- Description: Add LINE friend status tracking columns to customers table
-- Purpose: Enable display of LINE user friend status (following/blocked/unknown) in UI

-- Add friendStatus column to track LINE friend relationship
-- Values: 'following' (friend), 'blocked' (unfollowed), 'unknown' (status not determined), NULL (default)
ALTER TABLE customers ADD COLUMN friend_status TEXT DEFAULT NULL;

-- Add lastFriendStatusCheck column to track when status was last verified
ALTER TABLE customers ADD COLUMN last_friend_status_check TEXT DEFAULT NULL;

-- Create index for efficient filtering by friend status
CREATE INDEX idx_customers_friend_status ON customers(friend_status);

-- Create composite index for platform + friend status queries (common query pattern)
CREATE INDEX idx_customers_platform_friend_status ON customers(platform, friend_status);
