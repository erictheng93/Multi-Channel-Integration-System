// src/modules/notifications/types/index.ts
// 通知模組類型匯出

// 核心通知類型
export * from './notification-types';

// 通道相關類型
export * from './channel-types';

// 重新匯出常用類型，提供便利的存取方式
export type {
  NotificationBase,
  NotificationType,
  NotificationPriority,
  CreateNotificationRequest,
  NotificationSettings,
  NotificationStats,
  NotificationQuery,
  NotificationListResponse
} from './notification-types';

export type {
  NotificationChannelConfig,
  ChannelType,
  ChannelAdapter,
  DeliveryResult,
  ChannelMessage,
  DeliveryStatus,
  WebSocketMessage,
  EmailTemplate,
  PushSubscription,
  ChannelRoutingRule,
  BulkDeliveryJob,
  ChannelMetrics
} from './channel-types';