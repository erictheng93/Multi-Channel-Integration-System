-- Migration 0030: Add Team LIFF QR Codes Table
-- Purpose: Store persistent LIFF URLs and QR Code images for team member onboarding
-- Created: 2025-12-24
-- Related Feature: LIFF Team QR Code System

-- ========================================
-- Team LIFF QR Codes Table
-- ========================================
-- Stores LIFF URLs and QR Code images for each team
-- Each team gets ONE persistent QR Code that never changes
CREATE TABLE IF NOT EXISTS team_liff_qr_codes (
  id TEXT PRIMARY KEY,
  team_id INTEGER NOT NULL UNIQUE,
  liff_url TEXT NOT NULL,
  qr_code_url TEXT NOT NULL,
  scan_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- ========================================
-- Indexes for Performance
-- ========================================
CREATE INDEX IF NOT EXISTS idx_team_liff_qr_codes_team_id ON team_liff_qr_codes(team_id);
CREATE INDEX IF NOT EXISTS idx_team_liff_qr_codes_is_active ON team_liff_qr_codes(is_active);
