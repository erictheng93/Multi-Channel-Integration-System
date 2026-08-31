-- Add QR Codes Table for Team QR Code Management
-- This migration adds a comprehensive QR code tracking system

-- QR Codes table - stores all generated QR codes
CREATE TABLE IF NOT EXISTS qr_codes (
    id TEXT PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id),
    token TEXT NOT NULL UNIQUE,
    line_url TEXT NOT NULL,
    qr_code_image_url TEXT NOT NULL,
    campaign_name TEXT,
    description TEXT,
    usage_count INTEGER DEFAULT 0,
    max_uses INTEGER,
    is_active INTEGER DEFAULT 1,
    expires_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- QR Code Scans table - tracks each scan event
CREATE TABLE IF NOT EXISTS qr_code_scans (
    id TEXT PRIMARY KEY,
    qr_code_id TEXT NOT NULL REFERENCES qr_codes(id),
    customer_id INTEGER REFERENCES customers(id),
    platform TEXT NOT NULL,
    platform_user_id TEXT,
    scan_metadata TEXT, -- JSON for additional scan data
    scanned_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- QR Code Analytics table - aggregated statistics
CREATE TABLE IF NOT EXISTS qr_code_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    qr_code_id TEXT NOT NULL REFERENCES qr_codes(id),
    date TEXT NOT NULL,
    total_scans INTEGER DEFAULT 0,
    unique_scans INTEGER DEFAULT 0,
    new_customers INTEGER DEFAULT 0,
    returning_customers INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(qr_code_id, date)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_qr_codes_team_id ON qr_codes(team_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_token ON qr_codes(token);
CREATE INDEX IF NOT EXISTS idx_qr_codes_is_active ON qr_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_qr_code_scans_qr_code_id ON qr_code_scans(qr_code_id);
CREATE INDEX IF NOT EXISTS idx_qr_code_scans_customer_id ON qr_code_scans(customer_id);
CREATE INDEX IF NOT EXISTS idx_qr_code_analytics_date ON qr_code_analytics(date);