-- Migration: Change conversation ID from integer to text for better scalability
-- Created: 2025-08-29

-- Create new conversations table with string ID
CREATE TABLE conversations_new (
  id TEXT PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  assigned_team_id INTEGER REFERENCES teams(id),
  assigned_user_id INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  last_message_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create new messages table with string conversation_id
CREATE TABLE messages_new (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations_new(id),
  sender_type TEXT NOT NULL,
  sender_id INTEGER,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  platform_message_id TEXT,
  is_recalled INTEGER DEFAULT 0,
  recall_deadline TEXT,
  recalled_at TEXT,
  is_sent INTEGER DEFAULT 1,
  sent_at TEXT,
  delivery_status TEXT DEFAULT 'delivered',
  reply_to_message_id TEXT,
  thread_id TEXT,
  session_id TEXT,
  session_sequence INTEGER DEFAULT 1,
  metadata TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Drop old tables (since we removed users table and want clean migration)
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS delayed_messages;

-- Rename new tables to final names
ALTER TABLE conversations_new RENAME TO conversations;
ALTER TABLE messages_new RENAME TO messages;

-- Recreate delayed_messages table with string conversation_id
CREATE TABLE delayed_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  scheduled_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_customer ON conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_delayed_messages_scheduled_at ON delayed_messages(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_delayed_messages_status ON delayed_messages(status);