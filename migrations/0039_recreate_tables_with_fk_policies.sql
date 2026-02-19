-- ===============================================
-- Migration 0039: Recreate All Tables with Correct FK Policies
-- ===============================================
-- Date: 2026-02-19
-- Purpose: Drop and recreate every table so that ON DELETE CASCADE / SET NULL
--          policies declared in src/db/schema.ts are physically enforced by SQLite.
--          Also cleans up legacy columns (channel_integrations platform-specific cols)
--          and legacy tables (invitations, users - already dropped but ensuring clean state).
--
-- WHY: SQLite cannot ALTER existing FK constraints. The only way to change
--       ON DELETE RESTRICT → CASCADE/SET NULL is to recreate the table.
--       All current data is test data, so a clean DROP + CREATE is safe.
--
-- APPROACH:
--   1. PRAGMA foreign_keys = OFF
--   2. DROP all views (3 report views)
--   3. DROP all tables (children → parents order)
--   4. CREATE all tables (parents → children order) with correct FK policies
--   5. CREATE all indexes (~100 indexes)
--   6. Recreate views
--   7. Insert default report template data
--   8. PRAGMA foreign_keys = ON
-- ===============================================

-- ================================================================
-- STEP 1: Disable FK enforcement for mass table recreation
-- ================================================================
PRAGMA foreign_keys = OFF;

-- ================================================================
-- STEP 2: Drop all views
-- ================================================================
DROP VIEW IF EXISTS v_recent_reports;
DROP VIEW IF EXISTS v_report_generation_stats;
DROP VIEW IF EXISTS v_active_scheduled_reports;

-- ================================================================
-- STEP 3: Drop all tables (children first → parents last)
-- ================================================================

-- Level 4 (deepest children)
DROP TABLE IF EXISTS message_recall_logs;
DROP TABLE IF EXISTS file_attachments;

-- Level 3
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversation_sessions;
DROP TABLE IF EXISTS conversation_transfers;
DROP TABLE IF EXISTS delayed_messages;
DROP TABLE IF EXISTS customer_tags;
DROP TABLE IF EXISTS conversation_tags;
DROP TABLE IF EXISTS customer_team_assignments;
DROP TABLE IF EXISTS customer_feedback;
DROP TABLE IF EXISTS task_reminders;
DROP TABLE IF EXISTS report_download_history;
DROP TABLE IF EXISTS scheduled_report_executions;

-- Level 2
DROP TABLE IF EXISTS agent_teams;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS activities;
DROP TABLE IF EXISTS qr_code_scans;
DROP TABLE IF EXISTS qr_code_analytics;
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS scheduled_reports;
DROP TABLE IF EXISTS report_templates;
DROP TABLE IF EXISTS team_liff_qr_codes;
DROP TABLE IF EXISTS webhook_security_events;

-- Level 1
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS qr_codes;
DROP TABLE IF EXISTS channel_integrations;

-- Level 0 (roots)
DROP TABLE IF EXISTS agents;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS system_settings;
DROP TABLE IF EXISTS metrics;
DROP TABLE IF EXISTS cors_events;

-- Legacy tables (not in schema.ts, already dropped but ensuring clean state)
DROP TABLE IF EXISTS invitations;
DROP TABLE IF EXISTS users;

-- ================================================================
-- STEP 4: Create all tables (parents first → children last)
-- ================================================================

-- ----------------------------------------------------------------
-- Level 0: Root tables (no FK dependencies)
-- ----------------------------------------------------------------

-- teams
CREATE TABLE `teams` (
  `id` integer PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `qr_code` text,
  `is_active` integer DEFAULT 1,
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` text
);

-- agents
CREATE TABLE `agents` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `password_hash` text NOT NULL,
  `display_name` text NOT NULL,
  `role` text NOT NULL DEFAULT 'agent',
  `is_active` integer DEFAULT 1,
  `password_policy` text DEFAULT 'changeable',
  `last_active` text,
  `last_login_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` text
);

-- system_settings
CREATE TABLE `system_settings` (
  `key` text PRIMARY KEY NOT NULL,
  `value` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP
);

-- metrics
CREATE TABLE `metrics` (
  `id` integer PRIMARY KEY NOT NULL,
  `metric_name` text NOT NULL,
  `metric_value` real NOT NULL,
  `timestamp` integer NOT NULL,
  `tags` text,
  `unit` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP
);

-- cors_events
CREATE TABLE `cors_events` (
  `id` text PRIMARY KEY NOT NULL,
  `type` text NOT NULL CHECK (`type` IN ('allowed', 'rejected', 'preflight', 'sse_connection', 'credentials_used')),
  `origin` text NOT NULL,
  `method` text,
  `path` text,
  `user_agent` text,
  `ip_address` text,
  `timestamp` text NOT NULL DEFAULT (datetime('now')),
  `metadata` text
);

-- ----------------------------------------------------------------
-- Level 1: Depends on Level 0
-- ----------------------------------------------------------------

-- customers (FK → teams)
CREATE TABLE `customers` (
  `id` integer PRIMARY KEY NOT NULL,
  `platform` text NOT NULL,
  `platform_user_id` text NOT NULL,
  `display_name` text,
  `avatar_url` text,
  `email` text,
  `phone` text,
  `source_team_id` integer REFERENCES `teams`(`id`) ON DELETE SET NULL,
  `metadata` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` text,
  UNIQUE(`platform`, `platform_user_id`)
);

