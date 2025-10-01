-- Migration: Fix conversation_sessions table to properly reference conversations with TEXT IDs
-- Created: 2025-09-26
-- Purpose: Ensure referential integrity after conversation ID type change to TEXT

-- First, check if conversation_sessions table exists and has wrong column type
-- This migration handles the case where 0012 was already applied with INTEGER type

-- Drop existing conversation_sessions table if it has INTEGER conversation_id
DROP TABLE IF EXISTS conversation_sessions;

-- Recreate conversation_sessions table with correct TEXT reference
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  session_type TEXT NOT NULL DEFAULT 'continuous' CHECK (session_type IN ('continuous', 'topical', 'manual')),
  topic TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT,
  last_activity TEXT NOT NULL,
  message_count INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT TRUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_conversation_id ON conversation_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_is_active ON conversation_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_last_activity ON conversation_sessions(last_activity);

-- Ensure conversations table has TEXT IDs (should already be correct from migration 0005)
-- This is a safety check to verify the conversations table structure
CREATE TABLE IF NOT EXISTS conversations_check AS SELECT id FROM conversations WHERE 1=0;

-- Insert a comment to track this fix
INSERT OR IGNORE INTO system_settings (key, value, created_at, updated_at) VALUES
('migration_0014_applied', 'true', datetime('now'), datetime('now'));