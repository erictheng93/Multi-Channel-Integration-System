-- Fix dacagent password hash
UPDATE agents 
SET password_hash = '$2a$12$lzxPlt/u5FXEUuEvae8NTeoE9V1j/oCfNwQqKJKO6OL6PYpu8S6Wm', 
    username = 'dacagent',
    display_name = 'DaC Agent',
    is_active = 1,
    updated_at = datetime('now')
WHERE email = 'dacagent@dacit.net';