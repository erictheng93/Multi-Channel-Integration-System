-- Migration 0053: composite index for unread-count queries
-- Unread-count queries filter messages by (conversation_id, sender_type,
-- deleted_at) and then aggregate on created_at (MAX / range compare).
-- The existing single-column indexes force wide scans; this covering index
-- turns both the per-conversation last-agent-reply lookup and the unread
-- range count into index seeks.
CREATE INDEX IF NOT EXISTS idx_messages_conv_sender_deleted_created
ON messages(conversation_id, sender_type, deleted_at, created_at);
