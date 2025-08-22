PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    platform_user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    created_at INTEGER NOT NULL,
    UNIQUE(platform, platform_user_id)
);
CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    assigned_to TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    last_message_at INTEGER NOT NULL,
    unread_count INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_type TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    content TEXT NOT NULL,
    media_url TEXT,
    media_type TEXT,
    platform TEXT NOT NULL,
    created_at INTEGER NOT NULL, has_attachments BOOLEAN DEFAULT FALSE,
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
INSERT INTO agents VALUES('admin-001','admin@dacit.net','$2a$12$AVSzHYOJseo6vVDzX.XFCuuvWMrzImwARka/3AjPbO7VO9lKtwnRG','Admin','admin',1,1704088800000);
INSERT INTO agents VALUES('agent-001','dacagent@dacit.net','$2a$12$N3XyZSTj.MGEnudWYHdBielDsW7YB5wGssKdab3Po0PrelPBtGqB6','Agent 1','agent',1,1704088800000);
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
    upload_status TEXT NOT NULL DEFAULT 'pending', -- pending, uploaded, failed, deleted
    uploaded_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
CREATE TABLE file_metadata (
    id TEXT PRIMARY KEY,
    attachment_id TEXT NOT NULL,
    width INTEGER, -- 圖片寬度
    height INTEGER, -- 圖片高度
    duration INTEGER, -- 音視頻時長（秒）
    thumbnail_url TEXT, -- 縮圖URL
    checksum TEXT, -- 檔案校驗和
    virus_scan_status TEXT DEFAULT 'pending', -- pending, clean, infected, error
    virus_scan_at INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (attachment_id) REFERENCES file_attachments(id) ON DELETE CASCADE
);
CREATE TABLE file_access_logs (
    id TEXT PRIMARY KEY,
    attachment_id TEXT NOT NULL,
    accessed_by TEXT NOT NULL,
    access_type TEXT NOT NULL, -- download, view, thumbnail
    ip_address TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (attachment_id) REFERENCES file_attachments(id) ON DELETE CASCADE
);
CREATE TABLE app_users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, display_name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'agent', team_id INTEGER, is_active BOOLEAN DEFAULT TRUE, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE teams (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, is_active BOOLEAN DEFAULT TRUE, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO d1_migrations VALUES(1,'001_add_delayed_messages.sql','2025-08-14 05:28:00');
INSERT INTO d1_migrations VALUES(2,'002_fix_delayed_messages_constraints.sql','2025-08-14 05:28:01');
INSERT INTO d1_migrations VALUES(3,'003_fix_conversation_id_type.sql','2025-08-14 05:28:01');
INSERT INTO d1_migrations VALUES(4,'004_restore_foreign_key_constraints.sql','2025-08-14 05:28:02');
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
CREATE TABLE activities (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, user_name TEXT NOT NULL, user_role TEXT NOT NULL, action TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT, details TEXT, ip_address TEXT, user_agent TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
INSERT INTO activities VALUES(1,'admin-001','admin@dacit.net','admin','settings_update','system','null','{platform:line,credentialType:channelId,action:store}','null','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-19 03:44:22');
INSERT INTO activities VALUES(2,'admin-001','admin@dacit.net','admin','settings_update','system','null','{platform:line,credentialType:channelSecret,action:store}','null','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-19 03:44:22');
INSERT INTO activities VALUES(3,'admin-001','admin@dacit.net','admin','settings_update','system','null','{platform:line,credentialType:accessToken,action:store}','null','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-19 03:44:22');
INSERT INTO activities VALUES(4,'admin-001','admin@dacit.net','admin','settings_update','system','null','{updatedSettings:{integrations.line.status:connected},settingsCount:1}','null','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-19 03:44:22');
CREATE TABLE customers (id INTEGER PRIMARY KEY AUTOINCREMENT, line_user_id TEXT UNIQUE, display_name TEXT, avatar_url TEXT, first_interaction_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_interaction_at DATETIME DEFAULT CURRENT_TIMESTAMP, total_messages INTEGER DEFAULT 0, status TEXT DEFAULT 'active', tags TEXT, metadata TEXT);
CREATE TABLE system_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE NOT NULL, value TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
INSERT INTO system_settings VALUES(14,'general.systemName','Multi-Channel Support','2025-08-19 02:44:06','2025-08-19 02:44:06');
INSERT INTO system_settings VALUES(15,'general.contactEmail','admin@example.com','2025-08-19 02:44:06','2025-08-19 02:44:06');
INSERT INTO system_settings VALUES(16,'general.timezone','Asia/Taipei','2025-08-19 02:44:06','2025-08-19 02:44:06');
INSERT INTO system_settings VALUES(17,'general.language','zh-TW','2025-08-19 02:44:06','2025-08-19 02:44:06');
INSERT INTO system_settings VALUES(18,'advanced.messageQueueSize','1000','2025-08-19 02:44:06','2025-08-19 02:44:06');
INSERT INTO system_settings VALUES(19,'advanced.messageTimeout','30','2025-08-19 02:44:06','2025-08-19 02:44:06');
INSERT INTO system_settings VALUES(20,'advanced.cacheExpiry','60','2025-08-19 02:44:06','2025-08-19 02:44:06');
INSERT INTO system_settings VALUES(21,'advanced.sessionExpiry','24','2025-08-19 02:44:06','2025-08-19 02:44:06');
INSERT INTO system_settings VALUES(22,'advanced.enableRateLimit','true','2025-08-19 02:44:06','2025-08-19 02:44:06');
INSERT INTO system_settings VALUES(23,'advanced.enableLogging','true','2025-08-19 02:44:06','2025-08-19 02:44:06');
INSERT INTO system_settings VALUES(24,'advanced.enableMetrics','true','2025-08-19 02:44:06','2025-08-19 02:44:06');
INSERT INTO system_settings VALUES(25,'integrations.facebook.status','disconnected','2025-08-19 02:44:06','2025-08-19 02:44:06');
INSERT INTO system_settings VALUES(26,'integrations.line.status','connected','2025-08-19 03:44:22','2025-08-19 03:44:22');
DELETE FROM sqlite_sequence;
INSERT INTO sqlite_sequence VALUES('app_users',1);
INSERT INTO sqlite_sequence VALUES('d1_migrations',4);
INSERT INTO sqlite_sequence VALUES('activities',4);
INSERT INTO sqlite_sequence VALUES('system_settings',26);
CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_assigned ON conversations(assigned_to);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_file_attachments_message ON file_attachments(message_id);
CREATE INDEX idx_file_attachments_conversation ON file_attachments(conversation_id);
CREATE INDEX idx_file_attachments_status ON file_attachments(upload_status);
CREATE INDEX idx_file_attachments_created ON file_attachments(created_at);
CREATE INDEX idx_file_metadata_attachment ON file_metadata(attachment_id);
CREATE INDEX idx_file_access_logs_attachment ON file_access_logs(attachment_id);
CREATE INDEX idx_file_access_logs_created ON file_access_logs(created_at);
CREATE INDEX idx_pending_messages_status ON pending_messages(status);
CREATE INDEX idx_pending_messages_scheduled ON pending_messages(scheduled_send_time);
CREATE INDEX idx_pending_messages_conversation ON pending_messages(conversation_id);
CREATE INDEX idx_pending_messages_sender ON pending_messages(sender_id);
CREATE INDEX idx_recall_logs_message ON message_recall_logs(message_id);
CREATE INDEX idx_recall_logs_user ON message_recall_logs(user_id);
CREATE TRIGGER update_message_attachments_insert
    AFTER INSERT ON file_attachments
    FOR EACH ROW
    BEGIN
        UPDATE messages 
        SET has_attachments = TRUE 
        WHERE id = NEW.message_id;
    END;
CREATE TRIGGER update_message_attachments_delete
    AFTER DELETE ON file_attachments
    FOR EACH ROW
    BEGIN
        UPDATE messages 
        SET has_attachments = (
            SELECT COUNT(*) > 0 
            FROM file_attachments 
            WHERE message_id = OLD.message_id
        )
        WHERE id = OLD.message_id;
    END;
CREATE VIEW pending_messages_detail AS
SELECT 
    pm.*,
    c.customer_id,
    cu.display_name as customer_name,
    cu.avatar_url as customer_avatar,
    u.username as sender_name,
    u.display_name as sender_display_name,
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
JOIN users u ON pm.sender_id = u.id;
