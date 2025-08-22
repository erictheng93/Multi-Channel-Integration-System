import type { 
  Customer, 
  DbConversation, 
  DbMessage, 
  QueryParams, 
  // QueryParam,
  CustomerMetadata,
  // DatabaseRow 
} from '../types';

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
  const timestamp = new Date().toISOString();
  
  // 先嘗試找到現有客戶
  const existingCustomer = await db
    .prepare('SELECT * FROM customers WHERE platform = ? AND platform_user_id = ?')
    .bind(platform, platformUserId)
    .first<Customer>();

  if (existingCustomer) {
    // 如果客戶已存在，但有新的資訊要更新
    if (additionalInfo) {
      const updateFields: string[] = [];
      const updateValues: QueryParams = [];
      
      if (additionalInfo.displayName && additionalInfo.displayName !== existingCustomer.display_name) {
        updateFields.push('display_name = ?');
        updateValues.push(additionalInfo.displayName);
      }
      
      if (additionalInfo.avatarUrl && additionalInfo.avatarUrl !== existingCustomer.avatar_url) {
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
        updateFields.push('updated_at = ?');
        updateValues.push(timestamp);
        updateValues.push(existingCustomer.id);
        
        await db
          .prepare(`UPDATE customers SET ${updateFields.join(', ')} WHERE id = ?`)
          .bind(...updateValues)
          .run();
          
        console.log(`📝 客戶資訊已更新 - ID: ${existingCustomer.id}, 平台: ${platform}, 用戶ID: ${platformUserId}`);
        
        // 重新獲取更新後的客戶資料
        const updatedCustomer = await db
          .prepare('SELECT * FROM customers WHERE id = ?')
          .bind(existingCustomer.id)
          .first<Customer>();
          
        return updatedCustomer || existingCustomer;
      }
    }
    
    console.log(`👤 找到現有客戶 - ID: ${existingCustomer.id}, 平台: ${platform}, 用戶ID: ${platformUserId}`);
    return existingCustomer;
  }

  // 如果客戶不存在，建立新客戶
  const insertResult = await db
    .prepare(`
      INSERT INTO customers (
        platform, platform_user_id, display_name, avatar_url, 
        phone, email, source_team_id, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      platform, 
      platformUserId,
      additionalInfo?.displayName || null,
      additionalInfo?.avatarUrl || null,
      additionalInfo?.phone || null,
      additionalInfo?.email || null,
      additionalInfo?.sourceTeamId || null,
      additionalInfo?.metadata ? JSON.stringify(additionalInfo.metadata) : null,
      timestamp,
      timestamp
    )
    .run();

  if (!insertResult.success) {
    throw new Error('Failed to create customer');
  }

  // 重新獲取剛建立的客戶
  const newCustomer = await db
    .prepare('SELECT * FROM customers WHERE platform = ? AND platform_user_id = ?')
    .bind(platform, platformUserId)
    .first<Customer>();

  if (!newCustomer) {
    throw new Error('Failed to retrieve created customer');
  }

  console.log(`🆕 建立新客戶 - ID: ${newCustomer.id}, 平台: ${platform}, 用戶ID: ${platformUserId}`);
  return newCustomer;
}

/**
 * 尋找或建立對話
 */
export async function findOrCreateConversation(
  db: D1Database, 
  customerId: number
): Promise<DbConversation> {
  const timestamp = new Date().toISOString();

  // 先嘗試找到現有的活躍對話
  const existingConversation = await db
    .prepare('SELECT * FROM conversations WHERE customer_id = ? AND status = ?')
    .bind(customerId, 'active')
    .first<DbConversation>();

  if (existingConversation) {
    // 更新最後訊息時間
    await db
      .prepare('UPDATE conversations SET last_message_at = ?, updated_at = ? WHERE id = ?')
      .bind(timestamp, timestamp, existingConversation.id)
      .run();

    return existingConversation;
  }

  // 如果沒有活躍對話，建立新對話
  const insertResult = await db
    .prepare('INSERT INTO conversations (customer_id, status, last_message_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .bind(customerId, 'active', timestamp, timestamp, timestamp)
    .run();

  if (!insertResult.success) {
    throw new Error('Failed to create conversation');
  }

  // 重新獲取剛建立的對話
  const newConversation = await db
    .prepare('SELECT * FROM conversations WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1')
    .bind(customerId)
    .first<DbConversation>();

  if (!newConversation) {
    throw new Error('Failed to retrieve created conversation');
  }

  return newConversation;
}

/**
 * 儲存訊息 (支援會話管理)
 */
export async function saveMessage(
  db: D1Database,
  messageData: {
    id: string;
    conversationId: number;
    senderType: 'customer' | 'agent' | 'system';
    senderId?: number;
    content: string;
    messageType: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker';
    platformMessageId?: string;
    direction: 'inbound' | 'outbound';
    replyToMessageId?: string; // 回覆的目標訊息ID
    threadId?: string; // 訊息線程ID
    sessionId?: string; // 會話ID
    sessionSequence?: number; // 會話中的順序
    metadata?: Record<string, unknown>; // 額外的元數據
  }
): Promise<DbMessage> {
  const timestamp = new Date().toISOString();

  const insertResult = await db
    .prepare(`
      INSERT INTO messages (
        id, conversation_id, sender_type, sender_id, content, 
        message_type, platform_message_id, is_recalled, is_sent, 
        delivery_status, reply_to_message_id, thread_id, session_id,
        session_sequence, metadata, sent_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      messageData.id,
      messageData.conversationId,
      messageData.senderType,
      messageData.senderId || null,
      messageData.content,
      messageData.messageType,
      messageData.platformMessageId || null,
      false, // is_recalled
      messageData.direction === 'outbound', // is_sent
      messageData.direction === 'outbound' ? 'sent' : 'pending', // delivery_status
      messageData.replyToMessageId || null,
      messageData.threadId || null,
      messageData.sessionId || null,
      messageData.sessionSequence || 1,
      messageData.metadata ? JSON.stringify(messageData.metadata) : null,
      messageData.direction === 'outbound' ? timestamp : null, // sent_at
      timestamp
    )
    .run();

  if (!insertResult.success) {
    throw new Error('Failed to save message');
  }

  // 重新獲取剛儲存的訊息
  const savedMessage = await db
    .prepare('SELECT * FROM messages WHERE id = ?')
    .bind(messageData.id)
    .first<DbMessage>();

  if (!savedMessage) {
    throw new Error('Failed to retrieve saved message');
  }

  return savedMessage;
}

