-- Migration: 0047_add_conversation_last_read_at.sql
-- Date: 2026-03-24
-- Purpose: Add last_read_at column to conversations table for tracking when
-- an agent last viewed the conversation. Used to compute unread message counts:
-- unread = customer messages after MAX(last_agent_reply, last_read_at).

ALTER TABLE conversations ADD COLUMN last_read_at TEXT;
