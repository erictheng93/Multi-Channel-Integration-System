// Real-time 管理服務 - 統一的即時通訊管理

import type { Bindings } from '../../../types';
import type {
  RealtimeEvent,
  RealtimeConfig,
  EventTargets,
  EventPriority,
  EventSource,
  SSEConnectionStats,
  EventStats,
  RealtimeServiceConfig
} from '../types';
import { EventQueueService } from '@modules/realtime/services/event-queue-service';
import { enhancedSSEManager } from '@modules/realtime/handlers/sse-handler';
import { eventStats } from '@modules/realtime/handlers/event-handler';
import { RealtimeConfigManager } from '@modules/realtime/handlers/realtime-main';

// 服務狀態枚舉
export enum ServiceStatus {
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  DEGRADED = 'degraded',
  STOPPED = 'stopped',
  ERROR = 'error'
}

// 服務健康狀態
export interface ServiceHealth {
  status: ServiceStatus;
  uptime: number;
  lastCheck: string;
  components: {
    sseManager: 'healthy' | 'degraded' | 'down';
    queueService: 'healthy' | 'degraded' | 'down';
    database: 'healthy' | 'degraded' | 'down';
    kvStore: 'healthy' | 'degraded' | 'down';
  };
  metrics: {
    activeConnections: number;
    eventsProcessed: number;
    errorRate: number;
    averageResponseTime: number;
  };
}

// 統一的 Real-time 管理服務
export class RealtimeManager {
  private static instance: RealtimeManager;
  private env?: Bindings;
  private queueService?: EventQueueService;
  private status: ServiceStatus = ServiceStatus.INITIALIZING;
  private startTime: number = Date.now();
  private healthCheckInterval?: NodeJS.Timeout;

  // 單例模式
  static getInstance(): RealtimeManager {
    if (!RealtimeManager.instance) {
      RealtimeManager.instance = new RealtimeManager();
    }
    return RealtimeManager.instance;
  }

  // 初始化服務
  async initialize(env: Bindings, config?: Partial<RealtimeServiceConfig>): Promise<void> {
    try {
      this.env = env;
      this.status = ServiceStatus.INITIALIZING;

      // 初始化隊列服務
      this.queueService = new EventQueueService(env);

      // 設置 SSE 管理器環境
      enhancedSSEManager.setEnv(env);

      // 更新配置
      if (config) {
        const configManager = RealtimeConfigManager.getInstance();
        const currentConfig = configManager.getConfig();
        configManager.updateConfig({
          ...currentConfig,
          heartbeatInterval: config.heartbeatInterval || currentConfig.heartbeatInterval,
          connectionTimeout: config.connectionTimeout || currentConfig.connectionTimeout,
          maxRetries: config.maxRetries || currentConfig.maxRetries,
          eventStorageTtl: config.eventStorageTtl || currentConfig.eventStorageTtl
        });
      }

      // 啟動健康檢查
      this.startHealthCheck();

      this.status = ServiceStatus.RUNNING;
      console.log('✅ [Realtime Manager] 服務初始化完成');

    } catch (error) {
      this.status = ServiceStatus.ERROR;
      console.error('❌ [Realtime Manager] 初始化失敗:', error);
      throw error;
    }
  }

