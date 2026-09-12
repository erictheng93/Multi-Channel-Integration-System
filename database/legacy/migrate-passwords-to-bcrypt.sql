-- 將 app_users 表中的舊用戶密碼更新為 bcrypt 格式
-- 注意：這些是已知的測試密碼，在生產環境中應該要求用戶重新設置密碼

-- Update the selected admin account with an operator-supplied bcrypt hash.
UPDATE app_users 
SET password_hash = '<ADMIN_PASSWORD_HASH>'
WHERE email = '<ADMIN_EMAIL>';

-- Update the selected agent account with an operator-supplied bcrypt hash.
UPDATE app_users 
SET password_hash = '<AGENT_PASSWORD_HASH>'
WHERE email = '<AGENT_EMAIL>';
