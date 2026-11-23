-- Migration 0076: "got it" and "got it / ok + thanks" are sign-offs
-- ===============================================================
-- Date: 2026-11-23
--
-- WHY: a customer's 收到 after the agent's "we will wait for your news" started a wait, and the
-- next real request 4 days later showed 待回覆 100 小時 (the marker is the EARLIEST unanswered
-- customer message). Measured read-only on production 2026-11-23: 4 of the 16 conversations
-- waiting within 7 days had been started by a short acknowledgement.
--
-- RULE (src/modules/dashboard/services/awaiting-rules.ts + shared SIGN_OFF_PHRASES, the single
-- definition; the nightly heal uses the same module): after an accepted human reply, a customer
-- text is a sign-off when, lower-cased with spaces / commas / punctuation removed anywhere, it is
--   - thanks (unchanged list), or
--   - 收到 / 了解 / 知道了 / 明白, or
--   - one of those, or 好 / 好的 / ok, followed by thanks (收到謝謝, 好的，謝謝, ok thanks).
-- 好 / 好的 / OK alone still start a wait (they can answer "shall I go ahead?").
-- Punctuation is now ignored anywhere, not only at the end; a newline still makes a message.
--
-- The six awaiting triggers are re-created from their latest definitions (0072, 0073, 0075) with
-- only the sign-off fragment changed (generated; tests/unit/modules/dashboard/awaiting-signoff.test.ts
-- fails on drift). Trigger names are unchanged, so REQUIRED_TRIGGERS stays valid.
-- DEPLOY TOGETHER WITH THE WORKER: the nightly heal re-derives markers with the Worker's rule.

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

-- Backfill: more sign-offs can only move a marker later or clear it, so only marked rows change.
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
