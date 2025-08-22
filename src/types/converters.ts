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
    platformUserId: customer.platform_user_id,
    name: customer.display_name || 'Unknown User',
    avatarUrl: customer.avatar_url || '',
    createdAt: new Date(customer.created_at).getTime()
  };
}

// 將資料庫對話記錄轉換為新的 Conversation 型別
export function dbConversationToConversation(
  dbConv: DbConversation, 
  user?: User,
  agent?: Agent
): Conversation {
  return {
    id: dbConv.id.toString(),
    userId: dbConv.customer_id.toString(),
    user: user || {
      id: dbConv.customer_id.toString(),
      platform: 'line' as const,
      platformUserId: '',
      name: 'Unknown User',
      avatarUrl: '',
      createdAt: Date.now()
    },
    assignedTo: dbConv.assigned_user_id?.toString() || '',
    ...(agent && { assignedAgent: agent }),
    status: dbConv.status === 'active' ? 'open' : 
            dbConv.status === 'pending' ? 'assigned' : 'closed',
    lastMessageAt: dbConv.last_message_at ? 
                   new Date(dbConv.last_message_at).getTime() : 
                   new Date(dbConv.created_at).getTime(),
    unreadCount: 0, // 需要從其他地方計算
    createdAt: new Date(dbConv.created_at).getTime(),
    updatedAt: new Date(dbConv.updated_at).getTime()
  };
}

// 將資料庫訊息記錄轉換為新的 Message 型別
export function dbMessageToMessage(dbMsg: DbMessage): Message {
  return {
    id: dbMsg.id,
    conversationId: dbMsg.conversation_id.toString(),
    senderType: dbMsg.sender_type === 'customer' ? 'user' : 'agent',
    senderId: dbMsg.sender_id?.toString() || '',
    content: dbMsg.content,
    mediaUrl: '', // 需要根據 message_type 處理
    mediaType: dbMsg.message_type as 'text' | 'image' | 'video' | 'file',
    platform: 'line', // 需要從其他地方獲取
    createdAt: new Date(dbMsg.created_at).getTime()
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
    platform_user_id: user.platformUserId,
    display_name: user.name,
    avatar_url: user.avatarUrl || '',
    created_at: new Date(user.createdAt).toISOString(),
    updated_at: new Date().toISOString()
  };
}