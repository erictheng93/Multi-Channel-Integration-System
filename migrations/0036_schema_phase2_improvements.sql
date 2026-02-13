-- Migration: 0036_schema_phase2_improvements.sql
-- Date: 2025-02-12
-- Purpose: Phase 2 schema improvements - semantics, status values, and cleanup
--
-- IMPROVEMENTS INCLUDED:
--   P1-3: Document isActive vs deletedAt semantic difference (comments only)
--   P2-1: Add updatedAt column to messages table (supports recall tracking)
--   P2-4: Drop unused indexes on assigned_user_id (column exists but unused)
--
-- NOTE on conversations.status 'closed':
--   The 'closed' status is NOT added as an ALTER TABLE change because SQLite
--   does not support CHECK constraints on existing columns. The status value
--   is enforced at the application layer. This migration documents the
--   recommended status values:
--     'active', 'assigned', 'pending', 'in-progress', 'waiting', 'closed'
--   The closedAt field should be set when status transitions to 'closed'.

-- ============================================================================
-- 1. Add updatedAt to messages table
-- ============================================================================
-- Messages can be modified (recall, status changes) but lacked an updatedAt
-- column to track when modifications occurred.
-- This completes the audit trail for message lifecycle.

ALTER TABLE messages ADD COLUMN updated_at TEXT;

-- Index for finding recently modified messages
CREATE INDEX IF NOT EXISTS idx_messages_updated_at
ON messages(updated_at DESC)
WHERE updated_at IS NOT NULL;

-- ============================================================================
-- 2. Drop unused indexes on conversations.assigned_user_id
-- ============================================================================
-- The assigned_user_id column exists in the database (migration 0020) but
-- has been removed from the Drizzle ORM schema and is no longer used by
-- any application code. These indexes waste space and slow down writes.
--
-- Related migrations that created these indexes:
--   0020: idx_conversations_assigned_user
--   0027: idx_conversations_assigned_user_status
--   0030: idx_conversations_assigned_user (duplicate definition)

DROP INDEX IF EXISTS idx_conversations_assigned_user;
DROP INDEX IF EXISTS idx_conversations_assigned_user_status;

-- ============================================================================
-- 3. Documentation: isActive vs deletedAt semantic contract
-- ============================================================================
--
-- SEMANTIC CONTRACT (enforced at application layer):
--
-- isActive (boolean):
--   - Represents TEMPORARY DISABLE state
--   - Record is hidden from active listings but preserved
--   - Can be re-enabled by admin action
--   - Used for: tags, teams, channelIntegrations, qrCodes, scheduledReports
--
-- deletedAt (timestamp):
--   - Represents SOFT DELETE state
--   - Record is logically deleted, treated as non-existent
--   - Requires special admin action to restore (if ever)
--   - Used for: teams, agents, customers, conversations, messages, tags
--
-- When BOTH exist on same table (tags, teams):
--   - isActive=false, deletedAt=null → Disabled but not deleted (recoverable)
--   - isActive=true,  deletedAt=set  → Should not happen (application should set isActive=false when deleting)
--   - isActive=false, deletedAt=set  → Deleted (standard soft delete)
--
-- Application code should ALWAYS filter: WHERE deleted_at IS NULL
-- And additionally filter: WHERE is_active = 1 (when applicable)

-- ============================================================================
-- Migration metadata
-- ============================================================================
-- Version: 0036
-- Date: 2025-02-12
-- Author: Schema Integrity Review Phase 2
-- Breaking Changes: None
-- Risk: Low
--   - Adding a nullable column is safe
--   - Dropping unused indexes improves write performance
--
-- Rollback SQL:
-- CREATE INDEX IF NOT EXISTS idx_conversations_assigned_user ON conversations(assigned_user_id) WHERE assigned_user_id IS NOT NULL;
-- CREATE INDEX IF NOT EXISTS idx_conversations_assigned_user_status ON conversations(assigned_user_id, status) WHERE assigned_user_id IS NOT NULL;
-- DROP INDEX IF EXISTS idx_messages_updated_at;
-- Note: SQLite does not support DROP COLUMN for updated_at
