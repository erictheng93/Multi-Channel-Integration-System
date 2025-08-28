import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Users table - 統一的用戶表
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  platformId: text('platform_id').notNull(),
  platform: text('platform').notNull(), // 'line', 'facebook', etc.
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  email: text('email'),
  phone: text('phone'),
  metadata: text('metadata'), // JSON string for platform-specific data
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Teams table - 團隊
export const teams = sqliteTable('teams', {
  id: integer('id').primaryKey({ autoIncrement: true }),
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
});

// Invitations table - 邀請表
export const invitations = sqliteTable('invitations', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull(), // 'admin', 'team', 'agent'
  teamId: integer('team_id').references(() => teams.id), // Team assignment for invitation - nullable for admins, required for team role
  token: text('token').notNull().unique(),
  invitedBy: text('invited_by').notNull().references(() => agents.id),
  usedAt: text('used_at'),
  usedBy: text('used_by').references(() => agents.id),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  expiresAt: text('expires_at').notNull(),
});

// Conversations table - 對話
export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  agentId: text('agent_id').references(() => agents.id),
  platform: text('platform').notNull(),
  status: text('status').notNull().default('pending'), // 'pending', 'in-progress', 'closed'
  title: text('title'),
  lastMessageAt: text('last_message_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Messages table - 訊息
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  senderId: text('sender_id').notNull(), // user_id or agent_id
  senderType: text('sender_type').notNull(), // 'user', 'agent'
  messageType: text('message_type').notNull().default('text'), // 'text', 'image', 'file', etc.
  content: text('content').notNull(),
  metadata: text('metadata'), // JSON string for platform-specific data
  platformMessageId: text('platform_message_id'), // Original platform message ID
  replyToken: text('reply_token'), // For LINE reply token
  isRead: integer('is_read', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

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
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type FileAttachment = typeof fileAttachments.$inferSelect;
export type NewFileAttachment = typeof fileAttachments.$inferInsert;
export type DelayedMessage = typeof delayedMessages.$inferSelect;
export type NewDelayedMessage = typeof delayedMessages.$inferInsert;