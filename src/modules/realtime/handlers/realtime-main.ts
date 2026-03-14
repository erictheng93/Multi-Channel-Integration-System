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
import { nowISO, nowMs } from '@/utils/timestamp'

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

  // Version selection (WebSocket only - SSE removed)
  selectVersion(_context: any): 'v1' | 'v2' {
    const config = this.getConfig();

    if (config.version !== 'auto') {
      return config.version;
    }

    // Default to v2 (event-driven) since WebSocket is the standard
    return 'v2';
  }
}

// Unified Real-time handler (WebSocket only)
export const realtimeMainHandler: EventDrivenHandler = {
  // 發送打字狀態
  sendTypingStatus: async (c: Context<{ Bindings: Bindings; Variables: { jwtPayload: JWTPayload } }>) => {
    try {
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

      // 使用統一的事件處理器廣播事件
      const { eventHandler } = await import('./event-handler');
      return await eventHandler.broadcastToConversation(c);
    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // Get conversation status (WebSocket only)
  getConversationStatus: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      return successResponse(c, {
        message: 'Use WebSocket for real-time status',
        timestamp: nowISO()
      }, 'Use WebSocket for real-time status');
    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 更新在線狀態 - 統一接口
  updateOnlineStatus: async (c: Context<{ Bindings: Bindings; Variables: { jwtPayload: JWTPayload } }>) => {
    try {
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

      const stats = {
        currentConfig: RealtimeConfigManager.getInstance().getConfig(),
        timestamp: nowISO()
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

      const health = {
        status: 'healthy',
        version: config.version,
        eventDriven: config.enableEventDriven,
        queueProcessing: config.enableQueueProcessing,
        timestamp: nowISO()
      };

      return successResponse(c, health, 'Health check completed');
    } catch (error) {
      console.error('[Realtime Main] 健康檢查失敗:', error);
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
    const eventId = `${nowMs()}-${Math.random().toString(36).substring(2)}`;
    const eventKey = `event:${targets.conversationId || 'global'}:${eventId}`;

    const eventPayload = {
      id: eventId,
      type: eventType,
      timestamp: nowISO(),
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