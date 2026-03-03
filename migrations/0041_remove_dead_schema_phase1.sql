-- ===============================================
-- Migration 0041: Remove Dead Schema — Phase 1
-- ===============================================
-- Date: 2026-03-03
-- Purpose: Drop unused table and column that have zero reads/writes
--          in production code.
--
-- CHANGES:
--   1. DROP TABLE qr_code_analytics  (0 usages in codebase)
--   2. ALTER TABLE reports DROP COLUMN file_hash  (0 usages in codebase)
--
-- SAFETY:
--   D1 uses SQLite 3.42.0+ — DROP COLUMN supported since 3.35.0.
--   qr_code_analytics table has no FK references from other tables.
--   file_hash column has no constraints or indexes.
--   Note: SQLite does not support DROP COLUMN IF EXISTS; the D1 migration
--         tracker prevents double-application in normal operation.
--
-- Rollback SQL:
--   CREATE TABLE IF NOT EXISTS qr_code_analytics (
--     id INTEGER PRIMARY KEY,
--     qr_code_id TEXT NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
--     date TEXT NOT NULL,
--     total_scans INTEGER DEFAULT 0,
--     unique_scans INTEGER DEFAULT 0,
--     new_customers INTEGER DEFAULT 0,
--     returning_customers INTEGER DEFAULT 0,
--     created_at TEXT DEFAULT CURRENT_TIMESTAMP,
--     UNIQUE(qr_code_id, date)
--   );
--   ALTER TABLE reports ADD COLUMN file_hash TEXT;
-- ===============================================

-- 1. Drop the unused analytics table
DROP TABLE IF EXISTS qr_code_analytics;

-- 2. Drop the unused file hash column from reports
ALTER TABLE reports DROP COLUMN file_hash;