  // 創建並處理事件
  async createEvent(
    eventType: RealtimeEvent['type'],
    eventData: any,
    targets: EventTargets,
    priority: EventPriority = 'normal',
    source: EventSource = 'system'
  ): Promise<{
    eventId: string;
    queueDelivered: boolean;
    sseDelivered: number;
    processingTime: number;
  }> {
    const startTime = Date.now();

    if (!this.env || !this.queueService) {
      throw new Error('Service not initialized');
    }

    try {
      // 生成事件 ID
      const eventId = `${Date.now()}-${Math.random().toString(36).substring(2)}`;

      // 創建事件對象
      const event: RealtimeEvent = {
        id: eventId,
        type: eventType,
        timestamp: new Date().toISOString(),
        source,
        data: eventData
      };

      // 推送到隊列
      let queueDelivered = false;
      try {
        await this.queueService.createAndRouteEvent(
          eventType,
          eventData,
          {
            conversationId: targets.conversationId,
            userIds: targets.userIds,
            broadcast: targets.broadcast
          },
          priority,
          source
        );
        queueDelivered = true;
      } catch (queueError) {
        console.error('❌ [Realtime Manager] 隊列推送失敗:', queueError);
      }

      // 立即推送到活躍的 SSE 連接
      let sseDelivered = 0;
      try {
        if (targets.broadcast) {
          sseDelivered = enhancedSSEManager.broadcast({
            type: 'data',
            data: {
              type: eventType,
              data: eventData
            },
            timestamp: new Date().toISOString()
          });
        } else if (targets.conversationId) {
          sseDelivered = enhancedSSEManager.sendToConversation(
            targets.conversationId,
            {
              type: 'data',
              data: {
                type: eventType,
                data: eventData
              },
              timestamp: new Date().toISOString()
            },
            targets.excludeUsers
          );
        } else if (targets.userIds) {
          for (const userId of targets.userIds) {
            sseDelivered += enhancedSSEManager.sendToUser(userId, {
              type: 'data',
              data: {
                type: eventType,
                data: eventData
              },
              timestamp: new Date().toISOString()
            });
          }
        }
      } catch (sseError) {
        console.error('❌ [Realtime Manager] SSE 推送失敗:', sseError);
      }

      const processingTime = Date.now() - startTime;

      console.log(`✅ [Realtime Manager] 事件處理完成: ${eventId}`, {
        type: eventType,
        queueDelivered,
        sseDelivered,
        processingTime
      });

      return {
        eventId,
        queueDelivered,
        sseDelivered,
        processingTime
      };

    } catch (error) {
      console.error('❌ [Realtime Manager] 事件創建失敗:', error);
      throw error;
    }
  }

  // 批量創建事件
  async createBatchEvents(
    events: Array<{
      eventType: RealtimeEvent['type'];
      eventData: any;
      targets: EventTargets;
      priority?: EventPriority;
    }>,
    source: EventSource = 'system'
  ): Promise<{
    totalEvents: number;
    successCount: number;
    failureCount: number;
    results: Array<{
      eventId?: string;
      success: boolean;
      error?: string;
    }>;
    totalProcessingTime: number;
  }> {
    const startTime = Date.now();
    const results: Array<{ eventId?: string; success: boolean; error?: string }> = [];
    let successCount = 0;
    let failureCount = 0;

    for (const event of events) {
      try {
        const result = await this.createEvent(
          event.eventType,
          event.eventData,
          event.targets,
          event.priority || 'normal',
          source
        );

        results.push({
          eventId: result.eventId,
          success: true
        });
        successCount++;
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        failureCount++;
      }
    }

    const totalProcessingTime = Date.now() - startTime;

    console.log(`📊 [Realtime Manager] 批量事件處理完成`, {
      totalEvents: events.length,
      successCount,
      failureCount,
      totalProcessingTime
    });

    return {
      totalEvents: events.length,
      successCount,
      failureCount,
      results,
      totalProcessingTime
    };
  }

