-- Migration: Add system_settings table and default settings
-- Created: 2024-01-15

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create invitations table (if not exists)
CREATE TABLE IF NOT EXISTS invitations (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    invited_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    used_by TEXT,
    FOREIGN KEY (invited_by) REFERENCES agents(id)
);

-- Insert default system settings
INSERT OR IGNORE INTO system_settings (key, value) VALUES 
    ('general.systemName', 'Multi-Channel Support'),
    ('general.contactEmail', 'admin@example.com'),
    ('general.timezone', 'Asia/Taipei'),
    ('general.language', 'zh-TW'),
    ('advanced.messageQueueSize', '1000'),
    ('advanced.messageTimeout', '30'),
    ('advanced.cacheExpiry', '60'),
    ('advanced.sessionExpiry', '24'),
    ('advanced.enableRateLimit', 'true'),
    ('advanced.enableLogging', 'true'),
    ('advanced.enableMetrics', 'true'),
    ('integrations.line.status', 'disconnected'),
    ('integrations.facebook.status', 'disconnected');