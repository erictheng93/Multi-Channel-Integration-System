import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Customers table - 平台客戶資訊表
export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey({ autoIncrement: true }).notNull(),
  platform: text('platform').notNull(), // 'line', 'facebook', etc.
  platformUserId: text('platform_user_id').notNull(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  email: text('email'),
  phone: text('phone'),
  sourceTeamId: integer('source_team_id'),
  metadata: text('metadata'), // JSON string for platform-specific data
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  // Unique constraint to prevent duplicate platform users
  platformUserUnique: sql`UNIQUE(${table.platform}, ${table.platformUserId})`,
}));

// Teams table - 團隊
export const teams = sqliteTable('teams', {
  id: integer('id').primaryKey({ autoIncrement: true }).notNull(),
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
  teamId: integer('team_id').references(() => teams.id), // Foreign key to teams table - nullable for admins, required for team role
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  passwordPolicy: text('password_policy').default('changeable'), // 'changeable', 'unchangeable', 'must_change'
  lastLoginAt: text('last_login_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  // CHECK constraints for data integrity
  roleCheck: sql`CHECK (${table.role} IN ('admin', 'team', 'agent'))`,
  teamRequiredForNonAdmin: sql`CHECK (${table.teamId} IS NOT NULL OR ${table.role} = 'admin')`,
}));

// Activities table - 活動記錄表（審計追蹤）
export const activities = sqliteTable('activities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
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

// Conversations table - 對話
export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey().notNull(),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  assignedTeamId: integer('assigned_team_id').references(() => teams.id),
  assignedUserId: text('assigned_user_id').references(() => agents.id), // Fixed: TEXT to match agents.id
  status: text('status').notNull().default('active'), // 'active', 'pending', 'closed'
  lastMessageAt: text('last_message_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  // CHECK constraint for status values
  statusCheck: sql`CHECK (${table.status} IN ('active', 'pending', 'closed'))`,
}));

// Messages table - 訊息
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey().notNull(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  senderType: text('sender_type').notNull(), // 'customer', 'agent', 'system'
  customerSenderId: integer('customer_sender_id').references(() => customers.id), // For customer messages
  agentSenderId: text('agent_sender_id').references(() => agents.id), // For agent messages  
  content: text('content').notNull(),
  messageType: text('message_type').notNull().default('text'), // 'text', 'image', 'file', etc.
  platformMessageId: text('platform_message_id'), // Original platform message ID
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
  metadata: text('metadata'), // JSON string for platform-specific data
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  // CHECK constraints for data integrity
  senderTypeCheck: sql`CHECK (${table.senderType} IN ('customer', 'agent', 'system'))`,
  senderConsistencyCheck: sql`CHECK (
    (${table.senderType} = 'customer' AND ${table.customerSenderId} IS NOT NULL AND ${table.agentSenderId} IS NULL) OR
    (${table.senderType} = 'agent' AND ${table.agentSenderId} IS NOT NULL AND ${table.customerSenderId} IS NULL) OR
    (${table.senderType} = 'system' AND ${table.customerSenderId} IS NULL AND ${table.agentSenderId} IS NULL)
  )`,
}));

// File attachments table - 檔案附件
export const fileAttachments = sqliteTable('file_attachments', {
  id: text('id').primaryKey(),
  messageId: text('message_id').notNull().references(() => messages.id),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(),
  fileSize: integer('file_size'),
  r2Key: text('r2_key').notNull(), // R2 storage key
  url: text('url'), // Public URL if available
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
  status: text('status').notNull().default('pending'), // 'pending', 'sent', 'failed', 'cancelled'
  metadata: text('metadata'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Session storage for KV - 這個不需要在 D1 中，但定義型別
export interface SessionData {
  agentId: string;
  role: string;
  loginAt: string;
  expiresAt: string;
}

// Cache data structure for KV
export interface CacheData {
  key: string;
  value: any;
  expiresAt: string;
}

// Export types
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type FileAttachment = typeof fileAttachments.$inferSelect;
export type NewFileAttachment = typeof fileAttachments.$inferInsert;
export type DelayedMessage = typeof delayedMessages.$inferSelect;
export type NewDelayedMessage = typeof delayedMessages.$inferInsert;