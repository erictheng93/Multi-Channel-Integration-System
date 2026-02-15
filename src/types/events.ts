// 事件驅動推送系統類型定義
// 專案名稱：Multi-Channel Support MVP - Event-Driven Push System

export interface BaseEvent {
  id: string;
  type: string;
  timestamp: string;
  source: string; // 'webhook', 'agent', 'system'
}

export interface MessageEvent extends BaseEvent {
  type: 'message_created' | 'message_updated' | 'message_deleted';
  data: {
    messageId: string;
    conversationId: number;
    content: string;
    messageType: 'text' | 'image' | 'file';
    senderType: 'customer' | 'agent';
    senderId: string | number;
    senderName?: string;
    customerName?: string;
    agentName?: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
    isRead: boolean;
  };
}

export interface ConversationEvent extends BaseEvent {
  type: 'conversation_updated' | 'conversation_assigned' | 'conversation_status_changed';
  data: {
    conversationId: number;
    status?: string;
    assignedUserId?: number;
    assignedTeamId?: number;
    customerName?: string;
    updatedAt: string;
    changes?: Record<string, unknown>;
  };
}

export interface TypingEvent extends BaseEvent {
  type: 'typing_started' | 'typing_stopped';
  data: {
    conversationId: number;
    userId: number;
    userName: string;
    isTyping: boolean;
  };
}

export interface NotificationEvent extends BaseEvent {
  type: 'notification_created';
  data: {
    notificationId: string;
    userId: number;
    title: string;
    content: string;
    notificationType: 'new_message' | 'conversation_assigned' | 'mention' | 'system';
    relatedId?: string;
    createdAt: string;
  };
}

// 統一的事件類型
export type RealtimeEvent = MessageEvent | ConversationEvent | TypingEvent | NotificationEvent;

// 隊列消息格式
export interface QueueMessage {
  event: RealtimeEvent;
  targets: {
    conversationId?: number;
    userIds?: number[];
    teamIds?: number[];
    broadcast?: boolean; // 全域廣播
  };
  priority: 'low' | 'normal' | 'high' | 'urgent';
  retryCount?: number;
  maxRetries?: number;
}

// 事件處理結果
export interface EventProcessingResult {
  success: boolean;
  eventId: string;
  processedAt: string;
  targetCount: number;
  errors?: string[];
}