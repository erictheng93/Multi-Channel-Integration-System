// 事件隊列服務 - 統一管理所有即時事件的隊列處理

import type { Bindings } from '@/types';
import type {
  RealtimeEvent,
  EventType,
  EventSource,
  EventPriority,
  EventTargets,
  EventProcessingResult,
  QueueMessage
} from '../types';
import { QueueBaseService, QueueProcessingResult } from '@/services/queue-base-service';
import { nowISO, nowMs } from '@/utils/timestamp'

// 事件路由規則
interface EventRoutingRule {
  eventType: EventType;
  priority: EventPriority;
  targets: EventTargets;
  processingStrategy: 'immediate' | 'batch' | 'delayed';
  retryPolicy?: {
    maxRetries: number;
    backoffMultiplier: number;
    baseDelay: number;
  };
}

// 事件處理策略
export enum ProcessingStrategy {
  IMMEDIATE = 'immediate',    // 立即處理
  BATCH = 'batch',           // 批量處理
  DELAYED = 'delayed'        // 延遲處理
}

// 高級事件隊列服務
export class EventQueueService extends QueueBaseService {
  private routingRules = new Map<EventType, EventRoutingRule>();
  private batchProcessor?: NodeJS.Timeout;
  private batchQueue: QueueMessage[] = [];
  private readonly batchSize = 10;
  private readonly batchInterval = 1000; // 1秒

  constructor(env: Bindings) {
    super(env, 'EVENT_QUEUE', {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      retryableErrors: []
    });

    this.initializeRoutingRules();
    this.startBatchProcessor();
  }

  // 初始化事件路由規則
  private initializeRoutingRules(): void {
    const rules: EventRoutingRule[] = [
      {
        eventType: 'message',
        priority: 'high',
        targets: { broadcast: false },
        processingStrategy: 'immediate'
      },
      {
        eventType: 'typing_started',
        priority: 'low',
        targets: { broadcast: false },
        processingStrategy: 'immediate'
      },
      {
        eventType: 'typing_stopped',
        priority: 'low',
        targets: { broadcast: false },
        processingStrategy: 'batch'
      },
      {
        eventType: 'agent_joined',
        priority: 'normal',
        targets: { broadcast: false },
        processingStrategy: 'immediate'
      },
      {
        eventType: 'agent_left',
        priority: 'normal',
        targets: { broadcast: false },
        processingStrategy: 'batch'
      },
      {
        eventType: 'assignment_changed',
        priority: 'high',
        targets: { broadcast: false },
        processingStrategy: 'immediate'
      },
      {
        eventType: 'status_changed',
        priority: 'normal',
        targets: { broadcast: false },
        processingStrategy: 'immediate'
      },
      {
        eventType: 'notification',
        priority: 'normal',
        targets: { broadcast: false },
        processingStrategy: 'immediate'
      },
      {
        eventType: 'conversation_updated',
        priority: 'normal',
        targets: { broadcast: false },
        processingStrategy: 'batch'
      },
      {
        eventType: 'system_announcement',
        priority: 'urgent',
        targets: { broadcast: true },
        processingStrategy: 'immediate'
      }
    ];

    for (const rule of rules) {
      this.routingRules.set(rule.eventType, rule);
    }

    this.logInfo('事件路由規則已初始化', { rulesCount: rules.length });
  }

