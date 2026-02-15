// src/modules/notifications/index.ts
// Notifications 模組主要匯出文件

// 核心類型匯出
export * from './types';

// 服務層匯出
export { NotificationService } from './services/notification-service';
export { NotificationChannelService } from './services/notification-channel-service';

// 資料層匯出
export { NotificationRepository } from './repositories/notification-repository';
export { NotificationCache } from './repositories/notification-cache';

// 通道適配器匯出
export { WebSocketAdapter } from './adapters/websocket-adapter';
export { EmailAdapter } from './adapters/email-adapter';
export { PushAdapter } from './adapters/push-adapter';

// 處理器匯出
export {
  NotificationHandler,
  createNotificationHandler,
  createNotificationHandlerMethods
} from './handlers/notification-main';

// 工具類匯出
export {
  NotificationValidator,
  NotificationValidationError,
  type ValidationError
} from './utils/notification-validator';

export { NotificationFactory } from './utils/notification-factory';

// 默認配置 (WebSocket-based)
export const DEFAULT_NOTIFICATION_CONFIG = {
  channels: {
    websocket: {
      enabled: true,
      retryAttempts: 3,
      retryDelay: 1000,
      timeout: 30000,
      batchSize: 100
    },
    email: {
      enabled: false, // 需要配置 email 服務
      retryAttempts: 3,
      retryDelay: 5000,
      timeout: 30000,
      batchSize: 20
    },
    push: {
      enabled: false, // 需要配置 push 服務
      retryAttempts: 3,
      retryDelay: 2000,
      timeout: 30000,
      batchSize: 50
    }
  },
  routing: {
    defaultChannels: ['websocket'],
    fallbackEnabled: true,
    fallbackChannels: ['websocket']
  },
  cache: {
    defaultTTL: 300, // 5 minutes
    statsTTL: 60,    // 1 minute
    recentNotificationsTTL: 60 // 60 seconds (Cloudflare KV 最小 TTL)
  }
};

// 版本資訊
export const NOTIFICATIONS_MODULE_VERSION = '1.0.0';
export const NOTIFICATIONS_MODULE_NAME = 'Multi-Channel Notifications';

// 模組資訊
export const NOTIFICATIONS_MODULE_INFO = {
  name: NOTIFICATIONS_MODULE_NAME,
  version: NOTIFICATIONS_MODULE_VERSION,
  description: 'Unified multi-channel notification system with WebSocket, Email, and Push support',
  features: [
    'Multi-channel notification delivery',
    'Real-time WebSocket notifications',
    'Email notifications (prepared)',
    'Push notifications (prepared)',
    'Advanced caching with KV',
    'Flexible routing rules',
    'Bulk operations',
    'Notification templates',
    'User preferences',
    'Statistics and monitoring'
  ],
  channels: {
    websocket: 'WebSocket (Active)',
    email: 'Email (Prepared)',
    push: 'Push Notifications (Prepared)'
  }
};