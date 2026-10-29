-- Migration 0070: conversations.awaiting_since (waiting-for-reply marker)
-- ===============================================================
-- Date: 2026-10-29
--
-- WHY: "which conversations are waiting for an agent" used to be answered by
-- scanning the messages of every open conversation (414 of 428 conversations are
-- open, so that is nearly the whole messages table on every cache miss). The answer
-- is now a column, read through a partial index that holds only waiting rows.
--
-- DEFINITION (same as the previous waiting query, plus delivery acceptance):
--   awaiting_since = created_at of the EARLIEST non-deleted customer message that
--   came after the last HUMAN agent reply; NULL when nothing is unanswered.
--   Human agent reply = sender_type 'agent', is_sent = 1 (accepted by the platform;
--   a failed or still-held recall-window message is not an answer yet), not recalled,
--   not deleted, not a broadcast (metadata carries "broadcastId"). Auto-reply and
--   other system messages (sender_type 'system') never end a wait.
--   Closed / soft-deleted conversations are filtered by the reader, not by the column.
--
-- MAINTENANCE lives in the database so EVERY writer is covered (webhook, queue,
-- LIFF, recall-window delivery, legacy messaging routes, Durable Objects):
--   trg_messages_awaiting_customer      customer message inserted -> set if NULL
--   trg_messages_awaiting_reply_insert  accepted human reply inserted -> advance/clear
--   trg_messages_awaiting_reply_sent    reply flips is_sent 0 -> 1 (delivered) -> advance/clear
--   trg_messages_awaiting_recalled      agent message recalled -> re-derive the marker
--   trg_messages_awaiting_deleted       agent/customer message soft-deleted -> re-derive
-- A reply only affects customer messages at or before its created_at, so a customer
-- message that arrived while a recall-window reply was held stays unanswered.
-- The nightly heal in scheduled() re-derives the marker for open conversations whose
-- value disagrees with the messages (healAwaitingSince). Triggers are migration-only
-- objects: if a database rebuild drops them, the nightly heal still converges the
-- column and check:migrations reports the missing trigger.

ALTER TABLE conversations ADD COLUMN awaiting_since TEXT;

-- Partial index: only waiting rows are stored, so the waiting query reads O(waiting).
-- status / assigned_team_id / deleted_at are carried in the index so the "how many are
-- waiting" count and the open/visibility filters are answered from the index alone
-- (one row read per waiting conversation, no lookup into conversations); only the few
-- rows of the returned page are fetched from the table.
CREATE INDEX IF NOT EXISTS idx_conversations_awaiting_since
ON conversations(awaiting_since, id, status, assigned_team_id, deleted_at)
WHERE awaiting_since IS NOT NULL;

-- Backfill with the definition above for every non-deleted conversation.
UPDATE conversations
SET awaiting_since = (
  SELECT MIN(cm.created_at)
  FROM messages cm
  WHERE cm.conversation_id = conversations.id
    AND cm.sender_type = 'customer'
    AND cm.deleted_at IS NULL
    AND cm.created_at > COALESCE((
      SELECT MAX(am.created_at)
      FROM messages am
      WHERE am.conversation_id = conversations.id
        AND am.sender_type = 'agent'
        AND am.deleted_at IS NULL
        AND COALESCE(am.is_recalled, 0) = 0
        AND COALESCE(am.is_sent, 1) = 1
        AND (am.metadata IS NULL OR am.metadata NOT LIKE '%"broadcastId"%')
    ), '')
)
WHERE deleted_at IS NULL;

CREATE TRIGGER IF NOT EXISTS trg_messages_awaiting_customer
AFTER INSERT ON messages
WHEN NEW.sender_type = 'customer' AND NEW.deleted_at IS NULL
BEGIN
  UPDATE conversations
  SET awaiting_since = NEW.created_at
  WHERE id = NEW.conversation_id AND awaiting_since IS NULL;
END;

