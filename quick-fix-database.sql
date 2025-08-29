-- 快速修復數據庫 schema 不匹配問題
-- 執行此腳本來修復當前的 LINE webhook 問題

-- 1. 為 customers 表添加缺少的字段
ALTER TABLE customers ADD COLUMN profile_updated_at TEXT DEFAULT (datetime('now'));

-- 檢查 conversations 表的 id 字段類型
-- 如果需要將 INTEGER id 轉換為 TEXT id，執行以下步驟：

-- 先備份現有數據
CREATE TABLE conversations_backup AS SELECT * FROM conversations;

-- 重新創建 conversations 表（帶 TEXT id）
DROP TABLE conversations;
CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    assigned_team_id INTEGER,
    assigned_user_id INTEGER,
    status TEXT NOT NULL DEFAULT 'active',
    last_message_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 如果有現有數據，可以選擇性遷移（通常新部署不需要）
-- INSERT INTO conversations (id, customer_id, assigned_team_id, assigned_user_id, status, last_message_at, created_at, updated_at)
-- SELECT 'conv_' || CAST(id AS TEXT), customer_id, assigned_team_id, assigned_user_id, status, last_message_at, created_at, updated_at
-- FROM conversations_backup;

-- 重新創建索引
CREATE INDEX IF NOT EXISTS idx_conversations_customer ON conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_user ON conversations(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_team ON conversations(assigned_team_id);

-- 清理備份表
DROP TABLE conversations_backup;