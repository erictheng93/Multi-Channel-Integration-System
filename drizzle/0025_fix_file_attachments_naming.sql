-- Migration: Standardize file_attachments Column Naming
-- Purpose: Fix mixed camelCase/snake_case naming to consistent snake_case
-- Phase: 2 - Naming Convention Standardization
-- Created: 2025-01-29
--
-- AFFECTED COLUMNS:
--   mimeType    -> mime_type
--   fileSize    -> file_size
--   fileUrl     -> file_url
--   r2Key       -> r2_key
--   uploadStatus -> upload_status
--
-- NOTE: SQLite 3.25.0+ supports ALTER TABLE RENAME COLUMN
-- Cloudflare D1 uses SQLite 3.42.0+, so this is fully supported.

-- ===============================================
-- 1. Rename mimeType to mime_type
-- ===============================================
ALTER TABLE file_attachments RENAME COLUMN mimeType TO mime_type;

-- ===============================================
-- 2. Rename fileSize to file_size
-- ===============================================
ALTER TABLE file_attachments RENAME COLUMN fileSize TO file_size;

-- ===============================================
-- 3. Rename fileUrl to file_url
-- ===============================================
ALTER TABLE file_attachments RENAME COLUMN fileUrl TO file_url;

-- ===============================================
-- 4. Rename r2Key to r2_key
-- ===============================================
ALTER TABLE file_attachments RENAME COLUMN r2Key TO r2_key;

-- ===============================================
-- 5. Rename uploadStatus to upload_status
-- ===============================================
ALTER TABLE file_attachments RENAME COLUMN uploadStatus TO upload_status;

-- ===============================================
-- Verification Query
-- ===============================================
-- Run this to verify column names after migration:
-- PRAGMA table_info(file_attachments);
--
-- Expected columns (all snake_case now):
--   id, message_id, conversation_id, filename, mime_type,
--   file_size, file_url, r2_key, url, upload_status,
--   uploaded_by, created_at, updated_at

-- ===============================================
-- Migration metadata
-- ===============================================
-- Version: 0025
-- Date: 2025-01-29
-- Author: Database Schema Review
-- Phase: 2 - Naming Convention Fix
-- Breaking Changes: None (Drizzle ORM handles mapping)

-- Rollback SQL (if needed):
-- ALTER TABLE file_attachments RENAME COLUMN mime_type TO mimeType;
-- ALTER TABLE file_attachments RENAME COLUMN file_size TO fileSize;
-- ALTER TABLE file_attachments RENAME COLUMN file_url TO fileUrl;
-- ALTER TABLE file_attachments RENAME COLUMN r2_key TO r2Key;
-- ALTER TABLE file_attachments RENAME COLUMN upload_status TO uploadStatus;
