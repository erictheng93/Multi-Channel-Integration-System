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
INSERT INTO "users" VALUES('test-user-1','line','test-user-123','Test User',NULL,1704088800000);
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
INSERT INTO "conversations" VALUES('conv-1','test-user-1',NULL,'open',1704088800000,0,1704088800000,1704088800000);
INSERT INTO "conversations" VALUES('1','test-user-1',NULL,'open',1704088800000,0,1704088800000,1704088800000);
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
, last_active INTEGER);
INSERT INTO "agents" VALUES('admin-001','admin@dacit.net','$2a$12$AVSzHYOJseo6vVDzX.XFCuuvWMrzImwARka/3AjPbO7VO9lKtwnRG','System Administrator','admin',1,1704088800000,1755570155154);
INSERT INTO "agents" VALUES('agent-001','dacagent@dacit.net','$2a$12$N3XyZSTj.MGEnudWYHdBielDsW7YB5wGssKdab3Po0PrelPBtGqB6','Test Agent','agent',1,1704088800000,1755437763443);
INSERT INTO "agents" VALUES('agent-002','dacagent1@dacit.net','$2a$12$6e2A1icgOGcRtdGwac5FoOXoyBWJsFbjtHeqhW1qasLUL6CNjApMC','Agent 1','agent',1,1755148844000,1755148844000);
INSERT INTO "agents" VALUES('agent-003','dacagent2@dacit.net','$2a$12$j7KWuN3K.I/26nd6K8Iqyu8HYQdzcIx6/gp4MrZwlWy5xdDQld3J.','Agent 2','agent',1,1755148844000,1755148844000);
INSERT INTO "agents" VALUES('agent-004','dacagent3@dacit.net','$2a$12$xG8RA6YfL8K.mmn/bfj6TOoJzX5b0dwCHXI75ZwSvpcbNgvwFtoyy','Agent 3','agent',1,1755148844000,1755148844000);
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
CREATE TABLE d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" VALUES(1,'001_add_delayed_messages.sql','2025-08-13 02:43:53');
INSERT INTO "d1_migrations" VALUES(2,'002_fix_delayed_messages_constraints.sql','2025-08-13 03:25:01');
INSERT INTO "d1_migrations" VALUES(3,'003_fix_conversation_id_type.sql','2025-08-13 03:29:59');
INSERT INTO "d1_migrations" VALUES(4,'004_restore_foreign_key_constraints.sql','2025-08-13 05:32:15');
INSERT INTO "d1_migrations" VALUES(5,'001_add_activities_table.sql','2025-08-15 00:14:05');
INSERT INTO "d1_migrations" VALUES(6,'002_add_system_settings_table.sql','2025-08-19 02:28:14');
CREATE TABLE app_users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, display_name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'agent', team_id INTEGER, is_active BOOLEAN DEFAULT TRUE, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
INSERT INTO "app_users" VALUES(1,'admin','admin@example.com','$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.Gm.YG2','Admin User','admin',NULL,1,'2025-08-13 03:26:34','2025-08-13 03:26:34');
INSERT INTO "app_users" VALUES(2,'agent1','agent1@example.com','$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.Gm.YG2','Agent 1','agent',NULL,1,'2025-08-13 03:26:34','2025-08-13 03:26:34');
CREATE TABLE teams (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, is_active BOOLEAN DEFAULT TRUE, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
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
INSERT INTO "activities" VALUES(1,'admin-001','Admin','admin','user_login','user',NULL,'{"loginMethod": "email"}',NULL,NULL,'2025-08-14 23:14:05');
INSERT INTO "activities" VALUES(2,'agent-001','Agent 1','agent','user_login','user',NULL,'{"loginMethod": "email"}',NULL,NULL,'2025-08-14 23:44:05');
INSERT INTO "activities" VALUES(3,'admin-001','Admin','admin','settings_update','system',NULL,'{"settingsCount": 3}',NULL,NULL,'2025-08-14 23:59:05');
INSERT INTO "activities" VALUES(4,'admin-001','System Administrator','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"N731ff0z9bGGa45Nvd9PJtQXbvq6lINx"}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36','2025-08-15 00:19:09');
INSERT INTO "activities" VALUES(5,'admin-001','Admin','admin','user_login','user',NULL,'{"loginMethod": "email"}',NULL,NULL,'2025-08-14 23:22:33');
INSERT INTO "activities" VALUES(6,'agent-001','Agent 1','agent','user_login','user',NULL,'{"loginMethod": "email"}',NULL,NULL,'2025-08-14 23:52:33');
INSERT INTO "activities" VALUES(7,'admin-001','Admin','admin','settings_update','system',NULL,'{"settingsCount": 3}',NULL,NULL,'2025-08-15 00:07:33');
INSERT INTO "activities" VALUES(8,'admin-001','System Administrator','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"smjUXok44w6xRhWq7TSHflP0oR28XLYP"}',NULL,'node','2025-08-15 00:29:18');
INSERT INTO "activities" VALUES(9,'admin-001','System Administrator','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"FafjTXsKTKLGXx1ojgL3WkEn5PaJsOBT"}',NULL,'node','2025-08-15 00:29:19');
INSERT INTO "activities" VALUES(10,'admin-001','System Administrator','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"JHCc3TPocTGdm0AomOTpiPG5HQiL6nhV"}',NULL,'node','2025-08-15 00:30:20');
INSERT INTO "activities" VALUES(11,'admin-001','System Administrator','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"ncgoUOfKsZzNVt5a8piVVBTfGu1D2mjM"}',NULL,'node','2025-08-15 00:35:31');
INSERT INTO "activities" VALUES(12,'admin-001','System Administrator','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"ncqMbza6JA3LnkqGPEFKVj1fnmF5U7KI"}',NULL,'curl/8.14.1','2025-08-15 00:36:36');
INSERT INTO "activities" VALUES(13,'admin-001','System Administrator','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"TsW6JTlt2NDok83Vxz5PVi6id1mvBxRW"}',NULL,'node','2025-08-15 00:37:08');
INSERT INTO "activities" VALUES(14,'admin-001','System Administrator','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"WZEQMnfwz6YstoPKyCdkI2xpZfO8eEPK"}',NULL,'node','2025-08-15 00:37:10');
INSERT INTO "activities" VALUES(15,'admin-001','System Administrator','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"h3CvltywuFMAxtZQudpQM8ydcmWnMOJ1"}',NULL,'node','2025-08-15 00:39:14');
INSERT INTO "activities" VALUES(16,'agent-001','Test Agent','agent','user_login','user','agent-001','{"loginMethod":"email","sessionId":"al9iLXNH2XLteqxCtDMWvFi5ZEFDCUlv"}',NULL,'node','2025-08-15 00:39:14');
INSERT INTO "activities" VALUES(17,'admin-001','System Administrator','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"kJtM07YA1qnNk8MneMPTDo2o1Z8g1TYL"}',NULL,'node','2025-08-15 00:39:15');
INSERT INTO "activities" VALUES(18,'admin-001','System Administrator','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"pSo0b6jjUacHkqIxYuAqDIPSUSwaCxTU"}',NULL,'node','2025-08-15 00:40:37');
INSERT INTO "activities" VALUES(19,'admin-001','System Administrator','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"ETMaYpC4IBFsAFn4294KBAlGk9UrJhlP"}',NULL,'curl/8.14.1','2025-08-15 00:42:23');
INSERT INTO "activities" VALUES(20,'admin-001','System Administrator','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"2LrrmOwLjhQQSvKHlhrLBx08eClWeufI"}',NULL,'curl/8.14.1','2025-08-15 01:42:46');
INSERT INTO "activities" VALUES(21,'agent-001','Test Agent','agent','user_login','user','agent-001','{"loginMethod":"email","sessionId":"yzwzKEXu5q67SDBWEZpr4T9sc9uX6N1u"}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36','2025-08-15 01:57:33');
INSERT INTO "activities" VALUES(22,'admin-001','System Administrator','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"tdt7vWa6tfthTOuy9LPfM8FLfnvTIkxw"}',NULL,'curl/8.14.1','2025-08-15 01:59:31');
INSERT INTO "activities" VALUES(23,'admin-001','System Administrator','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"M0NSq0xhlF4NsuV65lmDa6UfgGTtWsAL"}',NULL,'curl/8.14.1','2025-08-15 02:03:06');
INSERT INTO "activities" VALUES(24,'agent-001','Test Agent','agent','user_login','user','agent-001','{"loginMethod":"email","sessionId":"NbkAeAcHkNlN9Wrbop6UFGQSDEoLMnzi"}',NULL,'curl/8.14.1','2025-08-15 02:04:17');
INSERT INTO "activities" VALUES(25,'admin-001','System Administrator','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"InlhM7DkvXtmPmwiQ8JN5RljCbIwf6Sl"}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36','2025-08-15 02:05:47');
INSERT INTO "activities" VALUES(26,'admin-001','System Administrator','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"2Tu6u7v4iox5Eg0ea6MXLVuN9Yurkqxt"}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36','2025-08-18 00:35:21');
INSERT INTO "activities" VALUES(27,'admin-001','System Administrator','admin','user_login','user','admin-001','{"loginMethod":"email","sessionId":"sDum7Lgehj64vnMy8TcL3Q08IAlq460j"}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-18 09:01:59');
INSERT INTO "activities" VALUES(28,'admin-001','admin@dacit.net','admin','settings_update','system',NULL,'{"platform":"line","credentialType":"channelId","action":"store"}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-19 02:08:13');
INSERT INTO "activities" VALUES(29,'admin-001','admin@dacit.net','admin','settings_update','system',NULL,'{"platform":"line","credentialType":"channelSecret","action":"store"}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-19 02:08:13');
INSERT INTO "activities" VALUES(30,'admin-001','admin@dacit.net','admin','settings_update','system',NULL,'{"platform":"line","credentialType":"accessToken","action":"store"}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-19 02:08:13');
INSERT INTO "activities" VALUES(31,'admin-001','admin@dacit.net','admin','CREDENTIALS_CLEAR','system',NULL,'{"platform":"line","clearedCredentials":["channelId","channelSecret","accessToken"]}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-19 02:08:37');
INSERT INTO "activities" VALUES(32,'admin-001','admin@dacit.net','admin','settings_update','system',NULL,'{"platform":"line","credentialType":"channelId","action":"store"}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-19 02:08:54');
INSERT INTO "activities" VALUES(33,'admin-001','admin@dacit.net','admin','CREDENTIAL_DELETE','system',NULL,'{"platform":"line","credentialType":"channelSecret","action":"delete"}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-19 02:08:54');
INSERT INTO "activities" VALUES(34,'admin-001','admin@dacit.net','admin','CREDENTIAL_DELETE','system',NULL,'{"platform":"line","credentialType":"accessToken","action":"delete"}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-19 02:08:54');
INSERT INTO "activities" VALUES(35,'admin-001','admin@dacit.net','admin','settings_update','system',NULL,'{"platform":"line","credentialType":"channelId","action":"store"}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-19 02:10:08');
INSERT INTO "activities" VALUES(36,'admin-001','admin@dacit.net','admin','CREDENTIAL_DELETE','system',NULL,'{"platform":"line","credentialType":"channelSecret","action":"delete"}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-19 02:10:08');
INSERT INTO "activities" VALUES(37,'admin-001','admin@dacit.net','admin','CREDENTIAL_DELETE','system',NULL,'{"platform":"line","credentialType":"accessToken","action":"delete"}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-19 02:10:08');
INSERT INTO "activities" VALUES(38,'admin-001','admin@dacit.net','admin','settings_update','system',NULL,'{"platform":"line","credentialType":"channelId","action":"store"}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-19 02:11:28');
INSERT INTO "activities" VALUES(39,'admin-001','admin@dacit.net','admin','settings_update','system',NULL,'{"platform":"line","credentialType":"channelSecret","action":"store"}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-19 02:11:28');
INSERT INTO "activities" VALUES(40,'admin-001','admin@dacit.net','admin','settings_update','system',NULL,'{"platform":"line","credentialType":"accessToken","action":"store"}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-19 02:11:29');
INSERT INTO "activities" VALUES(41,'admin-001','admin@dacit.net','admin','settings_update','system',NULL,'{"platform":"line","credentialType":"channelId","action":"store"}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-19 02:22:27');
INSERT INTO "activities" VALUES(42,'admin-001','admin@dacit.net','admin','settings_update','system',NULL,'{"platform":"line","credentialType":"channelSecret","action":"store"}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-19 02:22:27');
INSERT INTO "activities" VALUES(43,'admin-001','admin@dacit.net','admin','settings_update','system',NULL,'{"platform":"line","credentialType":"accessToken","action":"store"}',NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36','2025-08-19 02:22:27');
CREATE TABLE system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "system_settings" VALUES('general.systemName','Multi-Channel Support','2025-08-19 02:28:14','2025-08-19 02:28:14');
INSERT INTO "system_settings" VALUES('general.contactEmail','admin@example.com','2025-08-19 02:28:14','2025-08-19 02:28:14');
INSERT INTO "system_settings" VALUES('general.timezone','Asia/Taipei','2025-08-19 02:28:14','2025-08-19 02:28:14');
INSERT INTO "system_settings" VALUES('general.language','zh-TW','2025-08-19 02:28:14','2025-08-19 02:28:14');
INSERT INTO "system_settings" VALUES('advanced.messageQueueSize','1000','2025-08-19 02:28:14','2025-08-19 02:28:14');
INSERT INTO "system_settings" VALUES('advanced.messageTimeout','30','2025-08-19 02:28:14','2025-08-19 02:28:14');
INSERT INTO "system_settings" VALUES('advanced.cacheExpiry','60','2025-08-19 02:28:14','2025-08-19 02:28:14');
INSERT INTO "system_settings" VALUES('advanced.sessionExpiry','24','2025-08-19 02:28:14','2025-08-19 02:28:14');
INSERT INTO "system_settings" VALUES('advanced.enableRateLimit','true','2025-08-19 02:28:14','2025-08-19 02:28:14');
INSERT INTO "system_settings" VALUES('advanced.enableLogging','true','2025-08-19 02:28:14','2025-08-19 02:28:14');
INSERT INTO "system_settings" VALUES('advanced.enableMetrics','true','2025-08-19 02:28:14','2025-08-19 02:28:14');
INSERT INTO "system_settings" VALUES('integrations.line.status','disconnected','2025-08-19 02:28:14','2025-08-19 02:28:14');
INSERT INTO "system_settings" VALUES('integrations.facebook.status','disconnected','2025-08-19 02:28:14','2025-08-19 02:28:14');
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
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" VALUES('d1_migrations',6);
INSERT INTO "sqlite_sequence" VALUES('app_users',2);
INSERT INTO "sqlite_sequence" VALUES('activities',43);
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
CREATE INDEX idx_activities_user ON activities(user_id);
CREATE INDEX idx_activities_action ON activities(action);
CREATE INDEX idx_activities_resource ON activities(resource_type, resource_id);
CREATE INDEX idx_activities_created ON activities(created_at);
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