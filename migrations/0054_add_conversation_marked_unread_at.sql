-- Migration: 0054_add_conversation_marked_unread_at.sql
-- Date: 2026-07-21
-- Purpose: Add marked_unread_at column to conversations table as a manual
-- unread override. The derived unread formula (customer messages after
-- MAX(last_agent_reply, last_read_at)) recomputes to 0 once the agent has
-- replied last, making "mark as unread" a no-op in that case. When
-- marked_unread_at is set, the effective unread count is floored at 1.
-- Mark-as-read clears the column.

ALTER TABLE conversations ADD COLUMN marked_unread_at TEXT;
