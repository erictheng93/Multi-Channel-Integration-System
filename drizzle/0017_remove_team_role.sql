-- Remove 'team' role from role system
-- Simplify to 2-tier role hierarchy: admin and agent only
--
-- Migration Details:
-- - Previous: 3 roles (admin, team, agent)
-- - Current: 2 roles (admin, agent)
-- - Team functionality is preserved (teams table remains)
-- - Agents can still be assigned to teams (team_id field remains)
-- - Only the 'team' role as a permission level is removed
--
-- Data Migration:
-- - Any existing 'team' role users will be downgraded to 'agent'
-- - No data loss expected as current database has no 'team' role users

-- Update any existing 'team' role users to 'agent' (conservative approach)
UPDATE agents
SET role = 'agent', updated_at = CURRENT_TIMESTAMP
WHERE role = 'team';

-- Verify migration result
-- Expected: Only 'admin' and 'agent' roles should exist
-- Query: SELECT role, COUNT(*) as count FROM agents GROUP BY role;
