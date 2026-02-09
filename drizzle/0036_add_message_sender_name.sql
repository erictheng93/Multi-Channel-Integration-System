-- Migration: Add sender_name column to messages table
-- Purpose: Persist sender display name at message creation time for internal QA audit trail.
-- This ensures the original sender name is preserved even if the agent account is deleted,
-- renamed, or the conversation is reassigned to a different agent.

ALTER TABLE messages ADD COLUMN sender_name TEXT;
