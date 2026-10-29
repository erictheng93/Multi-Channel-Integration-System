-- Migration 0071: conversations.last_customer_message_at / last_agent_message_at
-- ===============================================================
-- Date: 2026-10-29
--
-- WHY: GET /api/conversations/stats computes this agent's unread totals. The old query
-- joined every visible conversation to its messages (last agent reply, then every
-- customer message after the per-agent threshold): ~10,300 rows read per call, polled
-- every 120 s by every open tab. Whether a conversation can be unread at all is decided
-- by two timestamps, so they are stored on the conversation:
--
--   last_customer_message_at  MAX(created_at) of non-deleted customer messages
--   last_agent_message_at     MAX(created_at) of non-deleted agent OR system messages
--                             (system = auto-reply; exactly the set the unread threshold
--                             uses, which is NOT the same set as awaiting_since's
--                             "human reply")
--
-- A conversation has unread customer messages for agent A iff it is not closed and
--   last_customer_message_at > MAX(last_agent_message_at, A.last_read_at, unread_floor_at)
-- (or A flagged it manually unread). Only those conversations need their messages
-- counted. The unread definition itself (per-agent read state, unread floor 0064,
-- manual unread, closed = 0) is unchanged.
--
-- Maintenance is by triggers on messages (same pattern as 0070), so every writer is
-- covered; soft delete / undelete re-derive from the remaining messages. The nightly
-- heal (healMessageMarkers) repairs drift and the migration backfills from history.

ALTER TABLE conversations ADD COLUMN last_customer_message_at TEXT;
ALTER TABLE conversations ADD COLUMN last_agent_message_at TEXT;

UPDATE conversations
SET last_customer_message_at = (
      SELECT MAX(m.created_at) FROM messages m
      WHERE m.conversation_id = conversations.id AND m.sender_type = 'customer' AND m.deleted_at IS NULL),
    last_agent_message_at = (
      SELECT MAX(m.created_at) FROM messages m
      WHERE m.conversation_id = conversations.id AND m.sender_type IN ('agent', 'system') AND m.deleted_at IS NULL);

-- Conversations where the customer spoke after the last agent/system reply: the only ones
-- that can have unread customer messages (read state / floor only raise the threshold).
-- Covering for the stats query: no lookups into conversations for rows that fail the filter.
CREATE INDEX IF NOT EXISTS idx_conversations_customer_after_agent
ON conversations(last_customer_message_at, id, status, assigned_team_id, unread_floor_at, last_agent_message_at)
WHERE last_customer_message_at > COALESCE(last_agent_message_at, '');

-- The stats endpoint also counts conversations by (team, status). With both columns in one
-- index the GROUP BY is answered from the index alone: one row read per conversation instead
-- of an index entry plus a table row.
CREATE INDEX IF NOT EXISTS idx_conversations_team_status
ON conversations(assigned_team_id, status);

-- Agents' manual "mark unread" flags (usually a handful per agent).
CREATE INDEX IF NOT EXISTS idx_conversation_read_states_marked_unread
ON conversation_read_states(agent_id, conversation_id)
WHERE marked_unread_at IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS trg_messages_marker_customer_insert
AFTER INSERT ON messages
WHEN NEW.sender_type = 'customer' AND NEW.deleted_at IS NULL
BEGIN
  UPDATE conversations
  SET last_customer_message_at = NEW.created_at
  WHERE id = NEW.conversation_id
    AND (last_customer_message_at IS NULL OR last_customer_message_at < NEW.created_at);
END;

CREATE TRIGGER IF NOT EXISTS trg_messages_marker_agent_insert
AFTER INSERT ON messages
WHEN NEW.sender_type IN ('agent', 'system') AND NEW.deleted_at IS NULL
BEGIN
  UPDATE conversations
  SET last_agent_message_at = NEW.created_at
  WHERE id = NEW.conversation_id
    AND (last_agent_message_at IS NULL OR last_agent_message_at < NEW.created_at);
END;

CREATE TRIGGER IF NOT EXISTS trg_messages_marker_customer_deleted
AFTER UPDATE OF deleted_at ON messages
WHEN NEW.sender_type = 'customer' AND (OLD.deleted_at IS NULL) <> (NEW.deleted_at IS NULL)
BEGIN
  UPDATE conversations
  SET last_customer_message_at = (
    SELECT MAX(m.created_at) FROM messages m
    WHERE m.conversation_id = NEW.conversation_id AND m.sender_type = 'customer' AND m.deleted_at IS NULL)
  WHERE id = NEW.conversation_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_messages_marker_agent_deleted
AFTER UPDATE OF deleted_at ON messages
WHEN NEW.sender_type IN ('agent', 'system') AND (OLD.deleted_at IS NULL) <> (NEW.deleted_at IS NULL)
BEGIN
  UPDATE conversations
  SET last_agent_message_at = (
    SELECT MAX(m.created_at) FROM messages m
    WHERE m.conversation_id = NEW.conversation_id AND m.sender_type IN ('agent', 'system') AND m.deleted_at IS NULL)
  WHERE id = NEW.conversation_id;
END;
