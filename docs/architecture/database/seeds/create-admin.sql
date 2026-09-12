DELETE FROM agents WHERE email = '<ADMIN_EMAIL>';
INSERT INTO agents (id, username, email, password_hash, display_name, role, is_active, created_at, updated_at) 
VALUES ('<ADMIN_ID>', '<ADMIN_USERNAME>', '<ADMIN_EMAIL>', '<ADMIN_PASSWORD_HASH>', 'System Administrator', 'admin', 1, datetime('now'), datetime('now'));
