-- Migration: Create webhook_security_events table for security monitoring
-- Date: 2025-11-20
-- Purpose: P2-4 Security Monitoring Table Creation

CREATE TABLE IF NOT EXISTS webhook_security_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  platform TEXT NOT NULL,
  integration_id INTEGER,
  source_ip TEXT,
  details TEXT,  -- JSON string
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Foreign key to channel_integrations
  CONSTRAINT fk_integration
    FOREIGN KEY (integration_id)
    REFERENCES channel_integrations(id)
    ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_webhook_security_events_platform
  ON webhook_security_events(platform);

CREATE INDEX IF NOT EXISTS idx_webhook_security_events_created_at
  ON webhook_security_events(created_at);

CREATE INDEX IF NOT EXISTS idx_webhook_security_events_severity
  ON webhook_security_events(severity);

CREATE INDEX IF NOT EXISTS idx_webhook_security_events_type
  ON webhook_security_events(type);

CREATE INDEX IF NOT EXISTS idx_webhook_security_events_integration
  ON webhook_security_events(integration_id);

-- Composite index for common queries (platform + severity + date)
CREATE INDEX IF NOT EXISTS idx_webhook_security_events_platform_severity
  ON webhook_security_events(platform, severity, created_at DESC);
