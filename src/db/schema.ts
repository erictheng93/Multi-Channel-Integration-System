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
});

// Agents table - 客服人員
export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  role: text('role').notNull().default('agent'), // 'admin', 'team', 'agent'
  teamId: integer('team_id').references(() => teams.id), // Foreign key to teams table
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  passwordPolicy: text('password_policy').default('changeable'),
  lastActive: text('last_active'),
  lastLoginAt: text('last_login_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Customers table - 平台客戶資訊表
export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey(),
  platform: text('platform').notNull(), // 'line', 'facebook', etc.
  platformUserId: text('platform_user_id').notNull(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  email: text('email'),
  phone: text('phone'),
  sourceTeamId: integer('source_team_id').references(() => teams.id),
  metadata: text('metadata'), // JSON string for platform-specific data
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  platformUserUnique: unique().on(table.platform, table.platformUserId),
}));

// Conversations table - 對話
export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  assignedTeamId: integer('assigned_team_id').references(() => teams.id),
  assignedUserId: text('assigned_user_id').references(() => agents.id),
  status: text('status').notNull().default('active'), // 'active', 'pending', 'closed'
  priority: text('priority').default('normal'), // 'low', 'normal', 'high', 'urgent'
  firstResponseAt: text('first_response_at'),
  closedAt: text('closed_at'),
  internalNotes: text('internal_notes'),
  lastMessageAt: text('last_message_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Messages table - 訊息
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
  replyToMessageId: text('reply_to_message_id'),
  threadId: text('thread_id'),
  sessionId: text('session_id'),
  sessionSequence: integer('session_sequence').default(1),
  metadata: text('metadata'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
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
export const fileAttachments = sqliteTable('file_attachments', {
  id: text('id').primaryKey(),
  messageId: text('message_id').references(() => messages.id),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSize: integer('file_size').notNull(),
  fileUrl: text('file_url'),
  r2Key: text('r2_key').notNull(),
  url: text('url'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
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
export const conversationTransfers = sqliteTable('conversation_transfers', {
  id: integer('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  fromTeamId: integer('from_team_id').references(() => teams.id),
  toTeamId: integer('to_team_id').references(() => teams.id),
  fromUserId: text('from_user_id').references(() => agents.id),
  toUserId: text('to_user_id').references(() => agents.id),
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