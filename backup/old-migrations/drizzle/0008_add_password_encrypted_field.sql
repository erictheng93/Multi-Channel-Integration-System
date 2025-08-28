-- Migration: Add password_encrypted field for admin password viewing
-- Date: 2025-01-22
-- Description: Adds password_encrypted field to agents table for secure password storage/retrieval

-- Add password_encrypted column to agents table if it doesn't exist
-- This field stores AES encrypted passwords that admins can decrypt and view
ALTER TABLE agents ADD COLUMN password_encrypted TEXT;

-- Create index for performance on password_encrypted queries
CREATE INDEX IF NOT EXISTS idx_agents_password_encrypted ON agents(password_encrypted);