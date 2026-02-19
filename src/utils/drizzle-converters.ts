/**
 * Drizzle ORM 統一轉換層
 * 解決雙重架構問題，統一字段命名和類型轉換
 * Created: 2025-08-29
 */

import { MESSAGE_STATUS } from '../constants/message-status';
import type { SenderType } from '../constants/sender-types';

import type {
  customers,
  conversations,
  messages,
  agents
} from '../db/schema';
import type {
  Customer,
  DbConversation,
  DbMessage,
  DbUser
} from '../types';
import { nowISO } from '@/utils/timestamp'

// Infer types from schema
type DrizzleCustomer = typeof customers.$inferSelect;
type DrizzleConversation = typeof conversations.$inferSelect;
type DrizzleMessage = typeof messages.$inferSelect;
type DrizzleAgent = typeof agents.$inferSelect;

/**
 * 轉換 Drizzle Customer 到業務邏輯 Customer (camelCase 格式)
 */
export function convertCustomer(drizzleCustomer: DrizzleCustomer): Customer {
  return {
    id: drizzleCustomer.id,
    platform: drizzleCustomer.platform,
    platformUserId: drizzleCustomer.platformUserId || '',
    displayName: drizzleCustomer.displayName || '',
    avatarUrl: drizzleCustomer.avatarUrl || '',
    phone: drizzleCustomer.phone || '',
    email: drizzleCustomer.email || '',
    sourceTeamId: drizzleCustomer.sourceTeamId || 0,
    metadata: drizzleCustomer.metadata || '',
    createdAt: drizzleCustomer.createdAt || nowISO(),
    updatedAt: drizzleCustomer.updatedAt || nowISO()
  };
}

/**
 * 轉換 Drizzle Conversation 到業務邏輯 DbConversation
 * Note: assignedUserId removed - only team assignment is supported now
 */
export function convertConversation(drizzleConversation: DrizzleConversation): DbConversation {
  return {
    id: drizzleConversation.id,
    customerId: drizzleConversation.customerId,
    assignedTeamId: drizzleConversation.assignedTeamId ?? 0,
    status: (drizzleConversation.status || 'active') as DbConversation['status'],
    lastMessageAt: drizzleConversation.lastMessageAt ?? '',
    createdAt: drizzleConversation.createdAt || nowISO(),
    updatedAt: drizzleConversation.updatedAt || nowISO()
  };
}

/**
 * 轉換 Drizzle Message 到業務邏輯 DbMessage
 */
export function convertMessage(drizzleMessage: DrizzleMessage): DbMessage {
  const result: DbMessage = {
    id: drizzleMessage.id,
    conversationId: drizzleMessage.conversationId,
    senderType: drizzleMessage.senderType as SenderType,
    content: drizzleMessage.content,
    messageType: drizzleMessage.messageType as 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker',
    isRecalled: Boolean(drizzleMessage.isRecalled),
    isSent: Boolean(drizzleMessage.isSent),
    deliveryStatus: (drizzleMessage.deliveryStatus as 'pending' | 'sent' | 'delivered' | 'failed') || MESSAGE_STATUS.PENDING,
    createdAt: drizzleMessage.createdAt || nowISO()
  };

  // Handle optional fields with proper undefined assignment for exactOptionalPropertyTypes
  if (drizzleMessage.customerSenderId !== null && drizzleMessage.customerSenderId !== undefined) {
    result.customerSenderId = drizzleMessage.customerSenderId;
  }

  if (drizzleMessage.agentSenderId !== null && drizzleMessage.agentSenderId !== undefined) {
    result.agentSenderId = drizzleMessage.agentSenderId;
  }

  if (drizzleMessage.platformMessageId !== null && drizzleMessage.platformMessageId !== undefined) {
    result.platformMessageId = drizzleMessage.platformMessageId;
  }

  if (drizzleMessage.recallDeadline !== null && drizzleMessage.recallDeadline !== undefined) {
    result.recallDeadline = drizzleMessage.recallDeadline;
  }

  if (drizzleMessage.recalledAt !== null && drizzleMessage.recalledAt !== undefined) {
    result.recalledAt = drizzleMessage.recalledAt;
  }

  if (drizzleMessage.sentAt !== null && drizzleMessage.sentAt !== undefined) {
    result.sentAt = drizzleMessage.sentAt;
  }

  if (drizzleMessage.replyToMessageId !== null && drizzleMessage.replyToMessageId !== undefined) {
    result.replyToMessageId = drizzleMessage.replyToMessageId;
  }

  if (drizzleMessage.threadId !== null && drizzleMessage.threadId !== undefined) {
    result.threadId = drizzleMessage.threadId;
  }

  if (drizzleMessage.sessionId !== null && drizzleMessage.sessionId !== undefined) {
    result.sessionId = drizzleMessage.sessionId;
  }

  if (drizzleMessage.sessionSequence !== null && drizzleMessage.sessionSequence !== undefined) {
    result.sessionSequence = drizzleMessage.sessionSequence;
  }

  if (drizzleMessage.metadata !== null && drizzleMessage.metadata !== undefined) {
    result.metadata = drizzleMessage.metadata;
  }

  return result;
}

/**
 * 轉換 Drizzle Agent 到業務邏輯 DbUser
 */
export function convertAgent(drizzleAgent: DrizzleAgent, teamName?: string, primaryTeamId?: number | null): DbUser {
  return {
    id: drizzleAgent.id,
    email: drizzleAgent.email,
    displayName: drizzleAgent.displayName,
    role: drizzleAgent.role as 'admin' | 'agent',
    primaryTeamId: primaryTeamId ?? null,
    teamName: teamName || null,
    isActive: Boolean(drizzleAgent.isActive),
    createdAt: drizzleAgent.createdAt || nowISO(),
    updatedAt: drizzleAgent.updatedAt || nowISO()
  };
}

/**
 * 批量轉換函數
 */
export function convertCustomers(drizzleCustomers: any[]): Customer[] {
  return drizzleCustomers.map(convertCustomer);
}

export function convertConversations(drizzleConversations: any[]): DbConversation[] {
  return drizzleConversations.map(convertConversation);
}

export function convertMessages(drizzleMessages: any[]): DbMessage[] {
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
}): Omit<any, 'id'> {
  const timestamp = nowISO();
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
  // Note: assignedUserId removed - only team assignment is supported now
}): any {
  const timestamp = nowISO();
  return {
    id: conversationData.id,
    customerId: conversationData.customerId,
    assignedTeamId: conversationData.assignedTeamId || null,
    status: conversationData.status || 'active',
    lastMessageAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function prepareMessageInsert(messageData: {
  id: string;
  conversationId: string;
  senderType: SenderType;
  customerSenderId?: number;
  agentSenderId?: string;
  content: string;
  messageType?: string;
  platformMessageId?: string;
  isSent?: boolean;
  metadata?: string;
}): any {
  const timestamp = nowISO();
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
    deliveryStatus: messageData.isSent !== false ? MESSAGE_STATUS.SENT : MESSAGE_STATUS.PENDING,
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