-- qr_codes (FK → teams)
CREATE TABLE `qr_codes` (
  `id` text PRIMARY KEY NOT NULL,
  `team_id` integer NOT NULL REFERENCES `teams`(`id`) ON DELETE CASCADE,
  `token` text NOT NULL,
  `line_url` text NOT NULL,
  `qr_code_image_url` text NOT NULL,
  `campaign_name` text,
  `description` text,
  `usage_count` integer DEFAULT 0,
  `max_uses` integer,
  `is_active` integer DEFAULT 1,
  `expires_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP
);

-- channel_integrations (FK → teams, agents)
-- NOTE: Legacy platform-specific columns (line_*, facebook_*, whatsapp_*, etc.) are NOT recreated.
--       All platform config now uses JSON columns: config, credentials, webhook_config, stats
CREATE TABLE `channel_integrations` (
  `id` integer PRIMARY KEY NOT NULL,
  `team_id` integer NOT NULL REFERENCES `teams`(`id`) ON DELETE CASCADE,
  `platform` text NOT NULL,
  `config` text,
  `credentials` text,
  `webhook_config` text,
  `stats` text,
  `is_active` integer DEFAULT 1,
  `is_verified` integer DEFAULT 0,
  `last_verified_at` text,
  `configured_by` text REFERENCES `agents`(`id`) ON DELETE SET NULL,
  `config_metadata` text,
  `last_error` text,
  `error_count` integer DEFAULT 0,
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------
-- Level 2: Depends on Level 0-1
-- ----------------------------------------------------------------

-- agent_teams (FK → agents CASCADE, teams CASCADE)
CREATE TABLE `agent_teams` (
  `id` integer PRIMARY KEY NOT NULL,
  `agent_id` text NOT NULL REFERENCES `agents`(`id`) ON DELETE CASCADE,
  `team_id` integer NOT NULL REFERENCES `teams`(`id`) ON DELETE CASCADE,
  `role_in_team` text DEFAULT 'member',
  `is_primary` integer DEFAULT 0,
  `joined_at` text DEFAULT CURRENT_TIMESTAMP,
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(`agent_id`, `team_id`)
);

-- conversations (FK → customers RESTRICT, teams SET NULL)
CREATE TABLE `conversations` (
  `id` text PRIMARY KEY NOT NULL,
  `customer_id` integer NOT NULL REFERENCES `customers`(`id`),
  `assigned_team_id` integer REFERENCES `teams`(`id`) ON DELETE SET NULL,
  `status` text NOT NULL DEFAULT 'active',
  `priority` text DEFAULT 'normal',
  `first_response_at` text,
  `closed_at` text,
  `internal_notes` text,
  `last_message_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` text
);

-- tags (FK → teams SET NULL, agents RESTRICT)
CREATE TABLE `tags` (
  `id` integer PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `color` text NOT NULL DEFAULT '#3B82F6',
  `description` text,
  `team_id` integer REFERENCES `teams`(`id`) ON DELETE SET NULL,
  `is_active` integer DEFAULT 1,
  `created_by` text NOT NULL REFERENCES `agents`(`id`),
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` text,
  UNIQUE(`name`, `team_id`)
);

-- notifications (FK → agents CASCADE)
CREATE TABLE `notifications` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `agents`(`id`) ON DELETE CASCADE,
  `type` text NOT NULL,
  `title` text NOT NULL,
  `content` text NOT NULL,
  `data` text,
  `is_read` integer DEFAULT 0,
  `read_at` text,
  `expires_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP
);

-- activities (FK → agents RESTRICT)
CREATE TABLE `activities` (
  `id` integer PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `agents`(`id`),
  `user_name` text NOT NULL,
  `user_role` text NOT NULL,
  `action` text NOT NULL,
  `resource_type` text NOT NULL,
  `resource_id` text,
  `details` text,
  `ip_address` text,
  `user_agent` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP
);

-- qr_code_scans (FK → qr_codes CASCADE, customers SET NULL)
CREATE TABLE `qr_code_scans` (
  `id` text PRIMARY KEY NOT NULL,
  `qr_code_id` text NOT NULL REFERENCES `qr_codes`(`id`) ON DELETE CASCADE,
  `customer_id` integer REFERENCES `customers`(`id`) ON DELETE SET NULL,
  `platform` text NOT NULL,
  `platform_user_id` text,
  `scan_metadata` text,
  `scanned_at` text DEFAULT CURRENT_TIMESTAMP
);

-- qr_code_analytics (FK → qr_codes CASCADE)
CREATE TABLE `qr_code_analytics` (
  `id` integer PRIMARY KEY NOT NULL,
  `qr_code_id` text NOT NULL REFERENCES `qr_codes`(`id`) ON DELETE CASCADE,
  `date` text NOT NULL,
  `total_scans` integer DEFAULT 0,
  `unique_scans` integer DEFAULT 0,
  `new_customers` integer DEFAULT 0,
  `returning_customers` integer DEFAULT 0,
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(`qr_code_id`, `date`)
);

-- reports (FK → agents RESTRICT, teams SET NULL)
CREATE TABLE `reports` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL,
  `description` text,
  `type` text NOT NULL,
  `format` text NOT NULL,
  `status` text NOT NULL DEFAULT 'pending',
  `created_by` text NOT NULL REFERENCES `agents`(`id`),
  `team_id` integer REFERENCES `teams`(`id`) ON DELETE SET NULL,
  `time_range` text,
  `start_date` text,
  `end_date` text,
  `filters` text,
  `options` text,
  `generation_started_at` text,
  `completed_at` text,
  `failed_at` text,
  `error_message` text,
  `execution_time` integer,
  `download_url` text,
  `file_size` integer,
  `file_hash` text,
  `downloaded_count` integer DEFAULT 0,
  `last_downloaded_at` text,
  `expires_at` text,
  `deleted_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP
);

