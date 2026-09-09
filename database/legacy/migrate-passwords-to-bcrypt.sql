-- 將 app_users 表中的舊用戶密碼更新為 bcrypt 格式
-- 注意：這些是已知的測試密碼，在生產環境中應該要求用戶重新設置密碼

-- 更新 admin@example.com 的密碼為 bcrypt 格式 (密碼: admin123)
UPDATE app_users 
SET password_hash = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.Gm.YG2'
WHERE email = 'admin@example.com';

-- 更新 agent1@example.com 的密碼為 bcrypt 格式 (密碼: admin123)
UPDATE app_users 
SET password_hash = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.Gm.YG2'
WHERE email = 'agent1@example.com';