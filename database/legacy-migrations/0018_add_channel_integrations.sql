-- Migration: Add channel_integrations table for multi-tenant channel management
-- Description: Enables customers to configure their own LINE/Facebook/WhatsApp channels
-- Date: 2025-10-27

-- ============================================================================
-- Table: channel_integrations
-- Purpose: Store channel configuration for each team (multi-tenant support)
-- ============================================================================

CREATE TABLE IF NOT EXISTS channel_integrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL,

  -- Channel type: 'line', 'facebook', 'whatsapp', etc.
  platform TEXT NOT NULL,

  -- LINE-specific configuration
  line_channel_id TEXT,
  line_channel_access_token TEXT, -- Encrypted storage recommended
  line_channel_secret TEXT, -- Encrypted storage recommended
  line_webhook_url TEXT, -- Auto-generated unique webhook URL
  line_webhook_token TEXT, -- Random token for webhook verification

  -- Facebook-specific configuration (for future use)
  facebook_page_id TEXT,
  facebook_access_token TEXT,
  facebook_app_secret TEXT,

  -- WhatsApp-specific configuration (for future use)
  whatsapp_phone_number TEXT,
  whatsapp_business_account_id TEXT,
  whatsapp_access_token TEXT,

  -- Configuration status
  is_active INTEGER DEFAULT 1, -- Boolean: 1 = active, 0 = inactive
  is_verified INTEGER DEFAULT 0, -- Boolean: 1 = verified, 0 = not verified
  last_verified_at TEXT, -- ISO 8601 timestamp

  -- Usage statistics
  total_messages_sent INTEGER DEFAULT 0,
  total_messages_received INTEGER DEFAULT 0,
  last_message_at TEXT, -- ISO 8601 timestamp

  -- Configuration metadata
  configured_by TEXT, -- References agents.id
  config_metadata TEXT, -- JSON: additional configuration options

  -- Error tracking
  last_error TEXT, -- JSON: last error message
  error_count INTEGER DEFAULT 0, -- Consecutive error count

  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  -- Foreign key constraint
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (configured_by) REFERENCES agents(id) ON DELETE SET NULL
);

-- ============================================================================
-- Indexes for performance optimization
-- ============================================================================

-- Primary lookup: find channel by team
CREATE INDEX IF NOT EXISTS idx_channel_integrations_team_id
  ON channel_integrations(team_id);

-- Filter by platform type
CREATE INDEX IF NOT EXISTS idx_channel_integrations_platform
  ON channel_integrations(platform);

-- Webhook routing: fast lookup by webhook URL
CREATE INDEX IF NOT EXISTS idx_channel_integrations_webhook_url
  ON channel_integrations(line_webhook_url);

-- Webhook routing: fast lookup by webhook token
CREATE INDEX IF NOT EXISTS idx_channel_integrations_webhook_token
  ON channel_integrations(line_webhook_token);

-- Active channels only
CREATE INDEX IF NOT EXISTS idx_channel_integrations_active
  ON channel_integrations(team_id, platform, is_active);

-- Find channels needing re-verification
CREATE INDEX IF NOT EXISTS idx_channel_integrations_verified
  ON channel_integrations(is_verified, last_verified_at);

-- ============================================================================
-- Unique constraints
-- ============================================================================

-- Each team can only have ONE active channel per platform
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_unique_active_per_team
  ON channel_integrations(team_id, platform, is_active)
  WHERE is_active = 1;

-- Webhook URL must be globally unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_unique_webhook_url
  ON channel_integrations(line_webhook_url)
  WHERE line_webhook_url IS NOT NULL;

-- Webhook token must be globally unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_unique_webhook_token
  ON channel_integrations(line_webhook_token)
  WHERE line_webhook_token IS NOT NULL;

-- LINE Channel ID must be unique per active channel
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_unique_line_id
  ON channel_integrations(line_channel_id)
  WHERE line_channel_id IS NOT NULL AND is_active = 1;

-- ============================================================================
-- Migration validation
-- ============================================================================

-- Verify table was created successfully
SELECT 'channel_integrations table created successfully' AS status;

-- Show table schema
PRAGMA table_info(channel_integrations);
