-- Migration 0074: notification read-path indexes
-- ===============================================================
-- Date: 2026-11-04
--
-- WHY: the notification KV cache was removed (it never invalidated, so mark-read reverted on
-- refresh for up to 5 minutes). Reads now hit D1 directly, and the bell polls unread-count +
-- recent every 30 s per visible tab. Measured on production 2026-11-04 for the user with the most
-- unread rows (945 unread):
--   recent  (WHERE user_id, is_read ORDER BY created_at DESC LIMIT 10)  rows_read 971
--   list    (WHERE user_id ORDER BY created_at DESC LIMIT 20)           rows_read 1889
-- Both sorted every matching row in a temp b-tree before applying LIMIT. With these indexes the
-- planner reads in index order and stops at LIMIT (EXPLAIN QUERY PLAN: no TEMP B-TREE).
--
-- idx_notifications_user_read_created supersedes the partial idx_notifications_user_unread
-- (user_id, is_read) WHERE is_read = 0: same leading columns, also serves is_read = 1 filters and
-- the created_at order. Dropping it avoids paying a third index write on every insert/mark-read.
-- idx_notifications_user_priority (0058) is kept for the priority filter.
--
-- Rollback:
--   DROP INDEX IF EXISTS idx_notifications_user_read_created;
--   DROP INDEX IF EXISTS idx_notifications_user_created;
--   CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = 0;

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON notifications(user_id, is_read, created_at);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at);

DROP INDEX IF EXISTS idx_notifications_user_unread;
