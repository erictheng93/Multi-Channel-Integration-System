-- ===============================================
-- Migration 0065: conversations.line_reply_token / line_reply_token_received_at
-- ===============================================
-- Date: 2026-10-28
--
-- Latest unused LINE replyToken from the customer's most recent inbound message,
-- plus the time (epoch ms) the webhook event was received. Agent replies claim the
-- token (set both to NULL, atomically) and use the free Reply API while it is
-- still inside LINE's one-minute validity window; otherwise they fall back to Push.
-- NULL = no usable token.
ALTER TABLE conversations ADD COLUMN line_reply_token TEXT;
ALTER TABLE conversations ADD COLUMN line_reply_token_received_at INTEGER;
