-- Migration: Add indexes for customers table to optimize platform filtering
-- Created: 2025-11-18
-- Purpose: Optimize Analytics platform filter performance with EXISTS subquery

-- Add index on platform column for efficient platform filtering
CREATE INDEX IF NOT EXISTS idx_customers_platform
ON customers(platform);

-- Add composite index on (platform, id) for optimal EXISTS subquery performance
CREATE INDEX IF NOT EXISTS idx_customers_platform_id
ON customers(platform, id);

-- Add index on customer id for JOIN operations (if not already exists from schema)
-- This helps with the EXISTS subquery WHERE clause
CREATE INDEX IF NOT EXISTS idx_customers_id
ON customers(id);
