PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE customers (
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
    metadata TEXT, 
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
INSERT INTO "agents" VALUES('admin-001','admin@dacit.net','$2a$12$AVSzHYOJseo6vVDzX.XFCuuvWMrzImwARka/3AjPbO7VO9lKtwnRG','Admin','admin',1,1704088800000);
INSERT INTO "agents" VALUES('agent-001','dacagent@dacit.net','$2a$12$N3XyZSTj.MGEnudWYHdBielDsW7YB5wGssKdab3Po0PrelPBtGqB6','Agent 1','agent',1,1704088800000);
CREATE TABLE system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "system_settings" VALUES('general.systemName','Multi-Channel Support','2025-08-19 02:44:06','2025-08-19 02:44:06');
INSERT INTO "system_settings" VALUES('general.contactEmail','admin@example.com','2025-08-19 02:44:06','2025-08-19 02:44:06');
INSERT INTO "system_settings" VALUES('general.timezone','Asia/Taipei','2025-08-19 02:44:06','2025-08-19 02:44:06');
INSERT INTO "system_settings" VALUES('general.language','zh-TW','2025-08-19 02:44:06','2025-08-19 02:44:06');
INSERT INTO "system_settings" VALUES('advanced.messageQueueSize','1000','2025-08-19 02:44:06','2025-08-19 02:44:06');
INSERT INTO "system_settings" VALUES('advanced.messageTimeout','30','2025-08-19 02:44:06','2025-08-19 02:44:06');
INSERT INTO "system_settings" VALUES('advanced.cacheExpiry','60','2025-08-19 02:44:06','2025-08-19 02:44:06');
INSERT INTO "system_settings" VALUES('advanced.sessionExpiry','24','2025-08-19 02:44:06','2025-08-19 02:44:06');
INSERT INTO "system_settings" VALUES('advanced.enableRateLimit','true','2025-08-19 02:44:06','2025-08-19 02:44:06');
INSERT INTO "system_settings" VALUES('advanced.enableLogging','true','2025-08-19 02:44:06','2025-08-19 02:44:06');
INSERT INTO "system_settings" VALUES('advanced.enableMetrics','true','2025-08-19 02:44:06','2025-08-19 02:44:06');
INSERT INTO "system_settings" VALUES('integrations.facebook.status','disconnected','2025-08-19 02:44:06','2025-08-19 02:44:06');
INSERT INTO "system_settings" VALUES('integrations.line.status','connected','2025-08-19 03:44:22','2025-08-19 03:44:22');
CREATE TABLE activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_role TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details TEXT, 
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES agents(id)
);
INSERT INTO "activities" VALUES(1,'admin-001','admin@dacit.net','admin','settings_update','system',NULL,'{"platform":"line","credentialType":"channelId","action":"store"}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-19 03:44:22');
INSERT INTO "activities" VALUES(2,'admin-001','admin@dacit.net','admin','settings_update','system',NULL,'{"platform":"line","credentialType":"channelSecret","action":"store"}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-19 03:44:22');
INSERT INTO "activities" VALUES(3,'admin-001','admin@dacit.net','admin','settings_update','system',NULL,'{"platform":"line","credentialType":"accessToken","action":"store"}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-19 03:44:22');
INSERT INTO "activities" VALUES(4,'admin-001','admin@dacit.net','admin','settings_update','system',NULL,'{"updatedSettings":{"integrations.line.status":"connected"},"settingsCount":1}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-19 03:44:22');
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    platform_user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    created_at INTEGER NOT NULL,
    UNIQUE(platform, platform_user_id)
);
CREATE TABLE teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    name TEXT NOT NULL, 
    description TEXT, 
    is_active BOOLEAN DEFAULT TRUE, 
    created_at TEXT NOT NULL DEFAULT (datetime('now')), 
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE app_users (
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
CREATE TABLE file_attachments (
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
CREATE TABLE file_metadata (
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
CREATE TABLE file_access_logs (
    id TEXT PRIMARY KEY,
    attachment_id TEXT NOT NULL,
    accessed_by TEXT NOT NULL,
    access_type TEXT NOT NULL, 
    ip_address TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (attachment_id) REFERENCES file_attachments(id) ON DELETE CASCADE
);
CREATE TABLE pending_messages (
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
CREATE TABLE message_recall_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL, 
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (message_id) REFERENCES pending_messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES agents(id) ON DELETE CASCADE
);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" VALUES('activities',4);
CREATE INDEX idx_customers_platform ON customers(platform, platform_user_id);
CREATE INDEX idx_conversations_customer ON conversations(customer_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_assigned_user ON conversations(assigned_user_id);
CREATE INDEX idx_conversations_assigned_team ON conversations(assigned_team_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_messages_sender ON messages(sender_type, sender_id);
CREATE INDEX idx_activities_user ON activities(user_id);
CREATE INDEX idx_activities_action ON activities(action);
CREATE INDEX idx_activities_resource ON activities(resource_type, resource_id);
CREATE INDEX idx_activities_created ON activities(created_at);