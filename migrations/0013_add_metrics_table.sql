-- Migration: Add metrics table for enterprise analytics
-- Created: 2025-01-31
-- Purpose: Support enterprise-grade analytics and performance tracking

-- Create metrics table for storing analytics data
CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    timestamp INTEGER NOT NULL,
    tags TEXT, -- JSON string for additional metadata
    unit TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_metrics_name_timestamp ON metrics(metric_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(metric_name);

-- Example metrics that can be tracked:
-- INSERT INTO metrics (metric_name, metric_value, timestamp, tags, unit) VALUES
-- ('agent_response_time', 45.5, 1706745600000, '{"agent_id": "1", "conversation_id": "123"}', 'seconds'),
-- ('conversation_resolution_time', 1800.0, 1706745600000, '{"agent_id": "1", "priority": "high"}', 'seconds'),
-- ('api_request_duration', 120.5, 1706745600000, '{"endpoint": "/api/messages", "status": "200"}', 'milliseconds'),
-- ('customer_satisfaction_rating', 4.5, 1706745600000, '{"agent_id": "1", "conversation_id": "123"}', 'rating'),
-- ('message_count', 15, 1706745600000, '{"agent_id": "1", "period": "hourly"}', 'count');