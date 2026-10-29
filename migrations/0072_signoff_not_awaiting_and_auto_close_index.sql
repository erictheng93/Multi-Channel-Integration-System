-- Migration 0072: sign-offs do not start a wait, plus the auto-close index
-- ===============================================================
-- Date: 2026-10-29
--
-- WHY (measured read-only on production 2026-10-29): 143 conversations were awaiting a reply, but
-- 119 of them were older than 30 days. Of the 134 older than 7 days, 22 ended on a sticker and ~55
-- on a short thanks text. A customer saying thanks after being helped is not asking for anything.
--
-- 1. SIGN-OFFS. A customer message does not start a wait when the conversation already has an
--    accepted human reply before it and the message is
--      - a sticker, or
--      - a text whose trimmed, lower-cased content (trailing punctuation removed) is exactly one of
--        謝謝 / 謝謝你 / 謝謝您 / 感謝 / 感謝您 / 多謝 / 3q / thx / thanks / thank you / 謝啦 / 感恩
--    First contact (no earlier human reply) always counts. 好 / 好的 / OK / 收到 are NOT sign-offs.
--    The trigger names are unchanged (REQUIRED_TRIGGERS stays valid). The SQL fragments below are
--    generated from src/modules/dashboard/services/awaiting-rules.ts, the single definition, which
--    the nightly heal (healAwaitingSince) also uses. tests/unit/modules/dashboard/awaiting-signoff.test.ts
--    fails when this file drifts from that module.
-- 2. BACKFILL. awaiting_since is re-derived for every conversation that currently has a marker, so
--    conversations whose only customer messages since the last human reply are sign-offs are cleared.
-- 3. AUTO-CLOSE INDEX. The nightly auto-close (autoCloseIdleConversations) looks for open,
--    not-waiting conversations idle for N days. The partial index holds only those rows, ordered by
--    the last customer message, so the query reads the qualifying prefix and nothing else.
-- 4. The 'system' agent row (from 0039/0040) is the actor of the auto-close activity log
--    (activities.user_id references agents.id). INSERT OR IGNORE: a no-op where it exists.

INSERT OR IGNORE INTO agents (id, email, password_hash, display_name, role, is_active, created_at, updated_at)
VALUES ('system', 'system@internal', 'SYSTEM_NO_LOGIN', 'System', 'admin', 0, datetime('now'), datetime('now'));

DROP TRIGGER IF EXISTS trg_messages_awaiting_customer;
DROP TRIGGER IF EXISTS trg_messages_awaiting_reply_insert;
DROP TRIGGER IF EXISTS trg_messages_awaiting_reply_sent;
DROP TRIGGER IF EXISTS trg_messages_awaiting_recalled;
DROP TRIGGER IF EXISTS trg_messages_awaiting_deleted;

