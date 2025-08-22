-- Migration: Add password_policy column to agents table
-- Created: 2025-01-21

ALTER TABLE agents ADD COLUMN password_policy TEXT DEFAULT 'changeable';

-- Update existing agents to have default changeable policy
UPDATE agents SET password_policy = 'changeable' WHERE password_policy IS NULL;