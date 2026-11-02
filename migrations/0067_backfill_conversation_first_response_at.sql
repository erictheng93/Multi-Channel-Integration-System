-- Migration 0067: backfill conversations.first_response_at
-- Nothing wrote this column before, so every row is NULL. From now on it is
-- stamped on the first HUMAN agent reply (see first-response.ts). History is
-- reconstructed with the same rule:
--   first message per conversation that is
--     - sender_type = 'agent'  (auto-reply is 'system', customers are 'customer')
--     - not a broadcast        (broadcast rows carry "broadcastId" in metadata)
--     - actually sent          (is_sent = 1, delivery_status <> 'failed')
--     - not recalled, not soft-deleted
-- Idempotent: only rows still NULL are touched, and a conversation with no
-- qualifying message is set to NULL again (no change).
UPDATE conversations
SET first_response_at = (
  SELECT MIN(m.created_at)
  FROM messages m
  WHERE m.conversation_id = conversations.id
    AND m.sender_type = 'agent'
    AND m.deleted_at IS NULL
    AND COALESCE(m.is_recalled, 0) = 0
    AND m.is_sent = 1
    AND COALESCE(m.delivery_status, 'sent') <> 'failed'
    AND (m.metadata IS NULL OR m.metadata NOT LIKE '%"broadcastId"%')
)
WHERE first_response_at IS NULL;
