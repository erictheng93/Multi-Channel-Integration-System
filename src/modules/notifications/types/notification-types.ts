// src/modules/notifications/types/notification-types.ts
// 通知系統核心類型定義

export interface NotificationBase {
  id: string;
  userId: string | number;  // 支援字串和數字格式的 userId
  type: NotificationType;
  title: string;
  content: string;
  data?: Record<string, unknown>;
  priority: NotificationPriority;
  isRead: boolean;
  readAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export type NotificationType =
  | 'new_message'
  | 'conversation_assigned'
  | 'conversation_transferred'
  | 'mention'
  | 'system'
  | 'priority_changed'
  | 'customer_responded'
  | 'task_reminder'
  | 'agent_removed_from_team'  // Agent 被移出團隊通知
  | 'customer_followed' //  新客戶加入通知 (LINE follow event)
  | 'new_conversation'; //  新對話創建通知 (未指派的新對話)

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'expired';

export type NotificationChannel = 'database' | 'email' | 'webhook' | 'push' | 'websocket' | 'sms';

export interface CreateNotificationRequest {
  userId: string | number;  // 支援字串和數字格式的 userId
  type: NotificationType;
  title: string;
  content: string;
  data?: Record<string, unknown>;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  expiresAt?: Date;
  scheduleAt?: Date;
}

export interface BulkCreateNotificationRequest {
  notifications: CreateNotificationRequest[];
  batchId?: string;
}

export interface NotificationSettings {
  userId: string | number;  // 支援字串和數字格式的 userId
  emailEnabled: boolean;
  pushEnabled: boolean;
  sseEnabled: boolean;
  websocketEnabled: boolean;
  soundEnabled: boolean;
  mentionEnabled: boolean;
  assignmentEnabled: boolean;
  messageEnabled: boolean;
  systemEnabled: boolean;
  quietHours?: {
    enabled: boolean;
    startTime: string; // HH:mm format
    endTime: string; // HH:mm format
    timezone: string;
  };
  channelPreferences: Record<NotificationType, NotificationChannel[]>;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<NotificationType, {
    total: number;
    unread: number;
  }>;
  byPriority: Record<NotificationPriority, {
    total: number;
    unread: number;
  }>;
  timeRange: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  channelStats: Record<NotificationChannel, {
    sent: number;
    delivered: number;
    failed: number;
  }>;
}

export interface NotificationQuery {
  userId: string | number;  // 支援字串和數字格式的 userId
  type?: NotificationType;
  priority?: NotificationPriority;
  isRead?: boolean;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface NotificationListResponse {
  notifications: NotificationBase[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// 通道相關類型已在 channel-types.ts 中定義