import { sqliteTable, text, integer, real, primaryKey, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Teams table - 團隊
export const teams = sqliteTable('teams', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  qrCode: text('qr_code'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text('deleted_at'), // Soft delete (Migration 0027)
});

// Agents table - 客服人員
// ENCRYPTION NOTE: passwordHash uses bcrypt (not reversible encryption)
export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(), // 🔐 Bcrypt hashed
  displayName: text('display_name').notNull(),
  role: text('role').notNull().default('agent'), // 'admin', 'agent' (simplified from 3-tier to 2-tier system)
  teamId: integer('team_id').references(() => teams.id), // @deprecated Use agent_teams for multi-team support (kept for backward compatibility as primary team)
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  passwordPolicy: text('password_policy').default('changeable'),
  lastActive: text('last_active'),
  lastLoginAt: text('last_login_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text('deleted_at'), // Soft delete (Migration 0027)
});

// Agent Teams junction table - 客服人員與團隊的多對多關係 (Migration 0028)
// Allows agents to belong to unlimited teams simultaneously
export const agentTeams = sqliteTable('agent_teams', {
  id: integer('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  roleInTeam: text('role_in_team').default('member'), // 'member', 'lead', 'supervisor'
  isPrimary: integer('is_primary', { mode: 'boolean' }).default(false), // Is this the agent's primary team?
  joinedAt: text('joined_at').default(sql`CURRENT_TIMESTAMP`),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  agentTeamUnique: unique().on(table.agentId, table.teamId), // Prevent duplicate memberships
}));

// Customers table - 平台客戶資訊表
// ENCRYPTION NOTE: Consider encrypting email, phone, metadata for PII protection
export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey(),
  platform: text('platform').notNull(), // 'line', 'facebook', etc.
  platformUserId: text('platform_user_id').notNull(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  email: text('email'), // 📋 Consider encryption for PII
  phone: text('phone'), // 📋 Consider encryption for PII
  sourceTeamId: integer('source_team_id').references(() => teams.id),
  metadata: text('metadata'), // JSON string for platform-specific data (📋 may contain PII)
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text('deleted_at'), // Soft delete (Migration 0027)
}, (table) => ({
  platformUserUnique: unique().on(table.platform, table.platformUserId),
}));

// QR Codes table - QR碼管理
export const qrCodes = sqliteTable('qr_codes', {
  id: text('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id),
  token: text('token').notNull().unique(),
  lineUrl: text('line_url').notNull(),
  qrCodeImageUrl: text('qr_code_image_url').notNull(),
  campaignName: text('campaign_name'),
  description: text('description'),
  usageCount: integer('usage_count').default(0),
  maxUses: integer('max_uses'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// QR Code Scans table - 掃描記錄
export const qrCodeScans = sqliteTable('qr_code_scans', {
  id: text('id').primaryKey(),
  qrCodeId: text('qr_code_id').notNull().references(() => qrCodes.id),
  customerId: integer('customer_id').references(() => customers.id),
  platform: text('platform').notNull(),
  platformUserId: text('platform_user_id'),
  scanMetadata: text('scan_metadata'),
  scannedAt: text('scanned_at').default(sql`CURRENT_TIMESTAMP`),
});

// QR Code Analytics table - 分析統計
export const qrCodeAnalytics = sqliteTable('qr_code_analytics', {
  id: integer('id').primaryKey(),
  qrCodeId: text('qr_code_id').notNull().references(() => qrCodes.id),
  date: text('date').notNull(),
  totalScans: integer('total_scans').default(0),
  uniqueScans: integer('unique_scans').default(0),
  newCustomers: integer('new_customers').default(0),
  returningCustomers: integer('returning_customers').default(0),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  qrCodeDateUnique: unique().on(table.qrCodeId, table.date),
}));

// Conversations table - 對話
export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  assignedTeamId: integer('assigned_team_id').references(() => teams.id),
  // Note: assignedUserId removed - only team assignment is supported now
  status: text('status').notNull().default('active'), // 'active', 'assigned', 'pending', 'in-progress', 'waiting'
  priority: text('priority').default('normal'), // 'low', 'normal', 'high', 'urgent'
  firstResponseAt: text('first_response_at'),
  closedAt: text('closed_at'),
  internalNotes: text('internal_notes'),
  lastMessageAt: text('last_message_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text('deleted_at'), // Soft delete (Migration 0027)
});

// Messages table - 訊息
// NOTE: replyToMessageId is a self-reference to messages.id
// Foreign key constraint is enforced at application layer (see message-crud.ts)
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  senderType: text('sender_type').notNull(), // 'customer', 'agent', 'system'
  customerSenderId: integer('customer_sender_id').references(() => customers.id),
  agentSenderId: text('agent_sender_id').references(() => agents.id),
  content: text('content').notNull(),
  messageType: text('message_type').notNull().default('text'),
  platformMessageId: text('platform_message_id'),
  isRecalled: integer('is_recalled', { mode: 'boolean' }).default(false),
  recallDeadline: text('recall_deadline'),
  recalledAt: text('recalled_at'),
  isSent: integer('is_sent', { mode: 'boolean' }).default(true),
  sentAt: text('sent_at'),
  deliveryStatus: text('delivery_status').default('delivered'),
  replyToMessageId: text('reply_to_message_id'), // Self-reference to messages.id (app-level FK)
  threadId: text('thread_id'),
  sessionId: text('session_id'),
  sessionSequence: integer('session_sequence').default(1),
  metadata: text('metadata'),
  senderName: text('sender_name'), // 發送者名稱快照（持久化保存，不受帳號刪除或更名影響）
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text('deleted_at'), // Soft delete (Migration 0027)
});

