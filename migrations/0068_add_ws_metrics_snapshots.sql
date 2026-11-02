-- ===============================================
-- Migration 0068: ws_metrics_snapshots
-- ===============================================
-- Date: 2026-10-29
--
-- History for the realtime (WebSocket) metrics page. One row per */5 cron run,
-- written by scheduled() from a single MessageBroadcaster /metrics request, and
-- pruned to the last 7 days by the same run (~2016 rows steady state).
-- Rate, latency and error columns are NULL when the broadcaster had no reference
-- sample for a window (first run after a DO reset): unknown, not zero.
-- The index is also declared in src/db/schema.ts so a schema-driven rebuild keeps it
-- (see the 2026-06-17 drift incident).
CREATE TABLE IF NOT EXISTS ws_metrics_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  active_connections INTEGER NOT NULL,
  online_agents INTEGER NOT NULL,
  events_in_per_s REAL,
  events_out_per_s REAL,
  avg_processing_ms REAL,
  error_rate REAL
);

CREATE INDEX IF NOT EXISTS idx_ws_metrics_snapshots_ts ON ws_metrics_snapshots(ts);
