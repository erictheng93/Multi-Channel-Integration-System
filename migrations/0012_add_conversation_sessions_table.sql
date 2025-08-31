-- Migration: Add conversation_sessions table for session management
-- UP
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id TEXT PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id),
  session_type TEXT NOT NULL DEFAULT 'continuous' CHECK (session_type IN ('continuous', 'topical', 'manual')),
  topic TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT,
  last_activity TEXT NOT NULL,
  message_count INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT TRUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_conversation_id ON conversation_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_is_active ON conversation_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_last_activity ON conversation_sessions(last_activity);

-- Add lastActive column to agents table if not exists
ALTER TABLE agents ADD COLUMN last_active TEXT;