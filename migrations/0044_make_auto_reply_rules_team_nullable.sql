-- ===============================================
-- Migration 0044: Make auto_reply_rules.team_id Nullable
-- ===============================================
-- Date: 2026-03-17
-- Purpose: Allow global/channel-level auto-reply rules that fire for ALL
--          conversations regardless of team assignment. Rules with
--          team_id = NULL are global rules; rules with a specific team_id
--          are team-specific overrides.
--
-- SQLite cannot ALTER COLUMN, so we use the recreate-table pattern.
-- ===============================================

PRAGMA foreign_keys=OFF;

-- 1. Create new table with team_id nullable
CREATE TABLE `auto_reply_rules_new` (
  `id` integer PRIMARY KEY,
  `team_id` integer REFERENCES `teams`(`id`) ON DELETE CASCADE,
  `name` text NOT NULL,
  `trigger_type` text NOT NULL,
  `priority` integer NOT NULL DEFAULT 100,
  `is_active` integer DEFAULT 1,
  `created_by` text REFERENCES `agents`(`id`) ON DELETE SET NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` text
);

-- 2. Copy existing data
INSERT INTO `auto_reply_rules_new`
  SELECT * FROM `auto_reply_rules`;

-- 3. Drop old table
DROP TABLE `auto_reply_rules`;

-- 4. Rename new table
ALTER TABLE `auto_reply_rules_new` RENAME TO `auto_reply_rules`;

-- 5. Recreate indexes
CREATE INDEX IF NOT EXISTS `idx_auto_reply_rules_team_active`
  ON `auto_reply_rules`(`team_id`, `is_active`) WHERE `deleted_at` IS NULL;

-- 6. Add index for global rules (team_id IS NULL)
CREATE INDEX IF NOT EXISTS `idx_auto_reply_rules_global_active`
  ON `auto_reply_rules`(`is_active`) WHERE `team_id` IS NULL AND `deleted_at` IS NULL;

PRAGMA foreign_keys=ON;
