-- database/apply-enhancements.sql
-- 應用所有增強功能的數據庫更改

-- 開始事務
BEGIN TRANSACTION;

-- 啟用外鍵約束
PRAGMA foreign_keys = ON;

-- ==================== 創建缺少的表格 ====================

-- 團隊表（如果不存在）
CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    qr_code TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 用戶表（兼容現有agents表）
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
    team_id INTEGER,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (team_id) REFERENCES teams(id)
);

-- ==================== 標籤系統 ====================

-- 標籤表
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3B82F6',
    description TEXT,
    team_id INTEGER, -- NULL表示全局標籤
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (team_id) REFERENCES teams(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    UNIQUE(name, team_id)
);

-- 客戶標籤關聯表
CREATE TABLE IF NOT EXISTS customer_tags (
    customer_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    assigned_by INTEGER NOT NULL,
    assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (customer_id, tag_id),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id)
);

-- 對話標籤關聯表
CREATE TABLE IF NOT EXISTS conversation_tags (
    conversation_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    assigned_by INTEGER NOT NULL,
    assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (conversation_id, tag_id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id)
);

-- ==================== 對話管理增強 ====================

-- 對話轉移歷史表
CREATE TABLE IF NOT EXISTS conversation_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    from_team_id INTEGER,
    to_team_id INTEGER,
    from_user_id INTEGER,
    to_user_id INTEGER,
    transfer_reason TEXT,
    transferred_by INTEGER NOT NULL,
    transfer_type TEXT NOT NULL DEFAULT 'manual' CHECK (transfer_type IN ('manual', 'auto', 'escalation')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (from_team_id) REFERENCES teams(id),
    FOREIGN KEY (to_team_id) REFERENCES teams(id),
    FOREIGN KEY (from_user_id) REFERENCES users(id),
    FOREIGN KEY (to_user_id) REFERENCES users(id),
    FOREIGN KEY (transferred_by) REFERENCES users(id)
);

-- ==================== 對話會話管理 ====================

