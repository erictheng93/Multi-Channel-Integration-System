-- Migration: 0030_add_critical_performance_indexes.sql
-- Date: 2025-01-14
-- Purpose: Add critical performance indexes to optimize query performance
--
-- This migration addresses P0-3 performance issues identified in multi-team usage analysis:
-- 1. Messages table: Missing index on conversation_id causes full table scans
-- 2. Conversation tags: Missing index for efficient tag-based filtering
-- 3. File attachments: Missing index for conversation-based file queries
-- 4. Customers: Missing index for team-scoped customer queries
--
-- Expected Performance Impact:
-- - Message queries: 100x-500x improvement (O(n) → O(log n))
-- - Tag filtering: 50x-100x improvement
-- - File lookups: 50x-100x improvement
-- - Customer team queries: 20x-50x improvement

-- ============================================================================
-- INDEX 1: Messages - Conversation + Created At (Most Critical)
-- ============================================================================
-- This is the MOST CRITICAL index for this application
-- Used in: getConversationMessages, getLatestMessage, message listing
-- Current queries scan entire messages table for each conversation view
-- Pattern: WHERE conversation_id = ? ORDER BY created_at DESC

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
ON messages(conversation_id, created_at DESC);

-- ============================================================================
-- INDEX 2: Messages - Sender filtering
-- ============================================================================
-- Used for filtering messages by sender type (customer/agent)
-- Pattern: WHERE conversation_id = ? AND sender_type = ?

CREATE INDEX IF NOT EXISTS idx_messages_conversation_sender
ON messages(conversation_id, sender_type);

-- ============================================================================
-- INDEX 3: Conversation Tags - Conversation ID
-- ============================================================================
-- Used in: getConversationTags, tag-based conversation filtering
-- Pattern: WHERE conversation_id = ?

CREATE INDEX IF NOT EXISTS idx_conversation_tags_conversation_id
ON conversation_tags(conversation_id);

-- ============================================================================
-- INDEX 4: Conversation Tags - Tag ID (for tag deletion cascading)
-- ============================================================================
-- Used in: Tag deletion, tag usage statistics
-- Pattern: WHERE tag_id = ?

CREATE INDEX IF NOT EXISTS idx_conversation_tags_tag_id
ON conversation_tags(tag_id);

-- ============================================================================
-- INDEX 5: Customer Tags - Customer ID
-- ============================================================================
-- Used in: getCustomerTags, customer tag management
-- Pattern: WHERE customer_id = ?

CREATE INDEX IF NOT EXISTS idx_customer_tags_customer_id
ON customer_tags(customer_id);

-- ============================================================================
-- INDEX 6: Customer Tags - Tag ID
-- ============================================================================
-- Used in: Tag usage statistics, customers by tag
-- Pattern: WHERE tag_id = ?

CREATE INDEX IF NOT EXISTS idx_customer_tags_tag_id
ON customer_tags(tag_id);

-- ============================================================================
-- INDEX 7: File Attachments - Conversation ID
-- ============================================================================
-- Used in: getConversationAttachments, attachment listing
-- Pattern: WHERE conversation_id = ?

CREATE INDEX IF NOT EXISTS idx_file_attachments_conversation_id
ON file_attachments(conversation_id);

-- ============================================================================
-- INDEX 8: File Attachments - Message ID
-- ============================================================================
-- Used in: getMessageAttachments, message detail view
-- Pattern: WHERE message_id = ?

CREATE INDEX IF NOT EXISTS idx_file_attachments_message_id
ON file_attachments(message_id);

-- ============================================================================
-- INDEX 9: Customers - Source Team ID (Team-scoped queries)
-- ============================================================================
-- Used in: Team-scoped customer listing, team statistics
-- Pattern: WHERE source_team_id = ?
-- Note: Partial index for non-NULL values to save space

CREATE INDEX IF NOT EXISTS idx_customers_source_team_id
ON customers(source_team_id) WHERE source_team_id IS NOT NULL;

-- ============================================================================
-- INDEX 10: Customers - Platform lookup
-- ============================================================================
-- Used in: findByPlatformId, webhook customer identification
-- Pattern: WHERE platform = ? AND platform_user_id = ?
-- This is a critical path for LINE/Facebook webhook processing

CREATE INDEX IF NOT EXISTS idx_customers_platform_user
ON customers(platform, platform_user_id);

-- ============================================================================
-- INDEX 11: Conversations - Customer ID
-- ============================================================================
-- Used in: getCustomerConversations, customer conversation history
-- Pattern: WHERE customer_id = ?

CREATE INDEX IF NOT EXISTS idx_conversations_customer_id
ON conversations(customer_id);

-- ============================================================================
-- INDEX 12: Conversations - Assigned Team ID (Team inbox)
-- ============================================================================
-- Used in: Team inbox, team-scoped conversation listing
-- Pattern: WHERE assigned_team_id = ?

CREATE INDEX IF NOT EXISTS idx_conversations_assigned_team
ON conversations(assigned_team_id) WHERE assigned_team_id IS NOT NULL;

-- ============================================================================
-- INDEX 13: Conversations - Assigned User ID (Agent inbox)
-- ============================================================================
-- Used in: Agent inbox, personal conversation listing
-- Pattern: WHERE assigned_user_id = ?

CREATE INDEX IF NOT EXISTS idx_conversations_assigned_user
ON conversations(assigned_user_id) WHERE assigned_user_id IS NOT NULL;

-- ============================================================================
-- INDEX 14: Conversations - Status + Updated At (Active conversations)
-- ============================================================================
-- Used in: Active conversation listing, conversation sorting
-- Pattern: WHERE status = 'active' ORDER BY updated_at DESC

CREATE INDEX IF NOT EXISTS idx_conversations_status_updated
ON conversations(status, updated_at DESC);

-- ============================================================================
-- INDEX 15: Tags - Team ID (Team-scoped tag listing)
-- ============================================================================
-- Used in: getAvailableTags, team tag management
-- Pattern: WHERE team_id = ? OR team_id IS NULL

CREATE INDEX IF NOT EXISTS idx_tags_team_id
ON tags(team_id);

-- ============================================================================
-- Verification query (run after migration to verify indexes created)
-- ============================================================================
-- SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%';
