-- Migration: Add password_plaintext column for testing/development purposes
-- WARNING: This is for testing only. Never use in production.

ALTER TABLE agents ADD COLUMN password_plaintext TEXT;

-- Update existing test agent with known password
UPDATE agents SET password_plaintext = 'testagent' WHERE id = 'test-agent-001';
UPDATE agents SET password_plaintext = 'password123' WHERE password_plaintext IS NULL;