PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    platform_user_id TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    email TEXT,
    source_team_id INTEGER,
    metadata TEXT, -- JSON格式的額外資訊
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(platform, platform_user_id)
);
CREATE TABLE conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    assigned_team_id INTEGER,
    assigned_user_id INTEGER,
    status TEXT NOT NULL DEFAULT 'active',
    last_message_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);
CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    conversation_id INTEGER NOT NULL,
    sender_type TEXT NOT NULL,
    sender_id INTEGER,
    content TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text',
    platform_message_id TEXT,
    is_recalled BOOLEAN DEFAULT FALSE,
    recall_deadline TEXT,
    recalled_at TEXT,
    is_sent BOOLEAN DEFAULT TRUE,
    sent_at TEXT,
    delivery_status TEXT DEFAULT 'delivered',
    reply_to_message_id TEXT,
    thread_id TEXT,
    session_id TEXT,
    session_sequence INTEGER DEFAULT 1,
    metadata TEXT, -- JSON格式的額外資訊
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);
CREATE TABLE agents (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'agent',
    is_active BOOLEAN DEFAULT TRUE,
    created_at INTEGER NOT NULL
);
INSERT INTO agents VALUES('admin-001','admin@example.com','$2a$10$YourHashedPasswordHere','Admin','admin',1,1704088800000);
INSERT INTO agents VALUES('agent-001','agent1@example.com','$2a$10$YourHashedPasswordHere','Agent 1','agent',1,1704088800000);
CREATE TABLE system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);
CREATE TABLE invitations (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    invited_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    used_by TEXT,
    FOREIGN KEY (invited_by) REFERENCES agents(id)
);
DELETE FROM sqlite_sequence;
CREATE INDEX idx_customers_platform ON customers(platform, platform_user_id);
CREATE INDEX idx_conversations_customer ON conversations(customer_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_assigned_user ON conversations(assigned_user_id);
CREATE INDEX idx_conversations_assigned_team ON conversations(assigned_team_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_messages_sender ON messages(sender_type, sender_id);
