-- database/init.sql
-- 完整的資料庫初始化腳本
-- 專案名稱：Multi-Channel Support MVP

-- 0. 禁用外鍵約束以便清理
PRAGMA foreign_keys = OFF;

-- 1. 清理舊表格
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS system_settings;
DROP TABLE IF EXISTS attachments;
DROP TABLE IF EXISTS conversation_transfers;
DROP TABLE IF EXISTS internal_notes;
DROP TABLE IF EXISTS conversation_tags;
DROP TABLE IF EXISTS customer_tags;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS conversation_sessions;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS line_users;
DROP TABLE IF EXISTS chat_sessions;
DROP TABLE IF EXISTS session_messages;
DROP TABLE IF EXISTS webhook_logs;

-- 2. 建立新的表格結構

-- 客戶表 (平台用戶)
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

-- 對話表
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

-- 訊息表
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

-- 客服人員表
CREATE TABLE agents (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'agent',
    is_active BOOLEAN DEFAULT TRUE,
    created_at INTEGER NOT NULL
);

-- 系統設定表
CREATE TABLE system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 邀請表
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

-- 活動記錄表
CREATE TABLE activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_role TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details TEXT, -- JSON格式的詳細資訊
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES agents(id)
);

-- 3. 建立索引
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

-- 4. 重新啟用外鍵約束
PRAGMA foreign_keys = ON;

-- 5. 插入測試資料
INSERT INTO agents (id, email, password_hash, name, role, created_at)
VALUES 
    ('admin-001', 'admin@dacit.net', '$2a$12$AVSzHYOJseo6vVDzX.XFCuuvWMrzImwARka/3AjPbO7VO9lKtwnRG', 'Admin', 'admin', 1704088800000),
    ('agent-001', 'dacagent@dacit.net', '$2a$12$N3XyZSTj.MGEnudWYHdBielDsW7YB5wGssKdab3Po0PrelPBtGqB6', 'Agent 1', 'agent', 1704088800000);

-- 6. 插入預設系統設定
INSERT INTO system_settings (key, value) VALUES 
    ('general.systemName', 'Multi-Channel Support'),
    ('general.contactEmail', 'admin@example.com'),
    ('general.timezone', 'Asia/Taipei'),
    ('general.language', 'zh-TW'),
    ('advanced.messageQueueSize', '1000'),
    ('advanced.messageTimeout', '30'),
    ('advanced.cacheExpiry', '60'),
    ('advanced.sessionExpiry', '24'),
    ('advanced.enableRateLimit', 'true'),
    ('advanced.enableLogging', 'true'),
    ('advanced.enableMetrics', 'true'),
    ('integrations.line.status', 'disconnected'),
    ('integrations.facebook.status', 'disconnected');