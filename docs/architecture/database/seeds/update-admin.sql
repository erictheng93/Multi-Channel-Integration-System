UPDATE agents 
SET password_hash = '<ADMIN_PASSWORD_HASH>', 
    updated_at = datetime('now') 
WHERE email = '<ADMIN_EMAIL>';