-- scheduled_reports (FK → agents RESTRICT, teams SET NULL)
CREATE TABLE `scheduled_reports` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `report_type` text NOT NULL,
  `report_format` text NOT NULL DEFAULT 'excel',
  `report_params` text NOT NULL,
  `schedule_type` text NOT NULL,
  `schedule_config` text NOT NULL,
  `timezone` text DEFAULT 'UTC',
  `is_active` integer DEFAULT 1,
  `max_retries` integer DEFAULT 3,
  `retry_delay_minutes` integer DEFAULT 30,
  `created_by` text NOT NULL REFERENCES `agents`(`id`),
  `team_id` integer REFERENCES `teams`(`id`) ON DELETE SET NULL,
  `notify_on_completion` integer DEFAULT 1,
  `notify_on_failure` integer DEFAULT 1,
  `notification_emails` text,
  `next_execution_at` text,
  `last_execution_at` text,
  `last_execution_status` text,
  `execution_count` integer DEFAULT 0,
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` text
);

-- report_templates (FK → agents RESTRICT, teams SET NULL)
CREATE TABLE `report_templates` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `report_type` text NOT NULL,
  `template_config` text NOT NULL,
  `preview_image_url` text,
  `category` text,
  `tags` text,
  `is_system_template` integer DEFAULT 0,
  `is_public` integer DEFAULT 0,
  `created_by` text NOT NULL REFERENCES `agents`(`id`),
  `team_id` integer REFERENCES `teams`(`id`) ON DELETE SET NULL,
  `usage_count` integer DEFAULT 0,
  `last_used_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` text
);

-- team_liff_qr_codes (FK → teams CASCADE)
CREATE TABLE `team_liff_qr_codes` (
  `id` text PRIMARY KEY NOT NULL,
  `team_id` integer NOT NULL UNIQUE REFERENCES `teams`(`id`) ON DELETE CASCADE,
  `liff_url` text NOT NULL,
  `qr_code_url` text NOT NULL,
  `scan_count` integer DEFAULT 0,
  `is_active` integer DEFAULT 1,
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP
);

-- webhook_security_events (FK → channel_integrations CASCADE)
CREATE TABLE `webhook_security_events` (
  `id` text PRIMARY KEY NOT NULL,
  `type` text NOT NULL,
  `severity` text NOT NULL CHECK (`severity` IN ('low', 'medium', 'high', 'critical')),
  `platform` text NOT NULL,
  `integration_id` integer REFERENCES `channel_integrations`(`id`) ON DELETE CASCADE,
  `source_ip` text,
  `details` text,
  `created_at` text NOT NULL DEFAULT (datetime('now'))
);

-- ----------------------------------------------------------------
-- Level 3: Depends on Level 2
-- ----------------------------------------------------------------

-- messages (FK → conversations CASCADE, customers SET NULL, agents SET NULL)
CREATE TABLE `messages` (
  `id` text PRIMARY KEY NOT NULL,
  `conversation_id` text NOT NULL REFERENCES `conversations`(`id`) ON DELETE CASCADE,
  `sender_type` text NOT NULL,
  `customer_sender_id` integer REFERENCES `customers`(`id`) ON DELETE SET NULL,
  `agent_sender_id` text REFERENCES `agents`(`id`) ON DELETE SET NULL,
  `content` text NOT NULL,
  `message_type` text NOT NULL DEFAULT 'text',
  `platform_message_id` text,
  `is_recalled` integer DEFAULT 0,
  `recall_deadline` text,
  `recalled_at` text,
  `is_sent` integer DEFAULT 1,
  `sent_at` text,
  `delivery_status` text DEFAULT 'delivered',
  `reply_to_message_id` text,
  `thread_id` text,
  `session_id` text,
  `session_sequence` integer DEFAULT 1,
  `metadata` text,
  `sender_name` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text,
  `deleted_at` text
);

-- conversation_sessions (FK → conversations CASCADE)
CREATE TABLE `conversation_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `conversation_id` text NOT NULL REFERENCES `conversations`(`id`) ON DELETE CASCADE,
  `session_type` text NOT NULL DEFAULT 'continuous',
  `topic` text,
  `start_time` text NOT NULL,
  `end_time` text,
  `last_activity` text NOT NULL,
  `message_count` integer DEFAULT 0,
  `is_active` integer DEFAULT 1,
  `created_at` text DEFAULT CURRENT_TIMESTAMP
);

