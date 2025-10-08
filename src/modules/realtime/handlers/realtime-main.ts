// Real-time 主處理器 - 統一入口
// 整合所有即時通訊功能的統一處理器

import { Context } from 'hono';
import type { Bindings, JWTPayload } from '@/types';
import type {
  RealtimeConfig,
  EventDrivenHandler,
  RealtimeEvent,
  QueueMessage,
  EventSource
} from '../types';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  handleApiError
} from '@/utils/api-response';
import { verifyJWT } from '@/utils/auth';

// 統一架構不再依賴外部處理器，使用內建實現

// 預設配置
const defaultConfig: RealtimeConfig = {
  version: 'auto',
  enableEventDriven: true,
  enableQueueProcessing: true,
  heartbeatInterval: 8000,
  connectionTimeout: 300000,
  maxRetries: 3,
  eventStorageTtl: 300
};

// 配置管理
class RealtimeConfigManager {
  private static instance: RealtimeConfigManager;
  private config: RealtimeConfig = defaultConfig;

  static getInstance(): RealtimeConfigManager {
    if (!RealtimeConfigManager.instance) {
      RealtimeConfigManager.instance = new RealtimeConfigManager();
    }
    return RealtimeConfigManager.instance;
  }

  updateConfig(newConfig: Partial<RealtimeConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): RealtimeConfig {
    return this.config;
  }

  // 動態版本選擇邏輯
  selectVersion(context: any): 'v1' | 'v2' {
    const config = this.getConfig();

    if (config.version !== 'auto') {
      return config.version;
    }

    // 自動選擇邏輯
    const userAgent = context.req.header('User-Agent') || '';
    const supportsEventSource = context.req.header('Accept')?.includes('text/event-stream');

    // 如果支援 EventSource 且啟用事件驅動，使用 v2
    if (supportsEventSource && config.enableEventDriven) {
      return 'v2';
    }

    // 否則使用傳統版本
    return 'v1';
  }
}

// 統一的 Real-time 處理器
export const realtimeMainHandler: EventDrivenHandler = {
  // REMOVED: SSE 端點 (Phase 3 cleanup - SSE removed, WebSocket only)
  // sse: async (c: Context<{ Bindings: Bindings }>) => {
  //   const { sseHandler } = await import('./sse-handler');
  //   return await sseHandler.connect(c);
  // },

  // 發送打字狀態 - 優先使用 v2
  sendTypingStatus: async (c: Context<{ Bindings: Bindings; Variables: { jwtPayload: JWTPayload } }>) => {
    try {
      const configManager = RealtimeConfigManager.getInstance();
      const config = configManager.getConfig();

      // 使用統一的事件處理器發送打字狀態
      const { eventHandler } = await import('./event-handler');
      return await eventHandler.sendTypingStatus(c);
    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 廣播事件 - 智能路由
  broadcastToConversation: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const configManager = RealtimeConfigManager.getInstance();
      const config = configManager.getConfig();

      // 使用統一的事件處理器廣播事件
      const { eventHandler } = await import('./event-handler');
      return await eventHandler.broadcastToConversation(c);
    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取對話狀態 - 統一接口
  getConversationStatus: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      // REMOVED: SSE handler (Phase 3 cleanup - WebSocket only)
      // const { sseHandler } = await import('./sse-handler');
      // return await sseHandler.getStats(c);

      return successResponse(c, {
        message: 'SSE removed, use WebSocket for real-time status',
        timestamp: new Date().toISOString()
      }, 'Use WebSocket instead');
    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 更新在線狀態 - 統一接口
  updateOnlineStatus: async (c: Context<{ Bindings: Bindings; Variables: { jwtPayload: JWTPayload } }>) => {
    try {
      const configManager = RealtimeConfigManager.getInstance();
      const selectedVersion = configManager.selectVersion(c);

      // 使用統一的事件處理器更新在線狀態
      const { eventHandler } = await import('./event-handler');
      return await eventHandler.updateOnlineStatus(c);
    } catch (error) {
      return handleApiError(error, c);
    }
  }
};

// 管理端點
export const realtimeManagementHandler = {
  // 獲取配置
  getConfig: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      if (!payload || payload.role !== 'admin') {
        return unauthorizedResponse(c, 'Admin access required');
      }

      const config = RealtimeConfigManager.getInstance().getConfig();
      return successResponse(c, config, 'Configuration retrieved');
    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 更新配置
  updateConfig: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      if (!payload || payload.role !== 'admin') {
        return unauthorizedResponse(c, 'Admin access required');
      }

      const newConfig = await c.req.json() as Partial<RealtimeConfig>;
      RealtimeConfigManager.getInstance().updateConfig(newConfig);

      return successResponse(c, { success: true }, 'Configuration updated');
    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取統計信息
  getStats: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      if (!payload || !['admin', 'team'].includes(payload.role)) {
        return unauthorizedResponse(c, 'Insufficient permissions');
      }

      // REMOVED: SSE stats (Phase 3 cleanup - WebSocket only)
      // const { enhancedSSEManager } = await import('./sse-handler');
      // const sseStats = enhancedSSEManager.getDetailedStats();

      const stats = {
        currentConfig: RealtimeConfigManager.getInstance().getConfig(),
        note: 'SSE removed, use WebSocket monitoring endpoints',
        timestamp: new Date().toISOString()
      };

      return successResponse(c, stats, 'Statistics retrieved');
    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 健康檢查
  healthCheck: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const config = RealtimeConfigManager.getInstance().getConfig();

      // REMOVED: SSE stats (Phase 3 cleanup - WebSocket only)
      // const { enhancedSSEManager } = await import('./sse-handler');
      // const sseStats = enhancedSSEManager.getDetailedStats();

      const health = {
        status: 'healthy',
        version: config.version,
        eventDriven: config.enableEventDriven,
        queueProcessing: config.enableQueueProcessing,
        note: 'SSE removed, use WebSocket monitoring',
        timestamp: new Date().toISOString()
      };

      return successResponse(c, health, 'Health check completed');
    } catch (error) {
      console.error('❌ [Realtime Main] 健康檢查失敗:', error);
      return errorResponse(c, 'Health check failed', 500);
    }
  }
};

// 隊列事件創建便利函數
export const createRealtimeEvent = async (
  eventType: RealtimeEvent['type'],
  eventData: RealtimeEvent['data'],
  targets: QueueMessage['targets'],
  priority: QueueMessage['priority'] = 'normal',
  env: Bindings,
  source: EventSource = 'system'
): Promise<string> => {
  const config = RealtimeConfigManager.getInstance().getConfig();

  if (config.enableQueueProcessing) {
    // 使用統一的隊列服務
    const { EventQueueService } = await import('../services/event-queue-service');
    const queueService = new EventQueueService(env);
    const result = await queueService.createAndRouteEvent(
      eventType,
      eventData,
      targets,
      priority,
      source
    );
    return result.eventId;
  } else {
    // 如果未啟用隊列處理，直接存儲到 KV
    const eventId = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
    const eventKey = `event:${targets.conversationId || 'global'}:${eventId}`;

    const eventPayload = {
      id: eventId,
      type: eventType,
      timestamp: new Date().toISOString(),
      source,
      data: eventData,
      targets
    };

    await env.SESSIONS.put(eventKey, JSON.stringify(eventPayload), {
      expirationTtl: config.eventStorageTtl
    });

    return eventId;
  }
};

// 導出配置管理器供外部使用
export { RealtimeConfigManager };