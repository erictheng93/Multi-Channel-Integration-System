// src/handlers/realtime.ts
// 優化的即時通訊處理器 - 替代 Durable Objects

import { Context } from 'hono';
import type { Bindings } from '../types';
import { 
  successResponse, 
  errorResponse, 
  unauthorizedResponse,
  handleApiError 
} from '../utils/api-response';
import { verifyJWT } from '../utils/auth';
import { drizzle } from 'drizzle-orm/d1';
import { sql } from 'drizzle-orm';

interface RealtimeEvent {
  type: 'message' | 'typing' | 'agent_joined' | 'agent_left' | 'assignment_changed' | 'status_changed';
  conversationId: number;
  userId: number;
  userName: string;
  data: any;
  timestamp: string;
}

interface TypingStatus {
  userId: number;
  userName: string;
  conversationId: number;
  startTime: number;
  expiresAt: number;
}

export const realtimeHandler = {
  // 優化的 SSE 端點
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

      // 設置優化的 SSE 標頭
      const headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control, Authorization',
        'X-Accel-Buffering': 'no', // 禁用 Nginx 緩衝
      };

      const encoder = new TextEncoder();
      let connectionClosed = false;
      let heartbeatInterval: any;
      let notificationCheckInterval: any;

      const stream = new ReadableStream({
        start(controller) {
          // 發送初始連接確認
          const connectionEvent = {
            type: 'connection',
            message: 'SSE connection established',
            timestamp: new Date().toISOString(),
            userId: payload.userId,
            conversationId
          };
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(connectionEvent)}\n\n`));

          // 優化的心跳檢測 (每 15 秒) - 減少延遲並提高連接穩定性
          heartbeatInterval = setInterval(() => {
            if (connectionClosed) {
              clearInterval(heartbeatInterval);
              return;
            }

            try {
              const heartbeat = {
                type: 'heartbeat',
                timestamp: new Date().toISOString(),
                serverTime: Date.now()
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(heartbeat)}\n\n`));
            } catch (error) {
              connectionClosed = true;
              clearInterval(heartbeatInterval);
              console.log('SSE heartbeat failed, connection closed');
            }
          }, 15000);

          // 優化的通知檢查 (每 3 秒) - 合併查詢減少資料庫負載
          const checkNotifications = async () => {
            if (connectionClosed) return;

            try {
              const drizzleDb = drizzle(c.env.DB);
              const timeWindow = '-30 seconds';
              
              // 優化：並行執行查詢而不是序列執行
              const queryPromises = [];
              
              // 1. 檢查新通知 (只選擇必要欄位)
              queryPromises.push(
                drizzleDb.run(sql`
                  SELECT id, type, title, content, created_at FROM notifications
                  WHERE user_id = ${payload.userId} AND is_read = FALSE
                  AND created_at > datetime('now', ${timeWindow})
                  ORDER BY created_at DESC
                  LIMIT 5
                `)
              );

              // 2. 檢查新消息和對話更新 (合併查詢)
              if (conversationId) {
                queryPromises.push(
                  drizzleDb.run(sql`
                    SELECT m.id, m.content, m.message_type, m.sender_type, m.sender_id, m.created_at, m.is_read, m.metadata,
                           c.customer_id, c.status as conversation_status, c.updated_at as conversation_updated_at,
                           cu.display_name as customer_name,
                           u.display_name as agent_name
                    FROM messages m
                    JOIN conversations c ON m.conversation_id = c.id
                    JOIN customers cu ON c.customer_id = cu.id
                    LEFT JOIN users u ON m.sender_id = u.id
                    WHERE m.conversation_id = ${conversationId} 
                    AND m.created_at > datetime('now', ${timeWindow})
                    ORDER BY m.created_at ASC
                  `),
                  drizzleDb.get(sql`
                    SELECT c.id, c.status, c.updated_at, cu.display_name as customer_name
                    FROM conversations c
                    JOIN customers cu ON c.customer_id = cu.id
                    WHERE c.id = ${conversationId} AND c.updated_at > datetime('now', ${timeWindow})
                  `)
                );
              }

              // 並行執行所有查詢
              const results = await Promise.all(queryPromises);
              const notifications = results[0] as any;
              const newMessages = conversationId && results[1] ? ((results[1] as any)?.results || []) : [];
              const conversationUpdates = conversationId && results[2] ? (results[2] as any) : null;

              // 檢查打字狀態
              const typingStatuses = await realtimeHandler.getTypingStatuses(c.env, conversationId ? parseInt(conversationId) : null);

              // 發送新消息（優化：直接推送消息內容）
              if (newMessages.length > 0) {
                for (const message of newMessages) {
                  const messageData = {
                    id: (message as any).id,
                    conversationId: parseInt(conversationId!),
                    content: (message as any).content,
                    messageType: (message as any).message_type || 'text',
                    senderType: (message as any).sender_type,
                    senderId: (message as any).sender_id,
                    senderName: (message as any).sender_type === 'customer' 
                      ? (message as any).customer_name 
                      : (message as any).agent_name,
                    createdAt: (message as any).created_at,
                    isRead: (message as any).is_read,
                    metadata: (message as any).metadata ? JSON.parse((message as any).metadata) : null
                  };

                  const eventData = {
                    type: 'new_message',
                    data: messageData,
                    timestamp: new Date().toISOString()
                  };
                  
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(eventData)}\n\n`));
                }
              }

              // 發送通知（保留作為備份）
              if ((notifications as any)?.results?.length > 0) {
                for (const notification of ((notifications as any)?.results || [])) {
                  const eventData = {
                    type: 'notification',
                    data: {
                      id: (notification as any).id,
                      type: (notification as any).type,
                      title: (notification as any).title,
                      content: (notification as any).content,
                      createdAt: (notification as any).created_at
                    },
                    timestamp: new Date().toISOString()
                  };
                  
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(eventData)}\n\n`));
                }
              }

              // 發送對話更新
              if (conversationUpdates) {
                const eventData = {
                  type: 'conversation_updated',
                  data: {
                    conversationId: (conversationUpdates as any).id,
                    status: (conversationUpdates as any).status,
                    assignedUserId: (conversationUpdates as any).assigned_user_id,
                    assignedTeamId: (conversationUpdates as any).assigned_team_id,
                    customerName: (conversationUpdates as any).customer_name,
                    updatedAt: (conversationUpdates as any).updated_at
                  },
                  timestamp: new Date().toISOString()
                };
                
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(eventData)}\n\n`));
              }

              // 發送打字狀態
              if (typingStatuses.length > 0) {
                const eventData = {
                  type: 'typing_status',
                  data: typingStatuses,
                  timestamp: new Date().toISOString()
                };
                
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(eventData)}\n\n`));
              }

            } catch (error) {
              console.error('Error checking notifications for SSE:', error);
            }
          };

          // 智能檢查機制：根據活動情況調整檢查頻率
          let consecutiveEmptyChecks = 0;
          const maxEmptyChecks = 10; // 10次空檢查後降低頻率
          let currentCheckInterval = 3000; // 開始 3 秒
          
          const smartCheckNotifications = async () => {
            const startTime = Date.now();
            await checkNotifications();
            
            // 模擬檢查結果（基於檢查時間長短判斷是否有數據）
            const checkDuration = Date.now() - startTime;
            const hadActivity = checkDuration > 50; // 如果查詢時間超過50ms，可能有數據處理
            
            if (hadActivity) {
              consecutiveEmptyChecks = 0;
              currentCheckInterval = 3000; // 重置為快速檢查
            } else {
              consecutiveEmptyChecks++;
              if (consecutiveEmptyChecks >= maxEmptyChecks) {
                currentCheckInterval = Math.min(10000, currentCheckInterval * 1.5); // 最多延長到10秒
              }
            }
            
            // 動態調整下次檢查間隔
            if (notificationCheckInterval) {
              clearTimeout(notificationCheckInterval);
            }
            notificationCheckInterval = setTimeout(smartCheckNotifications, currentCheckInterval);
          };

          // 立即檢查一次，然後啟動智能檢查
          smartCheckNotifications();
        },

        cancel() {
          connectionClosed = true;
          if (heartbeatInterval) clearInterval(heartbeatInterval);
          if (notificationCheckInterval) clearInterval(notificationCheckInterval);
          console.log(`SSE connection closed for user ${payload.userId}`);
        }
      });

      return new Response(stream, { headers });

    } catch (error) {
      console.error('SSE error:', error);
      return errorResponse(c, 'Failed to establish SSE connection', 500);
    }
  },

  // 發送打字狀態
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
          userId: payload.userId,
          userName: payload.displayName || `User ${payload.userId}`,
          conversationId: parseInt(conversationId),
          startTime: Date.now(),
          expiresAt: Date.now() + 30000
        };

        await c.env.SESSIONS.put(key, JSON.stringify(typingStatus), { expirationTtl: 30 });
      } else {
        // 清除打字狀態
        await c.env.SESSIONS.delete(key);
      }

      return successResponse(c, { success: true }, 'Typing status updated');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取對話的打字狀態
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

  // 廣播事件到對話中的所有用戶
  broadcastToConversation: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const { conversationId, event } = await c.req.json();

      if (!conversationId || !event) {
        return errorResponse(c, 'Conversation ID and event are required', 400);
      }

      // 將事件存儲到 KV，讓 SSE 連接可以讀取
      const eventKey = `event:${conversationId}:${Date.now()}:${Math.random().toString(36).substring(2)}`;
      const eventData: RealtimeEvent = {
        ...event,
        conversationId: parseInt(conversationId),
        timestamp: new Date().toISOString()
      };

      // 存儲 60 秒，足夠 SSE 連接讀取
      await c.env.SESSIONS.put(eventKey, JSON.stringify(eventData), { expirationTtl: 60 });

      return successResponse(c, { success: true }, 'Event broadcasted');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取對話狀態 (HTTP API 優化版)
  getConversationStatus: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const conversationId = c.req.param('id');
      // const payload = c.get('jwtPayload');

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
      const typingStatuses = await realtimeHandler.getTypingStatuses(c.env, parseInt(conversationId));

      // 獲取在線代理數量
      const onlineAgentsKey = `online_agents:${conversationId}`;
      const onlineAgentsData = await c.env.SESSIONS.get(onlineAgentsKey);
      const onlineAgents = onlineAgentsData ? JSON.parse(onlineAgentsData) : [];

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
          onlineAgents: onlineAgents.length
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

  // 更新在線狀態
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
        isOnline 
      }, 'Online status updated');

    } catch (error) {
      return handleApiError(error, c);
    }
  }
};