  // 獲取服務健康狀態
  async getServiceHealth(): Promise<ServiceHealth> {
    const uptime = Date.now() - this.startTime;
    const sseStats = enhancedSSEManager.getDetailedStats();
    const eventStatsData = eventStats.getStats();

    // 檢查各組件健康狀態
    const components = {
      sseManager: 'healthy' as 'healthy' | 'degraded' | 'down',
      queueService: this.queueService ? 'healthy' as 'healthy' | 'degraded' | 'down' : 'down' as 'healthy' | 'degraded' | 'down',
      database: 'healthy' as 'healthy' | 'degraded' | 'down',
      kvStore: 'healthy' as 'healthy' | 'degraded' | 'down'
    };

    // 檢查資料庫連接
    if (this.env?.DB) {
      try {
        await this.env.DB.prepare('SELECT 1').first();
      } catch (error) {
        components.database = 'down';
      }
    }

    // 檢查 KV 存儲
    if (this.env?.SESSIONS) {
      try {
        await this.env.SESSIONS.get('health_check');
      } catch (error) {
        components.kvStore = 'down';
      }
    }

    // 計算服務狀態
    let serviceStatus = this.status;
    const downComponents = Object.values(components).filter(status => status === 'down').length;
    const degradedComponents = Object.values(components).filter(status => status === 'degraded').length;

    if (downComponents > 0) {
      serviceStatus = ServiceStatus.DEGRADED;
    }
    if (downComponents >= 2) {
      serviceStatus = ServiceStatus.ERROR;
    }

    return {
      status: serviceStatus,
      uptime,
      lastCheck: new Date().toISOString(),
      components,
      metrics: {
        activeConnections: sseStats.totalConnections || 0,
        eventsProcessed: eventStatsData.totalEvents,
        errorRate: eventStatsData.errorRate,
        averageResponseTime: eventStatsData.averageProcessingTime
      }
    };
  }

  // 獲取綜合統計信息
  async getComprehensiveStats(): Promise<{
    service: ServiceHealth;
    sse: SSEConnectionStats;
    events: EventStats;
    queue?: any;
    config: RealtimeConfig;
  }> {
    const serviceHealth = await this.getServiceHealth();
    const sseStats = enhancedSSEManager.getDetailedStats();
    const eventStatsData = eventStats.getStats();
    const queueStats = this.queueService ? await this.queueService.getProcessingStats() : undefined;
    const config = RealtimeConfigManager.getInstance().getConfig();

    return {
      service: serviceHealth,
      sse: sseStats,
      events: eventStatsData,
      queue: queueStats,
      config
    };
  }

  // 維護操作
  async performMaintenance(operation: 'cleanup' | 'reset_stats' | 'restart_health_check'): Promise<boolean> {
    try {
      switch (operation) {
        case 'cleanup':
          enhancedSSEManager.cleanupStaleConnections();
          console.log('🧹 [Realtime Manager] 清理操作完成');
          return true;

        case 'reset_stats':
          eventStats.reset();
          console.log('📊 [Realtime Manager] 統計重置完成');
          return true;

        case 'restart_health_check':
          this.stopHealthCheck();
          this.startHealthCheck();
          console.log('🏥 [Realtime Manager] 健康檢查重啟完成');
          return true;

        default:
          throw new Error(`未知的維護操作: ${operation}`);
      }
    } catch (error) {
      console.error('❌ [Realtime Manager] 維護操作失敗:', error);
      return false;
    }
  }

  // 關閉服務
  async shutdown(): Promise<void> {
    try {
      this.status = ServiceStatus.STOPPED;
      this.stopHealthCheck();
      console.log('🛑 [Realtime Manager] 服務已關閉');
    } catch (error) {
      console.error('❌ [Realtime Manager] 關閉服務時發生錯誤:', error);
    }
  }

  // 私有方法：啟動健康檢查
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getServiceHealth();
        if (health.status === ServiceStatus.ERROR) {
          console.error('🚨 [Realtime Manager] 服務健康檢查失敗');
        }
      } catch (error) {
        console.error('❌ [Realtime Manager] 健康檢查錯誤:', error);
      }
    }, 60000); // 每分鐘檢查一次
  }

  // 私有方法：停止健康檢查
  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  // 獲取服務狀態
  getStatus(): ServiceStatus {
    return this.status;
  }

  // 獲取運行時間
  getUptime(): number {
    return Date.now() - this.startTime;
  }
}