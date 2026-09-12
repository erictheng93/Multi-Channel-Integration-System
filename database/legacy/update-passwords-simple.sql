INSERT OR REPLACE INTO agents (id, email, password_hash, name, role, is_active, created_at)
VALUES ('<ADMIN_ID>', '<ADMIN_EMAIL>', '<ADMIN_PASSWORD_HASH>', 'System Administrator', 'admin', 1, 1704088800000);

INSERT OR REPLACE INTO agents (id, email, password_hash, name, role, is_active, created_at)
VALUES ('<AGENT_ID>', '<AGENT_EMAIL>', '<AGENT_PASSWORD_HASH>', 'Test Agent', 'agent', 1, 1704088800000);

UPDATE app_users 
SET password_hash = '<ADMIN_PASSWORD_HASH>'
WHERE email = '<ADMIN_EMAIL>';

UPDATE app_users 
SET password_hash = '<AGENT_PASSWORD_HASH>'
WHERE email = '<AGENT_EMAIL>';
