-- Migration: 0037_fix_file_attachments_column_names.sql
-- Date: 2026-02-14
-- Purpose: Rename file_attachments camelCase columns to snake_case
--
-- CONTEXT:
--   Migration 0025 was recorded in d1_migrations (id=28) but the RENAME COLUMN
--   statements never actually executed. Production DB still has camelCase columns:
--     mimeType, fileSize, fileUrl, r2Key, uploadStatus
--
--   This migration replays the same renames with a new migration number so D1
--   will actually execute it.
--
-- AFFECTED COLUMNS:
--   mimeType     → mime_type
--   fileSize     → file_size
--   fileUrl      → file_url
--   r2Key        → r2_key
--   uploadStatus → upload_status
--
-- NOTE: SQLite 3.25.0+ supports ALTER TABLE RENAME COLUMN.
-- Cloudflare D1 uses SQLite 3.42.0+, so this is fully supported.
-- If a column has already been renamed, the statement will error.
-- Since D1 runs migrations atomically, partial application is not possible.

-- ===============================================
-- 1. Rename mimeType → mime_type
-- ===============================================
ALTER TABLE file_attachments RENAME COLUMN mimeType TO mime_type;

-- ===============================================
-- 2. Rename fileSize → file_size
-- ===============================================
ALTER TABLE file_attachments RENAME COLUMN fileSize TO file_size;

-- ===============================================
-- 3. Rename fileUrl → file_url
-- ===============================================
ALTER TABLE file_attachments RENAME COLUMN fileUrl TO file_url;

-- ===============================================
-- 4. Rename r2Key → r2_key
-- ===============================================
ALTER TABLE file_attachments RENAME COLUMN r2Key TO r2_key;

-- ===============================================
-- 5. Rename uploadStatus → upload_status
-- ===============================================
ALTER TABLE file_attachments RENAME COLUMN uploadStatus TO upload_status;

-- ===============================================
-- Verification (run manually after migration):
-- PRAGMA table_info(file_attachments);
--
-- Expected columns (all snake_case):
--   id, message_id, filename, mime_type, file_size,
--   file_url, r2_key, url, created_at, conversation_id,
--   uploaded_by, updated_at, upload_status
-- ===============================================

-- Rollback SQL (if needed):
-- ALTER TABLE file_attachments RENAME COLUMN mime_type TO mimeType;
-- ALTER TABLE file_attachments RENAME COLUMN file_size TO fileSize;
-- ALTER TABLE file_attachments RENAME COLUMN file_url TO fileUrl;
-- ALTER TABLE file_attachments RENAME COLUMN r2_key TO r2Key;
-- ALTER TABLE file_attachments RENAME COLUMN upload_status TO uploadStatus;
