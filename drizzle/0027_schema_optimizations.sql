-- Migration: Schema Optimizations (Multiple Improvements)
-- Purpose: Add missing foreign keys, indexes, soft delete columns, and encryption markers
-- Phase: Post-Phase 3 Optimizations
-- Created: 2025-01-29
--
-- OPTIMIZATIONS INCLUDED:
--   1. Self-referencing foreign key for messages.replyToMessageId
--   2. Additional composite indexes for common queries
--   3. Soft delete (deletedAt) columns for core tables
--   4. Comments for sensitive field encryption strategy

-- ===============================================
-- 1. Add composite indexes for common queries
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

-- Conversations: Team workload queries
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_user_status
  ON conversations(assigned_user_id, status)
  WHERE assigned_user_id IS NOT NULL;

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
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, is_read)
  WHERE is_read = 0;

-- ===============================================
-- 2. Add soft delete columns to core tables
-- ===============================================

-- Conversations soft delete
ALTER TABLE conversations ADD COLUMN deleted_at TEXT;
CREATE INDEX IF NOT EXISTS idx_conversations_deleted_at
  ON conversations(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Messages soft delete
ALTER TABLE messages ADD COLUMN deleted_at TEXT;
CREATE INDEX IF NOT EXISTS idx_messages_deleted_at
  ON messages(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Customers soft delete
ALTER TABLE customers ADD COLUMN deleted_at TEXT;
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at
  ON customers(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Agents soft delete
ALTER TABLE agents ADD COLUMN deleted_at TEXT;
CREATE INDEX IF NOT EXISTS idx_agents_deleted_at
  ON agents(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Tags soft delete (already has is_active, add deleted_at for hard deletion tracking)
ALTER TABLE tags ADD COLUMN deleted_at TEXT;

-- Teams soft delete
ALTER TABLE teams ADD COLUMN deleted_at TEXT;
CREATE INDEX IF NOT EXISTS idx_teams_deleted_at
  ON teams(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ===============================================
-- 3. Note about self-referencing foreign key
-- ===============================================
--
-- messages.reply_to_message_id should reference messages.id
--
-- SQLite foreign key constraint for self-reference:
-- Due to SQLite limitations with ALTER TABLE and foreign keys,
-- this constraint is enforced at the application layer.
--
-- For new tables or full schema recreation, use:
--   reply_to_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL
--
-- Application-level validation is implemented in:
--   - src/modules/messaging/services/message-crud.ts
--   - Validates reply_to_message_id exists before creating message

-- ===============================================
-- 4. Encryption strategy documentation
-- ===============================================
--
-- ENCRYPTED FIELDS (using AES-256-GCM via encryption-service.ts):
--
-- channel_integrations:
--   - credentials (JSON) - All platform access tokens and secrets
--   - Legacy: line_channel_access_token, line_channel_secret
--   - Legacy: facebook_access_token, facebook_app_secret
--   - Legacy: whatsapp_access_token
--
-- agents:
--   - password_hash - Uses bcrypt (not reversible encryption)
--
-- RECOMMENDED FUTURE ENCRYPTION:
--   - customers.email (PII)
--   - customers.phone (PII)
--   - customers.metadata (may contain PII)
--
-- ENCRYPTION KEY MANAGEMENT:
--   - Key stored in: Cloudflare Workers Secrets (ENCRYPTION_KEY)
--   - Key rotation: Via encryption-service.ts rotate() method
--   - Format: JSON with { encrypted, iv, tag } structure

-- ===============================================
-- Migration metadata
-- ===============================================
-- Version: 0027
-- Date: 2025-01-29
-- Author: Database Schema Review
-- Phase: Post-Phase 3 Optimizations
-- Breaking Changes: None (additive only)

-- Rollback SQL (indexes can be safely dropped):
-- DROP INDEX IF EXISTS idx_messages_agent_sender_created;
-- DROP INDEX IF EXISTS idx_messages_customer_sender_created;
-- DROP INDEX IF EXISTS idx_messages_thread_id_sequence;
-- DROP INDEX IF EXISTS idx_messages_reply_to;
-- DROP INDEX IF EXISTS idx_conversations_customer_status;
-- DROP INDEX IF EXISTS idx_conversations_assigned_user_status;
-- DROP INDEX IF EXISTS idx_delayed_messages_status_scheduled;
-- DROP INDEX IF EXISTS idx_tags_team_active;
-- DROP INDEX IF EXISTS idx_file_attachments_upload_status;
-- DROP INDEX IF EXISTS idx_notifications_user_unread;
-- DROP INDEX IF EXISTS idx_conversations_deleted_at;
-- DROP INDEX IF EXISTS idx_messages_deleted_at;
-- DROP INDEX IF EXISTS idx_customers_deleted_at;
-- DROP INDEX IF EXISTS idx_agents_deleted_at;
-- DROP INDEX IF EXISTS idx_teams_deleted_at;
--
-- Note: SQLite doesn't support DROP COLUMN for deleted_at columns
-- Data can remain in columns without breaking existing code
