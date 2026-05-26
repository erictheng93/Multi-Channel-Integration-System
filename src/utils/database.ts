import { eq, and, desc, asc, count } from 'drizzle-orm';
import { createDbClient } from '../db/drizzle-factory';
import {
  customers,
  conversations,
  messages,
  systemSettings
} from '../db/schema';
import { createContextLogger } from './logger';
import { SENDER_TYPES, type SenderType } from '../constants/sender-types';
import { 
  convertCustomer,
  convertConversation,
  convertMessage,
  // prepareCustomerInsert,
  // prepareConversationInsert,
  // prepareMessageInsert
} from './drizzle-converters';
import type {
  Customer,
  DbConversation,
  DbMessage,
  QueryParams,
  CustomerMetadata
} from '../types';
import { validateReplyToMessageId } from './validate-reply-to';
import { nowISO } from '@/utils/timestamp'

/**
 * 尋找或建立客戶 (增強版 - 收集更多客戶資訊)
 */
export async function findOrCreateCustomer(
  db: D1Database, 
  platform: string, 
  platformUserId: string,
  additionalInfo?: {
    displayName?: string;
    avatarUrl?: string;
    phone?: string;
    email?: string;
    sourceTeamId?: number;
    metadata?: CustomerMetadata;
  }
): Promise<Customer> {
  const timestamp = nowISO();
  const drizzleDb = createDbClient(db);
  
  // 先嘗試找到現有客戶
  const existingCustomer = await drizzleDb
    .select()
    .from(customers)
    .where(and(
      eq(customers.platform, platform),
      eq(customers.platformUserId, platformUserId)
    ))
    .get();

  if (existingCustomer) {
    // 如果客戶已存在，但有新的資訊要更新
    if (additionalInfo) {
      const updateFields: string[] = [];
      const updateValues: QueryParams = [];
      
      if (additionalInfo.displayName && additionalInfo.displayName !== existingCustomer.displayName) {
        updateFields.push('display_name = ?');
        updateValues.push(additionalInfo.displayName);
      }
      
      if (additionalInfo.avatarUrl && additionalInfo.avatarUrl !== existingCustomer.avatarUrl) {
        updateFields.push('avatar_url = ?');
        updateValues.push(additionalInfo.avatarUrl);
      }
      
      if (additionalInfo.phone && additionalInfo.phone !== existingCustomer.phone) {
        updateFields.push('phone = ?');
        updateValues.push(additionalInfo.phone);
      }
      
      if (additionalInfo.email && additionalInfo.email !== existingCustomer.email) {
        updateFields.push('email = ?');
        updateValues.push(additionalInfo.email);
      }
      
      if (additionalInfo.metadata) {
        const existingMetadata = existingCustomer.metadata ? JSON.parse(existingCustomer.metadata) : {};
        const mergedMetadata = { ...existingMetadata, ...additionalInfo.metadata };
        updateFields.push('metadata = ?');
        updateValues.push(JSON.stringify(mergedMetadata));
      }
      
      // 如果有需要更新的欄位
      if (updateFields.length > 0) {
        const updateData: Partial<typeof customers.$inferInsert> = {
          updatedAt: timestamp
        };
        
        if (additionalInfo.displayName) updateData.displayName = additionalInfo.displayName;
        if (additionalInfo.avatarUrl) updateData.avatarUrl = additionalInfo.avatarUrl;
        if (additionalInfo.phone) updateData.phone = additionalInfo.phone;
        if (additionalInfo.email) updateData.email = additionalInfo.email;
        if (additionalInfo.metadata) {
          const existingMetadata = existingCustomer.metadata ? JSON.parse(existingCustomer.metadata) : {};
          const mergedMetadata = { ...existingMetadata, ...additionalInfo.metadata };
          updateData.metadata = JSON.stringify(mergedMetadata);
        }
        
        await drizzleDb
          .update(customers)
          .set(updateData)
          .where(eq(customers.id, existingCustomer.id));
          
        const dbLogger = createContextLogger('Database');
        dbLogger.info('Customer info updated', { customerId: existingCustomer.id, platform, platformUserId });
        
        // 重新獲取更新後的客戶資料
        const updatedCustomer = await drizzleDb
          .select()
          .from(customers)
          .where(eq(customers.id, existingCustomer.id))
          .get();
          
        return convertCustomer(updatedCustomer || existingCustomer);
      }
    }
    
    const dbLogger = createContextLogger('Database');
    dbLogger.info('Found existing customer', { customerId: existingCustomer.id, platform, platformUserId });
    return convertCustomer(existingCustomer);
  }

  // 如果客戶不存在，建立新客戶
  const newCustomerData = {
    platform,
    platformUserId,
    displayName: additionalInfo?.displayName || null,
    avatarUrl: additionalInfo?.avatarUrl || null,
    phone: additionalInfo?.phone || null,
    email: additionalInfo?.email || null,
    sourceTeamId: additionalInfo?.sourceTeamId || null,
    metadata: additionalInfo?.metadata ? JSON.stringify(additionalInfo.metadata) : null,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await drizzleDb
    .insert(customers)
    .values(newCustomerData);

  // 重新獲取剛建立的客戶
  const newCustomer = await drizzleDb
    .select()
    .from(customers)
    .where(and(
      eq(customers.platform, platform),
      eq(customers.platformUserId, platformUserId)
    ))
    .get();

  if (!newCustomer) {
    throw new Error('Failed to retrieve created customer');
  }

  const dbLogger = createContextLogger('Database');
  dbLogger.info('Created new customer', { customerId: newCustomer.id, platform, platformUserId });
  return convertCustomer(newCustomer);
}

/**
 * 儲存訊息 (支援會話管理)
 */
export async function saveMessage(
  db: D1Database,
  messageData: {
    id: string;
    conversationId: string;
    senderType: SenderType;
    senderId?: string;
    content: string;
    messageType: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker';
    platformMessageId?: string;
    direction: 'inbound' | 'outbound';
    replyToMessageId?: string;
    threadId?: string;
    sessionId?: string;
    sessionSequence?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<DbMessage> {
  // Validate replyToMessageId exists (app-level FK enforcement)
  if (messageData.replyToMessageId) {
    const replyValidation = await validateReplyToMessageId(
      db,
      messageData.replyToMessageId,
      messageData.conversationId
    );
    if (!replyValidation.valid) {
      throw new Error(replyValidation.error || 'Invalid replyToMessageId');
    }
  }

  const timestamp = nowISO();
  const drizzleDb = createDbClient(db);

  const messageInsertData = {
    id: messageData.id,
    conversationId: messageData.conversationId,
    senderType: messageData.senderType,
    customerSenderId: messageData.senderType === SENDER_TYPES.CUSTOMER ? parseInt(messageData.senderId || '0') || null : null,
    agentSenderId: messageData.senderType === SENDER_TYPES.AGENT ? messageData.senderId || null : null,
    content: messageData.content,
    messageType: messageData.messageType,
    platformMessageId: messageData.platformMessageId || null,
    isRecalled: false,
    isSent: messageData.direction === 'outbound',
    deliveryStatus: messageData.direction === 'outbound' ? 'sent' : 'pending',
    replyToMessageId: messageData.replyToMessageId || null,
    threadId: messageData.threadId || null,
    sessionId: messageData.sessionId || null,
    sessionSequence: messageData.sessionSequence || 1,
    metadata: messageData.metadata ? JSON.stringify(messageData.metadata) : null,
    sentAt: messageData.direction === 'outbound' ? timestamp : null,
    createdAt: timestamp
  };

  await drizzleDb
    .insert(messages)
    .values(messageInsertData);

  // 重新獲取剛儲存的訊息
  const savedMessage = await drizzleDb
    .select()
    .from(messages)
    .where(eq(messages.id, messageData.id))
    .get();

  if (!savedMessage) {
    throw new Error('Failed to retrieve saved message');
  }

  return convertMessage(savedMessage);
}

/**
 * 獲取系統設定
 */
export async function getSystemSetting(
  db: D1Database, 
  key: string
): Promise<string | null> {
  const drizzleDb = createDbClient(db);
  
  const result = await drizzleDb
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .get();

  return result?.value || null;
}

/**
 * 獲取對話的所有訊息
 */
export async function getConversationMessages(
  db: D1Database,
  conversationId: string,
  limit: number = 50
): Promise<DbMessage[]> {
  const drizzleDb = createDbClient(db);
  
  const messageList = await drizzleDb
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  return messageList.map(convertMessage);
}

/**
 * 獲取客戶的所有對話
 */
export async function getCustomerConversations(
  db: D1Database,
  customerId: number
): Promise<DbConversation[]> {
  const drizzleDb = createDbClient(db);
  
  const conversationList = await drizzleDb
    .select()
    .from(conversations)
    .where(eq(conversations.customerId, customerId))
    .orderBy(desc(conversations.lastMessageAt));

  return conversationList.map(convertConversation);
}

/**
 * 獲取最近的訊息統計
 */
export async function getMessageStats(
  db: D1Database
): Promise<{
  totalMessages: number;
  totalCustomers: number;
  totalConversations: number;
  recentMessages: DbMessage[];
}> {
  const drizzleDb = createDbClient(db);

  // 總訊息數
  const totalMessagesResult = await drizzleDb
    .select({ count: count() })
    .from(messages)
    .get();

  // 總客戶數
  const totalCustomersResult = await drizzleDb
    .select({ count: count() })
    .from(customers)
    .get();

  // 總對話數
  const totalConversationsResult = await drizzleDb
    .select({ count: count() })
    .from(conversations)
    .get();

  // 最近的訊息
  const recentMessagesData = await drizzleDb
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      senderType: messages.senderType,
      customerSenderId: messages.customerSenderId,
      agentSenderId: messages.agentSenderId,
      content: messages.content,
      messageType: messages.messageType,
      platformMessageId: messages.platformMessageId,
      isRecalled: messages.isRecalled,
      recallDeadline: messages.recallDeadline,
      recalledAt: messages.recalledAt,
      isSent: messages.isSent,
      deliveryStatus: messages.deliveryStatus,
      replyToMessageId: messages.replyToMessageId,
      threadId: messages.threadId,
      sessionId: messages.sessionId,
      sessionSequence: messages.sessionSequence,
      metadata: messages.metadata,
      senderName: messages.senderName,
      readBy: messages.readBy,
      sentAt: messages.sentAt,
      createdAt: messages.createdAt,
      updatedAt: messages.updatedAt,
      deletedAt: messages.deletedAt,
      customer_name: customers.displayName,
      platform: customers.platform
    })
    .from(messages)
    .leftJoin(conversations, eq(messages.conversationId, conversations.id))
    .leftJoin(customers, eq(conversations.customerId, customers.id))
    .orderBy(desc(messages.createdAt))
    .limit(10);

  // 轉換為 DbMessage 格式，保留額外字段
  const recentMessages = recentMessagesData.map(msg => {
    const baseMessage = convertMessage(msg);
    return {
      ...baseMessage,
      customer_name: msg.customer_name,
      platform: msg.platform
    };
  });

  return {
    totalMessages: totalMessagesResult?.count || 0,
    totalCustomers: totalCustomersResult?.count || 0,
    totalConversations: totalConversationsResult?.count || 0,
    recentMessages
  };
}

/**
 * 獲取訊息的回覆鏈
 */
export async function getMessageReplies(
  db: D1Database,
  messageId: string
): Promise<DbMessage[]> {
  const drizzleDb = createDbClient(db);
  
  const replies = await drizzleDb
    .select()
    .from(messages)
    .where(eq(messages.replyToMessageId, messageId))
    .orderBy(asc(messages.createdAt));

  return replies.map(convertMessage);
}

/**
 * 獲取訊息線程
 */
export async function getMessageThread(
  db: D1Database,
  threadId: string
): Promise<DbMessage[]> {
  const drizzleDb = createDbClient(db);
  
  const threadMessages = await drizzleDb
    .select()
    .from(messages)
    .where(eq(messages.threadId, threadId))
    .orderBy(asc(messages.createdAt));

  return threadMessages.map(convertMessage);
}

/**
 * 獲取對話的訊息樹狀結構
 */
export async function getConversationMessageTree(
  db: D1Database,
  conversationId: string
): Promise<{
  messages: DbMessage[];
  messageMap: Map<string, DbMessage>;
  replyMap: Map<string, DbMessage[]>;
}> {
  const drizzleDb = createDbClient(db);

  // 獲取對話的所有訊息
  const messageList = await drizzleDb
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));

  const messageMap = new Map<string, DbMessage>();
  const replyMap = new Map<string, DbMessage[]>();

  const convertedMessages = messageList.map(convertMessage);
  
  // 建立訊息映射
  convertedMessages.forEach(message => {
    messageMap.set(message.id, message);
    
    // 如果是回覆訊息，加入回覆映射
    if (message.replyToMessageId) {
      if (!replyMap.has(message.replyToMessageId)) {
        replyMap.set(message.replyToMessageId, []);
      }
      replyMap.get(message.replyToMessageId)!.push(message);
    }
  });

  return {
    messages: convertedMessages,
    messageMap,
    replyMap
  };
}