CREATE TRIGGER IF NOT EXISTS trg_messages_awaiting_customer
AFTER INSERT ON messages
WHEN NEW.sender_type = 'customer' AND NEW.deleted_at IS NULL
BEGIN
  UPDATE conversations
  SET awaiting_since = NEW.created_at
  WHERE id = NEW.conversation_id
    AND awaiting_since IS NULL
    AND NOT ((NEW.message_type = 'sticker'
    OR (NEW.message_type = 'text'
        AND TRIM(RTRIM(LOWER(TRIM(NEW.content)), '！!～~。.')) IN ('謝謝', '謝謝你', '謝謝您', '感謝', '感謝您', '多謝', '3q', 'thx', 'thanks', 'thank you', '謝啦', '感恩')))
    AND EXISTS (
      SELECT 1 FROM messages hr
      WHERE hr.conversation_id = NEW.conversation_id
        AND hr.sender_type = 'agent'
    AND hr.deleted_at IS NULL
    AND COALESCE(hr.is_recalled, 0) = 0
    AND COALESCE(hr.is_sent, 1) = 1
    AND (hr.metadata IS NULL OR hr.metadata NOT LIKE '%"broadcastId"%')
        AND hr.created_at < NEW.created_at
    ));
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
      AND NOT ((cm.message_type = 'sticker'
    OR (cm.message_type = 'text'
        AND TRIM(RTRIM(LOWER(TRIM(cm.content)), '！!～~。.')) IN ('謝謝', '謝謝你', '謝謝您', '感謝', '感謝您', '多謝', '3q', 'thx', 'thanks', 'thank you', '謝啦', '感恩')))
    AND EXISTS (
      SELECT 1 FROM messages hr
      WHERE hr.conversation_id = cm.conversation_id
        AND hr.sender_type = 'agent'
    AND hr.deleted_at IS NULL
    AND COALESCE(hr.is_recalled, 0) = 0
    AND COALESCE(hr.is_sent, 1) = 1
    AND (hr.metadata IS NULL OR hr.metadata NOT LIKE '%"broadcastId"%')
        AND hr.created_at < cm.created_at
    ))
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
      AND NOT ((cm.message_type = 'sticker'
    OR (cm.message_type = 'text'
        AND TRIM(RTRIM(LOWER(TRIM(cm.content)), '！!～~。.')) IN ('謝謝', '謝謝你', '謝謝您', '感謝', '感謝您', '多謝', '3q', 'thx', 'thanks', 'thank you', '謝啦', '感恩')))
    AND EXISTS (
      SELECT 1 FROM messages hr
      WHERE hr.conversation_id = cm.conversation_id
        AND hr.sender_type = 'agent'
    AND hr.deleted_at IS NULL
    AND COALESCE(hr.is_recalled, 0) = 0
    AND COALESCE(hr.is_sent, 1) = 1
    AND (hr.metadata IS NULL OR hr.metadata NOT LIKE '%"broadcastId"%')
        AND hr.created_at < cm.created_at
    ))
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
    AND NOT ((cm.message_type = 'sticker'
    OR (cm.message_type = 'text'
        AND TRIM(RTRIM(LOWER(TRIM(cm.content)), '！!～~。.')) IN ('謝謝', '謝謝你', '謝謝您', '感謝', '感謝您', '多謝', '3q', 'thx', 'thanks', 'thank you', '謝啦', '感恩')))
    AND EXISTS (
      SELECT 1 FROM messages hr
      WHERE hr.conversation_id = cm.conversation_id
        AND hr.sender_type = 'agent'
    AND hr.deleted_at IS NULL
    AND COALESCE(hr.is_recalled, 0) = 0
    AND COALESCE(hr.is_sent, 1) = 1
    AND (hr.metadata IS NULL OR hr.metadata NOT LIKE '%"broadcastId"%')
        AND hr.created_at < cm.created_at
    ))
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
    AND NOT ((cm.message_type = 'sticker'
    OR (cm.message_type = 'text'
        AND TRIM(RTRIM(LOWER(TRIM(cm.content)), '！!～~。.')) IN ('謝謝', '謝謝你', '謝謝您', '感謝', '感謝您', '多謝', '3q', 'thx', 'thanks', 'thank you', '謝啦', '感恩')))
    AND EXISTS (
      SELECT 1 FROM messages hr
      WHERE hr.conversation_id = cm.conversation_id
        AND hr.sender_type = 'agent'
    AND hr.deleted_at IS NULL
    AND COALESCE(hr.is_recalled, 0) = 0
    AND COALESCE(hr.is_sent, 1) = 1
    AND (hr.metadata IS NULL OR hr.metadata NOT LIKE '%"broadcastId"%')
        AND hr.created_at < cm.created_at
    ))
)
  WHERE id = NEW.conversation_id;
END;

-- Backfill: only conversations that carry a marker can change (a sign-off can only move or clear it).
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
    AND NOT ((cm.message_type = 'sticker'
    OR (cm.message_type = 'text'
        AND TRIM(RTRIM(LOWER(TRIM(cm.content)), '！!～~。.')) IN ('謝謝', '謝謝你', '謝謝您', '感謝', '感謝您', '多謝', '3q', 'thx', 'thanks', 'thank you', '謝啦', '感恩')))
    AND EXISTS (
      SELECT 1 FROM messages hr
      WHERE hr.conversation_id = cm.conversation_id
        AND hr.sender_type = 'agent'
    AND hr.deleted_at IS NULL
    AND COALESCE(hr.is_recalled, 0) = 0
    AND COALESCE(hr.is_sent, 1) = 1
    AND (hr.metadata IS NULL OR hr.metadata NOT LIKE '%"broadcastId"%')
        AND hr.created_at < cm.created_at
    ))
)
WHERE awaiting_since IS NOT NULL
  AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_auto_close
ON conversations(last_customer_message_at, id)
WHERE awaiting_since IS NULL AND status <> 'closed' AND deleted_at IS NULL;