/**
 * 獲取系統設定
 */
export async function getSystemSetting(
  db: D1Database, 
  key: string
): Promise<string | null> {
  const result = await db
    .prepare('SELECT value FROM system_settings WHERE key = ?')
    .bind(key)
    .first<{ value: string }>();

  return result?.value || null;
}

/**
 * 獲取對話的所有訊息
 */
export async function getConversationMessages(
  db: D1Database,
  conversationId: number,
  limit: number = 50
): Promise<DbMessage[]> {
  const messages = await db
    .prepare(`
      SELECT * FROM messages 
      WHERE conversation_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `)
    .bind(conversationId, limit)
    .all<DbMessage>();

  return messages.results || [];
}

/**
 * 獲取客戶的所有對話
 */
export async function getCustomerConversations(
  db: D1Database,
  customerId: number
): Promise<DbConversation[]> {
  const conversations = await db
    .prepare(`
      SELECT * FROM conversations 
      WHERE customer_id = ? 
      ORDER BY last_message_at DESC
    `)
    .bind(customerId)
    .all<DbConversation>();

  return conversations.results || [];
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
  // 總訊息數
  const totalMessagesResult = await db
    .prepare('SELECT COUNT(*) as count FROM messages')
    .first<{ count: number }>();

  // 總客戶數
  const totalCustomersResult = await db
    .prepare('SELECT COUNT(*) as count FROM customers')
    .first<{ count: number }>();

  // 總對話數
  const totalConversationsResult = await db
    .prepare('SELECT COUNT(*) as count FROM conversations')
    .first<{ count: number }>();

  // 最近的訊息
  const recentMessages = await db
    .prepare(`
      SELECT m.*, c.display_name as customer_name, c.platform 
      FROM messages m 
      LEFT JOIN conversations conv ON m.conversation_id = conv.id
      LEFT JOIN customers c ON conv.customer_id = c.id
      ORDER BY m.created_at DESC 
      LIMIT 10
    `)
    .all<DbMessage & { customer_name?: string; platform?: string }>();

  return {
    totalMessages: totalMessagesResult?.count || 0,
    totalCustomers: totalCustomersResult?.count || 0,
    totalConversations: totalConversationsResult?.count || 0,
    recentMessages: recentMessages.results || []
  };
}

