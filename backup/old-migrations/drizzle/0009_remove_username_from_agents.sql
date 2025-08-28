-- Migration to remove the username column from the agents table and fix the pending_messages_detail view.

-- Step 1: Drop the existing view which has incorrect dependencies.
DROP VIEW IF EXISTS pending_messages_detail;

-- Step 2: Recreate the agents table without the 'username' column.
-- This is the standard SQLite way to drop a column.
-- A new table is created, data is copied, the old table is dropped, and the new one is renamed.
CREATE TABLE agents_new (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'agent',
    is_active BOOLEAN DEFAULT TRUE,
    created_at INTEGER NOT NULL,
    last_active INTEGER
);

-- Step 3: Copy data from the old table to the new one, omitting the 'username' column.
INSERT INTO agents_new (id, email, password_hash, name, role, is_active, created_at, last_active)
SELECT id, email, password_hash, name, role, is_active, created_at, last_active FROM agents;

-- Step 4: Drop the old agents table.
DROP TABLE agents;

-- Step 5: Rename the new table to the original name.
ALTER TABLE agents_new RENAME TO agents;

-- Step 6: Recreate the view with the correct table and column references.
-- The original view incorrectly joined with a 'users' table. This version joins with 'agents'.
-- It also uses the 'name' column from 'agents' as 'sender_display_name'.
CREATE VIEW pending_messages_detail AS
SELECT 
    pm.*,
    c.customer_id,
    cu.display_name as customer_name,
    cu.avatar_url as customer_avatar,
    a.name as sender_display_name,
    CASE 
        WHEN pm.status = 'pending' AND datetime('now') < pm.recall_deadline THEN 1
        ELSE 0
    END as can_recall,
    CASE 
        WHEN pm.status = 'pending' THEN 
            CAST((julianday(pm.scheduled_send_time) - julianday('now')) * 86400 AS INTEGER)
        ELSE 0
    END as seconds_remaining
FROM pending_messages pm
JOIN conversations c ON pm.conversation_id = c.id
JOIN customers cu ON c.customer_id = cu.id
JOIN agents a ON pm.sender_id = a.id;
