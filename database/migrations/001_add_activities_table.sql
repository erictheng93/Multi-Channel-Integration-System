-- 添加活動記錄表的遷移腳本
-- 執行時間：2024-01-15

-- 創建活動記錄表
CREATE TABLE IF NOT EXISTS activities (
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

-- 建立活動記錄索引
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_action ON activities(action);
CREATE INDEX IF NOT EXISTS idx_activities_resource ON activities(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at);

-- 插入一些示例活動記錄（可選）
INSERT INTO activities (user_id, user_name, user_role, action, resource_type, details, created_at) VALUES
('admin-001', 'Admin', 'admin', 'user_login', 'user', '{"loginMethod": "email"}', datetime('now', '-1 hour')),
('agent-001', 'Agent 1', 'agent', 'user_login', 'user', '{"loginMethod": "email"}', datetime('now', '-30 minutes')),
('admin-001', 'Admin', 'admin', 'settings_update', 'system', '{"settingsCount": 3}', datetime('now', '-15 minutes'));