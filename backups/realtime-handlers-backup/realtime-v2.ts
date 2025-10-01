// 事件驅動的即時通訊處理器 - 新版本
// 專案名稱：Multi-Channel Support MVP - Event-Driven Push System
// 取代原有的定時查詢機制，使用隊列事件驅動

import { Context } from 'hono';
import type { Bindings } from '../types/bindings';
import { 
  successResponse, 
  errorResponse, 
  unauthorizedResponse,
  handleApiError 
} from '../utils/api-response';
import { verifyJWT } from '../utils/auth';
import { drizzle } from 'drizzle-orm/d1';
import { sql } from 'drizzle-orm';
import { realtimeQueueHandler } from './realtime-queue';

// 使用全域 SSE 管理器 - 確保與 realtime-queue.ts 中使用相同的實例
declare global {
  var __sseManager: typeof import('./realtime-queue').sseManager | undefined;
}

const getSseManager = () => {
  if (!globalThis.__sseManager) {
    // 如果還沒初始化，需要從 realtime-queue 模組載入
    const { sseManager } = require('./realtime-queue');
    return sseManager;
  }
  return globalThis.__sseManager;
};

interface TypingStatus {
  userId: number;
  userName: string;
  conversationId: number;
  startTime: number;
  expiresAt: number;
}

