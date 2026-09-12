-- Seed agents (matches schema after migration 0039 - no username column)
INSERT INTO agents (id, email, password_hash, display_name, role, is_active, password_policy, created_at, updated_at) VALUES ('<ADMIN_ID>', '<ADMIN_EMAIL>', '<ADMIN_PASSWORD_HASH>', 'System Administrator', 'admin', 1, 'changeable', datetime('now'), datetime('now'));

INSERT INTO agents (id, email, password_hash, display_name, role, is_active, password_policy, created_at, updated_at) VALUES ('<AGENT_ID>', '<AGENT_EMAIL>', '<AGENT_PASSWORD_HASH>', 'Test User', 'agent', 1, 'must_change', datetime('now'), datetime('now'));
