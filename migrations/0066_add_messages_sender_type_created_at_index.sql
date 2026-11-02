-- Migration 0066: index for day-ranged message counts by sender
-- The dashboard counts customer messages per Taipei day and per day x platform
-- (WHERE sender_type = 'customer' AND created_at >= ? AND created_at < ?).
-- Existing indexes cannot serve that: idx_messages_sender_type is single-column
-- (a range scan would still read every customer message), idx_messages_created_at
-- ignores sender_type, and idx_messages_conv_sender_deleted_created leads with
-- conversation_id. This composite turns the count into one index range scan.
-- Reads: messages(sender_type, created_at) only; no table lookups for COUNT(*).
CREATE INDEX IF NOT EXISTS idx_messages_sender_type_created_at
ON messages(sender_type, created_at);