// Delayed messages table - 延遲訊息
export const delayedMessages = sqliteTable('delayed_messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  agentId: text('agent_id').notNull().references(() => agents.id),
  content: text('content').notNull(),
  messageType: text('message_type').notNull().default('text'),
  scheduledAt: text('scheduled_at').notNull(),
  sentAt: text('sent_at'),
  cancelledAt: text('cancelled_at'),
  status: text('status').notNull().default('pending'),
  metadata: text('metadata'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// File attachments table - 檔案附件表
// NOTE: Database columns use camelCase (mimeType, fileSize, fileUrl, r2Key, uploadStatus)
// Schema must match actual database column names for Drizzle ORM to work correctly
export const fileAttachments = sqliteTable('file_attachments', {
  id: text('id').primaryKey(),
  messageId: text('message_id').references(() => messages.id),
  conversationId: text('conversation_id').references(() => conversations.id),
  filename: text('filename').notNull(),
  mimeType: text('mimeType').notNull(), // 🔧 FIX: Match actual DB column (camelCase)
  fileSize: integer('fileSize').notNull(), // 🔧 FIX: Match actual DB column (camelCase)
  fileUrl: text('fileUrl'), // 🔧 FIX: Match actual DB column (camelCase) - 公開訪問URL
  r2Key: text('r2Key').notNull(), // 🔧 FIX: Match actual DB column (camelCase)
  url: text('url'), // Legacy column - exists in DB
  uploadStatus: text('uploadStatus').default('completed'), // 🔧 FIX: Match actual DB column (camelCase)
  uploadedBy: text('uploaded_by'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at'),
});

// Conversation sessions table - 對話會話管理
export const conversationSessions = sqliteTable('conversation_sessions', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  sessionType: text('session_type').notNull().default('continuous'),
  topic: text('topic'),
  startTime: text('start_time').notNull(),
  endTime: text('end_time'),
  lastActivity: text('last_activity').notNull(),
  messageCount: integer('message_count').default(0),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Conversation transfers table - 對話轉移記錄
// Note: fromUserId/toUserId removed - only team-based transfers are supported now
export const conversationTransfers = sqliteTable('conversation_transfers', {
  id: integer('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  fromTeamId: integer('from_team_id').references(() => teams.id),
  toTeamId: integer('to_team_id').references(() => teams.id),
  transferReason: text('transfer_reason'),
  transferredBy: text('transferred_by').notNull().references(() => agents.id),
  transferType: text('transfer_type').default('manual'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Message recall logs table - 訊息撤回日誌
export const messageRecallLogs = sqliteTable('message_recall_logs', {
  id: integer('id').primaryKey(),
  messageId: text('message_id').notNull(),
  userId: text('user_id').notNull().references(() => agents.id),
  action: text('action').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Notifications table - 通知系統
export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => agents.id),
  type: text('type').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  data: text('data'),
  isRead: integer('is_read', { mode: 'boolean' }).default(false),
  readAt: text('read_at'),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Tags table - 標籤系統
export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#3B82F6'),
  description: text('description'),
  teamId: integer('team_id').references(() => teams.id),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdBy: text('created_by').notNull().references(() => agents.id),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text('deleted_at'), // Soft delete (Migration 0027)
}, (table) => ({
  nameTeamUnique: unique().on(table.name, table.teamId),
}));

// Customer tags junction table - 客戶標籤關聯
export const customerTags = sqliteTable('customer_tags', {
  customerId: integer('customer_id').notNull().references(() => customers.id),
  tagId: integer('tag_id').notNull().references(() => tags.id),
  assignedBy: text('assigned_by').notNull().references(() => agents.id),
  assignedAt: text('assigned_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  pk: primaryKey({ columns: [table.customerId, table.tagId] }),
}));

// Conversation tags junction table - 對話標籤關聯
export const conversationTags = sqliteTable('conversation_tags', {
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  tagId: integer('tag_id').notNull().references(() => tags.id),
  assignedBy: text('assigned_by').notNull().references(() => agents.id),
  assignedAt: text('assigned_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  pk: primaryKey({ columns: [table.conversationId, table.tagId] }),
}));

// Activities table - 活動記錄表（審計追蹤）
export const activities = sqliteTable('activities', {
  id: integer('id').primaryKey(),
  userId: text('user_id').notNull().references(() => agents.id),
  userName: text('user_name').notNull(),
  userRole: text('user_role').notNull(),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id'),
  details: text('details'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// System settings table - 系統設定表
export const systemSettings = sqliteTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Metrics table - 企業分析指標
export const metrics = sqliteTable('metrics', {
  id: integer('id').primaryKey(),
  metricName: text('metric_name').notNull(),
  metricValue: real('metric_value').notNull(),
  timestamp: integer('timestamp').notNull(),
  tags: text('tags'), // JSON string for additional tags
  unit: text('unit'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Channel Integrations table - 渠道集成配置（多租户支持）
// NOTE: Migration 0026 introduced JSON-based configuration for extensibility
// Legacy platform-specific columns are preserved for backward compatibility
export const channelIntegrations = sqliteTable('channel_integrations', {
  id: integer('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id),

  // Channel type
  platform: text('platform').notNull(), // 'line', 'facebook', 'whatsapp', 'telegram', etc.

  // ==================== NEW JSON-based Configuration (Migration 0026) ====================
  // Platform-specific configuration (non-sensitive)
  // LINE: { channelId: "xxx" }
  // FB: { pageId: "xxx" }
  // WA: { phoneNumber: "xxx", businessAccountId: "xxx" }
  config: text('config'), // JSON

  // Encrypted sensitive credentials
  // LINE: { accessToken: "encrypted", secret: "encrypted" }
  // FB: { accessToken: "encrypted", appSecret: "encrypted" }
  // WA: { accessToken: "encrypted" }
  credentials: text('credentials'), // JSON (encrypted)

  // Unified webhook configuration
  // { url: "https://...", token: "uuid" }
  webhookConfig: text('webhook_config'), // JSON

  // Consolidated usage statistics
  // { totalSent: 0, totalReceived: 0, lastMessageAt: "timestamp" }
  stats: text('stats'), // JSON

  // ==================== LEGACY columns (deprecated, to be removed in 0027+) ====================
  // @deprecated Use config.channelId instead
  lineChannelId: text('line_channel_id'),
  // @deprecated Use credentials.accessToken instead
  lineChannelAccessToken: text('line_channel_access_token'),
  // @deprecated Use credentials.secret instead
  lineChannelSecret: text('line_channel_secret'),
  // @deprecated Use webhookConfig.url instead
  lineWebhookUrl: text('line_webhook_url'),
  // @deprecated Use webhookConfig.token instead
  lineWebhookToken: text('line_webhook_token'),

  // @deprecated Use config.pageId instead
  facebookPageId: text('facebook_page_id'),
  // @deprecated Use credentials.accessToken instead
  facebookAccessToken: text('facebook_access_token'),
  // @deprecated Use credentials.appSecret instead
  facebookAppSecret: text('facebook_app_secret'),

  // @deprecated Use config.phoneNumber and config.businessAccountId instead
  whatsappPhoneNumber: text('whatsapp_phone_number'),
  whatsappBusinessAccountId: text('whatsapp_business_account_id'),
  // @deprecated Use credentials.accessToken instead
  whatsappAccessToken: text('whatsapp_access_token'),

  // @deprecated Use stats.totalSent instead
  totalMessagesSent: integer('total_messages_sent').default(0),
  // @deprecated Use stats.totalReceived instead
  totalMessagesReceived: integer('total_messages_received').default(0),
  // @deprecated Use stats.lastMessageAt instead
  lastMessageAt: text('last_message_at'),
  // ==================== End of LEGACY columns ====================

  // Configuration status
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  isVerified: integer('is_verified', { mode: 'boolean' }).default(false),
  lastVerifiedAt: text('last_verified_at'),

  // Configuration metadata
  configuredBy: text('configured_by').references(() => agents.id),
  configMetadata: text('config_metadata'), // JSON

  // Error tracking
  lastError: text('last_error'), // JSON
  errorCount: integer('error_count').default(0),

  // Timestamps
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Webhook Security Events table - 安全事件記錄
export const webhookSecurityEvents = sqliteTable('webhook_security_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  severity: text('severity', {
    enum: ['low', 'medium', 'high', 'critical']
  }).notNull(),
  platform: text('platform').notNull(),
  integrationId: integer('integration_id').references(() => channelIntegrations.id, {
    onDelete: 'cascade'
  }),
  sourceIp: text('source_ip'),
  details: text('details'), // JSON string
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`)
});

export type WebhookSecurityEvent = typeof webhookSecurityEvents.$inferSelect;
export type NewWebhookSecurityEvent = typeof webhookSecurityEvents.$inferInsert;

// CORS Events table - CORS 事件記錄
export const corsEvents = sqliteTable('cors_events', {
  id: text('id').primaryKey(),
  type: text('type', {
    enum: ['allowed', 'rejected', 'preflight', 'sse_connection', 'credentials_used']
  }).notNull(),
  origin: text('origin').notNull(),
  method: text('method'),
  path: text('path'),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  timestamp: text('timestamp').notNull().default(sql`(datetime('now'))`),
  metadata: text('metadata') // JSON string
});

export type CORSEvent = typeof corsEvents.$inferSelect;
export type NewCORSEvent = typeof corsEvents.$inferInsert;

// Type definitions
export interface SessionData {
  userId: string;
  username: string;
  role: string;
  teamId?: number;
  expiresAt: number;
}

export interface CacheData {
  key: string;
  value: any;
  expiresAt: string;
}

export type NewTeam = typeof teams.$inferInsert;
export type NewConversationTransfer = typeof conversationTransfers.$inferInsert;
export type NewCustomer = typeof customers.$inferInsert;
export type NewConversation = typeof conversations.$inferInsert;
export type Agent = typeof agents.$inferSelect;

// ======================== Reports System Tables ========================

// Reports main table - 報告系統主表
export const reports = sqliteTable('reports', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  type: text('type').notNull(), // 'conversation_summary', 'agent_performance', etc.
  format: text('format').notNull(), // 'json', 'csv', 'excel', 'pdf', 'html'
  status: text('status').notNull().default('pending'), // 'pending', 'generating', 'completed', 'failed'

  // Ownership
  createdBy: text('created_by').notNull(),
  teamId: integer('team_id').references(() => teams.id),

  // Metadata
  timeRange: text('time_range'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  filters: text('filters'), // JSON string
  options: text('options'), // JSON string

  // Generation tracking
  generationStartedAt: text('generation_started_at'),
  completedAt: text('completed_at'),
  failedAt: text('failed_at'),
  errorMessage: text('error_message'),
  executionTime: integer('execution_time'), // seconds

  // File information
  downloadUrl: text('download_url'),
  fileSize: integer('file_size'), // bytes
  fileHash: text('file_hash'),

  // Lifecycle
  downloadedCount: integer('downloaded_count').default(0),
  lastDownloadedAt: text('last_downloaded_at'),
  expiresAt: text('expires_at'),
  deletedAt: text('deleted_at'),

  // Timestamps
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Scheduled reports table - 排程報告表
export const scheduledReports = sqliteTable('scheduled_reports', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),

  // Report configuration
  reportType: text('report_type').notNull(),
  reportFormat: text('report_format').notNull().default('excel'),
  reportParams: text('report_params').notNull(), // JSON string

  // Schedule configuration
  scheduleType: text('schedule_type').notNull(), // 'daily', 'weekly', 'monthly', 'custom'
  scheduleConfig: text('schedule_config').notNull(), // JSON string
  timezone: text('timezone').default('UTC'),

  // Execution settings
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  maxRetries: integer('max_retries').default(3),
  retryDelayMinutes: integer('retry_delay_minutes').default(30),

  // Ownership
  createdBy: text('created_by').notNull(),
  teamId: integer('team_id').references(() => teams.id),

  // Notification
  notifyOnCompletion: integer('notify_on_completion', { mode: 'boolean' }).default(true),
  notifyOnFailure: integer('notify_on_failure', { mode: 'boolean' }).default(true),
  notificationEmails: text('notification_emails'), // JSON array

  // Lifecycle
  nextExecutionAt: text('next_execution_at'),
  lastExecutionAt: text('last_execution_at'),
  lastExecutionStatus: text('last_execution_status'),
  executionCount: integer('execution_count').default(0),

  // Timestamps
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text('deleted_at'),
});

// Scheduled report executions table - 排程執行歷史表
export const scheduledReportExecutions = sqliteTable('scheduled_report_executions', {
  id: text('id').primaryKey(),
  scheduledReportId: text('scheduled_report_id').notNull().references(() => scheduledReports.id),

  // Execution details
  executionStartedAt: text('execution_started_at').notNull(),
  executionCompletedAt: text('execution_completed_at'),
  executionStatus: text('execution_status').notNull(), // 'running', 'success', 'failed', 'cancelled'
  executionDuration: integer('execution_duration'), // seconds

  // Result
  generatedReportId: text('generated_report_id').references(() => reports.id),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').default(0),

  // Timestamps
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Report download history table - 報告下載歷史表
export const reportDownloadHistory = sqliteTable('report_download_history', {
  id: text('id').primaryKey(),
  reportId: text('report_id').notNull().references(() => reports.id),

  // Download details
  downloadedBy: text('downloaded_by').notNull(),
  downloadedAt: text('downloaded_at').default(sql`CURRENT_TIMESTAMP`),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),

  // Download method
  downloadMethod: text('download_method'), // 'manual', 'scheduled', 'api'
  downloadSize: integer('download_size'), // bytes

  // Timestamps
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Report templates table - 報告模板表
export const reportTemplates = sqliteTable('report_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),

  // Template configuration
  reportType: text('report_type').notNull(),
  templateConfig: text('template_config').notNull(), // JSON string
  previewImageUrl: text('preview_image_url'),

  // Categorization
  category: text('category'), // 'operational', 'analytical', 'executive', 'compliance'
  tags: text('tags'), // JSON array

  // Usage tracking
  isSystemTemplate: integer('is_system_template', { mode: 'boolean' }).default(false),
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  createdBy: text('created_by').notNull(),
  teamId: integer('team_id').references(() => teams.id),

  // Popularity
  usageCount: integer('usage_count').default(0),
  lastUsedAt: text('last_used_at'),

  // Timestamps
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text('deleted_at'),
});

// Task Reminders table - 任務提醒 (Migration 0029)
export const taskReminders = sqliteTable('task_reminders', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content'),
  remindAt: text('remind_at').notNull(),
  conversationId: text('conversation_id'),
  repeatType: text('repeat_type').default('none'), // 'none', 'daily', 'weekly', 'monthly'
  repeatInterval: integer('repeat_interval').default(0),
  isCompleted: integer('is_completed', { mode: 'boolean' }).default(false),
  isSent: integer('is_sent', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  completedAt: text('completed_at'),
  sentAt: text('sent_at'),
});

// Customer Feedback table - 客户满意度反馈 (Migration 0032)
export const customerFeedback = sqliteTable('customer_feedback', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  customerId: integer('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
  rating: integer('rating').notNull(), // 1-5 stars, enforced by CHECK in migration
  comment: text('comment'),
  feedbackType: text('feedback_type').default('satisfaction'), // 'satisfaction', 'service_quality', 'response_time'
  metadata: text('metadata'), // JSON string for additional info
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// ======================== LIFF Team QR Code System (Migrations 0031+) ========================

// Team LIFF QR Codes table - 團隊 LIFF QR Code (Migration 0031 - pending)
// Stores persistent LIFF URLs and QR Code images for team member onboarding
export const teamLiffQrCodes = sqliteTable('team_liff_qr_codes', {
  id: text('id').primaryKey(),
  teamId: integer('team_id').notNull().unique().references(() => teams.id, { onDelete: 'cascade' }),
  liffUrl: text('liff_url').notNull(), // Full LIFF URL with team parameter
  qrCodeUrl: text('qr_code_url').notNull(), // QR Code image URL (R2)
  scanCount: integer('scan_count').default(0),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Customer Team Assignments table - 客戶團隊分配記錄 (Migration 0031)
// Tracks customer team assignments from LIFF QR Code scans (recorded BEFORE friend status)
export const customerTeamAssignments = sqliteTable('customer_team_assignments', {
  id: text('id').primaryKey(),
  platformUserId: text('platform_user_id').notNull(), // LINE User ID (U...)
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  qrCodeId: text('qr_code_id').references(() => teamLiffQrCodes.id, { onDelete: 'set null' }),
  source: text('source').default('liff_qr'), // 'liff_qr', 'manual', 'import', 'webhook'
  displayName: text('display_name'),
  assignedAt: text('assigned_at').default(sql`CURRENT_TIMESTAMP`),
  metadata: text('metadata'), // JSON: additional info
});

// Export types for reports system
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type ScheduledReport = typeof scheduledReports.$inferSelect;
export type NewScheduledReport = typeof scheduledReports.$inferInsert;
export type ScheduledReportExecution = typeof scheduledReportExecutions.$inferSelect;
export type NewScheduledReportExecution = typeof scheduledReportExecutions.$inferInsert;
export type ReportDownloadHistory = typeof reportDownloadHistory.$inferSelect;
export type NewReportDownloadHistory = typeof reportDownloadHistory.$inferInsert;
export type ReportTemplate = typeof reportTemplates.$inferSelect;
export type NewReportTemplate = typeof reportTemplates.$inferInsert;

// Export types for task reminders (Migration 0029)
export type TaskReminder = typeof taskReminders.$inferSelect;
export type NewTaskReminder = typeof taskReminders.$inferInsert;

// Export types for agent teams (multi-team membership)
export type AgentTeam = typeof agentTeams.$inferSelect;
export type NewAgentTeam = typeof agentTeams.$inferInsert;

// Export types for LIFF team QR Code system (Migrations 0030-0031)
export type TeamLiffQrCode = typeof teamLiffQrCodes.$inferSelect;
export type NewTeamLiffQrCode = typeof teamLiffQrCodes.$inferInsert;
export type CustomerTeamAssignment = typeof customerTeamAssignments.$inferSelect;
export type NewCustomerTeamAssignment = typeof customerTeamAssignments.$inferInsert;