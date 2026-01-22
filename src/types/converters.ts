// 型別轉換工具
// 用於在新的共享型別和現有資料庫型別之間轉換

import type { 
  User, 
  Conversation, 
  Message, 
  Agent,
  Customer, 
  DbConversation, 
  DbMessage, 
  DbUser,
  Platform 
} from './index';

// 將資料庫客戶記錄轉換為新的 User 型別
export function customerToUser(customer: Customer): User {
  return {
    id: customer.id.toString(),
    platform: customer.platform as Platform,
    platformUserId: customer.platformUserId,
    name: customer.displayName || 'Unknown User',
    avatarUrl: customer.avatarUrl || '',
    createdAt: new Date(customer.createdAt).getTime()
  };
}

// 將資料庫對話記錄轉換為新的 Conversation 型別
// Note: Individual assignment (assignedUserId, assignedAgent) removed - only team-based assignment is supported now
export function dbConversationToConversation(
  dbConv: DbConversation,
  user?: User,
  _agent?: Agent // Deprecated - kept for backwards compatibility
): Conversation {
  return {
    id: dbConv.id,
    userId: dbConv.customerId.toString(),
    user: user || {
      id: dbConv.customerId.toString(),
      platform: 'line' as const,
      platformUserId: '',
      name: 'Unknown User',
      avatarUrl: '',
      createdAt: Date.now()
    },
    // Team-based assignment
    assignedTeamId: dbConv.assignedTeamId ?? undefined,
    status: dbConv.status === 'active' ? 'open' :
            dbConv.status === 'pending' ? 'assigned' : 'closed',
    lastMessageAt: dbConv.lastMessageAt ?
                   new Date(dbConv.lastMessageAt).getTime() :
                   new Date(dbConv.createdAt).getTime(),
    unreadCount: 0, // 需要從其他地方計算
    createdAt: new Date(dbConv.createdAt).getTime(),
    updatedAt: new Date(dbConv.updatedAt).getTime()
  };
}

// 將資料庫訊息記錄轉換為新的 Message 型別
export function dbMessageToMessage(dbMsg: DbMessage): Message {
  return {
    id: dbMsg.id,
    conversationId: dbMsg.conversationId,
    senderType: dbMsg.senderType === 'customer' ? 'user' : 'agent',
    senderId: dbMsg.senderType === 'customer' ? dbMsg.customerSenderId?.toString() || '' : dbMsg.agentSenderId || '',
    content: dbMsg.content,
    mediaUrl: '', // 需要根據 messageType 處理
    mediaType: dbMsg.messageType as 'text' | 'image' | 'video' | 'file',
    platform: 'line', // 需要從其他地方獲取
    createdAt: new Date(dbMsg.createdAt).getTime()
  };
}

// 將資料庫用戶記錄轉換為新的 Agent 型別
export function dbUserToAgent(dbUser: DbUser): Agent {
  return {
    id: dbUser.id.toString(),
    email: dbUser.email,
    name: dbUser.displayName,
    role: dbUser.role,
    isActive: dbUser.isActive,
    createdAt: new Date(dbUser.createdAt).getTime()
  };
}

// 反向轉換：將新的 User 型別轉換為資料庫格式
export function userToCustomer(user: User): Partial<Customer> {
  return {
    platform: user.platform,
    platformUserId: user.platformUserId,
    displayName: user.name,
    avatarUrl: user.avatarUrl || '',
    createdAt: new Date(user.createdAt).toISOString(),
    updatedAt: new Date().toISOString()
  };
}