-- conversation_transfers (FK → conversations CASCADE, teams SET NULL, agents RESTRICT)
CREATE TABLE `conversation_transfers` (
  `id` integer PRIMARY KEY NOT NULL,
  `conversation_id` text NOT NULL REFERENCES `conversations`(`id`) ON DELETE CASCADE,
  `from_team_id` integer REFERENCES `teams`(`id`) ON DELETE SET NULL,
  `to_team_id` integer REFERENCES `teams`(`id`) ON DELETE SET NULL,
  `transfer_reason` text,
  `transferred_by` text NOT NULL REFERENCES `agents`(`id`),
  `transfer_type` text DEFAULT 'manual',
  `created_at` text DEFAULT CURRENT_TIMESTAMP
);

-- delayed_messages (FK → conversations CASCADE, agents CASCADE)
CREATE TABLE `delayed_messages` (
  `id` text PRIMARY KEY NOT NULL,
  `conversation_id` text NOT NULL REFERENCES `conversations`(`id`) ON DELETE CASCADE,
  `agent_id` text NOT NULL REFERENCES `agents`(`id`) ON DELETE CASCADE,
  `content` text NOT NULL,
  `message_type` text NOT NULL DEFAULT 'text',
  `scheduled_at` text NOT NULL,
  `sent_at` text,
  `cancelled_at` text,
  `status` text NOT NULL DEFAULT 'pending',
  `metadata` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP
);

-- customer_tags (FK → customers CASCADE, tags CASCADE, agents RESTRICT)
CREATE TABLE `customer_tags` (
  `customer_id` integer NOT NULL REFERENCES `customers`(`id`) ON DELETE CASCADE,
  `tag_id` integer NOT NULL REFERENCES `tags`(`id`) ON DELETE CASCADE,
  `assigned_by` text NOT NULL REFERENCES `agents`(`id`),
  `assigned_at` text DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`customer_id`, `tag_id`)
);

-- conversation_tags (FK → conversations CASCADE, tags CASCADE, agents RESTRICT)
CREATE TABLE `conversation_tags` (
  `conversation_id` text NOT NULL REFERENCES `conversations`(`id`) ON DELETE CASCADE,
  `tag_id` integer NOT NULL REFERENCES `tags`(`id`) ON DELETE CASCADE,
  `assigned_by` text NOT NULL REFERENCES `agents`(`id`),
  `assigned_at` text DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`conversation_id`, `tag_id`)
);

-- customer_team_assignments (FK → teams CASCADE, team_liff_qr_codes SET NULL)
CREATE TABLE `customer_team_assignments` (
  `id` text PRIMARY KEY NOT NULL,
  `platform_user_id` text NOT NULL,
  `team_id` integer NOT NULL REFERENCES `teams`(`id`) ON DELETE CASCADE,
  `qr_code_id` text REFERENCES `team_liff_qr_codes`(`id`) ON DELETE SET NULL,
  `source` text DEFAULT 'liff_qr',
  `display_name` text,
  `assigned_at` text DEFAULT CURRENT_TIMESTAMP,
  `metadata` text,
  UNIQUE(`platform_user_id`, `team_id`)
);

-- customer_feedback (FK → conversations CASCADE, customers CASCADE, agents SET NULL)
CREATE TABLE `customer_feedback` (
  `id` text PRIMARY KEY NOT NULL,
  `conversation_id` text NOT NULL REFERENCES `conversations`(`id`) ON DELETE CASCADE,
  `customer_id` integer NOT NULL REFERENCES `customers`(`id`) ON DELETE CASCADE,
  `agent_id` text REFERENCES `agents`(`id`) ON DELETE SET NULL,
  `rating` integer NOT NULL CHECK(`rating` >= 1 AND `rating` <= 5),
  `comment` text,
  `feedback_type` text DEFAULT 'satisfaction',
  `metadata` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP
);

-- task_reminders (FK → agents CASCADE, conversations SET NULL)
CREATE TABLE `task_reminders` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `agents`(`id`) ON DELETE CASCADE,
  `title` text NOT NULL,
  `content` text,
  `remind_at` text NOT NULL,
  `conversation_id` text REFERENCES `conversations`(`id`) ON DELETE SET NULL,
  `repeat_type` text DEFAULT 'none',
  `repeat_interval` integer DEFAULT 0,
  `is_completed` integer DEFAULT 0,
  `is_sent` integer DEFAULT 0,
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  `completed_at` text,
  `sent_at` text
);

-- scheduled_report_executions (FK → scheduled_reports CASCADE, reports SET NULL)
CREATE TABLE `scheduled_report_executions` (
  `id` text PRIMARY KEY NOT NULL,
  `scheduled_report_id` text NOT NULL REFERENCES `scheduled_reports`(`id`) ON DELETE CASCADE,
  `execution_started_at` text NOT NULL,
  `execution_completed_at` text,
  `execution_status` text NOT NULL,
  `execution_duration` integer,
  `generated_report_id` text REFERENCES `reports`(`id`) ON DELETE SET NULL,
  `error_message` text,
  `retry_count` integer DEFAULT 0,
  `created_at` text DEFAULT CURRENT_TIMESTAMP
);

