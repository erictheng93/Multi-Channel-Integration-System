-- Safe Schema Optimization for Production (Final Version)
-- Created: 2025-08-29  
-- Purpose: Safely update production database, handling existing indexes

-- Step 1: Disable foreign key constraints temporarily
PRAGMA foreign_keys = OFF;

-- Step 2: Safely drop invitations table (confirmed empty)
DROP TABLE IF EXISTS invitations;

-- Step 3: Handle messages table first (it references conversations)
-- Since there are 17 existing messages, we need to preserve them
CREATE TABLE messages_new (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_type TEXT NOT NULL,
    customer_sender_id INTEGER,  -- For customer messages
    agent_sender_id TEXT,        -- For agent messages
    content TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text',
    platform_message_id TEXT,
    is_recalled INTEGER DEFAULT 0,
    recall_deadline TEXT,
    recalled_at TEXT,
    is_sent INTEGER DEFAULT 1,
    sent_at TEXT,
    delivery_status TEXT DEFAULT 'delivered',
    reply_to_message_id TEXT,
    thread_id TEXT,
    session_id TEXT,
    session_sequence INTEGER DEFAULT 1,
    metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    -- Add CHECK constraints for data integrity
    CHECK (sender_type IN ('customer', 'agent', 'system')),
    CHECK (
        (sender_type = 'customer' AND customer_sender_id IS NOT NULL AND agent_sender_id IS NULL) OR
        (sender_type = 'agent' AND agent_sender_id IS NOT NULL AND customer_sender_id IS NULL) OR
        (sender_type = 'system' AND customer_sender_id IS NULL AND agent_sender_id IS NULL)
    )
);

-- Copy existing message data with sender type detection
INSERT INTO messages_new (
    id, conversation_id, sender_type, customer_sender_id, agent_sender_id, content, message_type,
    platform_message_id, is_recalled, recall_deadline, recalled_at, is_sent, sent_at,
    delivery_status, reply_to_message_id, thread_id, session_id, session_sequence, metadata, created_at
)
SELECT 
    id,
    conversation_id,
    -- Detect sender type: customer messages have integer sender_id
    CASE 
        WHEN TYPEOF(sender_id) = 'integer' THEN 'customer'
        WHEN sender_id LIKE 'agent-%' THEN 'agent'
        ELSE 'system'
    END as sender_type,
    -- Set customer_sender_id for customer messages (integer sender_id)
    CASE 
        WHEN TYPEOF(sender_id) = 'integer' THEN sender_id
        ELSE NULL
    END as customer_sender_id,
    -- Set agent_sender_id for agent messages  
    CASE 
        WHEN sender_id LIKE 'agent-%' THEN CAST(sender_id AS TEXT)
        ELSE NULL
    END as agent_sender_id,
    content,
    message_type,
    platform_message_id,
    is_recalled,
    recall_deadline,
    recalled_at,
    is_sent,
    sent_at,
    delivery_status,
    reply_to_message_id,
    thread_id,
    session_id,
    session_sequence,
    metadata,
    created_at
FROM messages;

-- Drop old messages table and rename new one
DROP TABLE messages;
ALTER TABLE messages_new RENAME TO messages;

-- Step 4: Now handle conversations table
-- Since there's 1 existing conversation, we need to preserve it
CREATE TABLE conversations_new (
    id TEXT PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    assigned_team_id INTEGER,
    assigned_user_id TEXT,  -- Fixed: TEXT to match agents.id
    status TEXT NOT NULL DEFAULT 'active',
    last_message_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    -- Add CHECK constraint for status
    CHECK (status IN ('active', 'pending', 'closed'))
);

-- Copy existing conversation data
INSERT INTO conversations_new (id, customer_id, assigned_team_id, assigned_user_id, status, last_message_at, created_at, updated_at)
SELECT 
    id, 
    customer_id, 
    assigned_team_id,
    CASE WHEN assigned_user_id IS NOT NULL THEN CAST(assigned_user_id AS TEXT) ELSE NULL END,
    status, 
    last_message_at, 
    created_at, 
    updated_at
FROM conversations;

-- Drop old conversations table and rename new one
DROP TABLE conversations;
ALTER TABLE conversations_new RENAME TO conversations;

-- Step 5: Create missing indexes only (avoid duplicates)
-- Messages table new indexes
CREATE INDEX IF NOT EXISTS idx_messages_customer_sender ON messages(customer_sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_agent_sender ON messages(agent_sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON messages(sender_type);
CREATE INDEX IF NOT EXISTS idx_messages_platform_id ON messages(platform_message_id);

-- Other missing indexes
CREATE INDEX IF NOT EXISTS idx_delayed_messages_agent ON delayed_messages(agent_id);
CREATE INDEX IF NOT EXISTS idx_delayed_messages_conversation ON delayed_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at);
CREATE INDEX IF NOT EXISTS idx_activities_action ON activities(action);
CREATE INDEX IF NOT EXISTS idx_activities_resource ON activities(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_file_attachments_message ON file_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_type ON file_attachments(file_type);

CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at);

-- Ensure unique constraints that might be missing
CREATE UNIQUE INDEX IF NOT EXISTS agents_email_unique ON agents(email);

-- Step 6: Re-enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Migration Summary:
-- ✅ Disabled foreign keys during migration to avoid constraint conflicts
-- ✅ Processed messages table first (child table) before conversations (parent table)
-- ✅ Safely removed empty invitations table
-- ✅ Preserved existing conversation and message data  
-- ✅ Fixed conversations.assigned_user_id type (INTEGER -> TEXT)
-- ✅ Redesigned messages sender structure for type safety
-- ✅ Added comprehensive CHECK constraints for data integrity
-- ✅ Created only missing indexes to avoid conflicts
-- ✅ Re-enabled foreign key constraints