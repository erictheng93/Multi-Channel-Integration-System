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
// REMOVED: SSEAdapter (Phase 2 cleanup - 100% WebSocket rollout)
// export { SSEAdapter } from './adapters/sse-adapter';
export { WebSocketAdapter } from './adapters/websocket-adapter';
export { EmailAdapter } from './adapters/email-adapter';
export { PushAdapter } from './adapters/push-adapter';

// 處理器匯出
export {
  NotificationHandler,
  createNotificationHandler,
  createNotificationHandlerMethods
} from './handlers/notification-main';

// REMOVED: NotificationSSEHandler (Phase 2 cleanup - 100% WebSocket rollout)
// export {
//   NotificationSSEHandler,
//   createNotificationSSEHandler,
//   createNotificationSSEHandlerMethods
// } from './handlers/notification-sse';

// 工具類匯出
export {
  NotificationValidator,
  NotificationValidationError,
  type ValidationError
} from './utils/notification-validator';

export { NotificationFactory } from './utils/notification-factory';

// 便利的工廠函數 (暫時註釋以修復類型錯誤)
// export function createNotificationModule(database: D1Database, kvNamespace: KVNamespace) {
//   // 創建核心服務實例
//   const channelService = new NotificationChannelService();
//   const notificationService = new NotificationService(database, kvNamespace, channelService);
//   const repository = new NotificationRepository(database);
//   const cache = new NotificationCache(kvNamespace);
//   const validator = new NotificationValidator();

//   return {
//     // 主要處理器
//     mainHandler: createNotificationHandler(database, kvNamespace),
//     mainHandlerMethods: createNotificationHandlerMethods(database, kvNamespace),

//     // SSE 處理器
//     sseHandler: createNotificationSSEHandler(),
//     sseHandlerMethods: createNotificationSSEHandlerMethods(),

//     // 核心服務
//     channelService,
//     notificationService,

//     // 資料層
//     repository,
//     cache,

//     // 工具類
//     validator,
//     factory: NotificationFactory,

//     // 適配器 (可選，通常通過 ChannelService 管理)
//     adapters: {
//       sse: new SSEAdapter(),
//       websocket: new WebSocketAdapter(),
//       email: new EmailAdapter(),
//       push: new PushAdapter()
//     }
//   };
// }

// 默認配置 (Phase 2: 100% WebSocket rollout)
export const DEFAULT_NOTIFICATION_CONFIG = {
  channels: {
    // REMOVED: SSE configuration (Phase 2 cleanup)
    // sse: {
    //   enabled: true,
    //   retryAttempts: 3,
    //   retryDelay: 1000,
    //   timeout: 30000,
    //   batchSize: 50
    // },
    websocket: {
      enabled: true, // ✅ 100% WebSocket rollout complete
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
    defaultChannels: ['websocket'], // Updated to WebSocket (Phase 2 cleanup)
    fallbackEnabled: true,
    fallbackChannels: ['websocket'] // Updated to WebSocket (Phase 2 cleanup)
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
    'Real-time WebSocket notifications', // Updated (Phase 2 cleanup)
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
    // REMOVED: SSE (Phase 2 cleanup)
    // sse: 'Server-Sent Events (Active)',
    websocket: 'WebSocket (Active - 100% rollout)', // Updated (Phase 2 cleanup)
    email: 'Email (Prepared)',
    push: 'Push Notifications (Prepared)'
  }
};