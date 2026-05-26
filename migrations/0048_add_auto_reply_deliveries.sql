-- Migration: 0048_add_auto_reply_deliveries.sql
-- Date: 2026-05-26
-- Purpose: Add an idempotency ledger for webhook-triggered auto-reply delivery.

CREATE TABLE IF NOT EXISTS auto_reply_deliveries (
  id INTEGER PRIMARY KEY,
  platform TEXT NOT NULL DEFAULT 'line',
  platform_message_id TEXT NOT NULL,
  rule_id INTEGER REFERENCES auto_reply_rules(id) ON DELETE SET NULL,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reply_method TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  last_attempt_at TEXT,
  sent_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(platform, platform_message_id)
);

CREATE INDEX IF NOT EXISTS idx_auto_reply_deliveries_status
ON auto_reply_deliveries(status, updated_at);

CREATE INDEX IF NOT EXISTS idx_auto_reply_deliveries_conversation
ON auto_reply_deliveries(conversation_id, created_at);
