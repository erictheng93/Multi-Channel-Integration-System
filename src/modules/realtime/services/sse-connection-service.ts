// SSE 連接管理服務 - 專門管理 SSE 連接的生命週期

import type { Bindings } from '../../../types';
import type {
  SSEConnection,
  SSEEvent,
  SSEConfig,
  SSEConnectionStats,
  SSEConnectionMetrics,
  SSEAuthPayload
} from '../types';

// 連接池管理
export class SSEConnectionPool {
  private connections = new Map<string, SSEConnection & { metrics: SSEConnectionMetrics }>();
  private userConnections = new Map<number, Set<string>>();
  private conversationConnections = new Map<number, Set<string>>();
  private teamConnections = new Map<number, Set<string>>();
  private env?: Bindings;
  private config: SSEConfig;

  constructor(config: Partial<SSEConfig> = {}) {
    this.config = {
      heartbeatInterval: 8000,
      connectionTimeout: 300000,
      maxConnectionsPerUser: 5,
      enableCompression: false,
      retryInterval: 3000,
      maxRetryAttempts: 3,
      ...config
    };
  }

  setEnv(env: Bindings): void {
    this.env = env;
  }

  // 創建新連接
  async createConnection(
    authPayload: SSEAuthPayload,
    conversationId: number | undefined,
    controller: ReadableStreamDefaultController
  ): Promise<string> {
    // 檢查用戶連接限制
    const userConnectionCount = this.userConnections.get(authPayload.userId)?.size || 0;
    if (userConnectionCount >= this.config.maxConnectionsPerUser) {
      throw new Error(`User ${authPayload.userId} exceeded maximum connections (${this.config.maxConnectionsPerUser})`);
    }

    const connectionId = this.generateConnectionId(authPayload.userId);
    const encoder = new TextEncoder();
    const now = Date.now();

    const connection: SSEConnection & { metrics: SSEConnectionMetrics } = {
      connectionId,
      controller,
      encoder,
      userId: authPayload.userId,
      conversationId,
      lastActivity: now,
      metadata: {
        userRole: authPayload.role,
        teamId: authPayload.teamId,
        displayName: authPayload.displayName,
        connectedAt: new Date().toISOString(),
        userAgent: '', // 可以從請求頭獲取
        clientIP: ''   // 可以從請求頭獲取
      },
      metrics: {
        establishedAt: now,
        lastHeartbeat: now,
        eventsSent: 0,
        errorsCount: 0,
        dataTransferred: 0
      }
    };

    // 存儲連接
    this.connections.set(connectionId, connection);
    this.addToIndex(connectionId, authPayload.userId, conversationId, authPayload.teamId);

    // 同步到 KV
    await this.syncConnectionToKV(connection);

    console.log(`✅ [SSE Pool] 連接已創建: ${connectionId}`, {
      userId: authPayload.userId,
      conversationId,
      totalConnections: this.connections.size
    });

    return connectionId;
  }

  // 移除連接
  async removeConnection(connectionId: string): Promise<boolean> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    // 從索引中移除
    this.removeFromIndex(
      connectionId,
      connection.userId,
      connection.conversationId,
      connection.metadata?.teamId
    );

    // 從主存儲移除
    this.connections.delete(connectionId);

    // 從 KV 移除
    await this.removeConnectionFromKV(connectionId);

    console.log(`🔌 [SSE Pool] 連接已移除: ${connectionId}`, {
      userId: connection.userId,
      uptime: Date.now() - connection.metrics.establishedAt,
      eventsSent: connection.metrics.eventsSent
    });

