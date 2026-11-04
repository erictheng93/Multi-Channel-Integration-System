-- Migration 0073: re-derive awaiting_since when a customer message's content or type is edited
-- ===============================================================
-- Date: 2026-11-03
--
-- WHY: since 0072 the sign-off rule depends on content and message_type, but no awaiting trigger
-- watched those columns. An admin editing a post-reply "謝謝" into a real question through
-- PUT /api/conversations/:id/messages/:messageId left awaiting_since NULL, and the nightly heal
-- skips it (no marker, old created_at), so the conversation dropped out of both waiting lists and
-- could be auto-closed. The expression is awaitingExpression('NEW.conversation_id') from
-- src/modules/dashboard/services/awaiting-rules.ts (verified by awaiting-signoff.test.ts).

DROP TRIGGER IF EXISTS trg_messages_awaiting_customer_edited;

CREATE TRIGGER IF NOT EXISTS trg_messages_awaiting_customer_edited
AFTER UPDATE OF content, message_type ON messages
WHEN NEW.sender_type = 'customer'
  AND NEW.deleted_at IS NULL
  AND (NEW.content IS NOT OLD.content OR NEW.message_type IS NOT OLD.message_type)
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
