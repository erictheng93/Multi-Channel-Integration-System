INSERT OR REPLACE INTO agents (id, email, password_hash, name, role, is_active, created_at)
VALUES ('admin-001', 'admin@dacit.net', '$2a$12$AVSzHYOJseo6vVDzX.XFCuuvWMrzImwARka/3AjPbO7VO9lKtwnRG', 'System Administrator', 'admin', 1, 1704088800000);

INSERT OR REPLACE INTO agents (id, email, password_hash, name, role, is_active, created_at)
VALUES ('agent-001', 'dacagent@dacit.net', '$2a$12$N3XyZSTj.MGEnudWYHdBielDsW7YB5wGssKdab3Po0PrelPBtGqB6', 'Test Agent', 'agent', 1, 1704088800000);

UPDATE app_users 
SET password_hash = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.Gm.YG2'
WHERE email = 'admin@example.com';

UPDATE app_users 
SET password_hash = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.Gm.YG2'
WHERE email = 'agent1@example.com';