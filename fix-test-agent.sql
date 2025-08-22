-- Fix test agent password hash
UPDATE agents 
SET password_hash = '$2a$12$8FaRkT7se/nq6p2Efl1kI.5k.vAHpQ5qBXPj2tf0GhP.KSoDnGh.m', 
    username = 'test',
    display_name = 'Test Agent',
    is_active = 1,
    updated_at = datetime('now')
WHERE email = 'test@dacit.net';