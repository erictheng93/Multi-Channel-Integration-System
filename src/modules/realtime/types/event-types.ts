// 事件系統專用類型定義

export type EventType =
  | 'message'
  | 'typing_started'
  | 'typing_stopped'
  | 'typing'
  | 'agent_joined'
  | 'agent_left'
  | 'assignment_changed'
  | 'status_changed'
  | 'notification'
  | 'conversation_updated'
  | 'connection'
  | 'heartbeat'
  | 'connection_status'
  | 'connection_closed'
  | 'new_message'
  | 'system_announcement'
  | 'user_online'
  | 'user_offline';

export type EventPriority = 'low' | 'normal' | 'high' | 'urgent';

export type EventSource = 'system' | 'user' | 'api' | 'webhook' | 'queue' | 'manual';

export interface BaseEventData {
  timestamp: string;
  source: EventSource;
  metadata?: Record<string, unknown>;
}

export interface MessageEventData extends BaseEventData {
  messageId: number;
  conversationId: number;
  content: string;
  messageType: 'text' | 'image' | 'file' | 'sticker' | 'location';
  senderType: 'customer' | 'agent' | 'system';
  senderId: number;
  senderName: string;
  isRead: boolean;
  attachments?: string[];
}

export interface TypingEventData extends BaseEventData {
  conversationId: number;
  userId: number;
  userName: string;
  isTyping: boolean;
  duration?: number;
}

export interface StatusEventData extends BaseEventData {
  conversationId: number;
  oldStatus: string;
  newStatus: string;
  changedBy: number;
  reason?: string;
}

export interface AssignmentEventData extends BaseEventData {
  conversationId: number;
  oldAssignee?: {
    type: 'user' | 'team';
    id: number;
    name: string;
  };
  newAssignee: {
    type: 'user' | 'team';
    id: number;
    name: string;
  };
  assignedBy: number;
}

export interface NotificationEventData extends BaseEventData {
  notificationId: number;
  type: string;
  title: string;
  content: string;
  targetUsers: number[];
  actionUrl?: string;
  isRead: boolean;
}

export interface ConnectionEventData extends BaseEventData {
  connectionId: string;
  userId: number;
  conversationId?: number;
  action: 'connected' | 'disconnected' | 'heartbeat' | 'error';
  uptime?: number;
  errorMessage?: string;
}

export interface SystemEventData extends BaseEventData {
  type: 'maintenance' | 'update' | 'alert' | 'info';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedUsers?: number[];
  scheduledAt?: string;
  duration?: number;
}

// 事件目標定義
export interface EventTargets {
  conversationId?: number;
  userIds?: number[];
  teamIds?: number[];
  roles?: string[];
  broadcast?: boolean;
  excludeUsers?: number[];
}

// 事件處理結果
export interface EventProcessingResult {
  success: boolean;
  eventId: string;
  processedAt: string;
  targetReached: number;
  totalTargets: number;
  errors?: string[];
  processingTime: number;
}

// 事件過濾條件
export interface EventFilter {
  eventTypes?: EventType[];
  sources?: EventSource[];
  priorities?: EventPriority[];
  dateRange?: {
    start: string;
    end: string;
  };
  conversationIds?: number[];
  userIds?: number[];
}

// 事件統計
export interface EventStats {
  totalEvents: number;
  eventsByType: Record<EventType, number>;
  eventsByPriority: Record<EventPriority, number>;
  eventsBySource: Record<EventSource, number>;
  averageProcessingTime: number;
  successRate: number;
  errorRate: number;
  peakHour: number;
  dailyVolume: number[];
}