-- Migration: Update admin user teamId for Channel Management
-- Created: 2025-10-28
-- Purpose: Ensure admin user has teamId set for channel management operations

-- Update admin user to have teamId = 1 (default team)
UPDATE agents
SET
  team_id = 1,
  updated_at = datetime('now')
WHERE
  email = 'admin@dacit.net'
  AND role = 'admin'
  AND (team_id IS NULL OR team_id = 0);

-- Verify the update
SELECT
  id,
  email,
  role,
  team_id,
  updated_at
FROM agents
WHERE email = 'admin@dacit.net';