/**
 * 獲取訊息的回覆鏈
 */
export async function getMessageReplies(
  db: D1Database,
  messageId: string
): Promise<DbMessage[]> {
  const replies = await db
    .prepare(`
      SELECT * FROM messages 
      WHERE reply_to_message_id = ? 
      ORDER BY created_at ASC
    `)
    .bind(messageId)
    .all<DbMessage>();

  return replies.results || [];
}

/**
 * 獲取訊息線程
 */
export async function getMessageThread(
  db: D1Database,
  threadId: string
): Promise<DbMessage[]> {
  const threadMessages = await db
    .prepare(`
      SELECT * FROM messages 
      WHERE thread_id = ? 
      ORDER BY created_at ASC
    `)
    .bind(threadId)
    .all<DbMessage>();

  return threadMessages.results || [];
}

/**
 * 獲取對話的訊息樹狀結構
 */
export async function getConversationMessageTree(
  db: D1Database,
  conversationId: number
): Promise<{
  messages: DbMessage[];
  messageMap: Map<string, DbMessage>;
  replyMap: Map<string, DbMessage[]>;
}> {
  // 獲取對話的所有訊息
  const messages = await db
    .prepare(`
      SELECT * FROM messages 
      WHERE conversation_id = ? 
      ORDER BY created_at ASC
    `)
    .bind(conversationId)
    .all<DbMessage>();

  const messageList = messages.results || [];
  const messageMap = new Map<string, DbMessage>();
  const replyMap = new Map<string, DbMessage[]>();

  // 建立訊息映射
  messageList.forEach(message => {
    messageMap.set(message.id, message);
    
    // 如果是回覆訊息，加入回覆映射
    if (message.reply_to_message_id) {
      if (!replyMap.has(message.reply_to_message_id)) {
        replyMap.set(message.reply_to_message_id, []);
      }
      replyMap.get(message.reply_to_message_id)!.push(message);
    }
  });

  return {
    messages: messageList,
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
  const customers = await db
    .prepare(`
      SELECT * FROM customers 
      ORDER BY created_at DESC 
      LIMIT ?
    `)
    .bind(limit)
    .all<Customer>();

  return customers.results || [];
}

/**
 * 根據ID獲取客戶
 */
export async function getCustomerById(
  db: D1Database,
  customerId: number
): Promise<Customer | null> {
  const customer = await db
    .prepare('SELECT * FROM customers WHERE id = ?')
    .bind(customerId)
    .first<Customer>();

  return customer || null;
}

/**
 * 根據平台和平台用戶ID獲取客戶
 */
export async function getCustomerByPlatformId(
  db: D1Database,
  platform: string,
  platformUserId: string
): Promise<Customer | null> {
  const customer = await db
    .prepare('SELECT * FROM customers WHERE platform = ? AND platform_user_id = ?')
    .bind(platform, platformUserId)
    .first<Customer>();

  return customer || null;
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
  const updateFields: string[] = [];
  const updateValues: any[] = [];
  
  if (updates.displayName !== undefined) {
    updateFields.push('display_name = ?');
    updateValues.push(updates.displayName);
  }
  
  if (updates.avatarUrl !== undefined) {
    updateFields.push('avatar_url = ?');
    updateValues.push(updates.avatarUrl);
  }
  
  if (updates.phone !== undefined) {
    updateFields.push('phone = ?');
    updateValues.push(updates.phone);
  }
  
  if (updates.email !== undefined) {
    updateFields.push('email = ?');
    updateValues.push(updates.email);
  }
  
  if (updates.metadata !== undefined) {
    updateFields.push('metadata = ?');
    updateValues.push(JSON.stringify(updates.metadata));
  }
  
  if (updateFields.length === 0) {
    return false;
  }
  
  updateFields.push('updated_at = ?');
  updateValues.push(new Date().toISOString());
  updateValues.push(customerId);
  
  const result = await db
    .prepare(`UPDATE customers SET ${updateFields.join(', ')} WHERE id = ?`)
    .bind(...updateValues)
    .run();
    
  return result.success;
}