-- 創建管理員用戶
-- 使用 bcrypt 哈希的 <ADMIN_PASSWORD> 密碼
INSERT OR REPLACE INTO agents (id, username, email, password_hash, display_name, role, is_active, created_at)
VALUES 
    ('<ADMIN_ID>', '<ADMIN_USERNAME>', '<ADMIN_EMAIL>', '<ADMIN_PASSWORD_HASH>', 'System Administrator', 'admin', 1, '2024-01-01T00:00:00Z');

-- 創建測試客服用戶
-- 使用 bcrypt 哈希的 <AGENT_PASSWORD> 密碼
INSERT OR REPLACE INTO agents (id, username, email, password_hash, display_name, role, is_active, created_at)
VALUES 
    ('<AGENT_ID>', '<AGENT_USERNAME>', '<AGENT_EMAIL>', '<AGENT_PASSWORD_HASH>', 'Test Agent', 'agent', 1, '2024-01-01T00:00:00Z');