    return true;
  }

  // 發送事件到特定連接
  sendToConnection(connectionId: string, event: SSEEvent): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    try {
      const eventData = this.formatSSEEvent(event);
      const dataSize = new Blob([eventData]).size;

      connection.controller.enqueue(connection.encoder.encode(eventData));

      // 更新指標
      connection.lastActivity = Date.now();
      connection.metrics.eventsSent++;
      connection.metrics.dataTransferred += dataSize;
      connection.metrics.lastHeartbeat = event.type === 'heartbeat' ? Date.now() : connection.metrics.lastHeartbeat;

      return true;
    } catch (error) {
      console.error(`❌ [SSE Pool] 發送失敗 ${connectionId}:`, error);
      connection.metrics.errorsCount++;

      // 如果錯誤過多，移除連接
      if (connection.metrics.errorsCount > 5) {
        this.removeConnection(connectionId);
      }

      return false;
    }
  }

  // 發送到用戶的所有連接
  sendToUser(userId: number, event: SSEEvent): number {
    const userConnections = this.userConnections.get(userId);
    if (!userConnections) {
      return 0;
    }

    let successCount = 0;
    for (const connectionId of userConnections) {
      if (this.sendToConnection(connectionId, event)) {
        successCount++;
      }
    }
    return successCount;
  }

  // 發送到對話的所有連接
  sendToConversation(conversationId: number, event: SSEEvent, excludeUsers?: number[]): number {
    const convConnections = this.conversationConnections.get(conversationId);
    if (!convConnections) {
      return 0;
    }

    let successCount = 0;
    for (const connectionId of convConnections) {
      const connection = this.connections.get(connectionId);
      if (connection && (!excludeUsers || !excludeUsers.includes(connection.userId))) {
        if (this.sendToConnection(connectionId, event)) {
          successCount++;
        }
      }
    }
    return successCount;
  }

  // 發送到團隊的所有連接
  sendToTeam(teamId: number, event: SSEEvent, excludeUsers?: number[]): number {
    const teamConnections = this.teamConnections.get(teamId);
    if (!teamConnections) {
      return 0;
    }

    let successCount = 0;
    for (const connectionId of teamConnections) {
      const connection = this.connections.get(connectionId);
      if (connection && (!excludeUsers || !excludeUsers.includes(connection.userId))) {
        if (this.sendToConnection(connectionId, event)) {
          successCount++;
        }
      }
    }
    return successCount;
  }

  // 廣播到所有連接
  broadcast(event: SSEEvent, filter?: (connection: SSEConnection) => boolean): number {
    let successCount = 0;
    for (const [connectionId, connection] of this.connections) {
      if (!filter || filter(connection)) {
        if (this.sendToConnection(connectionId, event)) {
          successCount++;
        }
      }
    }
    return successCount;
  }

  // 發送心跳到所有連接
  sendHeartbeatToAll(): number {
    const heartbeatEvent: SSEEvent = {
      type: 'heartbeat',
      data: {
        serverTime: Date.now(),
        totalConnections: this.connections.size
      },
      timestamp: new Date().toISOString()
    };

    return this.broadcast(heartbeatEvent);
  }

  // 清理過期連接
  cleanupStaleConnections(): number {
    const now = Date.now();
    const staleConnections: string[] = [];

    for (const [connectionId, connection] of this.connections) {
      const inactiveTime = now - connection.lastActivity;
      if (inactiveTime > this.config.connectionTimeout) {
        staleConnections.push(connectionId);
      }
    }

    let cleanedCount = 0;
    for (const connectionId of staleConnections) {
      if (this.removeConnection(connectionId)) {
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 [SSE Pool] 清理了 ${cleanedCount} 個過期連接`);
    }

    return cleanedCount;
  }

  // 獲取詳細統計信息
  getDetailedStats(): SSEConnectionStats & {
    connectionsByTeam: Record<number, number>;
    connectionMetrics: {
      totalEventsSent: number;
      totalErrorsCount: number;
      totalDataTransferred: number;
      averageUptime: number;
      averageEventsPerConnection: number;
    };
  } {
    const now = Date.now();
    let totalEventsSent = 0;
    let totalErrorsCount = 0;
    let totalDataTransferred = 0;
    let totalUptime = 0;

    const connectionsByUser: Record<number, number> = {};
    const connectionsByConversation: Record<number, number> = {};
    const connectionsByTeam: Record<number, number> = {};

    for (const [connectionId, connection] of this.connections) {
      // 統計用戶連接
      connectionsByUser[connection.userId] = (connectionsByUser[connection.userId] || 0) + 1;

      // 統計對話連接
      if (connection.conversationId !== undefined) {
        connectionsByConversation[connection.conversationId] =
          (connectionsByConversation[connection.conversationId] || 0) + 1;
      }

      // 統計團隊連接
      if (connection.metadata?.teamId) {
        connectionsByTeam[connection.metadata.teamId] =
          (connectionsByTeam[connection.metadata.teamId] || 0) + 1;
      }

      // 累計指標
      totalEventsSent += connection.metrics.eventsSent;
      totalErrorsCount += connection.metrics.errorsCount;
      totalDataTransferred += connection.metrics.dataTransferred;
      totalUptime += now - connection.metrics.establishedAt;
    }

    const totalConnections = this.connections.size;

    return {
      totalConnections,
      connectionsByUser,
      connectionsByTeam,
      connectionMetrics: {
        totalEventsSent,
        totalErrorsCount,
        totalDataTransferred,
        averageUptime: totalConnections > 0 ? totalUptime / totalConnections : 0,
        averageEventsPerConnection: totalConnections > 0 ? totalEventsSent / totalConnections : 0
      }
    };
  }

  // 獲取特定連接的詳細信息
  getConnectionDetails(connectionId: string): (SSEConnection & { metrics: SSEConnectionMetrics }) | null {
    return this.connections.get(connectionId) || null;
  }

  // 獲取用戶的所有連接
  getUserConnections(userId: number): SSEConnection[] {
    const userConnectionIds = this.userConnections.get(userId);
    if (!userConnectionIds) {
      return [];
    }

    const connections: SSEConnection[] = [];
    for (const connectionId of userConnectionIds) {
      const connection = this.connections.get(connectionId);
      if (connection) {
        connections.push(connection);
      }
    }

    return connections;
  }

  // 私有方法：生成連接 ID
  private generateConnectionId(userId: number): string {
    return `sse-${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  // 私有方法：添加到索引
  private addToIndex(
    connectionId: string,
    userId: number,
    conversationId?: number,
    teamId?: number
  ): void {
    // 用戶索引
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);

    // 對話索引
    if (conversationId !== undefined) {
      if (!this.conversationConnections.has(conversationId)) {
        this.conversationConnections.set(conversationId, new Set());
      }
      this.conversationConnections.get(conversationId)!.add(connectionId);
    }

    // 團隊索引
    if (teamId !== undefined) {
      if (!this.teamConnections.has(teamId)) {
        this.teamConnections.set(teamId, new Set());
      }
      this.teamConnections.get(teamId)!.add(connectionId);
    }
  }

  // 私有方法：從索引移除
  private removeFromIndex(
    connectionId: string,
    userId: number,
    conversationId?: number,
    teamId?: number
  ): void {
    // 從用戶索引移除
    const userConnections = this.userConnections.get(userId);
    if (userConnections) {
      userConnections.delete(connectionId);
      if (userConnections.size === 0) {
        this.userConnections.delete(userId);
      }
    }

    // 從對話索引移除
    if (conversationId !== undefined) {
      const convConnections = this.conversationConnections.get(conversationId);
      if (convConnections) {
        convConnections.delete(connectionId);
        if (convConnections.size === 0) {
          this.conversationConnections.delete(conversationId);
        }
      }
    }

    // 從團隊索引移除
    if (teamId !== undefined) {
      const teamConnections = this.teamConnections.get(teamId);
      if (teamConnections) {
        teamConnections.delete(connectionId);
        if (teamConnections.size === 0) {
          this.teamConnections.delete(teamId);
        }
      }
    }
  }

  // 私有方法：格式化 SSE 事件
  private formatSSEEvent(event: SSEEvent): string {
    let formatted = '';

    if (event.retry) {
      formatted += `retry: ${event.retry}\n`;
    }

    formatted += `event: ${event.type}\n`;
    formatted += `data: ${JSON.stringify({
      ...event.data,
      timestamp: event.timestamp,
      connectionId: event.connectionId
    })}\n\n`;

    return formatted;
  }

  // 私有方法：同步連接到 KV
  private async syncConnectionToKV(connection: SSEConnection): Promise<void> {
    if (!this.env?.SESSIONS) return;

    try {
      const kvData = {
        connectionId: connection.connectionId,
        userId: connection.userId,
        conversationId: connection.conversationId,
        metadata: connection.metadata,
        establishedAt: (connection as any).metrics.establishedAt
      };

      await this.env.SESSIONS.put(
        `sse_pool:${connection.connectionId}`,
        JSON.stringify(kvData),
        { expirationTtl: 300 }
      );
    } catch (error) {
      console.error('❌ [SSE Pool] KV 同步失敗:', error);
    }
  }

  // 私有方法：從 KV 移除連接
  private async removeConnectionFromKV(connectionId: string): Promise<void> {
    if (!this.env?.SESSIONS) return;

    try {
      await this.env.SESSIONS.delete(`sse_pool:${connectionId}`);
    } catch (error) {
      console.error('❌ [SSE Pool] KV 移除失敗:', error);
    }
  }
}