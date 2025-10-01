// 簡化版SSE實時消息處理器
// 核心原則：簡單、可靠、易維護
// 每個連接獨立運行，無跨Worker同步複雜性

import type { Context } from 'hono';
import type { Bindings } from '../types';
import { verifyJWT } from '../utils/auth';
import { eq, gt, desc, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

export const simpleRealtimeHandler = {
  // 簡化版SSE端點 - 每個連接自主運行
  sse: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      // 1. 驗證JWT token
      const token = c.req.query('token') || c.req.header('authorization')?.replace('Bearer ', '');
      
      if (!token) {
        return c.json({ error: 'Missing authentication token' }, 401);
      }

      const payload = await verifyJWT(token, c.env.JWT_SECRET);
      if (!payload) {
        return c.json({ error: 'Invalid token' }, 401);
      }

      const userId = payload.userId;
      const conversationId = c.req.query('conversationId');

      console.log(`🔗 [Simple SSE] Connection established for user ${userId}, conversation ${conversationId}`);

      // 2. 設置SSE headers
      const headers = new Headers({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      });

      // 3. 創建SSE stream
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          let lastCheckTime = new Date();
          
          // 初始化資料庫連接
          const db = drizzle(c.env.DB, { schema });

          // SSE連接確認
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({
              type: 'connection',
              message: 'Simple SSE connection established',
              timestamp: new Date().toISOString(),
              userId,
              conversationId
            })}\n\n`
          ));

          console.log(`✅ [Simple SSE] Connection confirmed for user ${userId}`);

          // 4. 心跳機制 - 每8秒發送
          const heartbeatInterval = setInterval(() => {
            try {
              const heartbeat = {
                type: 'heartbeat',
                timestamp: new Date().toISOString(),
                connectionActive: true
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(heartbeat)}\n\n`));
              console.log(`💓 [Simple SSE] Heartbeat sent to user ${userId}`);
            } catch (error) {
              console.error(`❌ [Simple SSE] Heartbeat failed for user ${userId}:`, error);
              clearInterval(heartbeatInterval);
            }
          }, 8000);

          // 5. 消息檢查機制 - 每1秒查詢新消息
          const messageCheckInterval = setInterval(async () => {
            try {
              if (!conversationId) return;

              // 查詢該對話的新消息 (只查詢在上次檢查時間之後的消息)
              const newMessages = await db
                .select()
                .from(schema.messages)
                .where(
                  and(
                    eq(schema.messages.conversationId, conversationId),
                    gt(schema.messages.createdAt, lastCheckTime.toISOString())
                  )
                )
                .orderBy(desc(schema.messages.createdAt))
                .limit(10);

              // 如果有新消息，推送給客戶端
              if (newMessages.length > 0) {
                console.log(`📨 [Simple SSE] Found ${newMessages.length} new messages for conversation ${conversationId}`);
                
                // 調試：顯示實際返回的消息數據結構
                console.log(`🔍 [Simple SSE Debug] First message data:`, {
                  id: newMessages[0]?.id,
                  createdAt: newMessages[0]?.createdAt,
                  createdAtType: typeof newMessages[0]?.createdAt,
                  messageKeys: Object.keys(newMessages[0] || {})
                });
                
                // 保存最新消息時間（排序前）- 修復時間戳處理
                const firstMessage = newMessages[0];
                const latestMessageTime = firstMessage?.createdAt;
                
                console.log(`🔍 [Simple SSE Debug] Latest message time: "${latestMessageTime}" (type: ${typeof latestMessageTime})`);
                
                newMessages.reverse().forEach(message => {
                  const eventData = {
                    type: 'new_message',
                    timestamp: new Date().toISOString(),
                    data: {
                      id: message.id,
                      conversationId: message.conversationId,
                      content: message.content,
                      messageType: message.messageType,
                      senderType: message.senderType,
                      createdAt: message.createdAt,
                      customerSenderId: message.customerSenderId,
                      agentSenderId: message.agentSenderId
                    }
                  };
                  
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(eventData)}\n\n`));
                  console.log(`✅ [Simple SSE] Message pushed: ${message.id}`);
                });

                // 強制更新最後檢查時間 - 修復邏輯
                if (latestMessageTime && latestMessageTime.trim()) {
                  try {
                    const newTime = new Date(latestMessageTime);
                    if (!isNaN(newTime.getTime())) {
                      lastCheckTime = newTime;
                      console.log(`🔄 [Simple SSE] Updated lastCheckTime to: ${lastCheckTime.toISOString()}`);
                    } else {
                      console.error(`❌ [Simple SSE] Invalid timestamp: "${latestMessageTime}"`);
                      // 使用當前時間作為備用
                      lastCheckTime = new Date();
                      console.log(`🔄 [Simple SSE] Fallback lastCheckTime to: ${lastCheckTime.toISOString()}`);
                    }
                  } catch (error) {
                    console.error(`❌ [Simple SSE] Error parsing timestamp:`, error);
                    // 使用當前時間作為備用
                    lastCheckTime = new Date();
                    console.log(`🔄 [Simple SSE] Fallback lastCheckTime to: ${lastCheckTime.toISOString()}`);
                  }
                } else {
                  console.error(`❌ [Simple SSE] Empty or invalid latestMessageTime: "${latestMessageTime}"`);
                  // 使用當前時間作為備用，防止重複推送
                  lastCheckTime = new Date();
                  console.log(`🔄 [Simple SSE] Fallback lastCheckTime to: ${lastCheckTime.toISOString()}`);
                }
                console.log(`✅ [Simple SSE] Successfully processed ${newMessages.length} messages`);
              }

            } catch (error) {
              console.error(`❌ [Simple SSE] Message check failed for user ${userId}:`, error);
            }
          }, 1000); // 1秒間隔

          // 6. 連接狀態檢查 - 每30秒
          const statusInterval = setInterval(() => {
            try {
              const status = {
                type: 'connection_status',
                timestamp: new Date().toISOString(),
                message: 'Connection healthy - simple mode',
                uptime: Date.now() - new Date().getTime()
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(status)}\n\n`));
            } catch (error) {
              console.error(`❌ [Simple SSE] Status check failed:`, error);
              clearInterval(statusInterval);
            }
          }, 30000);

          // 7. 清理機制
          const cleanup = () => {
            console.log(`🔌 [Simple SSE] Cleaning up connection for user ${userId}`);
            clearInterval(heartbeatInterval);
            clearInterval(messageCheckInterval);
            clearInterval(statusInterval);
          };

          // 監聽連接關閉
          c.req.raw.signal?.addEventListener('abort', cleanup);
          
          // 設置5分鐘超時清理
          setTimeout(() => {
            console.log(`⏰ [Simple SSE] Connection timeout for user ${userId}`);
            cleanup();
            controller.close();
          }, 300000);
        },

        cancel() {
          console.log(`🛑 [Simple SSE] Stream cancelled`);
        }
      });

      return new Response(stream, { 
        status: 200, 
        headers 
      });

    } catch (error) {
      console.error('❌ [Simple SSE] Handler error:', error);
      return c.json({ error: 'SSE connection failed' }, 500);
    }
  },

  // 簡化版測試事件端點
  testEvent: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const { conversationId } = await c.req.json();
      
      console.log(`🧪 [Simple SSE] Test event triggered for conversation ${conversationId}`);
      
      // 在簡化版中，我們不主動推送測試事件
      // 而是依賴1秒的消息檢查機制自動發現新消息
      
      return c.json({
        success: true,
        message: 'In simplified mode, events are detected automatically via message polling',
        conversationId,
        mode: 'simplified_polling'
      });

    } catch (error) {
      console.error('❌ [Simple SSE] Test event error:', error);
      return c.json({ error: 'Test event failed' }, 500);
    }
  }
};