-- 對話會話表
CREATE TABLE IF NOT EXISTS conversation_sessions (
    id TEXT PRIMARY KEY,
    conversation_id INTEGER NOT NULL,
    session_type TEXT NOT NULL DEFAULT 'continuous' CHECK (session_type IN ('continuous', 'topic_based', 'time_based')),
    topic TEXT,
    start_time TEXT NOT NULL DEFAULT (datetime('now')),
    end_time TEXT,
    last_activity TEXT NOT NULL DEFAULT (datetime('now')),
    message_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- ==================== 通知系統 ====================

-- 通知表
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('new_message', 'conversation_assigned', 'mention', 'system', 'conversation_transferred', 'priority_changed')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    data TEXT, -- JSON格式的額外資料
    is_read BOOLEAN DEFAULT FALSE,
    read_at TEXT,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 通知設定表
CREATE TABLE IF NOT EXISTS notification_settings (
    user_id INTEGER PRIMARY KEY,
    email_enabled BOOLEAN DEFAULT TRUE,
    push_enabled BOOLEAN DEFAULT TRUE,
    sound_enabled BOOLEAN DEFAULT TRUE,
    mention_enabled BOOLEAN DEFAULT TRUE,
    assignment_enabled BOOLEAN DEFAULT TRUE,
    message_enabled BOOLEAN DEFAULT TRUE,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==================== QR碼管理增強 ====================

-- QR碼表
CREATE TABLE IF NOT EXISTS qr_codes (
    id TEXT PRIMARY KEY,
    team_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    campaign_name TEXT,
    qr_code_url TEXT NOT NULL,
    line_url TEXT NOT NULL,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ==================== 擴展現有表格 ====================

-- 為對話表添加新字段（如果不存在）
ALTER TABLE conversations ADD COLUMN priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
ALTER TABLE conversations ADD COLUMN tags TEXT; -- JSON格式的標籤ID數組
ALTER TABLE conversations ADD COLUMN internal_notes TEXT;
ALTER TABLE conversations ADD COLUMN auto_close_at TEXT;

-- 為訊息表添加搜索相關字段（如果不存在）
-- 這些欄位可能已經存在，所以使用 IF NOT EXISTS 的變通方法
CREATE TABLE IF NOT EXISTS messages_temp AS SELECT * FROM messages LIMIT 0;
ALTER TABLE messages_temp ADD COLUMN direction TEXT DEFAULT 'inbound';
ALTER TABLE messages_temp ADD COLUMN has_attachments BOOLEAN DEFAULT FALSE;
DROP TABLE messages_temp;

-- ==================== 創建索引 ====================

-- 標籤相關索引
CREATE INDEX IF NOT EXISTS idx_tags_team ON tags(team_id);
CREATE INDEX IF NOT EXISTS idx_tags_active ON tags(is_active);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_customer_tags_customer ON customer_tags(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_tags_tag ON customer_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_conversation_tags_conversation ON conversation_tags(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_tags_tag ON conversation_tags(tag_id);

-- 對話相關索引
CREATE INDEX IF NOT EXISTS idx_conversations_priority ON conversations(priority);
CREATE INDEX IF NOT EXISTS idx_conversations_status_priority ON conversations(status, priority);
CREATE INDEX IF NOT EXISTS idx_conversation_transfers_conversation ON conversation_transfers(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_transfers_created ON conversation_transfers(created_at);

-- 會話相關索引
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_conversation ON conversation_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_active ON conversation_sessions(is_active);

-- 通知相關索引
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_expires ON notifications(expires_at);

-- 用戶相關索引
CREATE INDEX IF NOT EXISTS idx_users_team ON users(team_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- QR碼相關索引
CREATE INDEX IF NOT EXISTS idx_qr_codes_team ON qr_codes(team_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_active ON qr_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_qr_codes_token ON qr_codes(token);

-- 搜索相關索引
CREATE INDEX IF NOT EXISTS idx_messages_content ON messages(content);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_content ON messages(conversation_id, content);
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type);
CREATE INDEX IF NOT EXISTS idx_messages_recalled ON messages(is_recalled);

-- 客戶搜索索引
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(display_name);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_team ON customers(source_team_id);

-- ==================== 插入預設資料 ====================

-- 插入預設標籤
INSERT OR IGNORE INTO tags (id, name, color, description, team_id, created_by) VALUES
(1, 'VIP', '#F59E0B', 'VIP客戶', NULL, NULL),
(2, '技術支援', '#10B981', '技術相關問題', NULL, NULL),
(3, '銷售諮詢', '#3B82F6', '產品銷售相關', NULL, NULL),
(4, '投訴', '#EF4444', '客戶投訴', NULL, NULL),
(5, '待處理', '#8B5CF6', '需要進一步處理', NULL, NULL),
(6, '已解決', '#059669', '問題已解決', NULL, NULL),
(7, '緊急', '#DC2626', '緊急處理', NULL, NULL),
(8, '退款', '#F97316', '退款相關', NULL, NULL),
(9, '新客戶', '#06B6D4', '新註冊客戶', NULL, NULL),
(10, '回頭客', '#84CC16', '回頭客戶', NULL, NULL);

-- 插入預設團隊
INSERT OR IGNORE INTO teams (id, name, description) VALUES
(1, '客服團隊', '負責一般客戶服務'),
(2, '技術團隊', '處理技術支援問題'),
(3, '銷售團隊', '處理銷售和產品諮詢'),
(4, '管理團隊', '系統管理和監督');

-- 如果存在agents表，遷移數據到users表
INSERT OR IGNORE INTO users (id, username, email, password_hash, display_name, role, created_at)
SELECT id, 
       COALESCE(name, email) as username,
       email,
       password_hash,
       name as display_name,
       role,
       datetime(created_at/1000, 'unixepoch') as created_at
FROM agents 
WHERE EXISTS (SELECT name FROM pragma_table_info('agents') WHERE name = 'id');

-- 提交事務
COMMIT;

-- 分析表以優化查詢性能
ANALYZE;