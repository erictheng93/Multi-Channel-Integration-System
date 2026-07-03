-- Migration: 0052_add_broadcast_identity_indexes.sql
-- Date: 2026-07-03
-- Purpose: Add broadcast recipient identity and hot-path lookup indexes.
--
-- Preflight before applying to production:
--   SELECT broadcast_id, platform, platform_user_id, COUNT(*) AS duplicate_count
--   FROM broadcast_recipients
--   GROUP BY broadcast_id, platform, platform_user_id
--   HAVING COUNT(*) > 1;
--
-- If this query returns rows, deduplicate them before applying this migration;
-- the unique index below is the database-level guard against duplicate sends.

CREATE UNIQUE INDEX IF NOT EXISTS idx_broadcast_recipients_broadcast_platform_user
ON broadcast_recipients(broadcast_id, platform, platform_user_id);

CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_broadcast_status
ON broadcast_recipients(broadcast_id, status);

CREATE INDEX IF NOT EXISTS idx_broadcasts_list
ON broadcasts(deleted_at, created_at);
