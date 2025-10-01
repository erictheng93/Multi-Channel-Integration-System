// SSE 專用處理器 - 精細化連接管理

import { Context } from 'hono';
import type { Bindings } from '@/types';
import type {
  SSEConnection,
  SSEEvent,
  SSEHeaders,
  SSEConfig,
  SSEAuthPayload,
  SSEConnectionStats
} from '../types';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  handleApiError
} from '@/utils/api-response';
import { verifyJWT } from '@/utils/auth';

// SSE 配置
const sseConfig: SSEConfig = {
  heartbeatInterval: 8000,
  connectionTimeout: 300000,
  maxConnectionsPerUser: 5,
  enableCompression: false,
  retryInterval: 3000,
  maxRetryAttempts: 3
};

// 增強的 SSE 連接管理器
class EnhancedSSEManager {
  private connections = new Map<string, SSEConnection>();
  private userConnections = new Map<number, Set<string>>();
  private conversationConnections = new Map<number, Set<string>>();
  private env?: Bindings;

  setEnv(env: Bindings): void {
    this.env = env;
  }

  // 建立 SSE 連接
  async createConnection(
    userId: number,
    conversationId: number | undefined,
    controller: ReadableStreamDefaultController,
    authPayload: SSEAuthPayload
  ): Promise<string> {
    // 檢查用戶連接數限制
    const userConnectionCount = this.userConnections.get(userId)?.size || 0;
    if (userConnectionCount >= sseConfig.maxConnectionsPerUser) {
      throw new Error(`User ${userId} has reached maximum connection limit`);
    }

    const connectionId = `sse-${userId}-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    const encoder = new TextEncoder();

    const connection: SSEConnection = {
      connectionId,
      controller,
      encoder,
      userId,
      conversationId,
      lastActivity: Date.now(),
      metadata: {
        userRole: authPayload.role,
        teamId: authPayload.teamId,
        displayName: authPayload.displayName,
        connectedAt: new Date().toISOString()
      }
    };

    // 儲存連接
    this.connections.set(connectionId, connection);

    // 建立用戶連接索引
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);

    // 建立對話連接索引
    if (conversationId !== undefined) {
      if (!this.conversationConnections.has(conversationId)) {
        this.conversationConnections.set(conversationId, new Set());
      }
      this.conversationConnections.get(conversationId)!.add(connectionId);
    }

    // 同步到 KV
    await this.syncConnectionToKV(connection);

    console.log(`✅ [Enhanced SSE] 連接已建立: ${connectionId} (User: ${userId}, Conv: ${conversationId})`);
    return connectionId;
  }

  // 移除連接
  async removeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // 從主要存儲移除
    this.connections.delete(connectionId);

    // 從用戶索引移除
    const userConnections = this.userConnections.get(connection.userId);
    if (userConnections) {
      userConnections.delete(connectionId);
      if (userConnections.size === 0) {
        this.userConnections.delete(connection.userId);
      }
    }

    // 從對話索引移除
    if (connection.conversationId !== undefined) {
      const convConnections = this.conversationConnections.get(connection.conversationId);
      if (convConnections) {
        convConnections.delete(connectionId);
        if (convConnections.size === 0) {
          this.conversationConnections.delete(connection.conversationId);
        }
      }
    }

    // 從 KV 移除
    await this.removeConnectionFromKV(connectionId);

    console.log(`🔌 [Enhanced SSE] 連接已移除: ${connectionId}`);
  }

  // 發送事件到特定連接
  sendToConnection(connectionId: string, event: SSEEvent): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      console.warn(`⚠️ [Enhanced SSE] 連接不存在: ${connectionId}`);
      return false;
    }

    try {
      const eventData = this.formatSSEEvent(event);
      connection.controller.enqueue(connection.encoder.encode(eventData));
      connection.lastActivity = Date.now();
      return true;
    } catch (error) {
      console.error(`❌ [Enhanced SSE] 發送失敗到 ${connectionId}:`, error);
      this.removeConnection(connectionId);
      return false;
    }
  }

  // 批量發送到用戶的所有連接
  sendToUser(userId: number, event: SSEEvent): number {
    const userConnections = this.userConnections.get(userId);
    if (!userConnections) return 0;

    let successCount = 0;
    for (const connectionId of userConnections) {
      if (this.sendToConnection(connectionId, event)) {
        successCount++;
      }
    }
    return successCount;
  }

  // 批量發送到對話的所有連接
  sendToConversation(conversationId: number, event: SSEEvent, excludeUsers?: number[]): number {
    const convConnections = this.conversationConnections.get(conversationId);
    if (!convConnections) return 0;

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

  // 清理過期連接
  cleanupStaleConnections(): number {
    const now = Date.now();
    const staleConnections: string[] = [];

    for (const [connectionId, connection] of this.connections) {
      if (now - connection.lastActivity > sseConfig.connectionTimeout) {
        staleConnections.push(connectionId);
      }
    }

    staleConnections.forEach(id => this.removeConnection(id));

    if (staleConnections.length > 0) {
      console.log(`🧹 [Enhanced SSE] 清理了 ${staleConnections.length} 個過期連接`);
    }

    return staleConnections.length;
  }

  // 獲取統計信息
  getDetailedStats(): SSEConnectionStats & {
    connectionsByConversation: Record<number, number>;
    averageUptime: number;
    totalEventsSent: number;
  } {
    const now = Date.now();
    let totalUptime = 0;
    let totalEvents = 0;

    const connectionsByUser: Record<number, number> = {};
    const connectionsByConversation: Record<number, number> = {};

    for (const [connectionId, connection] of this.connections) {
      // 統計用戶連接
      connectionsByUser[connection.userId] = (connectionsByUser[connection.userId] || 0) + 1;

      // 統計對話連接
      if (connection.conversationId !== undefined) {
        connectionsByConversation[connection.conversationId] =
          (connectionsByConversation[connection.conversationId] || 0) + 1;
      }

      // 計算平均運行時間
      totalUptime += now - connection.lastActivity;
    }

    return {
      totalConnections: this.connections.size,
      connectionsByUser,
      connectionsByConversation,
      averageUptime: this.connections.size > 0 ? totalUptime / this.connections.size : 0,
      totalEventsSent: totalEvents
    };
  }

  // 格式化 SSE 事件
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

  // 同步連接到 KV
  private async syncConnectionToKV(connection: SSEConnection): Promise<void> {
    if (!this.env?.SESSIONS) return;

    try {
      const kvData = {
        connectionId: connection.connectionId,
        userId: connection.userId,
        conversationId: connection.conversationId,
        metadata: connection.metadata,
        lastActivity: connection.lastActivity
      };

      await this.env.SESSIONS.put(
        `enhanced_sse:${connection.connectionId}`,
        JSON.stringify(kvData),
        { expirationTtl: 300 }
      );
    } catch (error) {
      console.error('❌ [Enhanced SSE] KV 同步失敗:', error);
    }
  }

  // 從 KV 移除連接
  private async removeConnectionFromKV(connectionId: string): Promise<void> {
    if (!this.env?.SESSIONS) return;

    try {
      await this.env.SESSIONS.delete(`enhanced_sse:${connectionId}`);
    } catch (error) {
      console.error('❌ [Enhanced SSE] KV 移除失敗:', error);
    }
  }
}

// 全域增強 SSE 管理器實例
const enhancedSSEManager = new EnhancedSSEManager();

// SSE 處理器
export const sseHandler = {
  // 建立增強的 SSE 連接
  connect: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      let payload = c.get('jwtPayload');
      const conversationId = c.req.query('conversationId');

      // 驗證認證
      if (!payload) {
        const queryToken = c.req.query('token');
        if (queryToken) {
          payload = await verifyJWT(queryToken, c.env.JWT_SECRET);
        }
      }

      if (!payload) {
        return unauthorizedResponse(c, 'Authentication required for SSE');
      }

      // 設置 SSE 標頭
      const headers: SSEHeaders = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control, Authorization',
        'X-Accel-Buffering': 'no',
        'Keep-Alive': 'timeout=120, max=1000',
        'Pragma': 'no-cache',
        'Transfer-Encoding': 'chunked'
      };

      enhancedSSEManager.setEnv(c.env);
      let connectionId: string;
      let heartbeatInterval: any;

      const stream = new ReadableStream({
        async start(controller) {
          try {
            // 建立連接
            connectionId = await enhancedSSEManager.createConnection(
              Number(payload.userId),
              conversationId ? parseInt(conversationId) : undefined,
              controller,
              {
                userId: Number(payload.userId),
                displayName: payload.displayName,
                role: payload.role,
                teamId: payload.teamId
              }
            );

            // 發送連接確認
            const connectionEvent: SSEEvent = {
              type: 'connection',
              data: {
                message: 'Enhanced SSE connection established',
                connectionId,
                userId: Number(payload.userId),
                conversationId: conversationId ? parseInt(conversationId) : undefined
              },
              timestamp: new Date().toISOString(),
              connectionId
            };

            enhancedSSEManager.sendToConnection(connectionId, connectionEvent);

            // 設置心跳
            heartbeatInterval = setInterval(() => {
              const heartbeatEvent: SSEEvent = {
                type: 'heartbeat',
                data: {
                  serverTime: Date.now(),
                  uptime: Date.now() - parseInt(connectionId.split('-')[2] || '0')
                },
                timestamp: new Date().toISOString(),
                connectionId
              };

              if (!enhancedSSEManager.sendToConnection(connectionId, heartbeatEvent)) {
                clearInterval(heartbeatInterval);
              }
            }, sseConfig.heartbeatInterval);

          } catch (error) {
            console.error('❌ [SSE Handler] 連接建立失敗:', error);
            controller.error(error);
          }
        },

        cancel() {
          if (heartbeatInterval) clearInterval(heartbeatInterval);
          if (connectionId) enhancedSSEManager.removeConnection(connectionId);
        }
      });

      return new Response(stream, { headers: headers as unknown as HeadersInit });

    } catch (error) {
      console.error('❌ [SSE Handler] 處理錯誤:', error);
      return errorResponse(c, 'Failed to establish enhanced SSE connection', 500);
    }
  },

  // 獲取連接統計
  getStats: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      if (!payload || !['admin', 'team'].includes(payload.role)) {
        return unauthorizedResponse(c, 'Insufficient permissions');
      }

      const stats = enhancedSSEManager.getDetailedStats();
      return successResponse(c, stats, 'SSE statistics retrieved');
    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 清理過期連接
  cleanup: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      if (!payload || payload.role !== 'admin') {
        return unauthorizedResponse(c, 'Admin access required');
      }

      const cleanedCount = enhancedSSEManager.cleanupStaleConnections();
      return successResponse(c, { cleanedConnections: cleanedCount }, 'Cleanup completed');
    } catch (error) {
      return handleApiError(error, c);
    }
  }
};

// 導出增強 SSE 管理器供外部使用
export { enhancedSSEManager, sseConfig };