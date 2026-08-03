-- ===============================================
-- Migration 0058: Add notifications.priority (and updated_at)
-- ===============================================
-- Date: 2026-08-03
-- Purpose: Give the `notifications` table the two columns its write path has
--          been trying to populate all along.
--
-- WHY THIS IS A FIX, NOT A FEATURE:
--
--   notification-repository.ts has always sent `priority` and `updatedAt` on
--   every insert. Drizzle maps values by SCHEMA column, and neither column was
--   declared in src/db/schema.ts, so both were silently discarded on every
--   write. Nothing errored; the data just never arrived.
--
--   The effect was visible to users. `new_conversation` notifications are
--   created with `priority: 'high'` and are 7070 of the 7102 rows in
--   production - 99.5%. The WebSocket broadcast carries the real priority, so
--   NotificationCard.vue rendered its high-priority badge the moment the
--   notification arrived. On refresh the REST API re-read the row, found no
--   priority, and mapToNotification fell back to 'normal' - so the badge
--   vanished. Same notification, two different priorities depending on how you
--   got it.
--
--   The priority filter in NotificationFilters.vue was dead for the same
--   reason: notification-repository.ts had the WHERE clause commented out with
--   the note "(priority field not available in current schema)". 0058 restores
--   it.
--
-- BACKFILL, AND THE JUDGEMENT IN IT:
--
--   Existing rows are backfilled to the priority their creator intended, read
--   off the call sites in src/utils/notification-trigger.ts:
--
--     new_conversation   -> 'high'    (createBulk passes priority: 'high')
--     customer_followed  -> 'normal'  (the DB create() passes no priority at
--                                      all; only its WebSocket broadcast sets
--                                      'high', and that never touched the DB)
--
--   Any other type keeps the column DEFAULT of 'normal'. Production currently
--   has only those two types, so this covers every existing row.
--
--   This is a reconstruction of intent, not recovered data - the original
--   values were never stored. If you would rather not assert intent
--   retroactively, drop the two UPDATE statements and every existing row stays
--   'normal'; new rows will be correct either way.
--
--   updated_at is deliberately NOT backfilled. It is unknown for existing
--   rows, and inventing a value would be worse than leaving it NULL.
--
-- SAFETY:
--   ALTER TABLE ... ADD COLUMN is an O(1) metadata change in SQLite; it does
--   not rewrite the table, so 7102 rows are unaffected in practice. Both
--   columns are nullable with a DEFAULT, so existing readers are unaffected.
--
--   NOT idempotent: SQLite has no `ADD COLUMN IF NOT EXISTS`, so re-running
--   this fails with "duplicate column name". That is intentional - it is how
--   the migration runner is meant to work, and d1_migrations prevents a second
--   run. Do not wrap it in anything clever.
--
-- Rollback SQL:
--   ALTER TABLE notifications DROP COLUMN priority;
--   ALTER TABLE notifications DROP COLUMN updated_at;
--   (and re-comment the priority filter in notification-repository.ts)
-- ===============================================

ALTER TABLE notifications ADD COLUMN priority TEXT DEFAULT 'normal';

ALTER TABLE notifications ADD COLUMN updated_at TEXT;

-- Backfill to the priority each type was created with. See header.
UPDATE notifications SET priority = 'high'   WHERE type = 'new_conversation';
UPDATE notifications SET priority = 'normal' WHERE type = 'customer_followed';

-- Supports the now-enabled priority filter and the per-priority stats SUMs.
CREATE INDEX IF NOT EXISTS idx_notifications_user_priority
  ON notifications(user_id, priority);
