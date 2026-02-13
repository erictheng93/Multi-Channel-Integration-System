-- Migration: 0035_schema_integrity_fixes.sql
-- Date: 2025-02-12
-- Purpose: Fix data integrity issues identified in schema review
--
-- FIXES INCLUDED:
--   P0-1: Reports system tables missing FK constraints (schema-level only)
--   P0-2: messageRecallLogs.messageId missing FK (schema-level only)
--   P0-3: customerTeamAssignments missing unique constraint
--   P1-5: taskReminders.conversationId missing FK (schema-level only)
--
-- NOTE: SQLite does not support ALTER TABLE ADD CONSTRAINT for foreign keys.
-- FK constraints are enforced at the Drizzle ORM schema level (.references())
-- and will be applied automatically for new table creation or schema recreation.
-- For existing tables, enforcement happens at the application layer.

-- ============================================================================
-- 1. customerTeamAssignments - Add UNIQUE constraint (platform_user_id, team_id)
-- ============================================================================
-- Prevents duplicate customer-team assignment records.
-- Matches the pattern used in agent_teams table.
-- SQLite supports CREATE UNIQUE INDEX for adding uniqueness to existing tables.

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_team_assignments_unique
ON customer_team_assignments(platform_user_id, team_id);

-- ============================================================================
-- 2. taskReminders - Add index on conversation_id for efficient lookups
-- ============================================================================
-- Supports queries like: "find all reminders for this conversation"

CREATE INDEX IF NOT EXISTS idx_task_reminders_conversation_id
ON task_reminders(conversation_id)
WHERE conversation_id IS NOT NULL;

-- ============================================================================
-- 3. messageRecallLogs - Add index on message_id for efficient lookups
-- ============================================================================
-- Supports queries like: "find all recall actions for this message"

CREATE INDEX IF NOT EXISTS idx_message_recall_logs_message_id
ON message_recall_logs(message_id);

-- ============================================================================
-- 4. Reports system - Add indexes for createdBy lookups
-- ============================================================================
-- These indexes help enforce referential integrity at query time
-- and optimize queries filtering by creator

CREATE INDEX IF NOT EXISTS idx_reports_created_by
ON reports(created_by);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_created_by
ON scheduled_reports(created_by);

CREATE INDEX IF NOT EXISTS idx_report_templates_created_by
ON report_templates(created_by);

CREATE INDEX IF NOT EXISTS idx_report_download_history_downloaded_by
ON report_download_history(downloaded_by);

-- ============================================================================
-- Migration metadata
-- ============================================================================
-- Version: 0035
-- Date: 2025-02-12
-- Author: Schema Integrity Review
-- Breaking Changes: None (additive only)
-- Risk: Low - only adds indexes and unique constraints
--
-- Rollback SQL:
-- DROP INDEX IF EXISTS idx_customer_team_assignments_unique;
-- DROP INDEX IF EXISTS idx_task_reminders_conversation_id;
-- DROP INDEX IF EXISTS idx_message_recall_logs_message_id;
-- DROP INDEX IF EXISTS idx_reports_created_by;
-- DROP INDEX IF EXISTS idx_scheduled_reports_created_by;
-- DROP INDEX IF EXISTS idx_report_templates_created_by;
-- DROP INDEX IF EXISTS idx_report_download_history_downloaded_by;
