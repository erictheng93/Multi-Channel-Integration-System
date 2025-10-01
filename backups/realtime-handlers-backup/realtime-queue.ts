// 實時事件隊列處理器
// 專案名稱：Multi-Channel Support MVP - Event-Driven Push System
// 處理來自 Cloudflare Queue 的實時事件並推送到 SSE 連接

import type { Bindings, QueueMessage, RealtimeEvent, SSEPushData } from '../types';

// 活躍的 SSE 連接管理 - 混合模式（記憶體+KV）
class SSEConnectionManager {
  private connections = new Map<string, {
    controller: ReadableStreamDefaultController;
    encoder: TextEncoder;
    userId: number;
    conversationId?: number;
    lastActivity: number;
  }>();
  private env?: any;

  setEnv(env: any) {
    this.env = env;
  }

  // 註冊新的 SSE 連接
  async addConnection(connectionId: string, controller: ReadableStreamDefaultController, userId: number, conversationId?: number) {
    const encoder = new TextEncoder();
    const connectionData = {
      controller,
      encoder,
      userId,
      ...(conversationId !== undefined && { conversationId }),
      lastActivity: Date.now()
    };
    
    this.connections.set(connectionId, connectionData);
    
    // 同時註冊到 KV 以供跨 Worker 實例查詢
    if (this.env?.SESSIONS) {
      try {
        const kvData = {
          connectionId,
          userId,
          conversationId,
          registeredAt: new Date().toISOString(),
          workerId: `worker-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
        };
        await this.env.SESSIONS.put(`sse_connection:${connectionId}`, JSON.stringify(kvData), { expirationTtl: 300 });
        
        // 更新連接計數器
        const statsKey = 'sse_connection_stats';
        const currentStats = await this.env.SESSIONS.get(statsKey);
        const stats = currentStats ? JSON.parse(currentStats) : { totalConnections: 0, connectionsByUser: {} };
        
        stats.totalConnections = this.connections.size;
        stats.connectionsByUser[userId] = (stats.connectionsByUser[userId] || 0) + 1;
        stats.lastUpdated = new Date().toISOString();
        
        await this.env.SESSIONS.put(statsKey, JSON.stringify(stats), { expirationTtl: 300 });
        
        console.log(`📡 [SSE Manager] Connection registered: ${connectionId} (User: ${userId}, Conv: ${conversationId}) - Synced to KV`);
      } catch (error) {
        console.error(`❌ [SSE Manager] Failed to sync connection to KV:`, error);
      }
    }
  }

  // 移除 SSE 連接
  async removeConnection(connectionId: string) {
    const connectionData = this.connections.get(connectionId);
    this.connections.delete(connectionId);
    
    // 同時從 KV 移除
    if (this.env?.SESSIONS) {
      try {
        await this.env.SESSIONS.delete(`sse_connection:${connectionId}`);
        
        // 更新連接計數器
        if (connectionData) {
          const statsKey = 'sse_connection_stats';
          const currentStats = await this.env.SESSIONS.get(statsKey);
          const stats = currentStats ? JSON.parse(currentStats) : { totalConnections: 0, connectionsByUser: {} };
          
          stats.totalConnections = Math.max(0, this.connections.size);
          const userId = connectionData.userId;
          if (stats.connectionsByUser[userId]) {
            stats.connectionsByUser[userId] = Math.max(0, stats.connectionsByUser[userId] - 1);
            if (stats.connectionsByUser[userId] === 0) {
              delete stats.connectionsByUser[userId];
            }
          }
          stats.lastUpdated = new Date().toISOString();
          
          await this.env.SESSIONS.put(statsKey, JSON.stringify(stats), { expirationTtl: 300 });
        }
        
        console.log(`🔌 [SSE Manager] Connection removed: ${connectionId} - Synced to KV`);
      } catch (error) {
        console.error(`❌ [SSE Manager] Failed to remove connection from KV:`, error);
      }
    }
  }

  // 推送事件到特定連接
  pushToConnection(connectionId: string, data: SSEPushData): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    try {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      connection.controller.enqueue(connection.encoder.encode(message));
      connection.lastActivity = Date.now();
      return true;
    } catch (error) {
      console.error(`❌ [SSE Manager] Failed to push to ${connectionId}:`, error);
      this.removeConnection(connectionId);
      return false;
    }
  }

  // 推送到所有相關連接 - 支援跨 Worker 實例查詢
  async pushToRelevantConnections(event: RealtimeEvent, targets: QueueMessage['targets']): Promise<number> {
    let successCount = 0;
    const pushData: SSEPushData = {
      type: event.type,
      data: event.data,
      timestamp: event.timestamp,
      conversationId: targets.conversationId ?? 0,
      targetUsers: targets.userIds ?? []
    };

    // 推送到本地連接
    for (const [connectionId, connection] of this.connections) {
      let shouldPush = false;

      // 檢查是否應該推送到此連接
      if (targets.broadcast) {
        shouldPush = true;
      } else if (targets.conversationId && connection.conversationId === targets.conversationId) {
        shouldPush = true;
      } else if (targets.userIds && targets.userIds.includes(connection.userId)) {
        shouldPush = true;
      }

      if (shouldPush && this.pushToConnection(connectionId, pushData)) {
        successCount++;
      }
    }

    // 如果本地沒有連接，但 KV 中有全域連接，存儲事件供其他 Worker 實例檢索
    if (successCount === 0 && this.env?.SESSIONS) {
      try {
        const statsKey = 'sse_connection_stats';
        const kvStats = await this.env.SESSIONS.get(statsKey);
        if (kvStats) {
          const globalStats = JSON.parse(kvStats);
          if (globalStats.totalConnections > 0) {
            console.log(`📡 [SSE Manager] No local connections but ${globalStats.totalConnections} global connections exist - event will be handled by other Worker instances`);
            // 不需要額外動作，事件已經通過隊列分發到其他 Worker 實例
          }
        }
      } catch (error) {
        console.error(`❌ [SSE Manager] Failed to check global connection stats:`, error);
      }
    }

    return successCount;
  }

  // 清理過期連接
  cleanupStaleConnections(timeoutMs = 300000) { // 5分鐘超時
    const now = Date.now();
    const staleConnections = [];

    for (const [connectionId, connection] of this.connections) {
      if (now - connection.lastActivity > timeoutMs) {
        staleConnections.push(connectionId);
      }
    }

    staleConnections.forEach(id => this.removeConnection(id));
    if (staleConnections.length > 0) {
      console.log(`🧹 [SSE Manager] Cleaned up ${staleConnections.length} stale connections`);
    }
  }

  // 獲取連接統計 - 混合模式（本地+KV）
  async getStats() {
    const localStats = {
      totalConnections: this.connections.size,
      connectionsByUser: Array.from(this.connections.values()).reduce((acc, conn) => {
        acc[conn.userId] = (acc[conn.userId] || 0) + 1;
        return acc;
      }, {} as Record<number, number>)
    };

    // 嘗試從 KV 獲取全域統計
    if (this.env?.SESSIONS) {
      try {
        const statsKey = 'sse_connection_stats';
        const kvStats = await this.env.SESSIONS.get(statsKey);
        if (kvStats) {
          const globalStats = JSON.parse(kvStats);
          return {
            ...localStats,
            globalTotalConnections: globalStats.totalConnections || 0,
            globalConnectionsByUser: globalStats.connectionsByUser || {},
            lastGlobalUpdate: globalStats.lastUpdated
          };
        }
      } catch (error) {
        console.error(`❌ [SSE Manager] Failed to get global stats from KV:`, error);
      }
    }

    return localStats;
  }
}

// 全域 SSE 連接管理器 - 使用 globalThis 確保在 Cloudflare Workers 中是單例
declare global {
  var __sseManager: SSEConnectionManager | undefined;
}

export const sseManager = globalThis.__sseManager ?? (globalThis.__sseManager = new SSEConnectionManager());

// 隊列事件處理器
export const realtimeQueueHandler = {
  // 處理隊列中的事件
  async processEvent(batch: MessageBatch<QueueMessage>, env: Bindings): Promise<void> {
    console.log(`🎯 [Queue Handler] Processing batch of ${batch.messages.length} events`);

    // 定期清理過期連接
    sseManager.cleanupStaleConnections();

    for (const message of batch.messages) {
      try {
        await this.handleSingleEvent(message.body, env);
        message.ack(); // 確認處理成功
      } catch (error) {
        console.error('❌ [Queue Handler] Failed to process event:', error);
        message.retry(); // 重試處理
      }
    }
  },

  // 處理單個事件
  async handleSingleEvent(queueMessage: QueueMessage, env: Bindings): Promise<void> {
    const { event, targets } = queueMessage;
    
    console.log(`📨 [Queue Handler] Processing ${event.type} event for targets:`, {
      conversationId: targets.conversationId,
      userCount: targets.userIds?.length,
      broadcast: targets.broadcast
    });

    // 📊 顯示當前連接狀態
    const currentStats = await sseManager.getStats();
    console.log(`📊 [Queue Handler] Current SSE connections:`, {
      totalConnections: currentStats.totalConnections,
      connectionsByUser: currentStats.connectionsByUser
    });

    // 推送到 SSE 連接
    const successCount = await sseManager.pushToRelevantConnections(event, targets);
    
    // 如果沒有活躍連接，存儲到 KV 作為備份
    if (successCount === 0) {
      await this.storeEventForRetrieval(event, targets, env);
    }

    console.log(`✅ [Queue Handler] Event ${event.id} pushed to ${successCount} connections`);
  },

  // 存儲事件到 KV 供後續 SSE 連接檢索
  async storeEventForRetrieval(event: RealtimeEvent, targets: QueueMessage['targets'], env: Bindings): Promise<void> {
    try {
      const eventKey = `recent_event:${targets.conversationId || 'global'}:${event.id}`;
      const eventData = {
        event,
        targets,
        storedAt: new Date().toISOString()
      };

      // 存儲 5 分鐘，供新建立的 SSE 連接檢索
      await env.SESSIONS.put(eventKey, JSON.stringify(eventData), { expirationTtl: 300 });
      
      console.log(`💾 [Queue Handler] Event stored for retrieval: ${eventKey}`);
    } catch (error) {
      console.error('❌ [Queue Handler] Failed to store event for retrieval:', error);
    }
  },

  // 為新的 SSE 連接檢索最近的事件
  async getRecentEventsForConnection(conversationId: number | null, userId: number, env: Bindings): Promise<RealtimeEvent[]> {
    try {
      const prefix = conversationId ? `recent_event:${conversationId}:` : 'recent_event:global:';
      const keys = await env.SESSIONS.list({ prefix });
      const events: RealtimeEvent[] = [];

      for (const key of keys.keys) {
        try {
          const eventDataStr = await env.SESSIONS.get(key.name);
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
          console.error(`❌ [Queue Handler] Failed to parse stored event ${key.name}:`, error);
        }
      }

      // 按時間排序，最新的在前
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      console.log(`📥 [Queue Handler] Retrieved ${events.length} recent events for user ${userId}`);
      return events.slice(0, 10); // 最多返回 10 個最近事件
      
    } catch (error) {
      console.error('❌ [Queue Handler] Failed to retrieve recent events:', error);
      return [];
    }
  },

  // 創建事件並推送到隊列
  async createAndQueueEvent(
    eventType: RealtimeEvent['type'],
    eventData: RealtimeEvent['data'],
    targets: QueueMessage['targets'],
    priority: QueueMessage['priority'] = 'normal',
    env: Bindings,
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
      maxRetries: 3
    };

    try {
      await env.REALTIME_QUEUE.send(queueMessage);
      console.log(`📤 [Queue Handler] Event queued: ${eventId} (${eventType})`);
      return eventId;
    } catch (error) {
      console.error('❌ [Queue Handler] Failed to queue event:', error);
      throw error;
    }
  }
};

// Cloudflare Queue Consumer 入口點
export default {
  async queue(batch: MessageBatch<QueueMessage>, env: Bindings): Promise<void> {
    await realtimeQueueHandler.processEvent(batch, env);
  }
};