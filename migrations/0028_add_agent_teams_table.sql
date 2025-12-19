-- Migration: Add agent_teams many-to-many relationship table
-- Purpose: Allow agents to belong to unlimited teams (multi-team membership)
-- Created: 2025-06-11
--
-- BACKGROUND:
--   Previously, agents had a single teamId foreign key, limiting them to one team.
--   This migration introduces a junction table for many-to-many relationships,
--   enabling agents to serve multiple teams simultaneously.
--
-- CHANGES:
--   1. Create agent_teams junction table
--   2. Migrate existing teamId data to agent_teams
--   3. Add necessary indexes for performance
--   4. Keep agents.team_id for backward compatibility (primary team)

-- ===============================================
-- 1. Create agent_teams junction table
-- ===============================================

CREATE TABLE IF NOT EXISTS agent_teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Foreign keys
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

  -- Team membership details
  role_in_team TEXT DEFAULT 'member',  -- 'member', 'lead', 'supervisor'
  is_primary INTEGER DEFAULT 0,         -- Boolean: Is this the agent's primary team?

  -- Timestamps
  joined_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),

  -- Prevent duplicate memberships
  UNIQUE(agent_id, team_id)
);

-- ===============================================
-- 2. Add indexes for performance
-- ===============================================

-- Find all teams for an agent (common query)
CREATE INDEX IF NOT EXISTS idx_agent_teams_agent_id
  ON agent_teams(agent_id);

-- Find all members of a team (common query)
CREATE INDEX IF NOT EXISTS idx_agent_teams_team_id
  ON agent_teams(team_id);

-- Find primary team membership
CREATE INDEX IF NOT EXISTS idx_agent_teams_is_primary
  ON agent_teams(agent_id, is_primary)
  WHERE is_primary = 1;

-- Find team leads/supervisors
CREATE INDEX IF NOT EXISTS idx_agent_teams_role
  ON agent_teams(team_id, role_in_team);

-- ===============================================
-- 3. Migrate existing data from agents.team_id
-- ===============================================

-- Insert existing team memberships into the new table
-- Set them as primary teams (is_primary = 1)
INSERT INTO agent_teams (agent_id, team_id, role_in_team, is_primary, joined_at)
SELECT
  id AS agent_id,
  team_id,
  'member' AS role_in_team,
  1 AS is_primary,
  COALESCE(created_at, datetime('now')) AS joined_at
FROM agents
WHERE team_id IS NOT NULL
  AND deleted_at IS NULL;

-- ===============================================
-- Migration metadata
-- ===============================================
-- Version: 0028
-- Date: 2025-06-11
-- Author: System Enhancement
-- Breaking Changes: None (additive, backward compatible)
--
-- NOTE: agents.team_id column is preserved for:
--   1. Backward compatibility with existing code
--   2. Quick lookup of an agent's primary team
--   3. Gradual migration path for API consumers
--
-- FUTURE CONSIDERATION:
--   After full migration to agent_teams:
--   - Update agents.team_id via trigger on agent_teams changes
--   - Or deprecate agents.team_id entirely

-- Rollback SQL:
-- DROP INDEX IF EXISTS idx_agent_teams_agent_id;
-- DROP INDEX IF EXISTS idx_agent_teams_team_id;
-- DROP INDEX IF EXISTS idx_agent_teams_is_primary;
-- DROP INDEX IF EXISTS idx_agent_teams_role;
-- DROP TABLE IF EXISTS agent_teams;
