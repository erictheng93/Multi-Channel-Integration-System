-- Migration 0075: reply triggers re-derive awaiting_since instead of only advancing it
-- ===============================================================
-- Date: 2026-11-10
--
-- WHY (#223): trg_messages_awaiting_reply_insert / _reply_sent acted only when
-- awaiting_since <= the reply's created_at. Since 0072 a reply can also change messages AFTER
-- it into sign-offs, and a reply can land after a later customer message: a recall-window reply
-- delivered after a first-contact "謝謝", or a reply committed out of timestamp order. The marker
-- then stayed on the thanks until the nightly heal (healAwaitingSince).
--
-- FIX: both triggers set the full definition, awaitingExpression('NEW.conversation_id') from
-- src/modules/dashboard/services/awaiting-rules.ts (verified by awaiting-signoff.test.ts), on any
-- conversation that has a marker. A reply can only clear or move a marker, never start one, so
-- conversations without a marker are skipped. Trigger names are unchanged, so REQUIRED_TRIGGERS
-- in src/health-checkers/schema-integrity.ts and the runbook check stay valid.
-- No backfill: the nightly heal already converges any marker this left behind.

DROP TRIGGER IF EXISTS trg_messages_awaiting_reply_insert;
DROP TRIGGER IF EXISTS trg_messages_awaiting_reply_sent;

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
  WHERE id = NEW.conversation_id
    AND awaiting_since IS NOT NULL;
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
  WHERE id = NEW.conversation_id
    AND awaiting_since IS NOT NULL;
END;
