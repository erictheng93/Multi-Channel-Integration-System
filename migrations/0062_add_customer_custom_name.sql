-- ===============================================
-- Migration 0062: agent-editable customer nickname
-- ===============================================
-- Date: 2026-10-06
--
-- custom_name is set by agents; display_name stays owned by the platform
-- profile sync (src/utils/database.ts overwrites it on every webhook).
-- Readers show COALESCE(custom_name, display_name) — see customerNameSql
-- in src/db/schema.ts. NULL = no nickname.
ALTER TABLE customers ADD COLUMN custom_name TEXT;
