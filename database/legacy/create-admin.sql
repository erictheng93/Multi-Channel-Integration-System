-- 創建管理員用戶
-- 使用 bcrypt 哈希的 <ADMIN_PASSWORD> 密碼
INSERT OR REPLACE INTO agents (id, username, email, password_hash, display_name, role, is_active, created_at)
VALUES 
    ('admin-001', 'admin', 'admin@dacit.net', '$2a$12$AVSzHYOJseo6vVDzX.XFCuuvWMrzImwARka/3AjPbO7VO9lKtwnRG', 'System Administrator', 'admin', 1, '2024-01-01T00:00:00Z');

-- 創建測試客服用戶
-- 使用 bcrypt 哈希的 <AGENT_PASSWORD> 密碼
INSERT OR REPLACE INTO agents (id, username, email, password_hash, display_name, role, is_active, created_at)
VALUES 
    ('agent-001', 'dacagent', 'dacagent@dacit.net', '$2a$12$N3XyZSTj.MGEnudWYHdBielDsW7YB5wGssKdab3Po0PrelPBtGqB6', 'Test Agent', 'agent', 1, '2024-01-01T00:00:00Z');