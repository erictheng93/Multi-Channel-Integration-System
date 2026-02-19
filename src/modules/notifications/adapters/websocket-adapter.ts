// src/modules/notifications/adapters/websocket-adapter.ts
// WebSocket 通道適配器 (準備用於未來擴展)

import {
  ChannelAdapter,
  ChannelMessage,
  DeliveryResult,
  ChannelType,
  WebSocketMessage,
  ChannelConfig
} from '../types';
import { nowISO, nowMs } from '@/utils/timestamp'

export class WebSocketAdapter implements ChannelAdapter {
  readonly type: ChannelType = 'websocket';
  private connections = new Map<number, WebSocket[]>();
  // Phase 2 (100% WebSocket rollout): Enabled by default
  // NOTE: Real-time delivery is now handled by WebSocketBroadcastService + Durable Objects
  // This adapter is maintained for NotificationChannelService compatibility
  private enabled = true;
  private config: ChannelConfig;

  constructor(config?: Partial<ChannelConfig>) {
    this.config = {
      retryAttempts: 3,
      retryDelay: 1000,
      timeout: 30000,
      batchSize: 100,
      ...config
    };
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  validateConfig(config: ChannelConfig): boolean {
    return (
      config.retryAttempts >= 0 &&
      config.retryDelay >= 0 &&
      config.timeout > 0
    );
  }

  async send(message: ChannelMessage): Promise<DeliveryResult> {
    if (!this.isEnabled) {
      return {
        success: false,
        errorMessage: 'WebSocket adapter is currently disabled',
        deliveryTime: 0
      };
    }

    const startTime = nowMs();

    try {
      const userConnections = this.connections.get(parseInt(message.recipientId));

      if (!userConnections || userConnections.length === 0) {
        return {
          success: false,
          errorMessage: 'No active WebSocket connections for user',
          deliveryTime: Date.now() - startTime
        };
      }

      const wsMessage: WebSocketMessage = {
        type: 'notification',
        data: {
          id: message.notification.id,
          type: message.notification.type,
          title: message.notification.title,
          content: message.notification.content,
          priority: message.notification.priority,
          data: message.notification.data,
          createdAt: message.notification.createdAt
        },
        timestamp: nowISO(),
        userId: message.notification.userId,
        messageId: crypto.randomUUID()
      };

      let deliveredCount = 0;
      let failedCount = 0;

      // 發送到所有活躍連線
      for (const ws of userConnections) {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify(wsMessage));
            deliveredCount++;
          } catch (error) {
            console.error(`Failed to send WebSocket message:`, error);
            failedCount++;
          }
        } else {
          failedCount++;
        }
      }

      const success = deliveredCount > 0;

      return {
        success,
        messageId: wsMessage.messageId,
        deliveryTime: Date.now() - startTime,
        metadata: {
          deliveredConnections: deliveredCount,
          failedConnections: failedCount,
          totalConnections: userConnections.length
        }
      };

    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        deliveryTime: Date.now() - startTime
      };
    }
  }

  async sendBulk(messages: ChannelMessage[]): Promise<DeliveryResult[]> {
    if (!this.isEnabled) {
      return messages.map(() => ({
        success: false,
        errorMessage: 'WebSocket adapter is currently disabled',
        deliveryTime: 0
      }));
    }

    const results: DeliveryResult[] = [];

    // 分批處理
    const batchSize = this.config.batchSize || 100;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const batchPromises = batch.map(message => this.send(message));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 小延遲以避免過載
      if (i + batchSize < messages.length) {
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    }

    return results;
  }

  // WebSocket 連線管理 (準備用於未來實作)
  addConnection(userId: number, ws: WebSocket): void {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, []);
    }

    const userConnections = this.connections.get(userId)!;
    userConnections.push(ws);

    // 設置連線事件處理
    ws.onclose = () => {
      this.removeConnection(userId, ws);
    };

    ws.onerror = (error) => {
      console.error(`WebSocket error for user ${userId}:`, error);
      this.removeConnection(userId, ws);
    };

    console.log(`WebSocket connection added for user ${userId}`);
  }

  removeConnection(userId: number, ws: WebSocket): void {
    const userConnections = this.connections.get(userId);
    if (!userConnections) return;

    const index = userConnections.indexOf(ws);
    if (index !== -1) {
      userConnections.splice(index, 1);
      console.log(`WebSocket connection removed for user ${userId}`);

      // 如果用戶沒有連線了，移除用戶記錄
      if (userConnections.length === 0) {
        this.connections.delete(userId);
      }
    }
  }

  getConnectionCount(userId: number): number {
    return this.connections.get(userId)?.length || 0;
  }

  getTotalConnectionCount(): number {
    let total = 0;
    for (const connections of this.connections.values()) {
      total += connections.length;
    }
    return total;
  }

  // 發送 ping 到所有連線
  sendPing(): void {
    if (!this.isEnabled) return;

    const pingMessage: WebSocketMessage = {
      type: 'ping',
      timestamp: nowISO()
    };

    for (const [userId, connections] of this.connections.entries()) {
      for (const ws of connections) {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify(pingMessage));
          } catch (error) {
            console.error(`Failed to send ping to user ${userId}:`, error);
            this.removeConnection(userId, ws);
          }
        }
      }
    }
  }

  // 清理關閉的連線
  cleanupClosedConnections(): void {
    for (const [userId, connections] of this.connections.entries()) {
      const activeConnections = connections.filter(ws => ws.readyState === WebSocket.OPEN);

      if (activeConnections.length === 0) {
        this.connections.delete(userId);
      } else if (activeConnections.length !== connections.length) {
        this.connections.set(userId, activeConnections);
      }
    }
  }

  // 獲取連線統計
  getConnectionStats(): {
    totalUsers: number;
    totalConnections: number;
    averageConnectionsPerUser: number;
    connectionsByUser: Record<number, number>;
  } {
    const connectionsByUser: Record<number, number> = {};
    let totalConnections = 0;

    for (const [userId, connections] of this.connections.entries()) {
      const activeConnections = connections.filter(ws => ws.readyState === WebSocket.OPEN);
      connectionsByUser[userId] = activeConnections.length;
      totalConnections += activeConnections.length;
    }

    return {
      totalUsers: this.connections.size,
      totalConnections,
      averageConnectionsPerUser: this.connections.size > 0 ? totalConnections / this.connections.size : 0,
      connectionsByUser
    };
  }

  // 啟用適配器 (當 WebSocket 實作完成時)
  enable(): void {
    this.enabled = true;
    console.log('WebSocket adapter enabled');
  }

  // 停用適配器
  disable(): void {
    this.enabled = false;

    // 關閉所有連線
    for (const [userId, connections] of this.connections.entries()) {
      for (const ws of connections) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1001, 'Service disabled');
        }
      }
    }

    this.connections.clear();
    console.log('WebSocket adapter disabled');
  }
}