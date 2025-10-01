PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" VALUES(1,'0000_charming_chimera.sql','2025-09-22 06:35:21');
INSERT INTO "d1_migrations" VALUES(2,'0001_perfect_klaw.sql','2025-09-22 06:35:21');
INSERT INTO "d1_migrations" VALUES(3,'0005_change_conversation_id_to_string.sql','2025-09-22 06:35:21');
INSERT INTO "d1_migrations" VALUES(4,'0006_sync_local_to_remote.sql','2025-09-22 06:35:22');
INSERT INTO "d1_migrations" VALUES(5,'0007_emergency_missing_tables.sql','2025-09-25 09:57:02');
INSERT INTO "d1_migrations" VALUES(6,'0008_final_schema_optimization.sql','2025-09-25 09:57:03');
INSERT INTO "d1_migrations" VALUES(7,'0009_timezone_unification_asia_taipei.sql','2025-09-25 09:57:03');
INSERT INTO "d1_migrations" VALUES(8,'0011_add_unique_constraint_platform_message_id.sql','2025-09-25 09:57:03');
INSERT INTO "d1_migrations" VALUES(9,'0012_add_conversation_sessions_table.sql','2025-09-25 09:57:03');
INSERT INTO "d1_migrations" VALUES(10,'0013_add_metrics_table.sql','2025-09-25 09:57:04');
CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'agent' NOT NULL,
	`team_id` integer,
	`is_active` integer DEFAULT true,
	`password_policy` text DEFAULT 'changeable',
	`last_login_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP, `last_active` TEXT,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
INSERT INTO "agents" VALUES('admin-001','admin@dacit.net','\a\2\.XFCuuvWMrzImwARka/3AjPbO7VO9lKtwnRG','System Administrator','admin',NULL,1,'changeable',NULL,'2025-09-25 09:14:13','2025-09-25 09:14:13',NULL);
CREATE TABLE `file_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`file_name` text NOT NULL,
	`file_type` text NOT NULL,
	`file_size` integer,
	`r2_key` text NOT NULL,
	`url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`qr_code` text,
	`is_active` integer DEFAULT true,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE delayed_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  scheduled_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE `customers` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `platform` TEXT NOT NULL,
  `platform_user_id` TEXT NOT NULL,
  `display_name` TEXT,
  `avatar_url` TEXT,
  `phone` TEXT,
  `email` TEXT,
  `source_team_id` INTEGER,
  `metadata` TEXT,
  `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `profile_updated_at` DATETIME DEFAULT NULL,
  `profile_data` TEXT DEFAULT NULL,
  UNIQUE(`platform`, `platform_user_id`)
);
CREATE TABLE `activities` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `user_id` TEXT NOT NULL,
  `user_name` TEXT NOT NULL,
  `user_role` TEXT NOT NULL,
  `action` TEXT NOT NULL,
  `resource_type` TEXT NOT NULL,
  `resource_id` TEXT,
  `details` TEXT,
  `ip_address` TEXT,
  `user_agent` TEXT,
  `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE `system_settings` (
  `key` TEXT PRIMARY KEY,
  `value` TEXT NOT NULL,
  `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "system_settings" VALUES('timezone_test','Asia/Taipei','2025-09-25 17:57:03','2025-09-25 17:57:03');
