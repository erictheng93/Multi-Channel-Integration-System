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
  '50a679c1-66e9-41d5-a40a-f0626035198d',
  'dacagent@dacit.net',
  'dacagent@dacit.net',
  '$2a$10$3KGYWf/vF1pbbkmgbKbbPOfdA.8xsTWyOG2ni8M/yo41uCrYmbe/2',
  'dacagent',
  'agent',
  1,
  'changeable',
  '2025-08-21T07:56:26.493Z',
  '1755762952265.0',
  '2025-08-21 07:55:52'
);