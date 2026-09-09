-- ===============================================
-- Migration 0056: Restore the remaining rebuild-drift objects
-- ===============================================
-- Date: 2026-08-03
-- Purpose: Re-create the 96 indexes and views declared by 18 migrations that
--          `d1_migrations` records as APPLIED but whose DDL never ran.
--
-- COMPANION TO 0055. READ THAT FILE FIRST.
--
--   0055 restored the 14 indexes belonging to migration 0027. This file
--   restores everything else the same 2026-06-17 rebuild lost. Same root
--   cause: the rebuild INSERTED rows into `d1_migrations` without executing
--   the corresponding DDL, so the runner considers these files applied and
--   `bun run db:migrate` will never replay them. A new, higher-numbered
--   migration is the only way to converge.
--
-- SOURCE OF TRUTH:
--   Every statement below was extracted verbatim from the migration that
--   declares it, not retyped. Where an object is declared more than once
--   across migrations, the LAST declaration wins. The `-- from NNNN_....sql`
--   comment above each statement records its origin so the repair stays
--   auditable.
--
-- SCOPE (96 objects from 18 migrations):
--   93 indexes, 3 views
--   0006, 0008, 0013, 0014, 0015, 0018, 0019, 0021, 0022, 0023, 0026,
--   0030, 0031, 0035, 0040, 0043, 0044, 0048
--
-- EXCLUDED (1 of the 97 objects the audit reports missing):
--
--   idx_file_attachments_type
--     ON file_attachments(file_type)  -- from 0008_final_schema_optimization.sql
--     REASON: the target column does not exist. Production's
--     `file_attachments` has `mime_type`, not `file_type` (verified via
--     PRAGMA table_info: conversation_id, created_at, file_size, file_url,
--     filename, id, message_id, mime_type, r2_key, updated_at, upload_status,
--     uploaded_by). Re-creating it would abort the whole migration. This
--     mirrors the one exclusion 0055 had to make for
--     idx_conversations_assigned_user_status.
--
-- VERIFIED BEFORE COMMITTING:
--   - Production sqlite_master dumped read-only: 43 tables, 54 indexes,
--     0 views. The 3 views below are genuinely absent.
--   - Every index's target table and every indexed column checked against
--     that dump; only objects whose preconditions hold are included.
--   - Partial-index WHERE clauses parsed with string literals stripped first,
--     so `WHERE type = 'rejected'` is not mistaken for a column reference.
--     (Two cors_events indexes were nearly excluded by that bug.)
--   - DRY RUN: the production schema was rebuilt in memory from its own
--     CREATE TABLE statements and this file applied on top --
--     indexes 54 -> 147 (+93), views 0 -> 3, and a second application was a
--     clean no-op.
--
-- NOT VALIDATED AGAINST THE LOCAL D1 MIRROR:
--   The mirror is stale -- it is missing the `tags` table entirely, which is
--   why 0055 fails there too. Run `bun run db:sync:local` before testing
--   locally; the mirror is not evidence of anything in its current state.
--
-- SAFETY:
--   Every statement is CREATE INDEX / VIEW IF NOT EXISTS -- idempotent, safe
--   to re-run, and a no-op on any environment where these migrations genuinely
--   applied. Additive only: no data is read, written or moved, and no existing
--   object is altered or dropped.
--
-- AFTER APPLYING:
--   `bun run check:migrations:remote` should report 1 remaining phantom object
--   (idx_file_attachments_type above), down from 97.
--
-- Rollback SQL:
--   DROP INDEX IF EXISTS idx_delayed_messages_scheduled_at;
--   DROP INDEX IF EXISTS idx_delayed_messages_status;
--   DROP INDEX IF EXISTS idx_delayed_messages_agent;
--   DROP INDEX IF EXISTS idx_delayed_messages_conversation;
--   DROP INDEX IF EXISTS idx_activities_user;
--   DROP INDEX IF EXISTS idx_activities_created_at;
--   DROP INDEX IF EXISTS idx_activities_action;
--   DROP INDEX IF EXISTS idx_activities_resource;
--   DROP INDEX IF EXISTS idx_file_attachments_message;
--   DROP INDEX IF EXISTS idx_conversations_last_message;
--   DROP INDEX IF EXISTS idx_metrics_name_timestamp;
--   DROP INDEX IF EXISTS idx_metrics_timestamp;
--   DROP INDEX IF EXISTS idx_metrics_name;
--   DROP INDEX IF EXISTS idx_conversation_sessions_conversation_id;
--   DROP INDEX IF EXISTS idx_conversation_sessions_is_active;
--   DROP INDEX IF EXISTS idx_conversation_sessions_last_activity;
--   DROP INDEX IF EXISTS idx_reports_team_id;
--   DROP INDEX IF EXISTS idx_reports_type;
--   DROP INDEX IF EXISTS idx_reports_status;
--   DROP INDEX IF EXISTS idx_reports_created_at;
--   DROP INDEX IF EXISTS idx_reports_expires_at;
--   DROP INDEX IF EXISTS idx_scheduled_reports_team_id;
--   DROP INDEX IF EXISTS idx_scheduled_reports_is_active;
--   DROP INDEX IF EXISTS idx_scheduled_reports_next_execution;
--   DROP INDEX IF EXISTS idx_sched_exec_scheduled_report;
--   DROP INDEX IF EXISTS idx_sched_exec_status;
--   DROP INDEX IF EXISTS idx_sched_exec_started_at;
--   DROP INDEX IF EXISTS idx_download_history_report;
--   DROP INDEX IF EXISTS idx_download_history_user;
--   DROP INDEX IF EXISTS idx_download_history_downloaded_at;
--   DROP INDEX IF EXISTS idx_templates_report_type;
--   DROP INDEX IF EXISTS idx_templates_category;
--   DROP INDEX IF EXISTS idx_templates_is_public;
--   DROP INDEX IF EXISTS idx_templates_created_by;
--   DROP VIEW IF EXISTS v_recent_reports;
--   DROP VIEW IF EXISTS v_report_generation_stats;
--   DROP VIEW IF EXISTS v_active_scheduled_reports;
--   DROP INDEX IF EXISTS idx_customer_tags_tag_id;
--   DROP INDEX IF EXISTS idx_customer_tags_tag_assigned;
--   DROP INDEX IF EXISTS idx_customer_tags_customer_id;
--   DROP INDEX IF EXISTS idx_customer_tags_assigned_by;
--   DROP INDEX IF EXISTS idx_customers_platform;
--   DROP INDEX IF EXISTS idx_customers_platform_id;
--   DROP INDEX IF EXISTS idx_customers_id;
--   DROP INDEX IF EXISTS idx_webhook_security_events_platform;
--   DROP INDEX IF EXISTS idx_webhook_security_events_created_at;
--   DROP INDEX IF EXISTS idx_webhook_security_events_severity;
--   DROP INDEX IF EXISTS idx_webhook_security_events_type;
--   DROP INDEX IF EXISTS idx_webhook_security_events_integration;
--   DROP INDEX IF EXISTS idx_webhook_security_events_platform_severity;
--   DROP INDEX IF EXISTS idx_cors_events_type;
--   DROP INDEX IF EXISTS idx_cors_events_origin;
--   DROP INDEX IF EXISTS idx_cors_events_timestamp;
--   DROP INDEX IF EXISTS idx_cors_events_rejected_origin;
--   DROP INDEX IF EXISTS idx_cors_events_allowed_origin;
--   DROP INDEX IF EXISTS idx_file_attachments_conversation_id;
--   DROP INDEX IF EXISTS idx_file_attachments_uploaded_by;
--   DROP INDEX IF EXISTS idx_file_attachments_created_at;
--   DROP INDEX IF EXISTS idx_channel_integrations_team_platform_active;
--   DROP INDEX IF EXISTS idx_team_liff_qr_codes_team_id;
--   DROP INDEX IF EXISTS idx_team_liff_qr_codes_is_active;
--   DROP INDEX IF EXISTS idx_customer_team_assignments_platform_user;
--   DROP INDEX IF EXISTS idx_customer_team_assignments_team_id;
--   DROP INDEX IF EXISTS idx_customer_team_assignments_qr_code;
--   DROP INDEX IF EXISTS idx_customer_team_assignments_source;
--   DROP INDEX IF EXISTS idx_customer_team_assignments_team_date;
--   DROP INDEX IF EXISTS idx_reports_created_by;
--   DROP INDEX IF EXISTS idx_scheduled_reports_created_by;
--   DROP INDEX IF EXISTS idx_agent_teams_agent_id;
--   DROP INDEX IF EXISTS idx_agent_teams_team_id;
--   DROP INDEX IF EXISTS idx_agent_teams_is_primary;
--   DROP INDEX IF EXISTS idx_agent_teams_role;
--   DROP INDEX IF EXISTS idx_task_reminders_user_remind;
--   DROP INDEX IF EXISTS idx_task_reminders_pending;
--   DROP INDEX IF EXISTS idx_task_reminders_conversation;
--   DROP INDEX IF EXISTS idx_customer_feedback_conversation;
--   DROP INDEX IF EXISTS idx_customer_feedback_customer;
--   DROP INDEX IF EXISTS idx_customer_feedback_agent;
--   DROP INDEX IF EXISTS idx_customer_feedback_created_at;
--   DROP INDEX IF EXISTS idx_customer_feedback_rating;
--   DROP INDEX IF EXISTS idx_customer_feedback_type;
--   DROP INDEX IF EXISTS idx_customer_team_assignments_unique;
--   DROP INDEX IF EXISTS idx_task_reminders_conversation_id;
--   DROP INDEX IF EXISTS idx_message_recall_logs_message_id;
--   DROP INDEX IF EXISTS idx_report_templates_created_by;
--   DROP INDEX IF EXISTS idx_report_download_history_downloaded_by;
--   DROP INDEX IF EXISTS idx_messages_updated_at;
--   DROP INDEX IF EXISTS idx_auto_reply_conditions_rule;
--   DROP INDEX IF EXISTS idx_auto_reply_actions_rule;
--   DROP INDEX IF EXISTS idx_auto_reply_schedules_team;
--   DROP INDEX IF EXISTS idx_auto_reply_logs_rule;
--   DROP INDEX IF EXISTS idx_auto_reply_logs_created;
--   DROP INDEX IF EXISTS idx_auto_reply_rules_team_active;
--   DROP INDEX IF EXISTS idx_auto_reply_rules_global_active;
--   DROP INDEX IF EXISTS idx_auto_reply_deliveries_status;
--   DROP INDEX IF EXISTS idx_auto_reply_deliveries_conversation;
-- ===============================================

