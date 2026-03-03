/**
 * Bundled Database Migrations
 *
 * Complete database schema for the Multi-Channel CRM System
 * Auto-generated from src/db/schema.ts
 *
 * IMPORTANT: This file contains the full database schema required for
 * the Web Installer to set up a new CRM instance.
 */

export interface MigrationFile {
  version: string;
  filename: string;
  description: string;
  sql: string;
}

/**
 * All migrations in order of execution
 */
export const BUNDLED_MIGRATIONS: MigrationFile[] = [
  // ============================================================
  // PHASE 1: Core Tables (Required for basic functionality)
  // ============================================================
  {
    version: '0001',
    filename: '0001_core_tables.sql',
    description: 'Create core tables: teams, agents, customers',
    sql: `
-- Teams table - 團隊
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  qr_code TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_name ON teams(name);

-- Agents table - 客服人員
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent',
  team_id INTEGER REFERENCES teams(id),
  is_active INTEGER DEFAULT 1,
  password_policy TEXT DEFAULT 'changeable',
  last_active TEXT,
  last_login_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_agents_email ON agents(email);
CREATE INDEX IF NOT EXISTS idx_agents_team_id ON agents(team_id);
CREATE INDEX IF NOT EXISTS idx_agents_role ON agents(role);

-- Customers table - 平台客戶資訊表
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  platform_user_id TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  email TEXT,
  phone TEXT,
  source_team_id INTEGER REFERENCES teams(id),
  metadata TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  UNIQUE(platform, platform_user_id)
);
CREATE INDEX IF NOT EXISTS idx_customers_platform ON customers(platform, platform_user_id);
    `
  },

  {
    version: '0002',
    filename: '0002_conversations_messages.sql',
    description: 'Create conversations and messages tables',
    sql: `
-- Conversations table - 對話
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  assigned_team_id INTEGER REFERENCES teams(id),
  assigned_user_id TEXT REFERENCES agents(id),
  status TEXT NOT NULL DEFAULT 'active',
  priority TEXT DEFAULT 'normal',
  first_response_at TEXT,
  closed_at TEXT,
  internal_notes TEXT,
  last_message_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_conversations_customer_id ON conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_user_id ON conversations(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_team_id ON conversations(assigned_team_id);

-- Messages table - 訊息
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  sender_type TEXT NOT NULL,
  customer_sender_id INTEGER REFERENCES customers(id),
  agent_sender_id TEXT REFERENCES agents(id),
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
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON messages(sender_type);
    `
  },

  // ============================================================
  // PHASE 2: Feature Tables (Extended functionality)
  // ============================================================
  {
    version: '0003',
    filename: '0003_delayed_messages.sql',
    description: 'Create delayed messages table',
    sql: `
-- Delayed messages table - 延遲訊息
CREATE TABLE IF NOT EXISTS delayed_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  scheduled_at TEXT NOT NULL,
  sent_at TEXT,
  cancelled_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_delayed_messages_status ON delayed_messages(status);
CREATE INDEX IF NOT EXISTS idx_delayed_messages_scheduled_at ON delayed_messages(scheduled_at);
    `
  },

  {
    version: '0004',
    filename: '0004_file_attachments.sql',
    description: 'Create file attachments table',
    sql: `
-- File attachments table - 檔案附件表
CREATE TABLE IF NOT EXISTS file_attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT REFERENCES messages(id),
  conversation_id TEXT REFERENCES conversations(id),
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_url TEXT,
  r2_key TEXT NOT NULL,
  url TEXT,
  upload_status TEXT DEFAULT 'completed',
  uploaded_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_file_attachments_message_id ON file_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_conversation_id ON file_attachments(conversation_id);
    `
  },

  {
    version: '0005',
    filename: '0005_qr_codes.sql',
    description: 'Create QR codes tables',
    sql: `
-- QR Codes table - QR碼管理
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
CREATE INDEX IF NOT EXISTS idx_qr_codes_team_id ON qr_codes(team_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_token ON qr_codes(token);

-- QR Code Scans table - 掃描記錄
CREATE TABLE IF NOT EXISTS qr_code_scans (
  id TEXT PRIMARY KEY,
  qr_code_id TEXT NOT NULL REFERENCES qr_codes(id),
  customer_id INTEGER REFERENCES customers(id),
  platform TEXT NOT NULL,
  platform_user_id TEXT,
  scan_metadata TEXT,
  scanned_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_qr_code_scans_qr_code_id ON qr_code_scans(qr_code_id);

-- QR Code Analytics table - 分析統計
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
    `
  },

  {
    version: '0006',
    filename: '0006_tags.sql',
    description: 'Create tags and associations tables',
    sql: `
-- Tags table - 標籤系統
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  description TEXT,
  team_id INTEGER REFERENCES teams(id),
  is_active INTEGER DEFAULT 1,
  created_by TEXT NOT NULL REFERENCES agents(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  UNIQUE(name, team_id)
);
CREATE INDEX IF NOT EXISTS idx_tags_team_id ON tags(team_id);

-- Customer tags junction table - 客戶標籤關聯
CREATE TABLE IF NOT EXISTS customer_tags (
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  tag_id INTEGER NOT NULL REFERENCES tags(id),
  assigned_by TEXT NOT NULL REFERENCES agents(id),
  assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (customer_id, tag_id)
);

-- Conversation tags junction table - 對話標籤關聯
CREATE TABLE IF NOT EXISTS conversation_tags (
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  tag_id INTEGER NOT NULL REFERENCES tags(id),
  assigned_by TEXT NOT NULL REFERENCES agents(id),
  assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id, tag_id)
);
    `
  },

  {
    version: '0007',
    filename: '0007_sessions_transfers.sql',
    description: 'Create conversation sessions and transfers tables',
    sql: `
-- Conversation sessions table - 對話會話管理
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  session_type TEXT NOT NULL DEFAULT 'continuous',
  topic TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT,
  last_activity TEXT NOT NULL,
  message_count INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_conversation_id ON conversation_sessions(conversation_id);

-- Conversation transfers table - 對話轉移記錄
CREATE TABLE IF NOT EXISTS conversation_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  from_team_id INTEGER REFERENCES teams(id),
  to_team_id INTEGER REFERENCES teams(id),
  from_user_id TEXT REFERENCES agents(id),
  to_user_id TEXT REFERENCES agents(id),
  transfer_reason TEXT,
  transferred_by TEXT NOT NULL REFERENCES agents(id),
  transfer_type TEXT DEFAULT 'manual',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_conversation_transfers_conversation_id ON conversation_transfers(conversation_id);
    `
  },

  {
    version: '0008',
    filename: '0008_notifications_activities.sql',
    description: 'Create notifications and activities tables',
    sql: `
-- Message recall logs table - 訊息撤回日誌
CREATE TABLE IF NOT EXISTS message_recall_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES agents(id),
  action TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table - 通知系統
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES agents(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  data TEXT,
  is_read INTEGER DEFAULT 0,
  read_at TEXT,
  expires_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- Activities table - 活動記錄表（審計追蹤）
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES agents(id),
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at);
    `
  },

  // ============================================================
  // PHASE 3: System Tables (Configuration and metrics)
  // ============================================================
  {
    version: '0009',
    filename: '0009_system_settings_metrics.sql',
    description: 'Create system settings and metrics tables',
    sql: `
-- System settings table - 系統設定表
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Metrics table - 企業分析指標
CREATE TABLE IF NOT EXISTS metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  timestamp INTEGER NOT NULL,
  tags TEXT,
  unit TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_metrics_name_timestamp ON metrics(metric_name, timestamp);
    `
  },

  {
    version: '0010',
    filename: '0010_channel_integrations.sql',
    description: 'Create channel integrations table',
    sql: `
-- Channel Integrations table - 渠道集成配置
CREATE TABLE IF NOT EXISTS channel_integrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL REFERENCES teams(id),
  platform TEXT NOT NULL,

  -- JSON-based configuration
  config TEXT,
  credentials TEXT,
  webhook_config TEXT,
  stats TEXT,

  -- Legacy columns (deprecated)
  line_channel_id TEXT,
  line_channel_access_token TEXT,
  line_channel_secret TEXT,
  line_webhook_url TEXT,
  line_webhook_token TEXT,
  facebook_page_id TEXT,
  facebook_access_token TEXT,
  facebook_app_secret TEXT,
  whatsapp_phone_number TEXT,
  whatsapp_business_account_id TEXT,
  whatsapp_access_token TEXT,
  total_messages_sent INTEGER DEFAULT 0,
  total_messages_received INTEGER DEFAULT 0,
  last_message_at TEXT,

  -- Status
  is_active INTEGER DEFAULT 1,
  is_verified INTEGER DEFAULT 0,
  last_verified_at TEXT,
  configured_by TEXT REFERENCES agents(id),
  config_metadata TEXT,
  last_error TEXT,
  error_count INTEGER DEFAULT 0,

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_channel_integrations_team_id ON channel_integrations(team_id);
CREATE INDEX IF NOT EXISTS idx_channel_integrations_platform ON channel_integrations(platform);
    `
  },

  {
    version: '0011',
    filename: '0011_security_cors_events.sql',
    description: 'Create security and CORS events tables',
    sql: `
-- Webhook Security Events table - 安全事件記錄
CREATE TABLE IF NOT EXISTS webhook_security_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high', 'critical')),
  platform TEXT NOT NULL,
  integration_id INTEGER REFERENCES channel_integrations(id) ON DELETE CASCADE,
  source_ip TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_webhook_security_events_type ON webhook_security_events(type);
CREATE INDEX IF NOT EXISTS idx_webhook_security_events_severity ON webhook_security_events(severity);

-- CORS Events table - CORS 事件記錄
CREATE TABLE IF NOT EXISTS cors_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('allowed', 'rejected', 'preflight', 'sse_connection', 'credentials_used')),
  origin TEXT NOT NULL,
  method TEXT,
  path TEXT,
  user_agent TEXT,
  ip_address TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  metadata TEXT
);
CREATE INDEX IF NOT EXISTS idx_cors_events_type ON cors_events(type);
CREATE INDEX IF NOT EXISTS idx_cors_events_origin ON cors_events(origin);
    `
  },

  // ============================================================
  // PHASE 4: Reports System Tables
  // ============================================================
  {
    version: '0012',
    filename: '0012_reports_system.sql',
    description: 'Create reports system tables',
    sql: `
-- Reports main table - 報告系統主表
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  format TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by TEXT NOT NULL,
  team_id INTEGER REFERENCES teams(id),
  time_range TEXT,
  start_date TEXT,
  end_date TEXT,
  filters TEXT,
  options TEXT,
  generation_started_at TEXT,
  completed_at TEXT,
  failed_at TEXT,
  error_message TEXT,
  execution_time INTEGER,
  download_url TEXT,
  file_size INTEGER,
  file_hash TEXT,
  downloaded_count INTEGER DEFAULT 0,
  last_downloaded_at TEXT,
  expires_at TEXT,
  deleted_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON reports(created_by);

-- Scheduled reports table - 排程報告表
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL,
  report_format TEXT NOT NULL DEFAULT 'excel',
  report_params TEXT NOT NULL,
  schedule_type TEXT NOT NULL,
  schedule_config TEXT NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  is_active INTEGER DEFAULT 1,
  max_retries INTEGER DEFAULT 3,
  retry_delay_minutes INTEGER DEFAULT 30,
  created_by TEXT NOT NULL,
  team_id INTEGER REFERENCES teams(id),
  notify_on_completion INTEGER DEFAULT 1,
  notify_on_failure INTEGER DEFAULT 1,
  notification_emails TEXT,
  next_execution_at TEXT,
  last_execution_at TEXT,
  last_execution_status TEXT,
  execution_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

-- Scheduled report executions table - 排程執行歷史表
CREATE TABLE IF NOT EXISTS scheduled_report_executions (
  id TEXT PRIMARY KEY,
  scheduled_report_id TEXT NOT NULL REFERENCES scheduled_reports(id),
  execution_started_at TEXT NOT NULL,
  execution_completed_at TEXT,
  execution_status TEXT NOT NULL,
  execution_duration INTEGER,
  generated_report_id TEXT REFERENCES reports(id),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Report download history table - 報告下載歷史表
CREATE TABLE IF NOT EXISTS report_download_history (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES reports(id),
  downloaded_by TEXT NOT NULL,
  downloaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT,
  download_method TEXT,
  download_size INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Report templates table - 報告模板表
CREATE TABLE IF NOT EXISTS report_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL,
  template_config TEXT NOT NULL,
  preview_image_url TEXT,
  category TEXT,
  tags TEXT,
  is_system_template INTEGER DEFAULT 0,
  is_public INTEGER DEFAULT 0,
  created_by TEXT NOT NULL,
  team_id INTEGER REFERENCES teams(id),
  usage_count INTEGER DEFAULT 0,
  last_used_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);
    `
  },

  // ============================================================
  // PHASE 5: Default Data
  // ============================================================
  {
    version: '0013',
    filename: '0013_default_settings.sql',
    description: 'Insert default system settings',
    sql: `
-- Default system settings
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('app_name', 'Multi-Channel CRM');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('app_version', '1.0.0');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('default_language', 'zh-TW');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('timezone', 'Asia/Taipei');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('max_file_size_mb', '10');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('session_timeout_hours', '24');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('recall_window_seconds', '120');
    `
  },

  // ============================================================
  // PHASE 6: Multi-Team & Extended Features (from wrangler 0028+)
  // ============================================================
  {
    version: '0014',
    filename: '0014_agent_teams.sql',
    description: 'Create agent_teams many-to-many table for multi-team membership',
    sql: `
-- Agent Teams junction table - 客服多團隊成員關係
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
CREATE INDEX IF NOT EXISTS idx_agent_teams_agent_id ON agent_teams(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_teams_team_id ON agent_teams(team_id);
CREATE INDEX IF NOT EXISTS idx_agent_teams_is_primary ON agent_teams(agent_id, is_primary) WHERE is_primary = 1;
CREATE INDEX IF NOT EXISTS idx_agent_teams_role ON agent_teams(team_id, role_in_team);
    `
  },

  {
    version: '0015',
    filename: '0015_task_reminders.sql',
    description: 'Create task reminders table for agent task management',
    sql: `
-- Task Reminders table - 任務提醒系統
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
CREATE INDEX IF NOT EXISTS idx_task_reminders_user_remind ON task_reminders(user_id, remind_at) WHERE is_completed = 0 AND is_sent = 0;
CREATE INDEX IF NOT EXISTS idx_task_reminders_pending ON task_reminders(remind_at) WHERE is_completed = 0 AND is_sent = 0;
CREATE INDEX IF NOT EXISTS idx_task_reminders_conversation ON task_reminders(conversation_id) WHERE conversation_id IS NOT NULL;
    `
  },

  {
    version: '0016',
    filename: '0016_customer_feedback.sql',
    description: 'Create customer feedback table for satisfaction tracking',
    sql: `
-- Customer Feedback table - 客戶滿意度反饋
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
CREATE INDEX IF NOT EXISTS idx_customer_feedback_conversation ON customer_feedback(conversation_id);
CREATE INDEX IF NOT EXISTS idx_customer_feedback_customer ON customer_feedback(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_feedback_agent ON customer_feedback(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_feedback_created_at ON customer_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_customer_feedback_rating ON customer_feedback(rating, created_at);
CREATE INDEX IF NOT EXISTS idx_customer_feedback_type ON customer_feedback(feedback_type, created_at);
    `
  },

  {
    version: '0017',
    filename: '0017_messages_columns.sql',
    description: 'Add sender_name and updated_at columns to messages table',
    sql: `
-- Add sender_name for audit trail (persists original sender display name)
ALTER TABLE messages ADD COLUMN sender_name TEXT;

-- Add updated_at for message modification tracking (recall, status changes)
ALTER TABLE messages ADD COLUMN updated_at TEXT;
CREATE INDEX IF NOT EXISTS idx_messages_updated_at ON messages(updated_at DESC) WHERE updated_at IS NOT NULL;
    `
  },

  {
    version: '0018',
    filename: '0018_system_data.sql',
    description: 'Insert system agent, default report templates, and integrity indexes',
    sql: `
-- System agent (required for report_templates FK)
INSERT OR IGNORE INTO agents (id, email, password_hash, display_name, role, is_active, created_at, updated_at)
VALUES ('system', 'system@internal', 'SYSTEM_NO_LOGIN', 'System', 'admin', 0, datetime('now'), datetime('now'));

-- Default report templates
INSERT OR IGNORE INTO report_templates (id, name, description, report_type, template_config, category, is_system_template, is_public, created_by)
VALUES
  ('tpl_conv_summary_basic', '基本對話摘要', '顯示對話總數、訊息量和回應時間的基本報告', 'conversation_summary', '{"includeMetrics":["total","active","closed"],"groupBy":"day"}', 'operational', 1, 1, 'system'),
  ('tpl_agent_perf_monthly', '月度客服績效', '展示客服人員的月度工作表現和KPI指標', 'agent_performance', '{"timeRange":"last_30_days","metrics":["conversations","messages","avgResponseTime","satisfaction"]}', 'analytical', 1, 1, 'system'),
  ('tpl_team_analytics', '團隊分析報告', '團隊整體表現和協作效率分析', 'team_analytics', '{"includeCharts":true,"compareTeams":true}', 'analytical', 1, 1, 'system'),
  ('tpl_executive_summary', '高層管理摘要', '為管理層提供關鍵業務指標的簡潔摘要', 'executive_summary', '{"includeKPIs":true,"includeTrends":true}', 'executive', 1, 1, 'system');

-- Integrity indexes (from schema review)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_team_assignments_unique ON customer_team_assignments(platform_user_id, team_id);
CREATE INDEX IF NOT EXISTS idx_task_reminders_conversation_id ON task_reminders(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_recall_logs_message_id ON message_recall_logs(message_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_created_by ON scheduled_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_report_templates_created_by ON report_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_report_download_history_downloaded_by ON report_download_history(downloaded_by);
    `
  }
];

/**
 * Get all migration SQL statements
 */
export function getAllMigrationSQL(): string {
  return BUNDLED_MIGRATIONS.map(m => m.sql).join('\n\n');
}

/**
 * Get migration by version
 */
export function getMigrationByVersion(version: string): MigrationFile | undefined {
  return BUNDLED_MIGRATIONS.find(m => m.version === version);
}

/**
 * Get total number of migrations
 */
export function getMigrationCount(): number {
  return BUNDLED_MIGRATIONS.length;
}
