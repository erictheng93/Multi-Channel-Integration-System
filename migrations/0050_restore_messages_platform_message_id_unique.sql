-- Migration: 0050_restore_messages_platform_message_id_unique.sql
-- Date: 2026-06-30
-- Purpose: Restore database-level idempotency for inbound webhook messages.
--
-- Context:
--   Migration 0011 originally added UNIQUE(platform_message_id) to messages.
--   The schema was later rebuilt without that unique constraint, and 0045 only
--   restored a non-unique lookup index. Application-level duplicate checks are
--   still useful, but the database must remain the final idempotency boundary.
--
-- Preflight before applying to production:
--   SELECT platform_message_id, COUNT(*) AS duplicate_count
--   FROM messages
--   WHERE platform_message_id IS NOT NULL
--   GROUP BY platform_message_id
--   HAVING COUNT(*) > 1;
--
-- If the query returns rows, deduplicate those records before applying this
-- migration; CREATE UNIQUE INDEX will fail until all duplicates are removed.

DROP INDEX IF EXISTS idx_messages_platform_message_id;

CREATE UNIQUE INDEX IF NOT EXISTS messages_platform_message_id_unique
ON messages(platform_message_id)
WHERE platform_message_id IS NOT NULL;