-- from 0006_sync_local_to_remote.sql
CREATE INDEX IF NOT EXISTS idx_delayed_messages_scheduled_at ON delayed_messages(scheduled_at);
-- from 0006_sync_local_to_remote.sql
CREATE INDEX IF NOT EXISTS idx_delayed_messages_status ON delayed_messages(status);
-- from 0008_final_schema_optimization.sql
CREATE INDEX IF NOT EXISTS idx_delayed_messages_agent ON delayed_messages(agent_id);
-- from 0008_final_schema_optimization.sql
CREATE INDEX IF NOT EXISTS idx_delayed_messages_conversation ON delayed_messages(conversation_id);
-- from 0008_final_schema_optimization.sql
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
-- from 0008_final_schema_optimization.sql
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at);
-- from 0008_final_schema_optimization.sql
CREATE INDEX IF NOT EXISTS idx_activities_action ON activities(action);
-- from 0008_final_schema_optimization.sql
CREATE INDEX IF NOT EXISTS idx_activities_resource ON activities(resource_type, resource_id);
-- from 0008_final_schema_optimization.sql
CREATE INDEX IF NOT EXISTS idx_file_attachments_message ON file_attachments(message_id);
-- from 0008_final_schema_optimization.sql
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at);
-- from 0013_add_metrics_table.sql
CREATE INDEX IF NOT EXISTS idx_metrics_name_timestamp ON metrics(metric_name, timestamp);
-- from 0013_add_metrics_table.sql
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);
-- from 0013_add_metrics_table.sql
CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(metric_name);
-- from 0014_fix_conversation_session_references.sql
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_conversation_id ON conversation_sessions(conversation_id);
-- from 0014_fix_conversation_session_references.sql
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_is_active ON conversation_sessions(is_active);
-- from 0014_fix_conversation_session_references.sql
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_last_activity ON conversation_sessions(last_activity);
-- from 0015_add_reports_tables.sql
CREATE INDEX IF NOT EXISTS idx_reports_team_id ON reports(team_id);
-- from 0015_add_reports_tables.sql
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
-- from 0015_add_reports_tables.sql
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
-- from 0015_add_reports_tables.sql
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
-- from 0015_add_reports_tables.sql
CREATE INDEX IF NOT EXISTS idx_reports_expires_at ON reports(expires_at);
-- from 0015_add_reports_tables.sql
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_team_id ON scheduled_reports(team_id);
-- from 0015_add_reports_tables.sql
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_is_active ON scheduled_reports(is_active);
-- from 0015_add_reports_tables.sql
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_execution ON scheduled_reports(next_execution_at);
-- from 0015_add_reports_tables.sql
CREATE INDEX IF NOT EXISTS idx_sched_exec_scheduled_report ON scheduled_report_executions(scheduled_report_id);
-- from 0015_add_reports_tables.sql
CREATE INDEX IF NOT EXISTS idx_sched_exec_status ON scheduled_report_executions(execution_status);
-- from 0015_add_reports_tables.sql
CREATE INDEX IF NOT EXISTS idx_sched_exec_started_at ON scheduled_report_executions(execution_started_at DESC);
-- from 0015_add_reports_tables.sql
CREATE INDEX IF NOT EXISTS idx_download_history_report ON report_download_history(report_id);
-- from 0015_add_reports_tables.sql
CREATE INDEX IF NOT EXISTS idx_download_history_user ON report_download_history(downloaded_by);
-- from 0015_add_reports_tables.sql
CREATE INDEX IF NOT EXISTS idx_download_history_downloaded_at ON report_download_history(downloaded_at DESC);
-- from 0015_add_reports_tables.sql
CREATE INDEX IF NOT EXISTS idx_templates_report_type ON report_templates(report_type);
-- from 0015_add_reports_tables.sql
CREATE INDEX IF NOT EXISTS idx_templates_category ON report_templates(category);
-- from 0015_add_reports_tables.sql
CREATE INDEX IF NOT EXISTS idx_templates_is_public ON report_templates(is_public);
-- from 0015_add_reports_tables.sql
CREATE INDEX IF NOT EXISTS idx_templates_created_by ON report_templates(created_by);
-- from 0015_add_reports_tables.sql
CREATE VIEW IF NOT EXISTS v_recent_reports AS SELECT r.id, r.title, r.type, r.format, r.status, r.created_by, a.display_name as creator_name, r.created_at, r.completed_at, r.file_size, r.downloaded_count FROM reports r LEFT JOIN agents a ON r.created_by = a.id WHERE r.deleted_at IS NULL ORDER BY r.created_at DESC LIMIT 100;
-- from 0015_add_reports_tables.sql
CREATE VIEW IF NOT EXISTS v_report_generation_stats AS SELECT type as report_type, format as report_format, COUNT(*) as total_count, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count, SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count, ROUND(AVG(execution_time), 2) as avg_execution_time, ROUND(AVG(file_size) / 1024.0 / 1024.0, 2) as avg_file_size_mb FROM reports WHERE deleted_at IS NULL GROUP BY type, format;
-- from 0015_add_reports_tables.sql
CREATE VIEW IF NOT EXISTS v_active_scheduled_reports AS SELECT sr.id, sr.name, sr.report_type, sr.schedule_type, sr.is_active, sr.next_execution_at, sr.last_execution_at, sr.last_execution_status, sr.execution_count, sr.created_by, a.display_name as creator_name FROM scheduled_reports sr LEFT JOIN agents a ON sr.created_by = a.id WHERE sr.deleted_at IS NULL AND sr.is_active = 1 ORDER BY sr.next_execution_at ASC;
-- from 0018_add_customer_tags_indexes.sql
CREATE INDEX IF NOT EXISTS idx_customer_tags_tag_id ON customer_tags(tag_id);
-- from 0018_add_customer_tags_indexes.sql
CREATE INDEX IF NOT EXISTS idx_customer_tags_tag_assigned ON customer_tags(tag_id, assigned_at DESC);
-- from 0018_add_customer_tags_indexes.sql
CREATE INDEX IF NOT EXISTS idx_customer_tags_customer_id ON customer_tags(customer_id);
-- from 0018_add_customer_tags_indexes.sql
CREATE INDEX IF NOT EXISTS idx_customer_tags_assigned_by ON customer_tags(assigned_by);
-- from 0019_add_customers_platform_indexes.sql
CREATE INDEX IF NOT EXISTS idx_customers_platform ON customers(platform);
-- from 0019_add_customers_platform_indexes.sql
CREATE INDEX IF NOT EXISTS idx_customers_platform_id ON customers(platform, id);
-- from 0019_add_customers_platform_indexes.sql
CREATE INDEX IF NOT EXISTS idx_customers_id ON customers(id);
-- from 0021_create_webhook_security_events.sql
CREATE INDEX IF NOT EXISTS idx_webhook_security_events_platform ON webhook_security_events(platform);
-- from 0021_create_webhook_security_events.sql
CREATE INDEX IF NOT EXISTS idx_webhook_security_events_created_at ON webhook_security_events(created_at);
-- from 0021_create_webhook_security_events.sql
CREATE INDEX IF NOT EXISTS idx_webhook_security_events_severity ON webhook_security_events(severity);
-- from 0021_create_webhook_security_events.sql
CREATE INDEX IF NOT EXISTS idx_webhook_security_events_type ON webhook_security_events(type);
-- from 0021_create_webhook_security_events.sql
CREATE INDEX IF NOT EXISTS idx_webhook_security_events_integration ON webhook_security_events(integration_id);
-- from 0021_create_webhook_security_events.sql
CREATE INDEX IF NOT EXISTS idx_webhook_security_events_platform_severity ON webhook_security_events(platform, severity, created_at DESC);
-- from 0022_create_cors_events.sql
CREATE INDEX IF NOT EXISTS idx_cors_events_type ON cors_events(type);
-- from 0022_create_cors_events.sql
CREATE INDEX IF NOT EXISTS idx_cors_events_origin ON cors_events(origin);
-- from 0022_create_cors_events.sql
CREATE INDEX IF NOT EXISTS idx_cors_events_timestamp ON cors_events(timestamp DESC);
-- from 0022_create_cors_events.sql
CREATE INDEX IF NOT EXISTS idx_cors_events_rejected_origin ON cors_events(type, origin, timestamp DESC) WHERE type = 'rejected';
-- from 0022_create_cors_events.sql
CREATE INDEX IF NOT EXISTS idx_cors_events_allowed_origin ON cors_events(type, origin, timestamp DESC) WHERE type = 'allowed';
-- from 0023_enhance_file_attachments.sql
CREATE INDEX IF NOT EXISTS idx_file_attachments_conversation_id ON file_attachments(conversation_id);
-- from 0023_enhance_file_attachments.sql
CREATE INDEX IF NOT EXISTS idx_file_attachments_uploaded_by ON file_attachments(uploaded_by);
-- from 0023_enhance_file_attachments.sql
CREATE INDEX IF NOT EXISTS idx_file_attachments_created_at ON file_attachments(created_at);
-- from 0026_refactor_channel_integrations_json.sql
CREATE INDEX IF NOT EXISTS idx_channel_integrations_team_platform_active ON channel_integrations(team_id, platform, is_active);
-- from 0030_add_team_liff_qr_codes.sql
CREATE INDEX IF NOT EXISTS idx_team_liff_qr_codes_team_id ON team_liff_qr_codes(team_id);
-- from 0030_add_team_liff_qr_codes.sql
CREATE INDEX IF NOT EXISTS idx_team_liff_qr_codes_is_active ON team_liff_qr_codes(is_active);
-- from 0031_add_customer_team_assignments.sql
CREATE INDEX IF NOT EXISTS idx_customer_team_assignments_platform_user ON customer_team_assignments(platform_user_id);
-- from 0031_add_customer_team_assignments.sql
CREATE INDEX IF NOT EXISTS idx_customer_team_assignments_team_id ON customer_team_assignments(team_id);
-- from 0031_add_customer_team_assignments.sql
CREATE INDEX IF NOT EXISTS idx_customer_team_assignments_qr_code ON customer_team_assignments(qr_code_id);
-- from 0031_add_customer_team_assignments.sql
CREATE INDEX IF NOT EXISTS idx_customer_team_assignments_source ON customer_team_assignments(source);
-- from 0031_add_customer_team_assignments.sql
CREATE INDEX IF NOT EXISTS idx_customer_team_assignments_team_date ON customer_team_assignments(team_id, assigned_at DESC);
-- from 0035_schema_integrity_fixes.sql
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON reports(created_by);
-- from 0040_repair_schema_gap.sql
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_created_by ON scheduled_reports(created_by);
-- from 0040_repair_schema_gap.sql
CREATE INDEX IF NOT EXISTS idx_agent_teams_agent_id ON agent_teams(agent_id);
-- from 0040_repair_schema_gap.sql
CREATE INDEX IF NOT EXISTS idx_agent_teams_team_id ON agent_teams(team_id);
-- from 0040_repair_schema_gap.sql
CREATE INDEX IF NOT EXISTS idx_agent_teams_is_primary ON agent_teams(agent_id, is_primary) WHERE is_primary = 1;
-- from 0040_repair_schema_gap.sql
CREATE INDEX IF NOT EXISTS idx_agent_teams_role ON agent_teams(team_id, role_in_team);
-- from 0040_repair_schema_gap.sql
CREATE INDEX IF NOT EXISTS idx_task_reminders_user_remind ON task_reminders(user_id, remind_at) WHERE is_completed = 0 AND is_sent = 0;
-- from 0040_repair_schema_gap.sql
CREATE INDEX IF NOT EXISTS idx_task_reminders_pending ON task_reminders(remind_at) WHERE is_completed = 0 AND is_sent = 0;
-- from 0040_repair_schema_gap.sql
CREATE INDEX IF NOT EXISTS idx_task_reminders_conversation ON task_reminders(conversation_id) WHERE conversation_id IS NOT NULL;
-- from 0040_repair_schema_gap.sql
CREATE INDEX IF NOT EXISTS idx_customer_feedback_conversation ON customer_feedback(conversation_id);
-- from 0040_repair_schema_gap.sql
CREATE INDEX IF NOT EXISTS idx_customer_feedback_customer ON customer_feedback(customer_id);
-- from 0040_repair_schema_gap.sql
CREATE INDEX IF NOT EXISTS idx_customer_feedback_agent ON customer_feedback(agent_id) WHERE agent_id IS NOT NULL;
-- from 0040_repair_schema_gap.sql
CREATE INDEX IF NOT EXISTS idx_customer_feedback_created_at ON customer_feedback(created_at);
-- from 0040_repair_schema_gap.sql
CREATE INDEX IF NOT EXISTS idx_customer_feedback_rating ON customer_feedback(rating, created_at);
-- from 0040_repair_schema_gap.sql
CREATE INDEX IF NOT EXISTS idx_customer_feedback_type ON customer_feedback(feedback_type, created_at);
-- from 0040_repair_schema_gap.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_team_assignments_unique ON customer_team_assignments(platform_user_id, team_id);
-- from 0040_repair_schema_gap.sql
CREATE INDEX IF NOT EXISTS idx_task_reminders_conversation_id ON task_reminders(conversation_id) WHERE conversation_id IS NOT NULL;
-- from 0040_repair_schema_gap.sql
CREATE INDEX IF NOT EXISTS idx_message_recall_logs_message_id ON message_recall_logs(message_id);
-- from 0040_repair_schema_gap.sql
CREATE INDEX IF NOT EXISTS idx_report_templates_created_by ON report_templates(created_by);
-- from 0040_repair_schema_gap.sql
CREATE INDEX IF NOT EXISTS idx_report_download_history_downloaded_by ON report_download_history(downloaded_by);
-- from 0040_repair_schema_gap.sql
CREATE INDEX IF NOT EXISTS idx_messages_updated_at ON messages(updated_at DESC) WHERE updated_at IS NOT NULL;
-- from 0043_add_auto_reply_tables.sql
CREATE INDEX IF NOT EXISTS `idx_auto_reply_conditions_rule` ON `auto_reply_conditions`(`rule_id`);
-- from 0043_add_auto_reply_tables.sql
CREATE INDEX IF NOT EXISTS `idx_auto_reply_actions_rule` ON `auto_reply_actions`(`rule_id`);
-- from 0043_add_auto_reply_tables.sql
CREATE INDEX IF NOT EXISTS `idx_auto_reply_schedules_team` ON `auto_reply_schedules`(`team_id`);
-- from 0043_add_auto_reply_tables.sql
CREATE INDEX IF NOT EXISTS `idx_auto_reply_logs_rule` ON `auto_reply_logs`(`rule_id`);
-- from 0043_add_auto_reply_tables.sql
CREATE INDEX IF NOT EXISTS `idx_auto_reply_logs_created` ON `auto_reply_logs`(`created_at`);
-- from 0044_make_auto_reply_rules_team_nullable.sql
CREATE INDEX IF NOT EXISTS `idx_auto_reply_rules_team_active` ON `auto_reply_rules`(`team_id`, `is_active`) WHERE `deleted_at` IS NULL;
-- from 0044_make_auto_reply_rules_team_nullable.sql
CREATE INDEX IF NOT EXISTS `idx_auto_reply_rules_global_active` ON `auto_reply_rules`(`is_active`) WHERE `team_id` IS NULL AND `deleted_at` IS NULL;
-- from 0048_add_auto_reply_deliveries.sql
CREATE INDEX IF NOT EXISTS idx_auto_reply_deliveries_status ON auto_reply_deliveries(status, updated_at);
-- from 0048_add_auto_reply_deliveries.sql
CREATE INDEX IF NOT EXISTS idx_auto_reply_deliveries_conversation ON auto_reply_deliveries(conversation_id, created_at);