CREATE TABLE `notifications` (
  `id` TEXT PRIMARY KEY,
  `user_id` TEXT NOT NULL REFERENCES agents(id),
  `type` TEXT NOT NULL,
  `title` TEXT NOT NULL,
  `content` TEXT NOT NULL,
  `data` TEXT,
  `is_read` INTEGER DEFAULT 0,
  `read_at` TEXT,
  `expires_at` TEXT,
  `created_at` TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE `tags` (
  `id` INTEGER PRIMARY KEY,
  `name` TEXT NOT NULL,
  `color` TEXT NOT NULL DEFAULT '#3B82F6',
  `description` TEXT,
  `team_id` INTEGER REFERENCES teams(id),
  `is_active` INTEGER DEFAULT 1,
  `created_by` TEXT NOT NULL REFERENCES agents(id),
  `created_at` TEXT DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(`name`, `team_id`)
);
CREATE TABLE `customer_tags` (
  `customer_id` INTEGER NOT NULL REFERENCES customers(id),
  `tag_id` INTEGER NOT NULL REFERENCES tags(id),
  `assigned_by` TEXT NOT NULL REFERENCES agents(id),
  `assigned_at` TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`customer_id`, `tag_id`)
);
CREATE TABLE `conversation_tags` (
  `conversation_id` TEXT NOT NULL REFERENCES conversations(id),
  `tag_id` INTEGER NOT NULL REFERENCES tags(id),
  `assigned_by` TEXT NOT NULL REFERENCES agents(id),
  `assigned_at` TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`conversation_id`, `tag_id`)
);
CREATE TABLE `conversation_transfers` (
  `id` INTEGER PRIMARY KEY,
  `conversation_id` TEXT NOT NULL REFERENCES conversations(id),
  `from_team_id` INTEGER REFERENCES teams(id),
  `to_team_id` INTEGER REFERENCES teams(id),
  `from_user_id` TEXT REFERENCES agents(id),
  `to_user_id` TEXT REFERENCES agents(id),
  `transfer_reason` TEXT,
  `transferred_by` TEXT NOT NULL REFERENCES agents(id),
  `transfer_type` TEXT DEFAULT 'manual',
  `created_at` TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE `message_recall_logs` (
  `id` INTEGER PRIMARY KEY,
  `message_id` TEXT NOT NULL,
  `user_id` TEXT NOT NULL REFERENCES agents(id),
  `action` TEXT NOT NULL,
  `created_at` TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE `qr_codes` (
  `id` TEXT PRIMARY KEY,
  `team_id` INTEGER NOT NULL,
  `token` TEXT NOT NULL UNIQUE,
  `line_url` TEXT NOT NULL,
  `qr_code_image_url` TEXT NOT NULL,
  `campaign_name` TEXT,
  `description` TEXT,
  `usage_count` INTEGER DEFAULT 0,
  `max_uses` INTEGER,
  `is_active` INTEGER DEFAULT 1,
  `expires_at` TEXT,
  `created_at` TEXT DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE `qr_code_scans` (
  `id` TEXT PRIMARY KEY,
  `qr_code_id` TEXT NOT NULL,
  `customer_id` INTEGER,
  `platform` TEXT NOT NULL,
  `platform_user_id` TEXT,
  `scan_metadata` TEXT,
  `scanned_at` TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE `qr_code_analytics` (
  `id` INTEGER PRIMARY KEY,
  `qr_code_id` TEXT NOT NULL REFERENCES qr_codes(id),
  `date` TEXT NOT NULL,
  `total_scans` INTEGER DEFAULT 0,
  `unique_scans` INTEGER DEFAULT 0,
  `new_customers` INTEGER DEFAULT 0,
  `returning_customers` INTEGER DEFAULT 0,
  `created_at` TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(`qr_code_id`, `date`)
);
CREATE TABLE IF NOT EXISTS "conversations" (
    id TEXT PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    assigned_team_id INTEGER,
    assigned_user_id TEXT,  
    status TEXT NOT NULL DEFAULT 'active',
    last_message_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    CHECK (status IN ('active', 'pending', 'closed'))
);
CREATE TABLE IF NOT EXISTS "messages" (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'agent', 'system')),
    customer_sender_id INTEGER,
    agent_sender_id TEXT,
    content TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text',
    platform_message_id TEXT, 
    is_recalled INTEGER DEFAULT 0,
    recall_deadline TEXT,
    recalled_at TEXT,
    is_sent INTEGER DEFAULT 1,
    sent_at TEXT,
    delivery_status TEXT DEFAULT 'delivered',
    reply_to_message_id TEXT,
    thread_id TEXT,
    session_id TEXT,
    session_sequence INTEGER DEFAULT 1,
    metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (customer_sender_id) REFERENCES customers(id),
    FOREIGN KEY (agent_sender_id) REFERENCES agents(id),
    
    CHECK (
        (sender_type = 'customer' AND customer_sender_id IS NOT NULL AND agent_sender_id IS NULL) OR
        (sender_type = 'agent' AND agent_sender_id IS NOT NULL AND customer_sender_id IS NULL) OR
        (sender_type = 'system' AND customer_sender_id IS NULL AND agent_sender_id IS NULL)
    ),
    
    UNIQUE(platform_message_id)
);
CREATE TABLE conversation_sessions (
  id TEXT PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id),
  session_type TEXT NOT NULL DEFAULT 'continuous' CHECK (session_type IN ('continuous', 'topical', 'manual')),
  topic TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT,
  last_activity TEXT NOT NULL,
  message_count INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT TRUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    timestamp INTEGER NOT NULL,
    tags TEXT, 
    unit TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" VALUES('d1_migrations',10);
CREATE UNIQUE INDEX `agents_email_unique` ON `agents` (`email`);
CREATE INDEX idx_delayed_messages_scheduled_at ON delayed_messages(scheduled_at);
CREATE INDEX idx_delayed_messages_status ON delayed_messages(status);
CREATE INDEX idx_delayed_messages_agent ON delayed_messages(agent_id);
CREATE INDEX idx_delayed_messages_conversation ON delayed_messages(conversation_id);
CREATE INDEX idx_activities_user ON activities(user_id);
CREATE INDEX idx_activities_created_at ON activities(created_at);
CREATE INDEX idx_activities_action ON activities(action);
CREATE INDEX idx_activities_resource ON activities(resource_type, resource_id);
CREATE INDEX idx_file_attachments_message ON file_attachments(message_id);
CREATE INDEX idx_file_attachments_type ON file_attachments(file_type);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at);
CREATE INDEX idx_conversation_sessions_conversation_id ON conversation_sessions(conversation_id);
CREATE INDEX idx_conversation_sessions_is_active ON conversation_sessions(is_active);
CREATE INDEX idx_conversation_sessions_last_activity ON conversation_sessions(last_activity);
CREATE INDEX idx_metrics_name_timestamp ON metrics(metric_name, timestamp);
CREATE INDEX idx_metrics_timestamp ON metrics(timestamp);
CREATE INDEX idx_metrics_name ON metrics(metric_name);