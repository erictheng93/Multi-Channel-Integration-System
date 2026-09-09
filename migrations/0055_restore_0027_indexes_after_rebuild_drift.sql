-- ===============================================
-- Migration 0055: Restore migration 0027's indexes (rebuild drift repair)
-- ===============================================
-- Date: 2026-07-30
-- Purpose: Re-create the indexes originally declared in
--          `migrations/0027_schema_optimizations.sql`, which are MISSING from
--          production even though `d1_migrations` claims 0027 was applied.
--
-- THIS IS NOT A DUPLICATE OF 0027. READ THIS BEFORE "CLEANING IT UP":
--
--   On 2026-06-17 the production D1 database `mcis-db` was deleted and
--   rebuilt (new database id f58a1c9f-a739-4873-944e-39038e1008c2). The
--   rebuild INSERTED rows into the `d1_migrations` bookkeeping table without
--   executing the corresponding DDL. `d1_migrations` therefore lies: row
--   id=21 records 0027 as applied at 2026-06-17 08:18:50, but not one of its
--   15 indexes exists in the rebuilt database.
--
--   Because `d1_migrations` reports 0027 as already applied, `bun run
--   db:migrate` will never re-run it. The only way to converge production
--   back to the intended schema is a NEW, higher-numbered migration -- this
--   file.
--
-- VERIFIED ABSENT IN PRODUCTION (2026-07-30, read-only query):
--   SELECT name FROM sqlite_master WHERE type='index';
--   -> only idx_broadcast_recipients_broadcast_platform_user,
--      idx_broadcast_recipients_broadcast_status, idx_broadcasts_list,
--      idx_messages_conv_sender_deleted_created exist (all from migrations
--      0052/0053, i.e. applied AFTER the rebuild). Every 0027 index is gone.
--
-- MEASURED IMPACT:
--   The missing `idx_notifications_user_unread` forces two notification
--   queries to full-scan the 6737-row `notifications` table on every call.
--   Per `wrangler d1 insights`, those two queries accounted for 82.2% of all
--   production rows_read (5,031,784 of 6,122,152 in the sampled window).
--   This is the single largest contributor to D1 rows_read billing.
--
-- DEFINITIONS ARE REPRODUCED VERBATIM FROM 0027.
--   Same index names, same tables, same column lists and order, same partial
--   -index WHERE clauses. The goal is restoring the INTENDED state, not
--   redesigning it. Do not "improve" these here -- do that in its own
--   migration so the drift repair stays auditable.
--
-- EXCLUDED FROM THIS RESTORE (1 of 0027's 15 indexes):
--
--   idx_conversations_assigned_user_status
--     ON conversations(assigned_user_id, status) WHERE assigned_user_id IS NOT NULL
--     REASON: the target column no longer exists. Migration 0033
--     (`0033_remove_individual_assignment.sql`) dropped individual
--     assignment in favour of team assignment: it explicitly ran
--     `DROP INDEX IF EXISTS idx_conversations_assigned_user_status` and
--     `ALTER TABLE conversations DROP COLUMN assigned_user_id`.
--     Confirmed against production (`PRAGMA table_info(conversations)` has no
--     assigned_user_id) and against `src/db/schema.ts:102`
--     ("Note: assignedUserId removed - only team assignment is supported now").
--     Re-creating it would make this entire migration fail. The modern
--     equivalent is assigned_team_id, which is out of scope for a pure
--     drift repair.
--
-- ALSO NOT RE-APPLIED HERE (deliberately out of scope):
--   0027 additionally ran `ALTER TABLE ... ADD COLUMN deleted_at TEXT` on
--   conversations/messages/customers/agents/tags/teams. Those columns DO
--   exist in the rebuilt production database (verified via PRAGMA
--   table_info), so only the indexes drifted. SQLite has no
--   `ADD COLUMN IF NOT EXISTS`, so re-issuing them would hard-fail. This
--   migration is indexes only.
--
-- SAFETY:
--   Every statement is CREATE INDEX IF NOT EXISTS -- idempotent and safe to
--   re-run, and safe on any environment where 0027 genuinely did apply (e.g.
--   the local D1 mirror), where it becomes a no-op.
--   Additive only. No data is read, written, or moved.
--
-- Rollback SQL:
--   DROP INDEX IF EXISTS idx_messages_agent_sender_created;
--   DROP INDEX IF EXISTS idx_messages_customer_sender_created;
--   DROP INDEX IF EXISTS idx_messages_thread_id_sequence;
--   DROP INDEX IF EXISTS idx_messages_reply_to;
--   DROP INDEX IF EXISTS idx_conversations_customer_status;
--   DROP INDEX IF EXISTS idx_delayed_messages_status_scheduled;
--   DROP INDEX IF EXISTS idx_tags_team_active;
--   DROP INDEX IF EXISTS idx_file_attachments_upload_status;
--   DROP INDEX IF EXISTS idx_notifications_user_unread;
--   DROP INDEX IF EXISTS idx_conversations_deleted_at;
--   DROP INDEX IF EXISTS idx_messages_deleted_at;
--   DROP INDEX IF EXISTS idx_customers_deleted_at;
--   DROP INDEX IF EXISTS idx_agents_deleted_at;
--   DROP INDEX IF EXISTS idx_teams_deleted_at;
-- ===============================================

-- ===============================================
-- 1. Composite indexes for common queries (from 0027 section 1)
-- ===============================================

-- Messages: Find messages by sender with time ordering
CREATE INDEX IF NOT EXISTS idx_messages_agent_sender_created
  ON messages(agent_sender_id, created_at DESC)
  WHERE agent_sender_id IS NOT NULL;

-- Messages: Find messages by customer with time ordering
CREATE INDEX IF NOT EXISTS idx_messages_customer_sender_created
  ON messages(customer_sender_id, created_at DESC)
  WHERE customer_sender_id IS NOT NULL;

-- Messages: Thread queries (for threaded conversations)
CREATE INDEX IF NOT EXISTS idx_messages_thread_id_sequence
  ON messages(thread_id, session_sequence)
  WHERE thread_id IS NOT NULL;

-- Messages: Reply chain queries
CREATE INDEX IF NOT EXISTS idx_messages_reply_to
  ON messages(reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;

-- Conversations: Active conversations by customer
CREATE INDEX IF NOT EXISTS idx_conversations_customer_status
  ON conversations(customer_id, status);

-- NOTE: idx_conversations_assigned_user_status intentionally omitted.
--       See "EXCLUDED FROM THIS RESTORE" in the header -- conversations
--       .assigned_user_id was dropped by migration 0033.

-- Delayed messages: Pending messages to send
CREATE INDEX IF NOT EXISTS idx_delayed_messages_status_scheduled
  ON delayed_messages(status, scheduled_at)
  WHERE status = 'pending';

-- Tags: Active tags by team
CREATE INDEX IF NOT EXISTS idx_tags_team_active
  ON tags(team_id, is_active)
  WHERE is_active = 1;

-- File attachments: By upload status
CREATE INDEX IF NOT EXISTS idx_file_attachments_upload_status
  ON file_attachments(upload_status)
  WHERE upload_status != 'completed';

-- Notifications: Unread notifications by user
-- (highest-value index in this migration -- see MEASURED IMPACT above)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, is_read)
  WHERE is_read = 0;

-- ===============================================
-- 2. Soft delete indexes (from 0027 section 2)
-- ===============================================
-- The deleted_at COLUMNS already exist in production; only their supporting
-- indexes drifted. Columns are therefore not re-added here.

-- Conversations soft delete
CREATE INDEX IF NOT EXISTS idx_conversations_deleted_at
  ON conversations(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Messages soft delete
CREATE INDEX IF NOT EXISTS idx_messages_deleted_at
  ON messages(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Customers soft delete
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at
  ON customers(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Agents soft delete
CREATE INDEX IF NOT EXISTS idx_agents_deleted_at
  ON agents(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Teams soft delete
CREATE INDEX IF NOT EXISTS idx_teams_deleted_at
  ON teams(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ===============================================
-- Migration metadata
-- ===============================================
-- Version: 0055
-- Restores: migrations/0027_schema_optimizations.sql (indexes only)
-- Root cause: 2026-06-17 production D1 rebuild drift (d1_migrations
--             falsely reports 0027 as applied)
-- Indexes created: 14
-- Indexes excluded: 1 (idx_conversations_assigned_user_status -- column
--                      dropped by migration 0033)
-- Breaking Changes: None (additive, idempotent)
