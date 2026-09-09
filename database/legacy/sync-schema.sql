-- Add customers table to production environment
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    platform_user_id TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    email TEXT,
    source_team_id INTEGER,
    metadata TEXT, 
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(platform, platform_user_id)
);

-- Add missing tables to development environment
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    platform_user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    created_at INTEGER NOT NULL,
    UNIQUE(platform, platform_user_id)
);

CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    name TEXT NOT NULL, 
    description TEXT, 
    is_active BOOLEAN DEFAULT TRUE, 
    created_at TEXT NOT NULL DEFAULT (datetime('now')), 
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    username TEXT UNIQUE NOT NULL, 
    email TEXT UNIQUE NOT NULL, 
    password_hash TEXT NOT NULL, 
    display_name TEXT NOT NULL, 
    role TEXT NOT NULL DEFAULT 'agent', 
    team_id INTEGER, 
    is_active BOOLEAN DEFAULT TRUE, 
    created_at TEXT NOT NULL DEFAULT (datetime('now')), 
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS file_attachments (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    file_extension TEXT,
    storage_path TEXT NOT NULL,
    storage_url TEXT,
    upload_status TEXT NOT NULL DEFAULT 'pending', 
    uploaded_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS file_metadata (
    id TEXT PRIMARY KEY,
    attachment_id TEXT NOT NULL,
    width INTEGER, 
    height INTEGER, 
    duration INTEGER, 
    thumbnail_url TEXT, 
    checksum TEXT, 
    virus_scan_status TEXT DEFAULT 'pending', 
    virus_scan_at INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (attachment_id) REFERENCES file_attachments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS file_access_logs (
    id TEXT PRIMARY KEY,
    attachment_id TEXT NOT NULL,
    accessed_by TEXT NOT NULL,
    access_type TEXT NOT NULL, 
    ip_address TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (attachment_id) REFERENCES file_attachments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pending_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text',
    recipient_platform_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    delay_seconds INTEGER NOT NULL DEFAULT 0,
    scheduled_send_time TEXT NOT NULL,
    recall_deadline TEXT,
    status TEXT NOT NULL DEFAULT 'pending', 
    metadata TEXT, 
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    sent_at TEXT,
    cancelled_at TEXT,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS message_recall_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL, 
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (message_id) REFERENCES pending_messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES agents(id) ON DELETE CASCADE
);