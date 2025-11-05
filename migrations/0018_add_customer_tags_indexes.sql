-- Migration: Add indexes for customer_tags performance optimization
-- Created: 2025-11-05
-- Purpose: Improve query performance for tag-based customer filtering

-- Index for tag_id lookup (used in getTagCustomers query)
CREATE INDEX IF NOT EXISTS idx_customer_tags_tag_id
ON customer_tags(tag_id);

-- Composite index for tag_id + assigned_at ordering
CREATE INDEX IF NOT EXISTS idx_customer_tags_tag_assigned
ON customer_tags(tag_id, assigned_at DESC);

-- Index for customer_id lookup (used in customer tag management)
CREATE INDEX IF NOT EXISTS idx_customer_tags_customer_id
ON customer_tags(customer_id);

-- Index for assigned_by lookup (for analytics)
CREATE INDEX IF NOT EXISTS idx_customer_tags_assigned_by
ON customer_tags(assigned_by);