  // 創建並路由事件
  async createAndRouteEvent(
    eventType: EventType,
    eventData: any,
    targets: EventTargets,
    priority?: EventPriority,
    source: EventSource = 'system'
  ): Promise<EventProcessingResult> {
    const startTime = nowMs();

    try {
      // 獲取路由規則
      const rule = this.routingRules.get(eventType);
      const finalPriority = priority || rule?.priority || 'normal';

      // 生成事件
      const event: RealtimeEvent = {
        id: this.generateEventId(),
        type: eventType,
        timestamp: nowISO(),
        source,
        data: eventData
      };

      // 合併目標
      const finalTargets: EventTargets = {
        ...rule?.targets,
        ...targets
      };

      // 創建隊列消息
      const queueMessage: QueueMessage = {
        event,
        targets: {
          conversationId: finalTargets.conversationId,
          userIds: finalTargets.userIds,
          broadcast: finalTargets.broadcast
        },
        priority: finalPriority,
        retryCount: 0,
        maxRetries: rule?.retryPolicy?.maxRetries || this.retryConfig.maxRetries
      };

      // 根據處理策略路由
      const processingStrategy = rule?.processingStrategy || 'immediate';
      let targetReached = 0;

      switch (processingStrategy) {
        case 'immediate':
          targetReached = await this.processImmediate(queueMessage);
          break;

        case 'batch':
          targetReached = await this.addToBatch(queueMessage);
          break;

        case 'delayed':
          targetReached = await this.processDelayed(queueMessage);
          break;

        default:
          throw new Error(`未知的處理策略: ${processingStrategy}`);
      }

      const processingTime = Date.now() - startTime;

      this.logSuccess('事件路由完成', {
        eventId: event.id,
        eventType,
        processingStrategy,
        targetReached,
        processingTime
      });

      return {
        success: true,
        eventId: event.id,
        processedAt: nowISO(),
        targetReached,
        totalTargets: this.calculateTotalTargets(finalTargets),
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logError('事件路由失敗', error, { eventType, source });

      return {
        success: false,
        eventId: this.generateEventId(),
        processedAt: nowISO(),
        targetReached: 0,
        totalTargets: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        processingTime
      };
    }
  }

  // 立即處理事件 (WebSocket/DO 架構)
  private async processImmediate(queueMessage: QueueMessage): Promise<number> {
    try {
      const { event, targets } = queueMessage;
      const conversationId = targets.conversationId;

      // ✅ 新架構: 直接通過 ConversationRoom DO 廣播
      if (conversationId) {
        // 對話級事件 → ConversationRoom DO
        if (!this.env.CONVERSATION_ROOM) {
          throw new Error('CONVERSATION_ROOM binding not configured');
        }
        const roomKey = String(conversationId); // Ensure string type for idFromName
        const roomId = this.env.CONVERSATION_ROOM.idFromName(roomKey);
        const room = this.env.CONVERSATION_ROOM.get(roomId);

        const response = await room.fetch(new Request('https://conversation-room/broadcast', {
          method: 'POST',
          body: JSON.stringify({ event }),
          headers: { 'Content-Type': 'application/json' }
        }));

        if (!response.ok) {
          throw new Error(`ConversationRoom broadcast failed: ${response.status}`);
        }

        this.logInfo('立即處理事件 (WebSocket/DO)', {
          eventId: event.id,
          eventType: event.type,
          conversationId
        });

        return 1;
      } else {
        // 全局事件 → MessageBroadcaster DO
        if (!this.env.MESSAGE_BROADCASTER) {
          throw new Error('MESSAGE_BROADCASTER binding not configured');
        }
        const broadcasterId = this.env.MESSAGE_BROADCASTER.idFromName('global');
        const broadcaster = this.env.MESSAGE_BROADCASTER.get(broadcasterId);

        const response = await broadcaster.fetch(new Request('https://broadcaster/broadcast', {
          method: 'POST',
          body: JSON.stringify({
            event,
            targets: [{
              type: targets.broadcast ? 'global' : 'user',
              targets: targets.userIds || ['all']
            }]
          }),
          headers: { 'Content-Type': 'application/json' }
        }));

        if (!response.ok) {
          throw new Error(`MessageBroadcaster broadcast failed: ${response.status}`);
        }

        this.logInfo('立即處理事件 (WebSocket/DO 全局)', {
          eventId: event.id,
          eventType: event.type,
          broadcast: targets.broadcast
        });

        return 1;
      }
    } catch (error) {
      this.logError('立即處理失敗', error, {
        eventId: queueMessage.event.id
      });
      throw error;
    }
  }

  // 批量處理事件
  private async addToBatch(queueMessage: QueueMessage): Promise<number> {
    this.batchQueue.push(queueMessage);

    this.logInfo('事件加入批量隊列', {
      eventId: queueMessage.event.id,
      eventType: queueMessage.event.type,
      queueSize: this.batchQueue.length
    });

    // 如果達到批量大小，立即處理
    if (this.batchQueue.length >= this.batchSize) {
      await this.processBatchQueue();
    }

    return 1;
  }

  // 延遲處理事件 (MessageBroadcaster DO)
  private async processDelayed(queueMessage: QueueMessage, delay: number = 5000): Promise<number> {
    setTimeout(async () => {
      try {
        const { event, targets } = queueMessage;

        // ✅ 新架構: 使用 MessageBroadcaster DO 處理延遲事件
        if (!this.env.MESSAGE_BROADCASTER) {
          throw new Error('MESSAGE_BROADCASTER binding not configured');
        }
        const broadcasterId = this.env.MESSAGE_BROADCASTER.idFromName('global');
        const broadcaster = this.env.MESSAGE_BROADCASTER.get(broadcasterId);

        const response = await broadcaster.fetch(new Request('https://broadcaster/broadcast', {
          method: 'POST',
          body: JSON.stringify({
            event,
            targets: [{
              type: targets.conversationId ? 'conversation' : 'global',
              targets: targets.conversationId ? [targets.conversationId] : ['all']
            }],
            options: { delayed: true, originalDelay: delay }
          }),
          headers: { 'Content-Type': 'application/json' }
        }));

        if (response.ok) {
          this.logInfo('延遲處理事件完成 (WebSocket/DO)', {
            eventId: event.id,
            delay
          });
        } else {
          throw new Error(`MessageBroadcaster delayed broadcast failed: ${response.status}`);
        }
      } catch (error) {
        this.logError('延遲處理失敗', error, {
          eventId: queueMessage.event.id
        });
      }
    }, delay);

    return 1;
  }

  // 處理批量隊列 (MessageBroadcaster DO 批處理)
  private async processBatchQueue(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const batch = [...this.batchQueue];
    this.batchQueue = [];

    this.logInfo('開始處理批量隊列 (WebSocket/DO)', { batchSize: batch.length });

    try {
      // ✅ 新架構: 使用 MessageBroadcaster DO 批處理
      if (!this.env.MESSAGE_BROADCASTER) {
        throw new Error('MESSAGE_BROADCASTER binding not configured');
      }
      const broadcasterId = this.env.MESSAGE_BROADCASTER.idFromName('global');
      const broadcaster = this.env.MESSAGE_BROADCASTER.get(broadcasterId);

      // 將 batch 轉換為 MessageBroadcaster 格式
      const events = batch.map(qm => qm.event);
      const targets = batch.map(qm => ({
        type: qm.targets.conversationId ? 'conversation' :
              qm.targets.broadcast ? 'global' : 'user',
        targets: qm.targets.conversationId ? [qm.targets.conversationId] :
                qm.targets.userIds || ['all']
      }));

      // 批量廣播
      const response = await broadcaster.fetch(new Request('https://broadcaster/batch-events', {
        method: 'POST',
        body: JSON.stringify({ events, targets }),
        headers: { 'Content-Type': 'application/json' }
      }));

      if (!response.ok) {
        throw new Error(`MessageBroadcaster batch failed: ${response.status}`);
      }

      const result = await response.json() as { deliveredCount?: number };

      this.logSuccess('批量隊列處理完成 (WebSocket/DO)', {
        processedCount: batch.length,
        deliveredCount: result.deliveredCount || batch.length
      });

    } catch (error) {
      this.logError('批量隊列處理失敗', error, {
        batchSize: batch.length
      });

      // 將失敗的事件重新加入隊列
      this.batchQueue.unshift(...batch);
    }
  }

  // 啟動批量處理器
  private startBatchProcessor(): void {
    this.batchProcessor = setInterval(async () => {
      if (this.batchQueue.length > 0) {
        await this.processBatchQueue();
      }
    }, this.batchInterval);

    this.logInfo('批量處理器已啟動', {
      interval: this.batchInterval,
      batchSize: this.batchSize
    });
  }

  // 停止批量處理器
  private stopBatchProcessor(): void {
    if (this.batchProcessor) {
      clearInterval(this.batchProcessor);
      this.batchProcessor = undefined;
      this.logInfo('批量處理器已停止');
    }
  }

  // 實現基類的抽象方法
  protected async processMessage(queueMessage: QueueMessage): Promise<QueueProcessingResult> {
    const { event, targets, priority } = queueMessage;

    this.logInfo('處理隊列消息', {
      eventId: event.id,
      eventType: event.type,
      priority
    });

    try {
      // 這裡應該調用實際的事件處理邏輯
      // 例如發送到 SSE 連接、更新資料庫等

      // 模擬處理
      await new Promise(resolve => setTimeout(resolve, 10));

      return {
        success: true,
        messageId: event.id,
        processingTime: 10,
        metadata: {
          eventType: event.type,
          priority
        }
      };

    } catch (error) {
      this.logError('隊列消息處理失敗', error, {
        eventId: event.id
      });

      return {
        success: false,
        messageId: event.id,
        processingTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // 更新路由規則
  updateRoutingRule(eventType: EventType, rule: Partial<EventRoutingRule>): void {
    const existingRule = this.routingRules.get(eventType);
    if (existingRule) {
      this.routingRules.set(eventType, { ...existingRule, ...rule });
      this.logInfo('路由規則已更新', { eventType, rule });
    } else {
      this.logWarning('路由規則不存在', { eventType });
    }
  }

  // 獲取所有路由規則
  getRoutingRules(): Record<EventType, EventRoutingRule> {
    const rules: Record<string, EventRoutingRule> = {};
    for (const [eventType, rule] of this.routingRules) {
      rules[eventType] = rule;
    }
    return rules as Record<EventType, EventRoutingRule>;
  }

  // 獲取隊列統計
  getQueueStats() {
    const baseStats = this.getProcessingStats();

    return {
      ...baseStats,
      queueType: 'event_queue',
      purpose: '事件路由和批量處理',
      batchQueue: {
        size: this.batchQueue.length,
        maxSize: this.batchSize,
        processingInterval: this.batchInterval
      },
      routingRules: Object.keys(this.getRoutingRules()).length
    };
  }

  // 清理資源
  async cleanup(): Promise<void> {
    this.stopBatchProcessor();

    // 處理剩餘的批量隊列
    if (this.batchQueue.length > 0) {
      await this.processBatchQueue();
    }

    this.logInfo('事件隊列服務清理完成');
  }

  // 私有工具方法
  private generateEventId(): string {
    return `evt-${nowMs()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  private calculateTotalTargets(targets: EventTargets): number {
    let total = 0;
    if (targets.userIds) total += targets.userIds.length;
    if (targets.teamIds) total += targets.teamIds.length;
    if (targets.broadcast) total = 999; // 廣播假設為大量目標
    return Math.max(total, 1);
  }
}