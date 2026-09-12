-- 統一所有密碼為 bcrypt 格式
-- 這個腳本確保本地和遠端環境都使用 bcrypt 哈希

-- 更新或插入 agents 表中的用戶（使用你的自定義憑證）
INSERT OR REPLACE INTO agents (id, email, password_hash, name, role, is_active, created_at)
VALUES 
    ('<ADMIN_ID>', '<ADMIN_EMAIL>', '<ADMIN_PASSWORD_HASH>', 'System Administrator', 'admin', 1, 1704088800000),
    ('<AGENT_ID>', '<AGENT_EMAIL>', '<AGENT_PASSWORD_HASH>', 'Test Agent', 'agent', 1, 1704088800000);

-- 更新 app_users 表中的舊用戶為 bcrypt 格式
UPDATE app_users 
SET password_hash = '<ADMIN_PASSWORD_HASH>'
WHERE email = '<ADMIN_EMAIL>';

UPDATE app_users 
SET password_hash = '<AGENT_PASSWORD_HASH>'
WHERE email = '<AGENT_EMAIL>';
