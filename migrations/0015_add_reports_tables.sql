-- Migration: Add Reports System Tables
-- Created: 2025-09-30
-- Description: Complete reports system with scheduled reports and execution history

-- ======================== Reports Main Table ========================
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- 'conversation_summary', 'agent_performance', 'team_analytics', etc.
  format TEXT NOT NULL, -- 'json', 'csv', 'excel', 'pdf', 'html'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'generating', 'completed', 'failed'

  -- Ownership and access
  created_by TEXT NOT NULL,
  team_id INTEGER,

  -- Metadata
  time_range TEXT, -- 'last_7_days', 'last_30_days', 'custom', etc.
  start_date TEXT,
  end_date TEXT,
  filters TEXT, -- JSON string with filters
  options TEXT, -- JSON string with generation options

  -- Generation tracking
  generation_started_at TEXT,
  completed_at TEXT,
  failed_at TEXT,
  error_message TEXT,
  execution_time INTEGER, -- in seconds

  -- File information
  download_url TEXT,
  file_size INTEGER, -- in bytes
  file_hash TEXT,

  -- Lifecycle
  downloaded_count INTEGER DEFAULT 0,
  last_downloaded_at TEXT,
  expires_at TEXT,
  deleted_at TEXT,

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Foreign keys
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
);

-- Indexes for reports table
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON reports(created_by);
CREATE INDEX IF NOT EXISTS idx_reports_team_id ON reports(team_id);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_expires_at ON reports(expires_at);

-- ======================== Scheduled Reports Table ========================
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,

  -- Report configuration
  report_type TEXT NOT NULL,
  report_format TEXT NOT NULL DEFAULT 'excel',
  report_params TEXT NOT NULL, -- JSON string with generation parameters

  -- Schedule configuration
  schedule_type TEXT NOT NULL, -- 'daily', 'weekly', 'monthly', 'custom'
  schedule_config TEXT NOT NULL, -- JSON string with cron expression or schedule details
  timezone TEXT DEFAULT 'UTC',

  -- Execution settings
  is_active INTEGER DEFAULT 1,
  max_retries INTEGER DEFAULT 3,
  retry_delay_minutes INTEGER DEFAULT 30,

  -- Ownership
  created_by TEXT NOT NULL,
  team_id INTEGER,

  -- Notification settings
  notify_on_completion INTEGER DEFAULT 1,
  notify_on_failure INTEGER DEFAULT 1,
  notification_emails TEXT, -- JSON array of email addresses

  -- Lifecycle
  next_execution_at TEXT,
  last_execution_at TEXT,
  last_execution_status TEXT, -- 'success', 'failed', 'skipped'
  execution_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,

  -- Foreign keys
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
);

-- Indexes for scheduled_reports table
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_created_by ON scheduled_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_team_id ON scheduled_reports(team_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_is_active ON scheduled_reports(is_active);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_execution ON scheduled_reports(next_execution_at);

-- ======================== Scheduled Report Executions Table ========================
CREATE TABLE IF NOT EXISTS scheduled_report_executions (
  id TEXT PRIMARY KEY,
  scheduled_report_id TEXT NOT NULL,

  -- Execution details
  execution_started_at TEXT NOT NULL,
  execution_completed_at TEXT,
  execution_status TEXT NOT NULL, -- 'running', 'success', 'failed', 'cancelled'
  execution_duration INTEGER, -- in seconds

  -- Result
  generated_report_id TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Foreign keys
  FOREIGN KEY (scheduled_report_id) REFERENCES scheduled_reports(id) ON DELETE CASCADE,
  FOREIGN KEY (generated_report_id) REFERENCES reports(id) ON DELETE SET NULL
);

-- Indexes for scheduled_report_executions table
CREATE INDEX IF NOT EXISTS idx_sched_exec_scheduled_report ON scheduled_report_executions(scheduled_report_id);
CREATE INDEX IF NOT EXISTS idx_sched_exec_status ON scheduled_report_executions(execution_status);
CREATE INDEX IF NOT EXISTS idx_sched_exec_started_at ON scheduled_report_executions(execution_started_at DESC);

-- ======================== Report Download History Table ========================
CREATE TABLE IF NOT EXISTS report_download_history (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,

  -- Download details
  downloaded_by TEXT NOT NULL,
  downloaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT,

  -- Download method
  download_method TEXT, -- 'manual', 'scheduled', 'api'
  download_size INTEGER, -- actual downloaded size in bytes

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Foreign keys
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

-- Indexes for report_download_history table
CREATE INDEX IF NOT EXISTS idx_download_history_report ON report_download_history(report_id);
CREATE INDEX IF NOT EXISTS idx_download_history_user ON report_download_history(downloaded_by);
CREATE INDEX IF NOT EXISTS idx_download_history_downloaded_at ON report_download_history(downloaded_at DESC);

-- ======================== Report Templates Table ========================
CREATE TABLE IF NOT EXISTS report_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,

  -- Template configuration
  report_type TEXT NOT NULL,
  template_config TEXT NOT NULL, -- JSON string with default parameters
  preview_image_url TEXT,

  -- Categorization
  category TEXT, -- 'operational', 'analytical', 'executive', 'compliance'
  tags TEXT, -- JSON array of tags

  -- Usage tracking
  is_system_template INTEGER DEFAULT 0,
  is_public INTEGER DEFAULT 0,
  created_by TEXT NOT NULL,
  team_id INTEGER,

  -- Popularity
  usage_count INTEGER DEFAULT 0,
  last_used_at TEXT,

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,

  -- Foreign keys
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
);

-- Indexes for report_templates table
CREATE INDEX IF NOT EXISTS idx_templates_report_type ON report_templates(report_type);
CREATE INDEX IF NOT EXISTS idx_templates_category ON report_templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_is_public ON report_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_templates_created_by ON report_templates(created_by);

-- ======================== Initial Data ========================

-- Insert default report templates
INSERT OR IGNORE INTO report_templates (id, name, description, report_type, template_config, category, is_system_template, is_public, created_by)
VALUES
  ('tpl_conv_summary_basic', '基本對話摘要', '顯示對話總數、訊息量和回應時間的基本報告', 'conversation_summary', '{"includeMetrics":["total","active","closed"],"groupBy":"day"}', 'operational', 1, 1, 'system'),
  ('tpl_agent_perf_monthly', '月度客服績效', '展示客服人員的月度工作表現和KPI指標', 'agent_performance', '{"timeRange":"last_30_days","metrics":["conversations","messages","avgResponseTime","satisfaction"]}', 'analytical', 1, 1, 'system'),
  ('tpl_team_analytics', '團隊分析報告', '團隊整體表現和協作效率分析', 'team_analytics', '{"includeCharts":true,"compareTeams":true}', 'analytical', 1, 1, 'system'),
  ('tpl_executive_summary', '高層管理摘要', '為管理層提供關鍵業務指標的簡潔摘要', 'executive_summary', '{"includeKPIs":true,"includeTrends":true}', 'executive', 1, 1, 'system');

-- ======================== Views for Analytics ========================

-- View: Recent reports summary
CREATE VIEW IF NOT EXISTS v_recent_reports AS
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

-- View: Report generation performance
CREATE VIEW IF NOT EXISTS v_report_generation_stats AS
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

-- View: Scheduled reports with next execution
CREATE VIEW IF NOT EXISTS v_active_scheduled_reports AS
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