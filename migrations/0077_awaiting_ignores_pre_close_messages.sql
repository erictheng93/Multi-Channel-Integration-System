-- Migration 0077: a closed conversation's earlier messages never count toward 待回覆
-- ===============================================================
-- Date: 2026-11-23
--
-- WHY: closing did not touch awaiting_since, and the customer-insert trigger skips re-deriving while a marker
-- is set and the new message is newer. A conversation closed while waiting therefore reopened (customer's next
-- message) with its months-old marker: 待回覆 N 個月. The nightly auto-close now also closes stale waits
-- (no message for 30 days; 60 of an admin's 84 unread on 2026-11-23), so this would become common.
--
-- RULE (src/modules/dashboard/services/awaiting-rules.ts awaitingExpression, the single definition; the
-- nightly heal uses the same module): a customer message counts toward a wait only if it is after the
-- conversation's unread_floor_at (set when it is closed, kept on reopen) — the same floor unread already uses.
-- setConversationsClosed now also clears awaiting_since on close (Worker change, deployed with this).
--
-- The six awaiting triggers are re-created from 0076 with only awaitingExpression changed (generated;
-- tests/unit/modules/dashboard/awaiting-signoff.test.ts fails on drift). Names unchanged.
-- DEPLOY TOGETHER WITH THE WORKER: the nightly heal and the close path use the Worker's rule.

DROP TRIGGER IF EXISTS trg_messages_awaiting_customer;
DROP TRIGGER IF EXISTS trg_messages_awaiting_recalled;
DROP TRIGGER IF EXISTS trg_messages_awaiting_deleted;
DROP TRIGGER IF EXISTS trg_messages_awaiting_customer_edited;
DROP TRIGGER IF EXISTS trg_messages_awaiting_reply_insert;
DROP TRIGGER IF EXISTS trg_messages_awaiting_reply_sent;

CREATE TRIGGER IF NOT EXISTS trg_messages_awaiting_customer
AFTER INSERT ON messages
WHEN NEW.sender_type = 'customer' AND NEW.deleted_at IS NULL
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
    AND cm.created_at > COALESCE((
      SELECT fc.unread_floor_at FROM conversations fc WHERE fc.id = NEW.conversation_id
    ), '')
    AND NOT ((cm.message_type = 'sticker'
    OR (cm.message_type = 'text'
        AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(cm.content), ' ', ''), '，', ''), ',', ''), '、', ''), '！', ''), '!', ''), '～', ''), '~', ''), '。', ''), '.', '') IN ('謝謝', '謝謝你', '謝謝您', '感謝', '感謝您', '多謝', '3q', 'thx', 'thanks', 'thankyou', '謝啦', '感恩', '收到', '了解', '知道了', '明白', '收到謝謝', '收到謝謝你', '收到謝謝您', '收到感謝', '收到感謝您', '收到多謝', '收到3q', '收到thx', '收到thanks', '收到thankyou', '收到謝啦', '收到感恩', '了解謝謝', '了解謝謝你', '了解謝謝您', '了解感謝', '了解感謝您', '了解多謝', '了解3q', '了解thx', '了解thanks', '了解thankyou', '了解謝啦', '了解感恩', '知道了謝謝', '知道了謝謝你', '知道了謝謝您', '知道了感謝', '知道了感謝您', '知道了多謝', '知道了3q', '知道了thx', '知道了thanks', '知道了thankyou', '知道了謝啦', '知道了感恩', '明白謝謝', '明白謝謝你', '明白謝謝您', '明白感謝', '明白感謝您', '明白多謝', '明白3q', '明白thx', '明白thanks', '明白thankyou', '明白謝啦', '明白感恩', '好謝謝', '好謝謝你', '好謝謝您', '好感謝', '好感謝您', '好多謝', '好3q', '好thx', '好thanks', '好thankyou', '好謝啦', '好感恩', '好的謝謝', '好的謝謝你', '好的謝謝您', '好的感謝', '好的感謝您', '好的多謝', '好的3q', '好的thx', '好的thanks', '好的thankyou', '好的謝啦', '好的感恩', 'ok謝謝', 'ok謝謝你', 'ok謝謝您', 'ok感謝', 'ok感謝您', 'ok多謝', 'ok3q', 'okthx', 'okthanks', 'okthankyou', 'ok謝啦', 'ok感恩')))
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
    AND (awaiting_since IS NULL OR awaiting_since > NEW.created_at);
