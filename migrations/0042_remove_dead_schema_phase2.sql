-- ===============================================
-- Migration 0042: Remove Dead Schema — Phase 2
-- ===============================================
-- Date: 2026-03-03
-- Purpose: Drop legacy `url` column from file_attachments (replaced by
--          `file_url` since migration 0025) and drop `internal_notes`
--          from conversations (never read; code cleaned up before this
--          migration).
--
-- CHANGES:
--   1. ALTER TABLE file_attachments DROP COLUMN url
--   2. ALTER TABLE conversations DROP COLUMN internal_notes
--
-- SAFETY:
--   D1 uses SQLite 3.42.0+. Both columns are plain TEXT with no
--   constraints or indexes — DROP COLUMN is safe.
--   All backend fallback code referencing these columns was removed
--   in the codebase before this migration is applied.
--   Note: SQLite does not support DROP COLUMN IF EXISTS; the D1 migration
--         tracker prevents double-application in normal operation.
--
-- Rollback SQL:
--   ALTER TABLE file_attachments ADD COLUMN url TEXT;
--   ALTER TABLE conversations ADD COLUMN internal_notes TEXT;
-- ===============================================

-- 1. Drop legacy URL column (replaced by file_url since migration 0025)
ALTER TABLE file_attachments DROP COLUMN url;

-- 2. Drop internal notes column (never read; write-only dead column)
ALTER TABLE conversations DROP COLUMN internal_notes;
