-- Migration: 0051_add_broadcast_tables.sql
-- Date: 2026-07-03
-- Purpose: Add Phase 1 broadcast campaign tables for tag-targeted LINE multicast.

CREATE TABLE IF NOT EXISTS broadcasts (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text',
  content TEXT NOT NULL,
  tag_ids TEXT NOT NULL,
  match_mode TEXT NOT NULL DEFAULT 'any',
  status TEXT NOT NULL DEFAULT 'draft',
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  created_by TEXT NOT NULL,
  sent_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (created_by) REFERENCES agents(id) ON UPDATE NO ACTION ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id INTEGER PRIMARY KEY,
  broadcast_id TEXT NOT NULL,
  customer_id INTEGER,
  platform TEXT NOT NULL,
  platform_user_id TEXT NOT NULL,
  resolved_team_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  error_reason TEXT,
  sent_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (broadcast_id) REFERENCES broadcasts(id) ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT broadcast_recipients_broadcast_customer_unique UNIQUE (broadcast_id, customer_id)
);