/**
 * 獲取所有客戶
 */
export async function getAllCustomers(
  db: D1Database,
  limit: number = 100
): Promise<Customer[]> {
  const drizzleDb = createDbClient(db);
  
  const customerList = await drizzleDb
    .select()
    .from(customers)
    .orderBy(desc(customers.createdAt))
    .limit(limit);

  return customerList.map(convertCustomer);
}

/**
 * 根據ID獲取客戶
 */
export async function getCustomerById(
  db: D1Database,
  customerId: number
): Promise<Customer | null> {
  const drizzleDb = createDbClient(db);
  
  const customer = await drizzleDb
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .get();

  return customer ? convertCustomer(customer) : null;
}

/**
 * 根據平台和平台用戶ID獲取客戶
 */
export async function getCustomerByPlatformId(
  db: D1Database,
  platform: string,
  platformUserId: string
): Promise<Customer | null> {
  const drizzleDb = createDbClient(db);
  
  const customer = await drizzleDb
    .select()
    .from(customers)
    .where(and(
      eq(customers.platform, platform),
      eq(customers.platformUserId, platformUserId)
    ))
    .get();

  return customer ? convertCustomer(customer) : null;
}

/**
 * 更新客戶資訊
 */
export async function updateCustomer(
  db: D1Database,
  customerId: number,
  updates: {
    displayName?: string;
    avatarUrl?: string;
    phone?: string;
    email?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<boolean> {
  const drizzleDb = createDbClient(db);
  
  const updateData: Partial<typeof customers.$inferInsert> = {
    updatedAt: nowISO()
  };
  
  let hasUpdates = false;
  
  if (updates.displayName !== undefined) {
    updateData.displayName = updates.displayName;
    hasUpdates = true;
  }
  
  if (updates.avatarUrl !== undefined) {
    updateData.avatarUrl = updates.avatarUrl;
    hasUpdates = true;
  }
  
  if (updates.phone !== undefined) {
    updateData.phone = updates.phone;
    hasUpdates = true;
  }
  
  if (updates.email !== undefined) {
    updateData.email = updates.email;
    hasUpdates = true;
  }
  
  if (updates.metadata !== undefined) {
    updateData.metadata = JSON.stringify(updates.metadata);
    hasUpdates = true;
  }
  
  if (!hasUpdates) {
    return false;
  }
  
  try {
    await drizzleDb
      .update(customers)
      .set(updateData)
      .where(eq(customers.id, customerId));
    
    return true;
  } catch (error) {
    const dbLogger = createContextLogger('Database');
    dbLogger.error('Failed to update customer', { customerId, error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}