END;

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
    AND cm.created_at > COALESCE((
      SELECT fc.unread_floor_at FROM conversations fc WHERE fc.id = NEW.conversation_id
    ), '')
    AND NOT ((cm.message_type = 'sticker'
    OR (cm.message_type = 'text'
        AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(cm.content), ' ', ''), '，', ''), ',', ''), '、', ''), '！', ''), '!', ''), '～', ''), '~', ''), '。', ''), '.', '') IN ('謝謝', '謝謝你', '謝謝您', '感謝', '感謝您', '多謝', '3q', 'thx', 'thanks', 'thankyou', '謝啦', '感恩', '收到', '了解', '知道了', '明白', '收到謝謝', '收到謝謝你', '收到謝謝您', '收到感謝', '收到感謝您', '收到多謝', '收到3q', '收到thx', '收到thanks', '收到thankyou', '收到謝啦', '收到感恩', '了解謝謝', '了解謝謝你', '了解謝謝您', '了解感謝', '了解感謝您', '了解多謝', '了解3q', '了解thx', '了解thanks', '了解thankyou', '了解謝啦', '了解感恩', '知道了謝謝', '知道了謝謝你', '知道了謝謝您', '知道了感謝', '知道了感謝您', '知道了多謝', '知道了3q', '知道了thx', '知道了thanks', '知道了thankyou', '知道了謝啦', '知道了感恩', '明白謝謝', '明白謝謝你', '明白謝謝您', '明白感謝', '明白感謝您', '明白多謝', '明白3q', '明白thx', '明白thanks', '明白thankyou', '明白謝啦', '明白感恩', '好謝謝', '好謝謝你', '好謝謝您', '好感謝', '好感謝您', '好多謝', '好3q', '好thx', '好thanks', '好thankyou', '好謝啦', '好感恩', '好的謝謝', '好的謝謝你', '好的謝謝您', '好的感謝', '好的感謝您', '好的多謝', '好的3q', '好的thx', '好的thanks', '好的thankyou', '好的謝啦', '好的感恩', 'ok謝謝', 'ok謝謝你', 'ok謝謝您', 'ok感謝', 'ok感謝您', 'ok多謝', 'ok3q', 'okthx', 'okthanks', 'okthankyou', 'ok謝啦', 'ok感恩')))
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
    AND cm.created_at > COALESCE((
      SELECT fc.unread_floor_at FROM conversations fc WHERE fc.id = NEW.conversation_id
    ), '')
    AND NOT ((cm.message_type = 'sticker'
    OR (cm.message_type = 'text'
        AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(cm.content), ' ', ''), '，', ''), ',', ''), '、', ''), '！', ''), '!', ''), '～', ''), '~', ''), '。', ''), '.', '') IN ('謝謝', '謝謝你', '謝謝您', '感謝', '感謝您', '多謝', '3q', 'thx', 'thanks', 'thankyou', '謝啦', '感恩', '收到', '了解', '知道了', '明白', '收到謝謝', '收到謝謝你', '收到謝謝您', '收到感謝', '收到感謝您', '收到多謝', '收到3q', '收到thx', '收到thanks', '收到thankyou', '收到謝啦', '收到感恩', '了解謝謝', '了解謝謝你', '了解謝謝您', '了解感謝', '了解感謝您', '了解多謝', '了解3q', '了解thx', '了解thanks', '了解thankyou', '了解謝啦', '了解感恩', '知道了謝謝', '知道了謝謝你', '知道了謝謝您', '知道了感謝', '知道了感謝您', '知道了多謝', '知道了3q', '知道了thx', '知道了thanks', '知道了thankyou', '知道了謝啦', '知道了感恩', '明白謝謝', '明白謝謝你', '明白謝謝您', '明白感謝', '明白感謝您', '明白多謝', '明白3q', '明白thx', '明白thanks', '明白thankyou', '明白謝啦', '明白感恩', '好謝謝', '好謝謝你', '好謝謝您', '好感謝', '好感謝您', '好多謝', '好3q', '好thx', '好thanks', '好thankyou', '好謝啦', '好感恩', '好的謝謝', '好的謝謝你', '好的謝謝您', '好的感謝', '好的感謝您', '好的多謝', '好的3q', '好的thx', '好的thanks', '好的thankyou', '好的謝啦', '好的感恩', 'ok謝謝', 'ok謝謝你', 'ok謝謝您', 'ok感謝', 'ok感謝您', 'ok多謝', 'ok3q', 'okthx', 'okthanks', 'okthankyou', 'ok謝啦', 'ok感恩')))
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
    AND cm.created_at > COALESCE((
      SELECT fc.unread_floor_at FROM conversations fc WHERE fc.id = NEW.conversation_id
    ), '')
    AND NOT ((cm.message_type = 'sticker'
    OR (cm.message_type = 'text'
        AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(cm.content), ' ', ''), '，', ''), ',', ''), '、', ''), '！', ''), '!', ''), '～', ''), '~', ''), '。', ''), '.', '') IN ('謝謝', '謝謝你', '謝謝您', '感謝', '感謝您', '多謝', '3q', 'thx', 'thanks', 'thankyou', '謝啦', '感恩', '收到', '了解', '知道了', '明白', '收到謝謝', '收到謝謝你', '收到謝謝您', '收到感謝', '收到感謝您', '收到多謝', '收到3q', '收到thx', '收到thanks', '收到thankyou', '收到謝啦', '收到感恩', '了解謝謝', '了解謝謝你', '了解謝謝您', '了解感謝', '了解感謝您', '了解多謝', '了解3q', '了解thx', '了解thanks', '了解thankyou', '了解謝啦', '了解感恩', '知道了謝謝', '知道了謝謝你', '知道了謝謝您', '知道了感謝', '知道了感謝您', '知道了多謝', '知道了3q', '知道了thx', '知道了thanks', '知道了thankyou', '知道了謝啦', '知道了感恩', '明白謝謝', '明白謝謝你', '明白謝謝您', '明白感謝', '明白感謝您', '明白多謝', '明白3q', '明白thx', '明白thanks', '明白thankyou', '明白謝啦', '明白感恩', '好謝謝', '好謝謝你', '好謝謝您', '好感謝', '好感謝您', '好多謝', '好3q', '好thx', '好thanks', '好thankyou', '好謝啦', '好感恩', '好的謝謝', '好的謝謝你', '好的謝謝您', '好的感謝', '好的感謝您', '好的多謝', '好的3q', '好的thx', '好的thanks', '好的thankyou', '好的謝啦', '好的感恩', 'ok謝謝', 'ok謝謝你', 'ok謝謝您', 'ok感謝', 'ok感謝您', 'ok多謝', 'ok3q', 'okthx', 'okthanks', 'okthankyou', 'ok謝啦', 'ok感恩')))
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
    AND cm.created_at > COALESCE((
      SELECT fc.unread_floor_at FROM conversations fc WHERE fc.id = NEW.conversation_id
    ), '')
    AND NOT ((cm.message_type = 'sticker'
    OR (cm.message_type = 'text'
        AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(cm.content), ' ', ''), '，', ''), ',', ''), '、', ''), '！', ''), '!', ''), '～', ''), '~', ''), '。', ''), '.', '') IN ('謝謝', '謝謝你', '謝謝您', '感謝', '感謝您', '多謝', '3q', 'thx', 'thanks', 'thankyou', '謝啦', '感恩', '收到', '了解', '知道了', '明白', '收到謝謝', '收到謝謝你', '收到謝謝您', '收到感謝', '收到感謝您', '收到多謝', '收到3q', '收到thx', '收到thanks', '收到thankyou', '收到謝啦', '收到感恩', '了解謝謝', '了解謝謝你', '了解謝謝您', '了解感謝', '了解感謝您', '了解多謝', '了解3q', '了解thx', '了解thanks', '了解thankyou', '了解謝啦', '了解感恩', '知道了謝謝', '知道了謝謝你', '知道了謝謝您', '知道了感謝', '知道了感謝您', '知道了多謝', '知道了3q', '知道了thx', '知道了thanks', '知道了thankyou', '知道了謝啦', '知道了感恩', '明白謝謝', '明白謝謝你', '明白謝謝您', '明白感謝', '明白感謝您', '明白多謝', '明白3q', '明白thx', '明白thanks', '明白thankyou', '明白謝啦', '明白感恩', '好謝謝', '好謝謝你', '好謝謝您', '好感謝', '好感謝您', '好多謝', '好3q', '好thx', '好thanks', '好thankyou', '好謝啦', '好感恩', '好的謝謝', '好的謝謝你', '好的謝謝您', '好的感謝', '好的感謝您', '好的多謝', '好的3q', '好的thx', '好的thanks', '好的thankyou', '好的謝啦', '好的感恩', 'ok謝謝', 'ok謝謝你', 'ok謝謝您', 'ok感謝', 'ok感謝您', 'ok多謝', 'ok3q', 'okthx', 'okthanks', 'okthankyou', 'ok謝啦', 'ok感恩')))
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
    AND cm.created_at > COALESCE((
      SELECT fc.unread_floor_at FROM conversations fc WHERE fc.id = NEW.conversation_id
    ), '')
    AND NOT ((cm.message_type = 'sticker'
    OR (cm.message_type = 'text'
        AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(cm.content), ' ', ''), '，', ''), ',', ''), '、', ''), '！', ''), '!', ''), '～', ''), '~', ''), '。', ''), '.', '') IN ('謝謝', '謝謝你', '謝謝您', '感謝', '感謝您', '多謝', '3q', 'thx', 'thanks', 'thankyou', '謝啦', '感恩', '收到', '了解', '知道了', '明白', '收到謝謝', '收到謝謝你', '收到謝謝您', '收到感謝', '收到感謝您', '收到多謝', '收到3q', '收到thx', '收到thanks', '收到thankyou', '收到謝啦', '收到感恩', '了解謝謝', '了解謝謝你', '了解謝謝您', '了解感謝', '了解感謝您', '了解多謝', '了解3q', '了解thx', '了解thanks', '了解thankyou', '了解謝啦', '了解感恩', '知道了謝謝', '知道了謝謝你', '知道了謝謝您', '知道了感謝', '知道了感謝您', '知道了多謝', '知道了3q', '知道了thx', '知道了thanks', '知道了thankyou', '知道了謝啦', '知道了感恩', '明白謝謝', '明白謝謝你', '明白謝謝您', '明白感謝', '明白感謝您', '明白多謝', '明白3q', '明白thx', '明白thanks', '明白thankyou', '明白謝啦', '明白感恩', '好謝謝', '好謝謝你', '好謝謝您', '好感謝', '好感謝您', '好多謝', '好3q', '好thx', '好thanks', '好thankyou', '好謝啦', '好感恩', '好的謝謝', '好的謝謝你', '好的謝謝您', '好的感謝', '好的感謝您', '好的多謝', '好的3q', '好的thx', '好的thanks', '好的thankyou', '好的謝啦', '好的感恩', 'ok謝謝', 'ok謝謝你', 'ok謝謝您', 'ok感謝', 'ok感謝您', 'ok多謝', 'ok3q', 'okthx', 'okthanks', 'okthankyou', 'ok謝啦', 'ok感恩')))
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

