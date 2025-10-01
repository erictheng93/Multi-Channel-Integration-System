// src/modules/notifications/handlers/notification-sse.ts
// SSE 專用處理器 - 實時通知推送

import { Context } from 'hono';
import type { Bindings } from '../../../types';
import { unauthorizedResponse, handleApiError } from '../../../utils/api-response';
import { SSEAdapter } from '@modules/notifications/adapters/sse-adapter';
import { NotificationChannelService } from '@modules/notifications/services/notification-channel-service';
import { SSEConnection, SSEMessage } from '@modules/notifications/types';

export class NotificationSSEHandler {
  private sseAdapter: SSEAdapter;
  private channelService: NotificationChannelService;
  private heartbeatInterval: any;

  constructor() {
    this.channelService = new NotificationChannelService();
    this.sseAdapter = this.channelService.getAdapter('sse') as SSEAdapter;

    // 啟動心跳檢測
    this.startHeartbeat();
  }

  // 建立 SSE 連線
  connect = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      if (!payload?.userId) {
        return unauthorizedResponse(c, 'Authentication required for SSE');
      }

      const userId = parseInt(String(payload.userId));
      const connectionId = crypto.randomUUID();

      // 設置 SSE 標頭
      const headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control, Authorization',
        'X-Accel-Buffering': 'no',
      };

      const encoder = new TextEncoder();
      let connectionClosed = false;
      const sseAdapter = this.sseAdapter;
      const sendWelcomeMessage = this.sendWelcomeMessage.bind(this);

      const stream = new ReadableStream({
        start(controller) {
          // 創建連線記錄
          const connection: SSEConnection = {
            userId,
            connectionId,
            controller,
            lastActivity: new Date(),
            metadata: {
              userAgent: c.req.header('User-Agent'),
              ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
              connectedAt: new Date().toISOString()
            }
          };

          // 添加到適配器
          if (sseAdapter) {
            sseAdapter.addConnection(userId, connection);
          }

          // 發送初始連接確認
          const connectionEvent: SSEMessage = {
            type: 'connection',
            data: {
              connectionId,
              message: 'SSE connection established',
              serverTime: Date.now()
            },
            timestamp: new Date().toISOString(),
            userId
          };

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(connectionEvent)}\n\n`));

          // 發送歡迎訊息（包含未讀通知數量等）
          sendWelcomeMessage(controller, encoder, userId);

          console.log(`SSE connection established for user ${userId}, connection ${connectionId}`);
        },

        cancel() {
          connectionClosed = true;
          if (sseAdapter) {
            sseAdapter.removeConnection(userId, connectionId);
          }
          console.log(`SSE connection closed for user ${userId}, connection ${connectionId}`);
        }
      });

      return new Response(stream, { headers });

    } catch (error) {
      console.error('SSE connection error:', error);
      return c.json({ error: 'Failed to establish SSE connection' }, 500);
    }
  };

  // 手動向用戶發送訊息
  sendMessage = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      if (!payload?.userId || payload.role !== 'admin') {
        return unauthorizedResponse(c, 'Admin privileges required');
      }

      const { userId, message, type = 'notification' } = await c.req.json();

      if (!this.sseAdapter) {
        return c.json({ error: 'SSE adapter not available' }, 500);
      }

      const result = await this.sseAdapter.sendSystemMessage(userId, {
        type,
        ...message
      });

      return c.json({
        success: result.success,
        message: result.success ? 'Message sent successfully' : 'Failed to send message',
        error: result.errorMessage,
        metadata: result.metadata
      });

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  // 廣播訊息給所有連線用戶
  broadcast = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      if (!payload?.userId || payload.role !== 'admin') {
        return unauthorizedResponse(c, 'Admin privileges required');
      }

      const { message, userIds } = await c.req.json();

      if (!this.sseAdapter) {
        return c.json({ error: 'SSE adapter not available' }, 500);
      }

      const stats = this.sseAdapter.getConnectionStats();
      const targetUserIds = userIds || Object.keys(stats.connectionsByUser).map(id => parseInt(id));

      const results = await Promise.allSettled(
        targetUserIds.map((userId: number) =>
          this.sseAdapter.sendSystemMessage(userId, {
            type: 'broadcast',
            ...message
          })
        )
      );

      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - successful;

      return c.json({
        success: true,
        message: `Broadcast completed: ${successful} successful, ${failed} failed`,
        stats: {
          totalTargets: targetUserIds.length,
          successful,
          failed
        }
      });

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  // 獲取 SSE 連線統計
  getStats = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      if (!payload?.userId || payload.role !== 'admin') {
        return unauthorizedResponse(c, 'Admin privileges required');
      }

      if (!this.sseAdapter) {
        return c.json({ error: 'SSE adapter not available' }, 500);
      }

      const stats = this.sseAdapter.getConnectionStats();

      return c.json({
        success: true,
        data: {
          ...stats,
          adapterEnabled: this.sseAdapter.isEnabled(),
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  // 清理不活躍連線
  cleanupConnections = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      if (!payload?.userId || payload.role !== 'admin') {
        return unauthorizedResponse(c, 'Admin privileges required');
      }

      if (!this.sseAdapter) {
        return c.json({ error: 'SSE adapter not available' }, 500);
      }

      const beforeStats = this.sseAdapter.getConnectionStats();

      // 清理 5 分鐘內無活動的連線
      this.sseAdapter.cleanupInactiveConnections(5 * 60 * 1000);

      const afterStats = this.sseAdapter.getConnectionStats();
      const cleaned = beforeStats.totalConnections - afterStats.totalConnections;

      return c.json({
        success: true,
        message: `${cleaned} inactive connections cleaned up`,
        stats: {
          before: beforeStats.totalConnections,
          after: afterStats.totalConnections,
          cleaned
        }
      });

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  // 發送歡迎訊息
  private async sendWelcomeMessage(
    controller: ReadableStreamDefaultController,
    encoder: TextEncoder,
    userId: number
  ): Promise<void> {
    try {
      // 在真實實作中，這裡會從通知服務獲取用戶的未讀通知數量
      const welcomeEvent: SSEMessage = {
        type: 'notification',
        data: {
          type: 'welcome',
          title: '連線成功',
          content: '您已成功連接到即時通知系統',
          timestamp: new Date().toISOString(),
          // 可以添加更多歡迎資訊，如未讀通知數量等
        },
        timestamp: new Date().toISOString(),
        userId
      };

      controller.enqueue(encoder.encode(`data: ${JSON.stringify(welcomeEvent)}\n\n`));

    } catch (error) {
      console.error('Error sending welcome message:', error);
    }
  }

  // 啟動心跳檢測
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.sseAdapter && this.sseAdapter.isEnabled()) {
        this.sseAdapter.sendHeartbeat();
      }
    }, 30000); // 每30秒發送心跳
  }

  // 停止心跳檢測
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // 獲取用戶連線數
  getUserConnectionCount = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      if (!payload?.userId) {
        return unauthorizedResponse(c, 'Authentication required');
      }

      if (!this.sseAdapter) {
        return c.json({ error: 'SSE adapter not available' }, 500);
      }

      const userId = parseInt(String(payload.userId));
      const count = this.sseAdapter.getConnectionCount(userId);

      return c.json({
        success: true,
        data: {
          userId,
          connectionCount: count
        }
      });

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  // 關閉服務
  shutdown(): void {
    this.stopHeartbeat();
    if (this.sseAdapter && typeof (this.sseAdapter as any).disable === 'function') {
      (this.sseAdapter as any).disable();
    }
    console.log('NotificationSSEHandler shut down');
  }
}

// 工廠函數
export function createNotificationSSEHandler() {
  return new NotificationSSEHandler();
}

// 匯出處理器方法
export function createNotificationSSEHandlerMethods() {
  const handler = new NotificationSSEHandler();

  return {
    connect: handler.connect,
    sendMessage: handler.sendMessage,
    broadcast: handler.broadcast,
    getStats: handler.getStats,
    cleanupConnections: handler.cleanupConnections,
    getUserConnectionCount: handler.getUserConnectionCount,

    // 提供關閉方法給外部使用
    shutdown: () => handler.shutdown()
  };
}