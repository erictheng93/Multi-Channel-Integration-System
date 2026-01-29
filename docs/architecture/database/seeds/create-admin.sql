DELETE FROM agents WHERE email = 'admin@dacit.net';
INSERT INTO agents (id, username, email, password_hash, display_name, role, is_active, created_at, updated_at) 
VALUES ('admin-001', 'admin', 'admin@dacit.net', '$2a$12$eb2Glfv9/Z3qlPfzhhi8A.rgze6bOKNoq75XmvKQT96LNDqkVrAJu', 'System Administrator', 'admin', 1, datetime('now'), datetime('now'));