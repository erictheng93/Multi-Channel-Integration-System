-- Migration: Add uploadStatus field for presigned URL uploads
-- Created: 2025-01-11
-- Purpose: Support direct upload to R2 via presigned URLs
-- Note: uploaded_by and updated_at columns already exist

-- Add uploadStatus column (default 'completed' for existing records)
ALTER TABLE file_attachments ADD COLUMN uploadStatus TEXT DEFAULT 'completed';

-- Create index for uploadStatus to optimize queries for pending uploads
CREATE INDEX IF NOT EXISTS idx_file_attachments_upload_status ON file_attachments(uploadStatus);
