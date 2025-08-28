UPDATE agents 
SET password_hash = '$2a$12$UIsYL7dO1fVE.ydLNXe.GuxSW7loLKNtzJgY8cZM5mPHKYywE7m0y', 
    updated_at = datetime('now') 
WHERE email = 'admin@dacit.net';