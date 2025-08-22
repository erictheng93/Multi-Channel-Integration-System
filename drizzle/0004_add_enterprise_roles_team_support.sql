-- Migration: Add enterprise roles and team support
-- Date: 2025-01-21
-- Description: Adds teams table, team_id to agents and invitations tables, and prepares for 3-role enterprise system

-- Create teams table if it doesn't exist
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  qr_code TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Add team_id column to agents table if it doesn't exist
ALTER TABLE agents ADD COLUMN team_id INTEGER REFERENCES teams(id);

-- Add team_id column to invitations table if it doesn't exist  
ALTER TABLE invitations ADD COLUMN team_id INTEGER REFERENCES teams(id);

-- Create default team for existing agents
INSERT OR IGNORE INTO teams (name, description, is_active) 
VALUES ('Default Team', 'Default team for existing agents', 1);

-- Create admin team
INSERT OR IGNORE INTO teams (name, description, is_active) 
VALUES ('Admin Team', 'Team for system administrators', 1);

-- Update existing agents based on their roles
-- Admins get no team assignment (NULL team_id is allowed for admins)
-- Agents get assigned to the default team
UPDATE agents 
SET team_id = (
  CASE 
    WHEN role = 'admin' THEN NULL
    ELSE (SELECT id FROM teams WHERE name = 'Default Team' LIMIT 1)
  END
)
WHERE team_id IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agents_team_id ON agents(team_id);
CREATE INDEX IF NOT EXISTS idx_agents_role ON agents(role);
CREATE INDEX IF NOT EXISTS idx_invitations_team_id ON invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_teams_is_active ON teams(is_active);

-- Insert trigger to update updated_at timestamp for teams
CREATE TRIGGER IF NOT EXISTS teams_updated_at 
AFTER UPDATE ON teams
BEGIN
  UPDATE teams SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Insert some sample team users for testing (optional - can be removed for production)
-- This creates a test team user (password will need to be set separately)
-- INSERT OR IGNORE INTO agents (id, username, email, password_hash, display_name, role, team_id)
-- VALUES ('team001', 'testteam', 'team@example.com', '$2b$12$test_hash', 'Test Team Leader', 'team', 
--         (SELECT id FROM teams WHERE name = 'Default Team' LIMIT 1));