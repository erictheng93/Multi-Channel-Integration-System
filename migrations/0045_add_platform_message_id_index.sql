-- Migration: 0045_add_platform_message_id_index.sql
-- Date: 2026-03-19
-- Purpose: Add missing index on messages.platform_message_id to eliminate full table scans
--
-- This column is queried on EVERY incoming webhook for duplicate/idempotency checks:
-- 1. webhook-conversation-service.ts:215 — WHERE platform_message_id = ? (duplicate detection)
-- 2. message-normalization-service.ts:510 — SELECT id FROM messages WHERE platform_message_id = ? (idempotency)
-- 3. file-proxy.ts:203 — WHERE platform_message_id = ? (LINE media lookup)
--
-- Without this index, each webhook triggers a full table scan on the messages table.
-- Expected improvement: O(N) -> O(log N) per lookup

CREATE INDEX IF NOT EXISTS idx_messages_platform_message_id
ON messages(platform_message_id) WHERE platform_message_id IS NOT NULL;