-- report_download_history (FK → reports CASCADE, agents RESTRICT)
CREATE TABLE `report_download_history` (
  `id` text PRIMARY KEY NOT NULL,
  `report_id` text NOT NULL REFERENCES `reports`(`id`) ON DELETE CASCADE,
  `downloaded_by` text NOT NULL REFERENCES `agents`(`id`),
  `downloaded_at` text DEFAULT CURRENT_TIMESTAMP,
  `ip_address` text,
  `user_agent` text,
  `download_method` text,
  `download_size` integer,
  `created_at` text DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------
-- Level 4: Deepest children
-- ----------------------------------------------------------------

-- message_recall_logs (FK → messages CASCADE, agents RESTRICT)
CREATE TABLE `message_recall_logs` (
  `id` integer PRIMARY KEY NOT NULL,
  `message_id` text NOT NULL REFERENCES `messages`(`id`) ON DELETE CASCADE,
  `user_id` text NOT NULL REFERENCES `agents`(`id`),
  `action` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP
);

-- file_attachments (FK → messages SET NULL, conversations SET NULL)
CREATE TABLE `file_attachments` (
  `id` text PRIMARY KEY NOT NULL,
  `message_id` text REFERENCES `messages`(`id`) ON DELETE SET NULL,
  `conversation_id` text REFERENCES `conversations`(`id`) ON DELETE SET NULL,
  `filename` text NOT NULL,
  `mime_type` text NOT NULL,
  `file_size` integer NOT NULL,
  `file_url` text,
  `r2_key` text NOT NULL,
  `url` text,
  `upload_status` text DEFAULT 'completed',
  `uploaded_by` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text
);

-- ================================================================
-- STEP 5: Create all indexes
-- ================================================================

-- ---- agents indexes ----
CREATE UNIQUE INDEX `agents_email_unique` ON `agents` (`email`);
CREATE INDEX `idx_agents_role` ON `agents` (`role`);
CREATE INDEX `idx_agents_role_active` ON `agents` (`role`, `is_active`);
CREATE INDEX `idx_agents_deleted_at` ON `agents` (`deleted_at`) WHERE `deleted_at` IS NOT NULL;

-- ---- teams indexes ----
CREATE INDEX `idx_teams_deleted_at` ON `teams` (`deleted_at`) WHERE `deleted_at` IS NOT NULL;

-- ---- customers indexes ----
CREATE INDEX `idx_customers_platform` ON `customers` (`platform`);
CREATE INDEX `idx_customers_platform_id` ON `customers` (`platform`, `id`);
CREATE INDEX `idx_customers_id` ON `customers` (`id`);
CREATE INDEX `idx_customers_deleted_at` ON `customers` (`deleted_at`) WHERE `deleted_at` IS NOT NULL;

-- ---- qr_codes indexes ----
CREATE UNIQUE INDEX `qr_codes_token_unique` ON `qr_codes` (`token`);

-- ---- conversations indexes ----
CREATE INDEX `idx_conversations_customer` ON `conversations` (`customer_id`);
CREATE INDEX `idx_conversations_status` ON `conversations` (`status`);
CREATE INDEX `idx_conversations_last_message` ON `conversations` (`last_message_at`);
CREATE INDEX `idx_conversations_customer_status` ON `conversations` (`customer_id`, `status`);
CREATE INDEX `idx_conversations_deleted_at` ON `conversations` (`deleted_at`) WHERE `deleted_at` IS NOT NULL;

-- ---- messages indexes ----
CREATE INDEX `idx_messages_conversation` ON `messages` (`conversation_id`);
CREATE INDEX `idx_messages_created_at` ON `messages` (`created_at`);
CREATE INDEX `idx_messages_customer_sender` ON `messages` (`customer_sender_id`);
CREATE INDEX `idx_messages_agent_sender` ON `messages` (`agent_sender_id`);
CREATE INDEX `idx_messages_sender_type` ON `messages` (`sender_type`);
CREATE INDEX `idx_messages_platform_id` ON `messages` (`platform_message_id`);
CREATE INDEX `idx_messages_agent_sender_created` ON `messages` (`agent_sender_id`, `created_at` DESC) WHERE `agent_sender_id` IS NOT NULL;
CREATE INDEX `idx_messages_customer_sender_created` ON `messages` (`customer_sender_id`, `created_at` DESC) WHERE `customer_sender_id` IS NOT NULL;
CREATE INDEX `idx_messages_thread_id_sequence` ON `messages` (`thread_id`, `session_sequence`) WHERE `thread_id` IS NOT NULL;
CREATE INDEX `idx_messages_reply_to` ON `messages` (`reply_to_message_id`) WHERE `reply_to_message_id` IS NOT NULL;
CREATE INDEX `idx_messages_deleted_at` ON `messages` (`deleted_at`) WHERE `deleted_at` IS NOT NULL;
CREATE INDEX `idx_messages_updated_at` ON `messages` (`updated_at` DESC) WHERE `updated_at` IS NOT NULL;

-- ---- delayed_messages indexes ----
CREATE INDEX `idx_delayed_messages_scheduled_at` ON `delayed_messages` (`scheduled_at`);
CREATE INDEX `idx_delayed_messages_status` ON `delayed_messages` (`status`);
CREATE INDEX `idx_delayed_messages_agent` ON `delayed_messages` (`agent_id`);
CREATE INDEX `idx_delayed_messages_conversation` ON `delayed_messages` (`conversation_id`);
CREATE INDEX `idx_delayed_messages_status_scheduled` ON `delayed_messages` (`status`, `scheduled_at`) WHERE `status` = 'pending';

-- ---- file_attachments indexes ----
CREATE INDEX `idx_file_attachments_message` ON `file_attachments` (`message_id`);
CREATE INDEX `idx_file_attachments_conversation_id` ON `file_attachments` (`conversation_id`);
CREATE INDEX `idx_file_attachments_uploaded_by` ON `file_attachments` (`uploaded_by`);
CREATE INDEX `idx_file_attachments_created_at` ON `file_attachments` (`created_at`);
CREATE INDEX `idx_file_attachments_upload_status` ON `file_attachments` (`upload_status`);

-- ---- conversation_sessions indexes ----
CREATE INDEX `idx_conversation_sessions_conversation_id` ON `conversation_sessions` (`conversation_id`);
CREATE INDEX `idx_conversation_sessions_is_active` ON `conversation_sessions` (`is_active`);
CREATE INDEX `idx_conversation_sessions_last_activity` ON `conversation_sessions` (`last_activity`);

-- ---- activities indexes ----
CREATE INDEX `idx_activities_user` ON `activities` (`user_id`);
CREATE INDEX `idx_activities_created_at` ON `activities` (`created_at`);
CREATE INDEX `idx_activities_action` ON `activities` (`action`);

-- ---- metrics indexes ----
CREATE INDEX `idx_metrics_name_timestamp` ON `metrics` (`metric_name`, `timestamp`);
CREATE INDEX `idx_metrics_timestamp` ON `metrics` (`timestamp`);
CREATE INDEX `idx_metrics_name` ON `metrics` (`metric_name`);

-- ---- reports indexes ----
CREATE INDEX `idx_reports_created_by` ON `reports` (`created_by`);
CREATE INDEX `idx_reports_team_id` ON `reports` (`team_id`);
CREATE INDEX `idx_reports_type` ON `reports` (`type`);
CREATE INDEX `idx_reports_status` ON `reports` (`status`);
CREATE INDEX `idx_reports_created_at` ON `reports` (`created_at` DESC);
CREATE INDEX `idx_reports_expires_at` ON `reports` (`expires_at`);

-- ---- scheduled_reports indexes ----
CREATE INDEX `idx_scheduled_reports_created_by` ON `scheduled_reports` (`created_by`);
CREATE INDEX `idx_scheduled_reports_team_id` ON `scheduled_reports` (`team_id`);
CREATE INDEX `idx_scheduled_reports_is_active` ON `scheduled_reports` (`is_active`);
CREATE INDEX `idx_scheduled_reports_next_execution` ON `scheduled_reports` (`next_execution_at`);

-- ---- scheduled_report_executions indexes ----
CREATE INDEX `idx_sched_exec_scheduled_report` ON `scheduled_report_executions` (`scheduled_report_id`);
CREATE INDEX `idx_sched_exec_status` ON `scheduled_report_executions` (`execution_status`);
CREATE INDEX `idx_sched_exec_started_at` ON `scheduled_report_executions` (`execution_started_at` DESC);

-- ---- report_download_history indexes ----
CREATE INDEX `idx_download_history_report` ON `report_download_history` (`report_id`);
CREATE INDEX `idx_download_history_user` ON `report_download_history` (`downloaded_by`);
CREATE INDEX `idx_download_history_downloaded_at` ON `report_download_history` (`downloaded_at` DESC);

-- ---- report_templates indexes ----
CREATE INDEX `idx_templates_report_type` ON `report_templates` (`report_type`);
CREATE INDEX `idx_templates_category` ON `report_templates` (`category`);
CREATE INDEX `idx_templates_is_public` ON `report_templates` (`is_public`);
CREATE INDEX `idx_templates_created_by` ON `report_templates` (`created_by`);

-- ---- tags indexes ----
CREATE INDEX `idx_tags_team_active` ON `tags` (`team_id`, `is_active`) WHERE `is_active` = 1;

-- ---- customer_tags indexes ----
CREATE INDEX `idx_customer_tags_tag_id` ON `customer_tags` (`tag_id`);
CREATE INDEX `idx_customer_tags_tag_assigned` ON `customer_tags` (`tag_id`, `assigned_at` DESC);
CREATE INDEX `idx_customer_tags_customer_id` ON `customer_tags` (`customer_id`);
CREATE INDEX `idx_customer_tags_assigned_by` ON `customer_tags` (`assigned_by`);

-- ---- notifications indexes ----
CREATE INDEX `idx_notifications_user_unread` ON `notifications` (`user_id`, `is_read`) WHERE `is_read` = 0;

-- ---- webhook_security_events indexes ----
CREATE INDEX `idx_webhook_security_events_platform` ON `webhook_security_events` (`platform`);
CREATE INDEX `idx_webhook_security_events_created_at` ON `webhook_security_events` (`created_at`);
CREATE INDEX `idx_webhook_security_events_severity` ON `webhook_security_events` (`severity`);
CREATE INDEX `idx_webhook_security_events_type` ON `webhook_security_events` (`type`);
CREATE INDEX `idx_webhook_security_events_integration` ON `webhook_security_events` (`integration_id`);
CREATE INDEX `idx_webhook_security_events_platform_severity` ON `webhook_security_events` (`platform`, `severity`, `created_at` DESC);

-- ---- cors_events indexes ----
CREATE INDEX `idx_cors_events_type` ON `cors_events` (`type`);
CREATE INDEX `idx_cors_events_origin` ON `cors_events` (`origin`);
CREATE INDEX `idx_cors_events_timestamp` ON `cors_events` (`timestamp` DESC);
CREATE INDEX `idx_cors_events_rejected_origin` ON `cors_events` (`type`, `origin`, `timestamp` DESC) WHERE `type` = 'rejected';
CREATE INDEX `idx_cors_events_allowed_origin` ON `cors_events` (`type`, `origin`, `timestamp` DESC) WHERE `type` = 'allowed';

-- ---- channel_integrations indexes ----
CREATE INDEX `idx_channel_integrations_team_platform_active` ON `channel_integrations` (`team_id`, `platform`, `is_active`);

-- ---- agent_teams indexes ----
CREATE INDEX `idx_agent_teams_agent_id` ON `agent_teams` (`agent_id`);
CREATE INDEX `idx_agent_teams_team_id` ON `agent_teams` (`team_id`);
CREATE INDEX `idx_agent_teams_is_primary` ON `agent_teams` (`agent_id`, `is_primary`) WHERE `is_primary` = 1;
CREATE INDEX `idx_agent_teams_role` ON `agent_teams` (`team_id`, `role_in_team`);

-- ---- task_reminders indexes ----
CREATE INDEX `idx_task_reminders_user_remind` ON `task_reminders` (`user_id`, `remind_at`) WHERE `is_completed` = 0 AND `is_sent` = 0;
CREATE INDEX `idx_task_reminders_pending` ON `task_reminders` (`remind_at`) WHERE `is_completed` = 0 AND `is_sent` = 0;
CREATE INDEX `idx_task_reminders_conversation_id` ON `task_reminders` (`conversation_id`) WHERE `conversation_id` IS NOT NULL;

-- ---- team_liff_qr_codes indexes ----
CREATE INDEX `idx_team_liff_qr_codes_is_active` ON `team_liff_qr_codes` (`is_active`);

-- ---- customer_team_assignments indexes ----
CREATE INDEX `idx_customer_team_assignments_platform_user` ON `customer_team_assignments` (`platform_user_id`);
CREATE INDEX `idx_customer_team_assignments_team_id` ON `customer_team_assignments` (`team_id`);
CREATE INDEX `idx_customer_team_assignments_qr_code` ON `customer_team_assignments` (`qr_code_id`);
CREATE INDEX `idx_customer_team_assignments_source` ON `customer_team_assignments` (`source`);
CREATE INDEX `idx_customer_team_assignments_team_date` ON `customer_team_assignments` (`team_id`, `assigned_at` DESC);

-- ---- customer_feedback indexes ----
CREATE INDEX `idx_customer_feedback_conversation` ON `customer_feedback` (`conversation_id`);
CREATE INDEX `idx_customer_feedback_customer` ON `customer_feedback` (`customer_id`);
CREATE INDEX `idx_customer_feedback_agent` ON `customer_feedback` (`agent_id`) WHERE `agent_id` IS NOT NULL;
CREATE INDEX `idx_customer_feedback_created_at` ON `customer_feedback` (`created_at`);
CREATE INDEX `idx_customer_feedback_rating` ON `customer_feedback` (`rating`, `created_at`);
CREATE INDEX `idx_customer_feedback_type` ON `customer_feedback` (`feedback_type`, `created_at`);

-- ---- message_recall_logs indexes ----
CREATE INDEX `idx_message_recall_logs_message_id` ON `message_recall_logs` (`message_id`);

-- ================================================================
-- STEP 6: Recreate views
-- ================================================================

-- View: Recent reports summary
CREATE VIEW v_recent_reports AS
SELECT
  r.id,
  r.title,
  r.type,
  r.format,
  r.status,
  r.created_by,
  a.display_name as creator_name,
  r.created_at,
  r.completed_at,
  r.file_size,
  r.downloaded_count
FROM reports r
LEFT JOIN agents a ON r.created_by = a.id
WHERE r.deleted_at IS NULL
ORDER BY r.created_at DESC
LIMIT 100;

-- View: Report generation performance statistics
CREATE VIEW v_report_generation_stats AS
SELECT
  type as report_type,
  format as report_format,
  COUNT(*) as total_count,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
  ROUND(AVG(execution_time), 2) as avg_execution_time,
  ROUND(AVG(file_size) / 1024.0 / 1024.0, 2) as avg_file_size_mb
FROM reports
WHERE deleted_at IS NULL
GROUP BY type, format;

-- View: Active scheduled reports with next execution
CREATE VIEW v_active_scheduled_reports AS
SELECT
  sr.id,
  sr.name,
  sr.report_type,
  sr.schedule_type,
  sr.is_active,
  sr.next_execution_at,
  sr.last_execution_at,
  sr.last_execution_status,
  sr.execution_count,
  sr.created_by,
  a.display_name as creator_name
FROM scheduled_reports sr
LEFT JOIN agents a ON sr.created_by = a.id
WHERE sr.deleted_at IS NULL AND sr.is_active = 1
ORDER BY sr.next_execution_at ASC;

-- ================================================================
-- STEP 7: Insert default report template data
-- ================================================================
INSERT OR IGNORE INTO report_templates (id, name, description, report_type, template_config, category, is_system_template, is_public, created_by)
VALUES
  ('tpl_conv_summary_basic', '基本對話摘要', '顯示對話總數、訊息量和回應時間的基本報告', 'conversation_summary', '{"includeMetrics":["total","active","closed"],"groupBy":"day"}', 'operational', 1, 1, 'system'),
  ('tpl_agent_perf_monthly', '月度客服績效', '展示客服人員的月度工作表現和KPI指標', 'agent_performance', '{"timeRange":"last_30_days","metrics":["conversations","messages","avgResponseTime","satisfaction"]}', 'analytical', 1, 1, 'system'),
  ('tpl_team_analytics', '團隊分析報告', '團隊整體表現和協作效率分析', 'team_analytics', '{"includeCharts":true,"compareTeams":true}', 'analytical', 1, 1, 'system'),
  ('tpl_executive_summary', '高層管理摘要', '為管理層提供關鍵業務指標的簡潔摘要', 'executive_summary', '{"includeKPIs":true,"includeTrends":true}', 'executive', 1, 1, 'system');

-- ================================================================
-- STEP 8: Re-enable FK enforcement
-- ================================================================
PRAGMA foreign_keys = ON;

-- ===============================================
-- Migration metadata
-- ===============================================
-- Version: 0039
-- Date: 2026-02-19
-- Author: Schema FK Policy Enforcement
-- Purpose: Recreate all tables with correct ON DELETE CASCADE/SET NULL policies
--
-- TABLES: 30 tables created (+ 2 legacy tables dropped)
-- INDEXES: 96 indexes created (4 obsolete indexes NOT recreated)
-- VIEWS: 3 views recreated
-- DEFAULT DATA: 4 system report templates
--
-- FK POLICY CHANGES (RESTRICT → CASCADE or SET NULL):
--   qr_codes.team_id                         → CASCADE
--   qr_code_scans.qr_code_id                 → CASCADE
--   qr_code_scans.customer_id                → SET NULL
--   qr_code_analytics.qr_code_id             → CASCADE
--   customers.source_team_id                  → SET NULL
--   conversations.assigned_team_id            → SET NULL
--   messages.conversation_id                  → CASCADE
--   messages.customer_sender_id               → SET NULL
--   messages.agent_sender_id                  → SET NULL
--   delayed_messages.conversation_id          → CASCADE
--   delayed_messages.agent_id                 → CASCADE
--   file_attachments.message_id               → SET NULL
--   file_attachments.conversation_id          → SET NULL
--   conversation_sessions.conversation_id     → CASCADE
--   conversation_transfers.conversation_id    → CASCADE
--   conversation_transfers.from_team_id       → SET NULL
--   conversation_transfers.to_team_id         → SET NULL
--   message_recall_logs.message_id            → CASCADE
--   notifications.user_id                     → CASCADE
--   tags.team_id                              → SET NULL
--   customer_tags.customer_id                 → CASCADE
--   customer_tags.tag_id                      → CASCADE
--   conversation_tags.conversation_id         → CASCADE
--   conversation_tags.tag_id                  → CASCADE
--   channel_integrations.team_id              → CASCADE
--   channel_integrations.configured_by        → SET NULL
--
-- OBSOLETE INDEXES NOT RECREATED:
--   idx_agents_team_id          (agents.team_id column dropped in 0038)
--   idx_agents_team_id_active   (agents.team_id column dropped in 0038)
--   idx_file_attachments_type   (file_type column renamed to mime_type)
--   invitations_token_unique    (invitations table dropped)
--
-- LEGACY CLEANUP:
--   - channel_integrations: 14 deprecated platform-specific columns removed
--     (line_channel_id, line_channel_secret, line_access_token, line_webhook_url,
--      line_webhook_token, facebook_page_id, facebook_app_secret, facebook_access_token,
--      facebook_webhook_token, whatsapp_phone_number, whatsapp_access_token,
--      total_messages_sent, total_messages_received, last_message_at)
--   - invitations table (dropped in 0008, confirmed clean)
--   - users table (dropped in 0006, replaced by customers)
--
-- VERIFICATION:
--   SELECT sql FROM sqlite_master WHERE type='table' ORDER BY name;
--   SELECT name FROM sqlite_master WHERE type='index' ORDER BY name;
--   SELECT name FROM sqlite_master WHERE type='view';
--   PRAGMA foreign_key_list(messages);  -- Verify ON DELETE CASCADE
--   PRAGMA foreign_key_list(notifications);  -- Verify ON DELETE CASCADE
