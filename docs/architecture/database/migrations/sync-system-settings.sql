-- Sync system_settings data from remote to local
DELETE FROM system_settings;

INSERT OR REPLACE INTO system_settings (key, value, created_at, updated_at)
VALUES 
('general.systemName', 'Multi-Channel Support', '2025-08-19 10:45:37', '2025-08-19 10:45:37'),
('general.contactEmail', 'admin@example.com', '2025-08-19 10:45:37', '2025-08-19 10:45:37'),
('general.timezone', 'Asia/Taipei', '2025-08-19 10:45:37', '2025-08-19 10:45:37'),
('general.language', 'zh-TW', '2025-08-19 10:45:37', '2025-08-19 10:45:37'),
('advanced.messageQueueSize', '1000', '2025-08-19 10:45:37', '2025-08-19 10:45:37'),
('advanced.messageTimeout', '30', '2025-08-19 10:45:37', '2025-08-19 10:45:37'),
('advanced.cacheExpiry', '60', '2025-08-19 10:45:37', '2025-08-19 10:45:37'),
('advanced.sessionExpiry', '24', '2025-08-19 10:45:37', '2025-08-19 10:45:37'),
('advanced.enableRateLimit', 'true', '2025-08-19 10:45:37', '2025-08-19 10:45:37'),
('advanced.enableLogging', 'true', '2025-08-19 10:45:37', '2025-08-19 10:45:37'),
('advanced.enableMetrics', 'true', '2025-08-19 10:45:37', '2025-08-19 10:45:37'),
('integrations.line.status', 'disconnected', '2025-08-19 10:45:37', '2025-08-19 10:45:37'),
('integrations.facebook.status', 'disconnected', '2025-08-19 10:45:37', '2025-08-19 10:45:37'),
('timezone_test', 'Asia/Taipei', '2025-08-29 08:25:41', '2025-08-29 08:25:41');