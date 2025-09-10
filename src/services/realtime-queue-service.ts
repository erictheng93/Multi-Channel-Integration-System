// 實時隊列服務 - 繼承基礎隊列服務
// Realtime Queue Service - 處理實時事件推送和SSE連接管理

import { QueueBaseService, QueueProcessingResult, QueueErrorType } from './queue-base-service';
// 使用全域 SSE 管理器實例
const getSseManager = () => {
  if (!globalThis.__sseManager) {
    const { sseManager } = require('../handlers/realtime-queue');
    return sseManager;
  }
  return globalThis.__sseManager;
};
import type { Bindings, QueueMessage, RealtimeEvent } from '../types';

export class RealtimeQueueService extends QueueBaseService {
  
  constructor(env: Bindings) {
    super(env, 'REALTIME_QUEUE', {
      maxRetries: 2,         // 實時隊列重試次數較少
      baseDelay: 500,        // 快速重試
      maxDelay: 5000,        // 最大5秒延遲
      backoffMultiplier: 2,
      retryableErrors: [
        QueueErrorType.NETWORK_ERROR,
        QueueErrorType.TIMEOUT,
        QueueErrorType.TEMPORARY_FAILURE
      ]
    });
  }

  // 實現具體的消息處理邏輯
  protected async processMessage(queueMessage: QueueMessage): Promise<QueueProcessingResult> {
    const { event, targets, priority } = queueMessage;
    
    this.logInfo(`處理實時事件`, {
      eventType: event.type,
      eventId: event.id,
      priority,
      targets: {
        conversationId: targets.conversationId,
        userCount: targets.userIds?.length,
        broadcast: targets.broadcast
      }
    });

    try {
      // 獲取當前SSE連接統計
      const sseManager = getSseManager();
      const currentStats = await sseManager.getStats();
      this.logInfo(`當前SSE連接狀態`, {
        totalConnections: currentStats.totalConnections || 0,
        connectionsByUser: Object.keys(currentStats.connectionsByUser || {}).length
      });

      // 推送事件到相關的SSE連接
      const successCount = await this.measurePerformance(
        () => sseManager.pushToRelevantConnections(event, targets),
        `推送事件到SSE連接: ${event.type}`
      );

      // 如果沒有活躍連接，存儲事件以供後續連接檢索
      if (successCount === 0) {
        await this.storeEventForRetrieval(event, targets);
        this.logWarning(`無活躍SSE連接，事件已存儲供後續檢索`, {
          eventId: event.id,
          eventType: event.type
        });
      }

      this.logSuccess(`實時事件處理完成`, {
        eventId: event.id,
        eventType: event.type,
        successfulPushes: successCount,
        storedForRetrieval: successCount === 0
      });

      return {
        success: true,
        messageId: event.id,
        processingTime: 0,
        metadata: {
          eventType: event.type,
          successfulPushes: successCount,
          totalConnections: currentStats.totalConnections
        }
      };

    } catch (error) {
      this.logError(`處理實時事件時發生錯誤`, error, {
        eventId: event.id,
        eventType: event.type
      });

      return {
        success: false,
        messageId: event.id,
        processingTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          eventType: event.type,
          errorContext: 'sse_push_failed'
        }
      };
    }
  }

  // 存儲事件到 KV 供後續 SSE 連接檢索
  private async storeEventForRetrieval(
    event: RealtimeEvent, 
    targets: QueueMessage['targets']
  ): Promise<void> {
    try {
      const eventKey = `recent_event:${targets.conversationId || 'global'}:${event.id}`;
      const eventData = {
        event,
        targets,
        storedAt: new Date().toISOString()
      };

      // 存儲 5 分鐘，供新建立的 SSE 連接檢索
      await this.env.SESSIONS.put(eventKey, JSON.stringify(eventData), { 
        expirationTtl: 300 
      });
      
      this.logInfo(`事件已存儲供後續檢索`, { eventKey });
    } catch (error) {
      this.logError(`存儲事件失敗`, error, { eventId: event.id });
      // 存儲失敗不影響主要流程，只記錄錯誤
    }
  }

  // 為新的 SSE 連接檢索最近的事件
  public async getRecentEventsForConnection(
    conversationId: number | null, 
    userId: number
  ): Promise<RealtimeEvent[]> {
    try {
      const prefix = conversationId ? `recent_event:${conversationId}:` : 'recent_event:global:';
      const keys = await this.env.SESSIONS.list({ prefix });
      const events: RealtimeEvent[] = [];

      for (const key of keys.keys) {
          try {
            const eventDataStr = await this.env.SESSIONS.get(key.name);
            if (eventDataStr) {
              const { event, targets } = JSON.parse(eventDataStr);
              
              // 檢查事件是否與此用戶相關
              const isRelevant = targets.broadcast || 
                               targets.userIds?.includes(userId) ||
                               (conversationId && targets.conversationId === conversationId);
              
              if (isRelevant) {
                events.push(event);
              }
            }
          } catch (error) {
            this.logError(`解析存儲事件失敗`, error, { keyName: key.name });
          }
        }

      // 按時間排序，最新的在前
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      const recentEvents = events.slice(0, 10); // 最多返回10個最近事件
      this.logInfo(`檢索最近事件完成`, { 
        userId, 
        conversationId, 
        eventCount: recentEvents.length 
      });
      
      return recentEvents;
      
    } catch (error) {
      this.logError(`檢索最近事件失敗`, error, { userId, conversationId });
      return [];
    }
  }

  // 創建事件並推送到隊列
  public async createAndQueueEvent(
    eventType: RealtimeEvent['type'],
    eventData: RealtimeEvent['data'],
    targets: QueueMessage['targets'],
    priority: QueueMessage['priority'] = 'normal',
    source = 'system'
  ): Promise<string> {
    const eventId = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
    
    const event: RealtimeEvent = {
      id: eventId,
      type: eventType,
      timestamp: new Date().toISOString(),
      source,
      data: eventData
    } as RealtimeEvent;

    const queueMessage: QueueMessage = {
      event,
      targets,
      priority,
      retryCount: 0,
      maxRetries: this.retryConfig.maxRetries
    };

    try {
      await this.measurePerformance(
        () => this.env.REALTIME_QUEUE.send(queueMessage),
        `推送事件到實時隊列: ${eventType}`
      );
      
      this.logSuccess(`事件已推送到隊列`, { 
        eventId, 
        eventType, 
        priority,
        targets 
      });
      
      return eventId;
    } catch (error) {
      this.logError(`推送事件到隊列失敗`, error, { eventId, eventType });
      throw error;
    }
  }

  // 批次處理實時隊列消息
  public async processMessageBatch(batch: MessageBatch<QueueMessage>): Promise<void> {
    this.logInfo(`開始處理實時隊列批次`, { 
      batchSize: batch.messages.length,
      queueName: batch.queue
    });

    // 定期清理過期的SSE連接並設置環境
    const sseManager = getSseManager();
    sseManager.setEnv(this.env);
    sseManager.cleanupStaleConnections();

    // 處理每個消息
    for (const message of batch.messages) {
      await this.handleQueueMessage(message);
    }

    const currentStats = await getSseManager().getStats();
    this.logSuccess(`實時隊列批次處理完成`, {
      processedCount: batch.messages.length,
      currentConnections: currentStats.totalConnections || 0,
      stats: this.getProcessingStats()
    });
  }

  // 獲取實時隊列特定的統計信息
  public async getRealtimeQueueStats() {
    const baseStats = this.getProcessingStats();
    const sseStats = await getSseManager().getStats();
    
    return {
      ...baseStats,
      queueType: 'realtime',
      purpose: '實時事件推送和SSE連接管理',
      sseConnections: {
        total: sseStats.totalConnections || 0,
        byUser: Object.keys(sseStats.connectionsByUser || {}).length,
        details: sseStats.connectionsByUser || {}
      },
      configuration: {
        maxRetries: this.retryConfig.maxRetries,
        baseDelay: this.retryConfig.baseDelay,
        maxDelay: this.retryConfig.maxDelay,
        backoffMultiplier: this.retryConfig.backoffMultiplier
      }
    };
  }

  // 維護操作
  public performMaintenance(operation: string): any {
    const sseManager = getSseManager();
    switch (operation) {
      case 'cleanup_stale_connections':
        sseManager.cleanupStaleConnections();
        return { operation, completed: true, stats: sseManager.getStats() };
        
      case 'get_connection_details':
        return sseManager.getStats();
        
      case 'reset_stats':
        this.resetStats();
        return { operation, completed: true };
        
      default:
        throw new Error(`未知的維護操作: ${operation}`);
    }
  }
}