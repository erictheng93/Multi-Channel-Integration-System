-- ===============================================
-- Migration 0038: Drop agents.team_id column
-- ===============================================
-- Completes the migration started in 0028_add_agent_teams_table.sql
-- which moved team membership to the agent_teams junction table.
--
-- SQLite cannot DROP COLUMN when it has a FOREIGN KEY constraint,
-- so we use the standard table-rebuild approach.
-- PRAGMA foreign_keys must be OFF because other tables reference agents.id.
-- ===============================================

-- Disable FK enforcement for table rebuild
PRAGMA foreign_keys = OFF;

-- Step 1: Create new agents table without team_id and its FK
CREATE TABLE agents_new (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `password_hash` text NOT NULL,
  `display_name` text NOT NULL,
  `role` text DEFAULT 'agent' NOT NULL,
  `is_active` integer DEFAULT 1,
  `password_policy` text DEFAULT 'changeable',
  `last_login_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP,
  `last_active` text,
  `deleted_at` text
);

-- Step 2: Copy all data (excluding team_id)
INSERT INTO agents_new (id, email, password_hash, display_name, role, is_active, password_policy, last_login_at, created_at, updated_at, last_active, deleted_at)
SELECT id, email, password_hash, display_name, role, is_active, password_policy, last_login_at, created_at, updated_at, last_active, deleted_at
FROM agents;

-- Step 3: Drop old table
DROP TABLE agents;

-- Step 4: Rename new table
ALTER TABLE agents_new RENAME TO agents;

-- Step 5: Recreate the unique index on email
CREATE UNIQUE INDEX `agents_email_unique` ON `agents` (`email`);

-- Re-enable FK enforcement
PRAGMA foreign_keys = ON;

-- ===============================================
-- Migration metadata
-- ===============================================
-- Version: 0038
-- Date: 2026-02-15
-- Author: Schema Cleanup
-- Depends on: 0028_add_agent_teams_table (data migration)
-- Breaking Changes: agents.team_id column physically removed
--
-- VERIFICATION (run after migration):
--   SELECT COUNT(*) FROM agent_teams;  -- Should be > 0
--   SELECT sql FROM sqlite_master WHERE name = 'agents';  -- Should NOT contain team_id
