-- Add read_by column to messages table for tracking which agents have read each message
ALTER TABLE messages ADD COLUMN read_by TEXT;