-- Conversations closed before the close path wrote unread_floor_at (7 on 2026-11-23, closed 2026-08..10) get
-- their close time as the floor, so they too reopen with a fresh wait. Closed rows show 0 unread either way.
UPDATE conversations
SET unread_floor_at = closed_at
WHERE status = 'closed'
  AND unread_floor_at IS NULL
  AND closed_at IS NOT NULL;

-- Backfill: the floor can only clear or move a marker later, so only marked rows change. Open conversations
-- with a pre-close marker were 0 on 2026-11-23; closed ones are cleared (readers ignore closed rows anyway).
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
    AND cm.created_at > COALESCE((
      SELECT fc.unread_floor_at FROM conversations fc WHERE fc.id = conversations.id
    ), '')
    AND NOT ((cm.message_type = 'sticker'
    OR (cm.message_type = 'text'
        AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(cm.content), ' ', ''), '，', ''), ',', ''), '、', ''), '！', ''), '!', ''), '～', ''), '~', ''), '。', ''), '.', '') IN ('謝謝', '謝謝你', '謝謝您', '感謝', '感謝您', '多謝', '3q', 'thx', 'thanks', 'thankyou', '謝啦', '感恩', '收到', '了解', '知道了', '明白', '收到謝謝', '收到謝謝你', '收到謝謝您', '收到感謝', '收到感謝您', '收到多謝', '收到3q', '收到thx', '收到thanks', '收到thankyou', '收到謝啦', '收到感恩', '了解謝謝', '了解謝謝你', '了解謝謝您', '了解感謝', '了解感謝您', '了解多謝', '了解3q', '了解thx', '了解thanks', '了解thankyou', '了解謝啦', '了解感恩', '知道了謝謝', '知道了謝謝你', '知道了謝謝您', '知道了感謝', '知道了感謝您', '知道了多謝', '知道了3q', '知道了thx', '知道了thanks', '知道了thankyou', '知道了謝啦', '知道了感恩', '明白謝謝', '明白謝謝你', '明白謝謝您', '明白感謝', '明白感謝您', '明白多謝', '明白3q', '明白thx', '明白thanks', '明白thankyou', '明白謝啦', '明白感恩', '好謝謝', '好謝謝你', '好謝謝您', '好感謝', '好感謝您', '好多謝', '好3q', '好thx', '好thanks', '好thankyou', '好謝啦', '好感恩', '好的謝謝', '好的謝謝你', '好的謝謝您', '好的感謝', '好的感謝您', '好的多謝', '好的3q', '好的thx', '好的thanks', '好的thankyou', '好的謝啦', '好的感恩', 'ok謝謝', 'ok謝謝你', 'ok謝謝您', 'ok感謝', 'ok感謝您', 'ok多謝', 'ok3q', 'okthx', 'okthanks', 'okthankyou', 'ok謝啦', 'ok感恩')))
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
