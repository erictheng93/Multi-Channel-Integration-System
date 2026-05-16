// Real-time 模組主入口 - 統一導出所有功能

// === 類型定義導出 ===
export * from './types';
import type { Bindings } from '@/types';
import type { RealtimeConfig, RealtimeEvent, QueueMessage } from '@modules/realtime/types';
import type { EventSource } from '@modules/realtime/types/event-types';

// === 處理器導出 ===
export * from './handlers';

// === 服務層導出 ===
export * from './services';

// === 中間件導出 ===
export * from './middleware';

// === 監控系統導出 ===
export { RealtimePerformanceMonitor } from './monitoring/performance-monitor';
export {
  dashboardHandler,
  metricsHistoryHandler,
  alertsHandler,
  healthHandler,
  configHandler
} from './monitoring/dashboard-handler';
export { RealtimeVersionSelector } from './config/version-selector';

// === 主要功能快速訪問 ===
import { realtimeMainHandler, realtimeManagementHandler } from '@modules/realtime/handlers/realtime-main';
import { eventHandler } from '@modules/realtime/handlers/event-handler';
import { RealtimeManager } from '@modules/realtime/services/realtime-manager';
import { EventQueueService } from '@modules/realtime/services/event-queue-service';
import { getRealtimeMiddleware } from '@modules/realtime/middleware';
import { RealtimePerformanceMonitor } from '@modules/realtime/monitoring/performance-monitor';
import {
  dashboardHandler,
  metricsHistoryHandler,
  alertsHandler,
  healthHandler,
  configHandler
} from './monitoring/dashboard-handler';
import { RealtimeVersionSelector } from '@modules/realtime/config/version-selector';

// === 便利的統一訪問接口 ===
export const realtime = {
  // 主要處理器
  handlers: {
    main: realtimeMainHandler,
    management: realtimeManagementHandler,
    event: eventHandler
  },

  // 服務實例
  services: {
    manager: RealtimeManager.getInstance(),
    createQueue: (env: Bindings) => new EventQueueService(env)
  },

  // 中間件
  middleware: getRealtimeMiddleware,

  // 監控系統
  monitoring: {
    performance: RealtimePerformanceMonitor.getInstance(),
    dashboard: dashboardHandler,
    metricsHistory: metricsHistoryHandler,
    alerts: alertsHandler,
    health: healthHandler,
    config: configHandler,
    version: RealtimeVersionSelector.getInstance()
  },

  // 快速初始化函數
  async initialize(env: Bindings, config?: Partial<RealtimeConfig>) {
    const manager = RealtimeManager.getInstance();
    await manager.initialize(env, config);
    return manager;
  },

  // 快速創建事件函數
  async createEvent(
    eventType: RealtimeEvent['type'],
    eventData: RealtimeEvent['data'],
    targets: QueueMessage['targets'],
    priority: QueueMessage['priority'] = 'normal',
    source: EventSource = 'api'
  ) {
    const manager = RealtimeManager.getInstance();
    return await manager.createEvent(eventType, eventData, targets, priority, source);
  },

  // 獲取服務狀態
  async getStatus() {
    const manager = RealtimeManager.getInstance();
    return await manager.getComprehensiveStats();
  }
};

// === 主要類別導出（方便直接使用）===
export {
  RealtimeManager,
  EventQueueService
};

// === 便利函數導出 ===
export { createRealtimeEvent } from './handlers/realtime-main';
export { createRealtimeServices } from './services';

// === 預設配置 ===
export const defaultRealtimeConfig = {
  version: 'auto' as const,
  enableEventDriven: true,
  enableQueueProcessing: true,
  heartbeatInterval: 8000,
  connectionTimeout: 300000,
  maxRetries: 3,
  eventStorageTtl: 300,
  authConfig: {
    allowQueryToken: true,
    requireConversationAccess: true,
    validRoles: ['admin', 'agent']
  }
};

// === 模組信息 ===
export const realtimeModuleInfo = {
  name: 'Real-time Module',
  version: '2.0.0',
  description: '統一的即時通訊模組，支援 WebSocket、事件驅動和隊列處理',
  features: [
    '事件驅動架構',
    'WebSocket 連接管理',
    '隊列處理系統',
    '智能版本選擇',
    '完整的認證和驗證',
    '性能監控和統計',
    '模組化架構'
  ],
  compatibility: {
    realtimeV1: true,
    realtimeV2: true,
    autoSwitch: true
  }
};
