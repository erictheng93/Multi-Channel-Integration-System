-- 統一所有密碼為 bcrypt 格式
-- 這個腳本確保本地和遠端環境都使用 bcrypt 哈希

-- 更新或插入 agents 表中的用戶（使用你的自定義憑證）
INSERT OR REPLACE INTO agents (id, email, password_hash, name, role, is_active, created_at)
VALUES 
    ('admin-001', 'admin@dacit.net', '$2a$12$AVSzHYOJseo6vVDzX.XFCuuvWMrzImwARka/3AjPbO7VO9lKtwnRG', 'System Administrator', 'admin', 1, 1704088800000),
    ('agent-001', 'dacagent@dacit.net', '$2a$12$N3XyZSTj.MGEnudWYHdBielDsW7YB5wGssKdab3Po0PrelPBtGqB6', 'Test Agent', 'agent', 1, 1704088800000);

-- 更新 app_users 表中的舊用戶為 bcrypt 格式
UPDATE app_users 
SET password_hash = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.Gm.YG2'
WHERE email = 'admin@example.com';

UPDATE app_users 
SET password_hash = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.Gm.YG2'
WHERE email = 'agent1@example.com';