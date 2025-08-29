/**
 * Drizzle ORM 統一轉換層
 * 解決雙重架構問題，統一字段命名和類型轉換
 * Created: 2025-08-29
 */

import type { 
  Customer as DrizzleCustomer,
  Conversation as DrizzleConversation, 
  Message as DrizzleMessage,
  Agent as DrizzleAgent
} from '../db/schema';
import type { 
  Customer, 
  DbConversation, 
  DbMessage, 
  DbUser 
} from '../types';

/**
 * 轉換 Drizzle Customer 到業務邏輯 Customer
 */
export function convertCustomer(drizzleCustomer: DrizzleCustomer): Customer {
  return {
    id: drizzleCustomer.id,
    platform: drizzleCustomer.platform,
    platform_user_id: drizzleCustomer.platformUserId || '',
    display_name: drizzleCustomer.displayName || '',
    avatar_url: drizzleCustomer.avatarUrl || '',
    phone: drizzleCustomer.phone || '',
    email: drizzleCustomer.email || '',
    source_team_id: drizzleCustomer.sourceTeamId || 0,
    metadata: drizzleCustomer.metadata || '',
    created_at: drizzleCustomer.createdAt || new Date().toISOString(),
    updated_at: drizzleCustomer.updatedAt || new Date().toISOString()
  };
}

/**
 * 轉換 Drizzle Conversation 到業務邏輯 DbConversation
 */
export function convertConversation(drizzleConversation: DrizzleConversation): DbConversation {
  return {
    id: drizzleConversation.id,
    customerId: drizzleConversation.customerId,
    assignedTeamId: drizzleConversation.assignedTeamId ?? 0,
    assignedUserId: drizzleConversation.assignedUserId ?? '',
    status: drizzleConversation.status as 'active' | 'closed' | 'pending',
    lastMessageAt: drizzleConversation.lastMessageAt ?? '',
    createdAt: drizzleConversation.createdAt || new Date().toISOString(),
    updatedAt: drizzleConversation.updatedAt || new Date().toISOString()
  };
}

/**
 * 轉換 Drizzle Message 到業務邏輯 DbMessage
 */
export function convertMessage(drizzleMessage: DrizzleMessage): DbMessage {
  return {
    id: drizzleMessage.id,
    conversationId: drizzleMessage.conversationId,
    senderType: drizzleMessage.senderType as 'customer' | 'agent' | 'system',
    customerSenderId: drizzleMessage.customerSenderId ?? 0,
    agentSenderId: drizzleMessage.agentSenderId ?? '',
    content: drizzleMessage.content,
    messageType: drizzleMessage.messageType as 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker',
    platformMessageId: drizzleMessage.platformMessageId || '',
    isRecalled: Boolean(drizzleMessage.isRecalled),
    recallDeadline: drizzleMessage.recallDeadline || '',
    recalledAt: drizzleMessage.recalledAt || '',
    isSent: Boolean(drizzleMessage.isSent),
    sentAt: drizzleMessage.sentAt || '',
    deliveryStatus: (drizzleMessage.deliveryStatus as 'pending' | 'sent' | 'delivered' | 'failed') || 'pending',
    replyToMessageId: drizzleMessage.replyToMessageId || '',
    threadId: drizzleMessage.threadId || '',
    sessionId: drizzleMessage.sessionId || '',
    sessionSequence: drizzleMessage.sessionSequence || 1,
    metadata: drizzleMessage.metadata || '',
    createdAt: drizzleMessage.createdAt || new Date().toISOString()
  };
}

/**
 * 轉換 Drizzle Agent 到業務邏輯 DbUser
 */
export function convertAgent(drizzleAgent: DrizzleAgent, teamName?: string): DbUser {
  return {
    id: drizzleAgent.id,
    email: drizzleAgent.email,
    displayName: drizzleAgent.displayName,
    role: drizzleAgent.role as 'admin' | 'team' | 'agent',
    teamId: drizzleAgent.teamId,
    teamName: teamName || null,
    isActive: Boolean(drizzleAgent.isActive),
    createdAt: drizzleAgent.createdAt || new Date().toISOString(),
    updatedAt: drizzleAgent.updatedAt || new Date().toISOString()
  };
}

/**
 * 批量轉換函數
 */
export function convertCustomers(drizzleCustomers: DrizzleCustomer[]): Customer[] {
  return drizzleCustomers.map(convertCustomer);
}

export function convertConversations(drizzleConversations: DrizzleConversation[]): DbConversation[] {
  return drizzleConversations.map(convertConversation);
}

export function convertMessages(drizzleMessages: DrizzleMessage[]): DbMessage[] {
  return drizzleMessages.map(convertMessage);
}

/**
 * 創建新記錄的轉換工具（業務邏輯到 Drizzle 插入格式）
 */
export function prepareCustomerInsert(customerData: {
  platform: string;
  platformUserId: string;
  displayName?: string;
  avatarUrl?: string;
  phone?: string;
  email?: string;
  sourceTeamId?: number;
  metadata?: string;
}): Omit<DrizzleCustomer, 'id'> {
  const timestamp = new Date().toISOString();
  return {
    platform: customerData.platform,
    platformUserId: customerData.platformUserId,
    displayName: customerData.displayName || null,
    avatarUrl: customerData.avatarUrl || null,
    phone: customerData.phone || null,
    email: customerData.email || null,
    sourceTeamId: customerData.sourceTeamId || null,
    metadata: customerData.metadata || null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function prepareConversationInsert(conversationData: {
  id: string;
  customerId: number;
  status?: string;
  assignedTeamId?: number;
  assignedUserId?: string;
}): DrizzleConversation {
  const timestamp = new Date().toISOString();
  return {
    id: conversationData.id,
    customerId: conversationData.customerId,
    assignedTeamId: conversationData.assignedTeamId || null,
    assignedUserId: conversationData.assignedUserId || null,
    status: conversationData.status || 'active',
    lastMessageAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function prepareMessageInsert(messageData: {
  id: string;
  conversationId: string;
  senderType: 'customer' | 'agent' | 'system';
  customerSenderId?: number;
  agentSenderId?: string;
  content: string;
  messageType?: string;
  platformMessageId?: string;
  isSent?: boolean;
  metadata?: string;
}): DrizzleMessage {
  const timestamp = new Date().toISOString();
  return {
    id: messageData.id,
    conversationId: messageData.conversationId,
    senderType: messageData.senderType,
    customerSenderId: messageData.customerSenderId || null,
    agentSenderId: messageData.agentSenderId || null,
    content: messageData.content,
    messageType: messageData.messageType || 'text',
    platformMessageId: messageData.platformMessageId || null,
    isRecalled: false,
    recallDeadline: null,
    recalledAt: null,
    isSent: messageData.isSent !== undefined ? messageData.isSent : true,
    sentAt: messageData.isSent !== false ? timestamp : null,
    deliveryStatus: messageData.isSent !== false ? 'sent' : 'pending',
    replyToMessageId: null,
    threadId: null,
    sessionId: null,
    sessionSequence: 1,
    metadata: messageData.metadata || null,
    createdAt: timestamp
  };
}

/**
 * 驗證和清理數據的工具函數
 */
export function sanitizeString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
}

export function sanitizeNumber(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
}

export function sanitizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    return lower === 'true' || lower === '1' || lower === 'yes';
  }
  return false;
}