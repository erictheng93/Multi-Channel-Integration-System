-- Migration: Remove Individual Assignment (assigned_user_id)
-- Purpose: Complete transition to team-based assignment only
-- Date: 2025-01-22
--
-- CHANGES:
--   1. Drop indexes referencing assigned_user_id
--   2. Remove assigned_user_id column from conversations table
--
-- RATIONALE:
--   - Individual assignment (assigning conversations to specific agents) has been removed
--   - All assignment is now team-based via assigned_team_id
--   - This simplifies the permission model and improves team collaboration
--
-- NOTE: Using ALTER TABLE DROP COLUMN (supported in SQLite 3.35.0+)
--       D1 uses modern SQLite that supports this operation

-- ===============================================
-- 1. Drop indexes that reference assigned_user_id
-- ===============================================

-- Index from migration 0020 (recreated in 0030)
DROP INDEX IF EXISTS idx_conversations_assigned_user;

-- Composite index from migration 0027
DROP INDEX IF EXISTS idx_conversations_assigned_user_status;

-- ===============================================
-- 2. Remove assigned_user_id column
-- ===============================================
-- Using ALTER TABLE DROP COLUMN (SQLite 3.35.0+ feature)
-- D1 supports this as it uses SQLite 3.45+

ALTER TABLE conversations DROP COLUMN assigned_user_id;

-- ===============================================
-- Migration metadata
-- ===============================================
-- Version: 0033
-- Date: 2025-01-22
-- Author: System Migration
-- Phase: Remove Individual Assignment
-- Breaking Changes: Yes - assigned_user_id column removed
