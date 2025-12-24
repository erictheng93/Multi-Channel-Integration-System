-- Migration 0031: Add Customer Team Assignments Table
-- Purpose: Track customer team assignments from LIFF QR Code scans
-- Created: 2025-12-24
-- Related Feature: LIFF Team QR Code System

-- ========================================
-- Customer Team Assignments Table
-- ========================================
-- Records which team a customer was assigned to via LIFF QR Code
-- This is recorded BEFORE the customer becomes a friend of the LINE OA
CREATE TABLE IF NOT EXISTS customer_team_assignments (
  id TEXT PRIMARY KEY,
  platform_user_id TEXT NOT NULL,  -- LINE User ID (U...)
  team_id INTEGER NOT NULL,        -- Assigned team
  qr_code_id TEXT,                 -- Source LIFF QR Code (if applicable)
  source TEXT DEFAULT 'liff_qr',   -- 'liff_qr', 'manual', 'import', 'webhook'
  display_name TEXT,               -- User's display name from LIFF
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT,                   -- JSON: additional info (user agent, IP, etc.)

  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (qr_code_id) REFERENCES team_liff_qr_codes(id) ON DELETE SET NULL
);

-- ========================================
-- Indexes for Performance
-- ========================================
-- Index for looking up user's team assignment
CREATE INDEX IF NOT EXISTS idx_customer_team_assignments_platform_user
  ON customer_team_assignments(platform_user_id);

-- Index for team-based queries
CREATE INDEX IF NOT EXISTS idx_customer_team_assignments_team_id
  ON customer_team_assignments(team_id);

-- Index for QR Code tracking
CREATE INDEX IF NOT EXISTS idx_customer_team_assignments_qr_code
  ON customer_team_assignments(qr_code_id);

-- Index for source tracking
CREATE INDEX IF NOT EXISTS idx_customer_team_assignments_source
  ON customer_team_assignments(source);

-- Composite index for recent assignments per team
CREATE INDEX IF NOT EXISTS idx_customer_team_assignments_team_date
  ON customer_team_assignments(team_id, assigned_at DESC);
