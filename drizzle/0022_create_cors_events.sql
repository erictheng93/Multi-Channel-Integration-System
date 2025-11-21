-- Migration: Create cors_events table for CORS monitoring
-- Date: 2025-11-21
-- Purpose: P2-6 Statistics Querying from D1 - Persistent CORS event storage

CREATE TABLE IF NOT EXISTS cors_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('allowed', 'rejected', 'preflight', 'sse_connection', 'credentials_used')),
  origin TEXT NOT NULL,
  method TEXT,
  path TEXT,
  user_agent TEXT,
  ip_address TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  metadata TEXT  -- JSON string for additional details
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cors_events_type
  ON cors_events(type);

CREATE INDEX IF NOT EXISTS idx_cors_events_origin
  ON cors_events(origin);

CREATE INDEX IF NOT EXISTS idx_cors_events_timestamp
  ON cors_events(timestamp DESC);

-- Composite index for rejected origins analysis
CREATE INDEX IF NOT EXISTS idx_cors_events_rejected_origin
  ON cors_events(type, origin, timestamp DESC)
  WHERE type = 'rejected';

-- Composite index for allowed origins analysis
CREATE INDEX IF NOT EXISTS idx_cors_events_allowed_origin
  ON cors_events(type, origin, timestamp DESC)
  WHERE type = 'allowed';
