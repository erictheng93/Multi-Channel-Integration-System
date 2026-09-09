-- Migration: Add 'assigned' status to conversations table
-- Problem: CHECK constraint only allowed 'active', 'pending', 'closed'
-- Solution: Recreate table with 'assigned' added to allowed values
-- Date: 2025-11-04

-- SQLite doesn't support ALTER TABLE ... DROP CONSTRAINT
-- So we need to recreate the table (standard SQLite migration pattern)

-- Step 0: Disable foreign key constraints temporarily
PRAGMA foreign_keys = OFF;

-- Step 1: Create new table with updated CHECK constraint
CREATE TABLE conversations_new (
    id TEXT PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    assigned_team_id INTEGER,
    assigned_user_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    last_message_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    priority TEXT DEFAULT 'normal',
    first_response_at TEXT,
    closed_at TEXT,
    internal_notes TEXT,

    CHECK (status IN ('active', 'assigned', 'pending', 'closed'))
);

-- Step 2: Copy all data from old table (explicit column list for safety)
INSERT INTO conversations_new (
    id,
    customer_id,
    assigned_team_id,
    assigned_user_id,
    status,
    last_message_at,
    created_at,
    updated_at,
    priority,
    first_response_at,
    closed_at,
    internal_notes
)
SELECT
    id,
    customer_id,
    assigned_team_id,
    assigned_user_id,
    status,
    last_message_at,
    created_at,
    updated_at,
    priority,
    first_response_at,
    closed_at,
    internal_notes
FROM conversations;

-- Step 3: Drop old table
DROP TABLE conversations;

-- Step 4: Rename new table to original name
ALTER TABLE conversations_new RENAME TO conversations;

-- Step 5: Recreate indexes (matching existing indexes)
CREATE INDEX IF NOT EXISTS idx_conversations_customer ON conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_team ON conversations(assigned_team_id);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_user ON conversations(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at);

-- Step 6: Re-enable foreign key constraints
PRAGMA foreign_keys = ON;