export const realtimeHandlerV2 = {
  // 🚀 事件驅動 SSE 端點 - 集成隊列事件系統
  sse: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      let payload = c.get('jwtPayload');
      const conversationId = c.req.query('conversationId');

      // 如果沒有 payload，嘗試從查詢參數獲取 token (用於 EventSource)
      if (!payload) {
        const queryToken = c.req.query('token');
        if (queryToken) {
          try {
            // 手動驗證 JWT token
            payload = await verifyJWT(queryToken, c.env.JWT_SECRET);
          } catch (error) {
            console.error('Invalid query token:', error);
            return unauthorizedResponse(c, 'Invalid token');
          }
        }
      }

      if (!payload) {
        return unauthorizedResponse(c, 'Authentication required for SSE');
      }

      // 🔧 優化的 SSE 標頭 - 改進連接穩定性
      const headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control, Authorization',
        'X-Accel-Buffering': 'no', // 禁用 Nginx 緩衝
        'Keep-Alive': 'timeout=120, max=1000', // 明確設定keep-alive參數
        'Pragma': 'no-cache', // 額外的no-cache指示
        'Transfer-Encoding': 'chunked', // 確保正確的傳輸編碼
      };

      const encoder = new TextEncoder();
      let connectionClosed = false;
      let heartbeatInterval: any;
      let backupCheckInterval: any;
      
      // 生成唯一的連接 ID
      const connectionId = `${payload.userId}-${Date.now()}-${Math.random().toString(36).substring(2)}`;

      const stream = new ReadableStream({
        async start(controller) {
          // 📡 註冊此 SSE 連接到全域管理器
          const sseManager = getSseManager();
          sseManager.setEnv(c.env);
          await sseManager.addConnection(
            connectionId, 
            controller, 
            payload.userId, 
            conversationId ? parseInt(conversationId) : undefined
          );
          
          console.log(`🔗 [SSE] Connection registered in manager:`, {
            connectionId,
            userId: payload.userId,
            conversationId,
            totalConnections: sseManager.getStats().totalConnections
          });

          // 發送初始連接確認
          const connectionEvent = {
            type: 'connection',
            message: 'Event-driven SSE connection established',
            timestamp: new Date().toISOString(),
            userId: payload.userId,
            conversationId,
            connectionId
          };
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(connectionEvent)}\n\n`));

          // 📥 發送最近的事件（補償新連接可能錯過的事件）
          realtimeQueueHandler.getRecentEventsForConnection(
            conversationId ? parseInt(conversationId) : null,
            typeof payload.userId === 'string' ? parseInt(payload.userId) : payload.userId,
            c.env
          ).then(recentEvents => {
            if (recentEvents.length > 0) {
              console.log(`📥 [SSE] Sending ${recentEvents.length} recent events to ${connectionId}`);
              for (const event of recentEvents) {
                if (!connectionClosed) {
                  const eventData = {
                    type: event.type,
                    data: event.data,
                    timestamp: event.timestamp,
                    source: 'recent_events'
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(eventData)}\n\n`));
                }
              }
            }
          }).catch(error => {
            console.error('❌ [SSE] Failed to send recent events:', error);
          });

          // 💓 優化的心跳檢測 (每 8 秒) - 更頻繁的心跳確保連接穩定
          heartbeatInterval = setInterval(() => {
            if (connectionClosed) {
              clearInterval(heartbeatInterval);
              return;
            }

            try {
              const heartbeat = {
                type: 'heartbeat',
                timestamp: new Date().toISOString(),
                serverTime: Date.now(),
                connectionId,
                uptime: Date.now() - parseInt(connectionId.split('-')[1] ?? '0'),
                stats: getSseManager().getStats()
              };
              
              // 🔥 重要：使用雙換行符確保SSE格式正確
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(heartbeat)}\n\n`));
              
              console.log(`💓 [SSE] Heartbeat sent to ${connectionId}`);
            } catch (error) {
              console.error(`💔 [SSE] Heartbeat failed for ${connectionId}:`, error);
              connectionClosed = true;
              clearInterval(heartbeatInterval);
              getSseManager().removeConnection(connectionId);
              
              // 發送連接關閉事件給客戶端（如果可能）
              try {
                const closeEvent = {
                  type: 'connection_closed',
                  timestamp: new Date().toISOString(),
                  reason: 'heartbeat_failed',
                  connectionId
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(closeEvent)}\n\n`));
              } catch (e) {
                // 忽略發送關閉事件的錯誤
              }
              
              // 嘗試優雅關閉
              try {
                controller.close();
              } catch (e) {
                // 忽略關閉錯誤
              }
            }
          }, 8000);

          // 🔄 極簡備份檢查 (每 60 秒) - 只為了確保連接活躍
          // 主要依賴隊列事件，這只是保險措施
          backupCheckInterval = setInterval(async () => {
            if (connectionClosed) {
              clearInterval(backupCheckInterval);
              return;
            }

            try {
              // 發送連接狀態更新
              const statusUpdate = {
                type: 'connection_status',
                timestamp: new Date().toISOString(),
                connectionId,
                uptime: Date.now() - parseInt(connectionId.split('-')[1] ?? '0'),
                message: 'Connection healthy - event-driven mode'
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(statusUpdate)}\n\n`));
            } catch (error) {
              console.error('❌ [SSE] Backup check failed:', error);
              connectionClosed = true;
              getSseManager().removeConnection(connectionId);
            }
          }, 60000);

          console.log(`✅ [SSE] Event-driven connection established: ${connectionId} (User: ${payload.userId}, Conv: ${conversationId})`);
        },

        cancel() {
          connectionClosed = true;
          if (heartbeatInterval) clearInterval(heartbeatInterval);
          if (backupCheckInterval) clearInterval(backupCheckInterval);
          getSseManager().removeConnection(connectionId);
          console.log(`🔌 [SSE] Event-driven connection closed: ${connectionId}`);
        }
      });

      return new Response(stream, { headers });

    } catch (error) {
      console.error('❌ [SSE] Event-driven SSE error:', error);
      return errorResponse(c, 'Failed to establish event-driven SSE connection', 500);
    }
  },

  // 發送打字狀態 (保持原有功能)
  sendTypingStatus: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      const { conversationId, isTyping } = await c.req.json();

      if (!conversationId) {
        return errorResponse(c, 'Conversation ID is required', 400);
      }

      const key = `typing:${conversationId}:${payload.userId}`;
      
      if (isTyping) {
        // 設置打字狀態，30 秒後自動過期
        const typingStatus: TypingStatus = {
          userId: typeof payload.userId === 'string' ? parseInt(payload.userId) : payload.userId,
          userName: payload.displayName || `User ${payload.userId}`,
          conversationId: parseInt(conversationId),
          startTime: Date.now(),
          expiresAt: Date.now() + 30000
        };

        await c.env.SESSIONS.put(key, JSON.stringify(typingStatus), { expirationTtl: 30 });

        // 🚀 推送打字事件到隊列
        await realtimeQueueHandler.createAndQueueEvent(
          'typing_started',
          {
            conversationId: parseInt(conversationId),
            userId: typeof payload.userId === 'string' ? parseInt(payload.userId) : payload.userId,
            userName: payload.displayName || `User ${payload.userId}`,
            isTyping: true
          },
          {
            conversationId: parseInt(conversationId)
          },
          'low',
          c.env,
          'user'
        );

      } else {
        // 清除打字狀態
        await c.env.SESSIONS.delete(key);

        // 🚀 推送停止打字事件
        await realtimeQueueHandler.createAndQueueEvent(
          'typing_stopped',
          {
            conversationId: parseInt(conversationId),
            userId: typeof payload.userId === 'string' ? parseInt(payload.userId) : payload.userId,
            userName: payload.displayName || `User ${payload.userId}`,
            isTyping: false
          },
          {
            conversationId: parseInt(conversationId)
          },
          'low',
          c.env,
          'user'
        );
      }

      return successResponse(c, { success: true }, 'Typing status updated');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取對話的打字狀態 (保持原有功能)
  getTypingStatuses: async (env: Bindings, conversationId: number | null): Promise<TypingStatus[]> => {
    if (!conversationId) return [];

    try {
      // 獲取所有相關的打字狀態
      const keys = await env.SESSIONS.list({ prefix: `typing:${conversationId}:` });
      const statuses: TypingStatus[] = [];

      for (const key of keys.keys) {
        try {
          const value = await env.SESSIONS.get(key.name);
          if (value) {
            const status = JSON.parse(value) as TypingStatus;
            // 檢查是否過期
            if (status.expiresAt > Date.now()) {
              statuses.push(status);
            } else {
              // 清理過期的狀態
              await env.SESSIONS.delete(key.name);
            }
          }
        } catch (error) {
          console.error(`Error parsing typing status for key ${key.name}:`, error);
        }
      }

      return statuses;
    } catch (error) {
      console.error('Error getting typing statuses:', error);
      return [];
    }
  },

  // 廣播事件到對話中的所有用戶 (現在直接使用隊列)
  broadcastToConversation: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const { conversationId, event } = await c.req.json();

      if (!conversationId || !event) {
        return errorResponse(c, 'Conversation ID and event are required', 400);
      }

      // 🚀 直接推送到隊列，讓隊列處理器分發
      const eventId = await realtimeQueueHandler.createAndQueueEvent(
        event.type,
        event.data,
        {
          conversationId: parseInt(conversationId),
          broadcast: false
        },
        event.priority || 'normal',
        c.env,
        'api'
      );

      return successResponse(c, { 
        success: true, 
        eventId,
        message: 'Event broadcasted via queue'
      }, 'Event broadcasted');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取對話狀態 (保持原有功能，添加連接統計)
  getConversationStatus: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const conversationId = c.req.param('id');

      // 使用單一查詢獲取所有需要的資訊
      const drizzleDb = drizzle(c.env.DB);
      const result = await drizzleDb.get(sql`
        SELECT 
          c.*,
          cu.display_name as customer_name,
          cu.platform,
          cu.avatar_url,
          t.name as team_name,
          u.display_name as agent_name,
          (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND sender_type = 'customer' AND is_read = FALSE) as unread_count,
          (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
          (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at
        FROM conversations c
        JOIN customers cu ON c.customer_id = cu.id
        LEFT JOIN teams t ON c.assigned_team_id = t.id
        LEFT JOIN users u ON c.assigned_user_id = u.id
        WHERE c.id = ${conversationId}
      `);

      if (!result) {
        return errorResponse(c, 'Conversation not found', 404);
      }

      // 獲取打字狀態
      const typingStatuses = await realtimeHandlerV2.getTypingStatuses(c.env, parseInt(conversationId));

      // 獲取 SSE 連接統計
      const sseStats = getSseManager().getStats();

      const conversationStatus = {
        id: (result as any).id,
        status: (result as any).status,
        priority: (result as any).priority,
        customer: {
          name: (result as any).customer_name,
          platform: (result as any).platform,
          avatarUrl: (result as any).avatar_url
        },
        assignment: {
          teamId: (result as any).assigned_team_id,
          teamName: (result as any).team_name,
          userId: (result as any).assigned_user_id,
          userName: (result as any).agent_name
        },
        activity: {
          unreadCount: (result as any).unread_count,
          lastMessage: (result as any).last_message,
          lastMessageAt: (result as any).last_message_at,
          typingUsers: typingStatuses,
          sseConnections: sseStats.totalConnections
        },
        timestamps: {
          createdAt: (result as any).created_at,
          updatedAt: (result as any).updated_at,
          lastMessageAt: (result as any).last_message_at
        }
      };

      // 設置快取標頭 (5 秒)
      c.header('Cache-Control', 'public, max-age=5');
      c.header('ETag', `"${(result as any).updated_at}"`);

      return successResponse(c, conversationStatus, 'Conversation status retrieved');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 更新在線狀態 (保持原有功能)
  updateOnlineStatus: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      const { conversationId, isOnline } = await c.req.json();

      const onlineAgentsKey = `online_agents:${conversationId}`;
      const onlineAgentsData = await c.env.SESSIONS.get(onlineAgentsKey);
      let onlineAgents = onlineAgentsData ? JSON.parse(onlineAgentsData) : [];

      if (isOnline) {
        // 添加到在線列表
        const agentInfo = {
          userId: payload.userId,
          userName: payload.displayName || `User ${payload.userId}`,
          joinedAt: new Date().toISOString()
        };

        // 移除舊的記錄（如果存在）
        onlineAgents = onlineAgents.filter((agent: any) => agent.userId !== payload.userId);
        onlineAgents.push(agentInfo);
      } else {
        // 從在線列表移除
        onlineAgents = onlineAgents.filter((agent: any) => agent.userId !== payload.userId);
      }

      // 更新 KV 存儲，5 分鐘過期
      await c.env.SESSIONS.put(onlineAgentsKey, JSON.stringify(onlineAgents), { expirationTtl: 300 });

      return successResponse(c, { 
        onlineAgents: onlineAgents.length,
        isOnline,
        sseStats: getSseManager().getStats()
      }, 'Online status updated');

    } catch (error) {
      return handleApiError(error, c);
    }
  }
};