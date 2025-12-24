-- Migration: Enhance file_attachments table
-- Add uploadedBy, conversationId, updatedAt fields for better tracking
-- Date: 2025-01-12

-- Add conversation_id column to track which conversation the file belongs to
ALTER TABLE file_attachments ADD COLUMN conversation_id TEXT REFERENCES conversations(id);

-- Add uploaded_by column to track who uploaded the file (agent/staff ID)
ALTER TABLE file_attachments ADD COLUMN uploaded_by TEXT REFERENCES agents(id);

-- Add updated_at column for tracking modifications
ALTER TABLE file_attachments ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP;

-- Create index for faster lookups by conversation
CREATE INDEX IF NOT EXISTS idx_file_attachments_conversation_id ON file_attachments(conversation_id);

-- Create index for faster lookups by uploader
CREATE INDEX IF NOT EXISTS idx_file_attachments_uploaded_by ON file_attachments(uploaded_by);

-- Create index for faster lookups by creation date
CREATE INDEX IF NOT EXISTS idx_file_attachments_created_at ON file_attachments(created_at);
