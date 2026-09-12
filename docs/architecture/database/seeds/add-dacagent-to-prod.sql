-- Add missing dacagent to production database
INSERT INTO agents (
  id, 
  username, 
  email, 
  password_hash, 
  display_name, 
  role, 
  is_active, 
  password_policy, 
  last_login_at, 
  created_at, 
  updated_at
) VALUES (
  '<AGENT_ID>',
  '<AGENT_USERNAME>',
  '<AGENT_EMAIL>',
  '<AGENT_PASSWORD_HASH>',
  'dacagent',
  'agent',
  1,
  'changeable',
  NULL,
  datetime('now'),
  datetime('now')
);
