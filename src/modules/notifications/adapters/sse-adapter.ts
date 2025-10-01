// src/modules/notifications/adapters/sse-adapter.ts
// SSE 通道適配器

import {
  ChannelAdapter,
  ChannelMessage,
  DeliveryResult,
  ChannelType,
  SSEMessage,
  SSEConnection,
  ChannelConfig
} from '../types';

export class SSEAdapter implements ChannelAdapter {
  readonly type: ChannelType = 'sse';
  private connections = new Map<number, SSEConnection[]>();
  private enabled = true;
  private config: ChannelConfig;

  constructor(config?: Partial<ChannelConfig>) {
    this.config = {
      retryAttempts: 3,
      retryDelay: 1000,
      timeout: 30000,
      batchSize: 50,
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
    const startTime = Date.now();

    try {
      const userConnections = this.connections.get(parseInt(message.recipientId));

      if (!userConnections || userConnections.length === 0) {
        return {
          success: false,
          errorMessage: 'No active SSE connections for user',
          deliveryTime: Date.now() - startTime
        };
      }

      const sseMessage: SSEMessage = {
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
        timestamp: new Date().toISOString(),
        userId: message.notification.userId
      };

      const eventData = `data: ${JSON.stringify(sseMessage)}\n\n`;
      let deliveredCount = 0;
      let failedCount = 0;

      // 發送到所有活躍連線
      for (const connection of userConnections) {
        try {
          connection.controller.enqueue(new TextEncoder().encode(eventData));
          connection.lastActivity = new Date();
          deliveredCount++;
        } catch (error) {
          console.error(`Failed to send SSE message to connection ${connection.connectionId}:`, error);
          failedCount++;

          // 移除失敗的連線
          this.removeConnection(parseInt(message.recipientId), connection.connectionId);
        }
      }

      const success = deliveredCount > 0;

      return {
        success,
        messageId: message.id,
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
    const results: DeliveryResult[] = [];

    // 分批處理以避免阻塞
    const batchSize = this.config.batchSize || 50;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const batchPromises = batch.map(message => this.send(message));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 小延遲以避免過載
      if (i + batchSize < messages.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    return results;
  }

  // SSE 連線管理
  addConnection(userId: number, connection: SSEConnection): void {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, []);
    }

    const userConnections = this.connections.get(userId)!;

    // 移除相同 connectionId 的舊連線（如果存在）
    const existingIndex = userConnections.findIndex(
      conn => conn.connectionId === connection.connectionId
    );
    if (existingIndex !== -1) {
      userConnections.splice(existingIndex, 1);
    }

    userConnections.push(connection);

    console.log(`SSE connection added for user ${userId}, connection ${connection.connectionId}`);
  }

  removeConnection(userId: number, connectionId: string): void {
    const userConnections = this.connections.get(userId);
    if (!userConnections) return;

    const index = userConnections.findIndex(conn => conn.connectionId === connectionId);
    if (index !== -1) {
      userConnections.splice(index, 1);
      console.log(`SSE connection removed for user ${userId}, connection ${connectionId}`);

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

  // 清理不活躍的連線
  cleanupInactiveConnections(maxInactiveTime: number = 300000): void { // 5 minutes
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - maxInactiveTime);

    for (const [userId, connections] of this.connections.entries()) {
      const activeConnections = connections.filter(conn => {
        if (conn.lastActivity < cutoffTime) {
          console.log(`Removing inactive SSE connection for user ${userId}, connection ${conn.connectionId}`);
          return false;
        }
        return true;
      });

      if (activeConnections.length === 0) {
        this.connections.delete(userId);
      } else if (activeConnections.length !== connections.length) {
        this.connections.set(userId, activeConnections);
      }
    }
  }

  // 發送心跳到所有連線
  sendHeartbeat(): void {
    const heartbeatMessage: SSEMessage = {
      type: 'heartbeat',
      timestamp: new Date().toISOString()
    };

    const eventData = `data: ${JSON.stringify(heartbeatMessage)}\n\n`;
    const encoder = new TextEncoder();

    for (const [userId, connections] of this.connections.entries()) {
      for (const connection of connections) {
        try {
          connection.controller.enqueue(encoder.encode(eventData));
          connection.lastActivity = new Date();
        } catch (error) {
          console.error(`Failed to send heartbeat to user ${userId}, connection ${connection.connectionId}:`, error);
          this.removeConnection(userId, connection.connectionId);
        }
      }
    }
  }

  // 發送系統訊息
  async sendSystemMessage(userId: number, message: any): Promise<DeliveryResult> {
    const systemMessage: SSEMessage = {
      type: 'notification',
      data: message,
      timestamp: new Date().toISOString(),
      userId
    };

    const userConnections = this.connections.get(userId);
    if (!userConnections || userConnections.length === 0) {
      return {
        success: false,
        errorMessage: 'No active SSE connections for user'
      };
    }

    const eventData = `data: ${JSON.stringify(systemMessage)}\n\n`;
    const encoder = new TextEncoder();
    let deliveredCount = 0;

    for (const connection of userConnections) {
      try {
        connection.controller.enqueue(encoder.encode(eventData));
        connection.lastActivity = new Date();
        deliveredCount++;
      } catch (error) {
        console.error(`Failed to send system message to user ${userId}:`, error);
        this.removeConnection(userId, connection.connectionId);
      }
    }

    return {
      success: deliveredCount > 0,
      metadata: {
        deliveredConnections: deliveredCount,
        totalConnections: userConnections.length
      }
    };
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
      connectionsByUser[userId] = connections.length;
      totalConnections += connections.length;
    }

    return {
      totalUsers: this.connections.size,
      totalConnections,
      averageConnectionsPerUser: this.connections.size > 0 ? totalConnections / this.connections.size : 0,
      connectionsByUser
    };
  }

  // 啟用/停用適配器
  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
    // 關閉所有連線
    for (const [userId, connections] of this.connections.entries()) {
      for (const connection of connections) {
        try {
          connection.controller.close();
        } catch (error) {
          console.error(`Error closing SSE connection for user ${userId}:`, error);
        }
      }
    }
    this.connections.clear();
  }
}