CREATE TRIGGER IF NOT EXISTS trg_messages_awaiting_reply_insert
AFTER INSERT ON messages
WHEN NEW.sender_type = 'agent'
  AND COALESCE(NEW.is_sent, 1) = 1
  AND COALESCE(NEW.is_recalled, 0) = 0
  AND NEW.deleted_at IS NULL
  AND (NEW.metadata IS NULL OR NEW.metadata NOT LIKE '%"broadcastId"%')
BEGIN
  UPDATE conversations
  SET awaiting_since = (
    SELECT MIN(cm.created_at)
    FROM messages cm
    WHERE cm.conversation_id = NEW.conversation_id
      AND cm.sender_type = 'customer'
      AND cm.deleted_at IS NULL
      AND cm.created_at > NEW.created_at
  )
  WHERE id = NEW.conversation_id
    AND awaiting_since IS NOT NULL
    AND awaiting_since <= NEW.created_at;
END;

CREATE TRIGGER IF NOT EXISTS trg_messages_awaiting_reply_sent
AFTER UPDATE OF is_sent ON messages
WHEN NEW.sender_type = 'agent'
  AND COALESCE(OLD.is_sent, 1) = 0
  AND NEW.is_sent = 1
  AND COALESCE(NEW.is_recalled, 0) = 0
  AND NEW.deleted_at IS NULL
  AND (NEW.metadata IS NULL OR NEW.metadata NOT LIKE '%"broadcastId"%')
BEGIN
  UPDATE conversations
  SET awaiting_since = (
    SELECT MIN(cm.created_at)
    FROM messages cm
    WHERE cm.conversation_id = NEW.conversation_id
      AND cm.sender_type = 'customer'
      AND cm.deleted_at IS NULL
      AND cm.created_at > NEW.created_at
  )
  WHERE id = NEW.conversation_id
    AND awaiting_since IS NOT NULL
    AND awaiting_since <= NEW.created_at;
END;

-- Re-derive from scratch when the message that decided the marker is recalled or deleted.
CREATE TRIGGER IF NOT EXISTS trg_messages_awaiting_recalled
AFTER UPDATE OF is_recalled ON messages
WHEN NEW.sender_type = 'agent'
  AND COALESCE(OLD.is_recalled, 0) = 0
  AND COALESCE(NEW.is_recalled, 0) = 1
BEGIN
  UPDATE conversations
  SET awaiting_since = (
    SELECT MIN(cm.created_at)
    FROM messages cm
    WHERE cm.conversation_id = NEW.conversation_id
      AND cm.sender_type = 'customer'
      AND cm.deleted_at IS NULL
      AND cm.created_at > COALESCE((
        SELECT MAX(am.created_at)
        FROM messages am
        WHERE am.conversation_id = NEW.conversation_id
          AND am.sender_type = 'agent'
          AND am.deleted_at IS NULL
          AND COALESCE(am.is_recalled, 0) = 0
          AND COALESCE(am.is_sent, 1) = 1
          AND (am.metadata IS NULL OR am.metadata NOT LIKE '%"broadcastId"%')
      ), '')
  )
  WHERE id = NEW.conversation_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_messages_awaiting_deleted
AFTER UPDATE OF deleted_at ON messages
WHEN NEW.sender_type IN ('agent', 'customer')
  AND OLD.deleted_at IS NULL
  AND NEW.deleted_at IS NOT NULL
BEGIN
  UPDATE conversations
  SET awaiting_since = (
    SELECT MIN(cm.created_at)
    FROM messages cm
    WHERE cm.conversation_id = NEW.conversation_id
      AND cm.sender_type = 'customer'
      AND cm.deleted_at IS NULL
      AND cm.created_at > COALESCE((
        SELECT MAX(am.created_at)
        FROM messages am
        WHERE am.conversation_id = NEW.conversation_id
          AND am.sender_type = 'agent'
          AND am.deleted_at IS NULL
          AND COALESCE(am.is_recalled, 0) = 0
          AND COALESCE(am.is_sent, 1) = 1
          AND (am.metadata IS NULL OR am.metadata NOT LIKE '%"broadcastId"%')
      ), '')
  )
  WHERE id = NEW.conversation_id;
END;
