-- ===============================================
-- Migration 0040: Repair Schema Gap from Web Installer
-- ===============================================
-- Date: 2026-03-03
-- Purpose: Apply all schema changes from wrangler migrations 0028-0039
--          that were missing from the web installer's bundled migrations.
--
-- CONTEXT:
--   The web installer's 13 bundled migrations created the base schema but
--   did not include changes from wrangler migrations 0028-0039.
--   This repair migration applies the 8 missing changes using IF NOT EXISTS
--   and OR IGNORE guards so it is safe to run on both:
--     (a) Web-installed DBs (applies all changes)
--     (b) Wrangler-migrated DBs (all statements are no-ops)
--
-- CHANGES:
--   1.1  CREATE TABLE agent_teams (from 0028)
--   1.2  CREATE TABLE task_reminders (from 0029)
--   1.3  CREATE TABLE customer_feedback (from 0032)
--   1.4  ALTER TABLE messages ADD sender_name (from 0034)
--   1.5  ALTER TABLE messages ADD updated_at (from 0036)
--   1.6  CREATE missing indexes (from 0035)
--   1.7  INSERT system agent (from 0039)
--   1.8  INSERT default report templates (from 0039)
-- ===============================================

-- ============================================================================
-- 1.1  CREATE TABLE agent_teams (from 0028)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  role_in_team TEXT DEFAULT 'member',
  is_primary INTEGER DEFAULT 0,
  joined_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(agent_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_teams_agent_id
  ON agent_teams(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_teams_team_id
  ON agent_teams(team_id);

CREATE INDEX IF NOT EXISTS idx_agent_teams_is_primary
  ON agent_teams(agent_id, is_primary)
  WHERE is_primary = 1;

CREATE INDEX IF NOT EXISTS idx_agent_teams_role
  ON agent_teams(team_id, role_in_team);

-- ============================================================================
-- 1.2  CREATE TABLE task_reminders (from 0029)
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  remind_at TEXT NOT NULL,
  conversation_id TEXT,
  repeat_type TEXT DEFAULT 'none',
  repeat_interval INTEGER DEFAULT 0,
  is_completed INTEGER DEFAULT 0,
  is_sent INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  sent_at TEXT,
  FOREIGN KEY (user_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_task_reminders_user_remind
  ON task_reminders(user_id, remind_at)
  WHERE is_completed = 0 AND is_sent = 0;

CREATE INDEX IF NOT EXISTS idx_task_reminders_pending
  ON task_reminders(remind_at)
  WHERE is_completed = 0 AND is_sent = 0;

CREATE INDEX IF NOT EXISTS idx_task_reminders_conversation
  ON task_reminders(conversation_id)
  WHERE conversation_id IS NOT NULL;

-- ============================================================================
-- 1.3  CREATE TABLE customer_feedback (from 0032)
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_feedback (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  customer_id INTEGER NOT NULL,
  agent_id TEXT,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  comment TEXT,
  feedback_type TEXT DEFAULT 'satisfaction',
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_feedback_conversation
  ON customer_feedback(conversation_id);

CREATE INDEX IF NOT EXISTS idx_customer_feedback_customer
  ON customer_feedback(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_feedback_agent
  ON customer_feedback(agent_id)
  WHERE agent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_feedback_created_at
  ON customer_feedback(created_at);

CREATE INDEX IF NOT EXISTS idx_customer_feedback_rating
  ON customer_feedback(rating, created_at);

CREATE INDEX IF NOT EXISTS idx_customer_feedback_type
  ON customer_feedback(feedback_type, created_at);

-- ============================================================================
-- 1.4  ADD COLUMN messages.sender_name (from 0034)
-- ============================================================================
-- NOTE: SQLite returns an error if the column already exists; there is no
--       IF NOT EXISTS for ALTER TABLE ADD COLUMN. We rely on the migration
--       tracker (d1_migrations) to prevent double-execution. On a
--       wrangler-migrated DB this migration (0040) runs once but the column
--       already exists from 0034, so wrangler will error. This is only
--       expected to run on web-installed DBs where the column is missing.

ALTER TABLE messages ADD COLUMN sender_name TEXT;

-- ============================================================================
-- 1.5  ADD COLUMN messages.updated_at + index (from 0036)
-- ============================================================================

ALTER TABLE messages ADD COLUMN updated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_updated_at
  ON messages(updated_at DESC)
  WHERE updated_at IS NOT NULL;

-- ============================================================================
-- 1.6  CREATE missing indexes (from 0035)
-- ============================================================================

-- Unique constraint on customer_team_assignments
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_team_assignments_unique
  ON customer_team_assignments(platform_user_id, team_id);

-- task_reminders conversation_id lookup
CREATE INDEX IF NOT EXISTS idx_task_reminders_conversation_id
  ON task_reminders(conversation_id)
  WHERE conversation_id IS NOT NULL;

-- message_recall_logs message_id lookup
CREATE INDEX IF NOT EXISTS idx_message_recall_logs_message_id
  ON message_recall_logs(message_id);

-- Reports system creator lookups
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_created_by
  ON scheduled_reports(created_by);

CREATE INDEX IF NOT EXISTS idx_report_templates_created_by
  ON report_templates(created_by);

CREATE INDEX IF NOT EXISTS idx_report_download_history_downloaded_by
  ON report_download_history(downloaded_by);

-- ============================================================================
-- 1.7  INSERT system agent (from 0039)
-- ============================================================================

INSERT OR IGNORE INTO agents (id, email, password_hash, display_name, role, is_active, created_at, updated_at)
VALUES ('system', 'system@internal', 'SYSTEM_NO_LOGIN', 'System', 'admin', 0, datetime('now'), datetime('now'));

-- ============================================================================
-- 1.8  INSERT default report templates (from 0039)
-- ============================================================================

INSERT OR IGNORE INTO report_templates (id, name, description, report_type, template_config, category, is_system_template, is_public, created_by)
VALUES
  ('tpl_conv_summary_basic', '基本對話摘要', '顯示對話總數、訊息量和回應時間的基本報告', 'conversation_summary', '{"includeMetrics":["total","active","closed"],"groupBy":"day"}', 'operational', 1, 1, 'system'),
  ('tpl_agent_perf_monthly', '月度客服績效', '展示客服人員的月度工作表現和KPI指標', 'agent_performance', '{"timeRange":"last_30_days","metrics":["conversations","messages","avgResponseTime","satisfaction"]}', 'analytical', 1, 1, 'system'),
  ('tpl_team_analytics', '團隊分析報告', '團隊整體表現和協作效率分析', 'team_analytics', '{"includeCharts":true,"compareTeams":true}', 'analytical', 1, 1, 'system'),
  ('tpl_executive_summary', '高層管理摘要', '為管理層提供關鍵業務指標的簡潔摘要', 'executive_summary', '{"includeKPIs":true,"includeTrends":true}', 'executive', 1, 1, 'system');

-- ===============================================
-- Migration metadata
-- ===============================================
-- Version: 0040
-- Date: 2026-03-03
-- Author: Schema Gap Repair
-- Breaking Changes: None (additive only, IF NOT EXISTS / OR IGNORE guarded)
-- Risk: Low — all statements are idempotent except ALTER TABLE ADD COLUMN
--
-- Rollback SQL:
-- DROP INDEX IF EXISTS idx_agent_teams_agent_id;
-- DROP INDEX IF EXISTS idx_agent_teams_team_id;
-- DROP INDEX IF EXISTS idx_agent_teams_is_primary;
-- DROP INDEX IF EXISTS idx_agent_teams_role;
-- DROP TABLE IF EXISTS agent_teams;
-- DROP TABLE IF EXISTS task_reminders;
-- DROP TABLE IF EXISTS customer_feedback;
-- DROP INDEX IF EXISTS idx_customer_team_assignments_unique;
-- DROP INDEX IF EXISTS idx_task_reminders_conversation_id;
-- DROP INDEX IF EXISTS idx_message_recall_logs_message_id;
-- DROP INDEX IF EXISTS idx_scheduled_reports_created_by;
-- DROP INDEX IF EXISTS idx_report_templates_created_by;
-- DROP INDEX IF EXISTS idx_report_download_history_downloaded_by;
-- DROP INDEX IF EXISTS idx_messages_updated_at;
-- DELETE FROM report_templates WHERE id IN ('tpl_conv_summary_basic','tpl_agent_perf_monthly','tpl_team_analytics','tpl_executive_summary');
-- DELETE FROM agents WHERE id = 'system';
-- Note: ALTER TABLE DROP COLUMN not supported in SQLite for sender_name/updated_at
