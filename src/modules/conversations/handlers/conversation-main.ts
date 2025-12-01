// 對話管理處理器 - 主要實現
import { Hono } from 'hono';
import { eq, inArray, desc, and, count, sql, gt } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { conversations, customers, messages, agents, conversationTransfers, teams, fileAttachments, conversationTags } from '@/db/schema';
import type { Bindings } from '@/types';
import type {
  NewConversationTransfer
} from '../types/conversation-types';
import { ERROR_MESSAGES } from '@shared/utils/error-messages';
import { PermissionService } from '@shared/services/permission-service';
import { jwtAuth } from '@/middleware/auth';
import { verifyJWT, getUserById } from '@modules/auth/services/auth';
import { WebSocketBroadcastService } from '@shared/services/websocket-broadcast-service';
import { successResponse, errorResponse, validationErrorResponse } from '@shared/utils/api-response';
import { MessageRequestService, MessageService } from '@modules/conversations/services/message-service';
import { getSSECorsHeaders } from '@/config/cors';
import { WebSocketAuthService } from '@/services/websocket-auth-service';
import { createContextLogger } from '@/utils/logger';

// Context logger for conversation handler
const log = createContextLogger('ConversationHandler');

const conversationHandler = new Hono<{ Bindings: Bindings }>();

// ==================== ROUTE REGISTRATION (Proper Priority Order) ====================
// ✅ ROUTES REORDERED - All conflicts resolved following Hono's first-registered, first-matched priority
//
// CORRECTED ORDER (0 conflicts):
//   Priority 1: STATIC - GET /stream
//   Priority 2: MULTI-SEGMENT 3-param - GET /:conversationId/messages/stream
//   Priority 3: MULTI-SEGMENT 2-param:
//     - POST /:id/assign
//     - POST /:id/transfer
//     - POST /:id/messages
//     - GET /:id/messages
//   Priority 4: SINGLE PARAM - GET /:id
//   Priority 5: WILDCARD - GET /
//
// This ordering ensures that more specific routes (with concrete segments or more parameters)
// are checked before general parameterized or wildcard routes, preventing route interception.
// ====================================================================================

// ==================== Priority 1: STATIC routes ====================

// SSE推送端點 - 實時對話更新
conversationHandler.get('/stream', async (c) => {
  // 手動驗證token,因為EventSource無法設置自定義headers
  try {
    const authHeader = c.req.header('Authorization');
    const token = c.req.query('token'); // 備用：從query參數獲取token

    let authToken: string | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      authToken = authHeader.substring(7);
    } else if (token) {
      authToken = token;
    }

    if (!authToken) {
      return c.json({ error: 'Missing authentication token' }, 401);
    }

    // 驗證JWT並設置用戶
    const payload = await verifyJWT(authToken, c.env.JWT_SECRET);
    const user = await getUserById(c.env.DB, payload.userId);

    if (!user.isActive) {
      return c.json({ error: 'User account is inactive' }, 401);
    }

    // 手動設置用戶到context
    c.set('user', user);

    console.log('🔄 [SSE Stream] Starting SSE connection for user:', user.id);

    // 設定SSE headers（使用統一 CORS 配置）
    const sseCorsHeaders1 = getSSECorsHeaders(c.req.header('Origin'));
    Object.entries(sseCorsHeaders1).forEach(([key, value]) => {
      c.header(key, value);
    });

    let isConnected = true;

    // 創建可讀流
    const stream = new ReadableStream({
      start(controller) {
        console.log('📡 [SSE Stream] Stream started');

        // 發送心跳
        const sendHeartbeat = () => {
          if (!isConnected) return;

          try {
            const heartbeat = `data: ${JSON.stringify({
              type: 'heartbeat',
              timestamp: new Date().toISOString()
            })}\n\n`;
            controller.enqueue(new TextEncoder().encode(heartbeat));
          } catch (error) {
            log.warn('SSE Stream: Heartbeat failed', { error: error instanceof Error ? error.message : String(error) });
            isConnected = false;
            controller.close();
          }
        };

        // 發送對話數據更新
        const sendConversationUpdate = async () => {
          if (!isConnected) return;

          try {
            console.log('📤 [SSE Stream] Sending conversation update');

            // 獲取用戶可見的對話
            const visibleConversationIds = await PermissionService.getVisibleConversations(user.id, c.env.DB);

            if (visibleConversationIds.length === 0) {
              const updateData = `data: ${JSON.stringify({
                type: 'conversations_update',
                data: [],
                timestamp: new Date().toISOString()
              })}\n\n`;
              controller.enqueue(new TextEncoder().encode(updateData));
              return;
            }

            // 使用相同的查詢邏輯獲取對話數據
            const drizzleDb = createDbClient(c.env.DB);
            const conversationData = await drizzleDb
              .select({
                id: conversations.id,
                customerId: conversations.customerId,
                assignedTeamId: conversations.assignedTeamId,
                assignedUserId: conversations.assignedUserId,
                status: conversations.status,
                lastMessageAt: conversations.lastMessageAt,
                createdAt: conversations.createdAt,
                updatedAt: conversations.updatedAt,
                customerName: customers.displayName,
                platform: customers.platform,
                platformUserId: customers.platformUserId
              })
              .from(conversations)
              .leftJoin(customers, eq(conversations.customerId, customers.id))
              .where(inArray(conversations.id, visibleConversationIds))
              .orderBy(desc(conversations.updatedAt));

            // 獲取最新消息
            const conversationIds = conversationData.map(c => c.id);
            let lastMessages: any[] = [];

            if (conversationIds.length > 0) {
              for (const conversationId of conversationIds) {
                const latestMessage = await drizzleDb
                  .select({
                    conversation_id: messages.conversationId,
                    last_message_content: messages.content,
                    last_message_at_actual: messages.createdAt
                  })
                  .from(messages)
                  .where(eq(messages.conversationId, conversationId))
                  .orderBy(desc(messages.createdAt))
                  .limit(1)
                  .get();

                if (latestMessage) {
                  lastMessages.push(latestMessage);
                }
              }
            }

            // 結合數據
            const combinedData = conversationData.map(conv => {
              const lastMsg = lastMessages.find((msg: any) => msg.conversation_id === conv.id);
              return {
                ...conv,
                // 構建lastMessage對象以匹配前端期望的結構
                lastMessage: lastMsg?.last_message_content ? {
                  content: lastMsg.last_message_content,
                  createdAt: lastMsg.last_message_at_actual
                } : null,
                // 保留原有字段以確保向後兼容
                last_message_content: lastMsg?.last_message_content || null,
                last_message_at_actual: lastMsg?.last_message_at_actual || null
              };
            });

            const updateData = `data: ${JSON.stringify({
              type: 'conversations_update',
              data: combinedData,
              timestamp: new Date().toISOString()
            })}\n\n`;

            controller.enqueue(new TextEncoder().encode(updateData));

          } catch (error) {
            log.error('SSE Stream: Failed to send conversation update', { error: error instanceof Error ? error.message : String(error) });
          }
        };

        // 立即發送初始數據
        sendConversationUpdate();

        // 定期發送更新 (60秒間隔，比輪詢更低頻)
        const updateInterval = setInterval(sendConversationUpdate, 60000);

        // 心跳間隔 (30秒)
        const heartbeatInterval = setInterval(sendHeartbeat, 30000);

        // 清理函數
        const cleanup = () => {
          isConnected = false;
          clearInterval(updateInterval);
          clearInterval(heartbeatInterval);
          controller.close();
          console.log('🔌 [SSE Stream] Connection closed and cleaned up');
        };

        // 設定清理定時器 (5分鐘後自動斷開)
        const connectionTimeout = setTimeout(cleanup, 5 * 60 * 1000);

        // 存儲清理函數以供外部調用
        (controller as any).cleanup = () => {
          clearTimeout(connectionTimeout);
          cleanup();
        };
      },

      cancel() {
        console.log('🚫 [SSE Stream] Stream cancelled');
        isConnected = false;
      }
    });

    // 使用統一的 SSE CORS 配置
    const sseCorsHeaders = getSSECorsHeaders(c.req.header('Origin'));
    return new Response(stream, { headers: sseCorsHeaders });

  } catch (error) {
    log.error('SSE Stream: Error setting up SSE', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      success: false,
      error: 'Failed to establish SSE connection',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 📦 批量操作端點 - POST /bulk
// 支援操作: assign, close, reopen, set_priority, add_tags
conversationHandler.post('/bulk', jwtAuth, async (c) => {
  const drizzleDb = createDbClient(c.env.DB);
  try {
    const { operation, conversationIds, data } = await c.req.json();
    const payload = c.get('jwtPayload');

    // 驗證 conversationIds
    if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
      return validationErrorResponse(c, [
        { field: 'conversationIds', message: 'Conversation IDs array is required' }
      ]);
    }

    // 限制批量操作數量
    if (conversationIds.length > 100) {
      return validationErrorResponse(c, [
        { field: 'conversationIds', message: 'Bulk operation limited to 100 conversations at a time' }
      ]);
    }

    const conversationIdsArray = conversationIds as string[];

    switch (operation) {
      case 'assign': {
        if (!data?.userId && !data?.teamId) {
          return validationErrorResponse(c, [
            { field: 'data', message: 'User ID or Team ID is required for assignment' }
          ]);
        }

        // 🆕 P1-4: Get old assignments for cache invalidation
        const oldAssignments = await drizzleDb
          .select({ id: conversations.id, assignedUserId: conversations.assignedUserId })
          .from(conversations)
          .where(inArray(conversations.id, conversationIdsArray));

        await drizzleDb.update(conversations)
          .set({
            assignedUserId: data.userId || null,
            assignedTeamId: data.teamId || null,
            status: 'assigned',
            updatedAt: sql`datetime('now')`
          })
          .where(inArray(conversations.id, conversationIdsArray));

        // 🆕 P1-4: Invalidate conversation cache for affected agents
        const authService = new WebSocketAuthService(c.env, c.env.DB, c.env.CACHE);
        const affectedAgentIds = new Set<string>();

        // Collect old assigned agents
        for (const conv of oldAssignments) {
          if (conv.assignedUserId) {
            affectedAgentIds.add(conv.assignedUserId);
          }
        }

        // Add new assigned agent
        if (data.userId) {
          affectedAgentIds.add(data.userId);
        }

        // Invalidate cache for all affected agents
        for (const agentId of affectedAgentIds) {
          await authService.invalidateAgentConversationCache(agentId);
        }
        console.log(`🗑️  [Bulk Assign] Invalidated cache for ${affectedAgentIds.size} agent(s)`);
        break;
      }

      case 'close':
        await drizzleDb.update(conversations)
          .set({
            status: 'closed',
            updatedAt: sql`datetime('now')`
          })
          .where(inArray(conversations.id, conversationIdsArray));
        break;

      case 'reopen':
        await drizzleDb.update(conversations)
          .set({
            status: 'active',
            updatedAt: sql`datetime('now')`
          })
          .where(inArray(conversations.id, conversationIdsArray));
        break;

      case 'set_priority':
        if (!data?.priority) {
          return validationErrorResponse(c, [
            { field: 'data.priority', message: 'Priority is required' }
          ]);
        }
        await drizzleDb.update(conversations)
          .set({
            priority: data.priority,
            updatedAt: sql`datetime('now')`
          })
          .where(inArray(conversations.id, conversationIdsArray));
        break;

      case 'add_tags':
        if (!data?.tagIds || !Array.isArray(data.tagIds)) {
          return validationErrorResponse(c, [
            { field: 'data.tagIds', message: 'Tag IDs array is required' }
          ]);
        }
        // 為每個對話添加標籤
        const tagInsertPromises = [];
        for (const convId of conversationIdsArray) {
          for (const tagId of data.tagIds) {
            tagInsertPromises.push(
              drizzleDb.insert(conversationTags)
                .values({
                  conversationId: convId,
                  tagId: parseInt(tagId),
                  assignedBy: payload?.userId ? String(payload.userId) : 'system'
                })
                .onConflictDoNothing()
            );
          }
        }
        await Promise.all(tagInsertPromises);
        break;

      case 'remove_tags':
        if (!data?.tagIds || !Array.isArray(data.tagIds)) {
          return validationErrorResponse(c, [
            { field: 'data.tagIds', message: 'Tag IDs array is required' }
          ]);
        }
        // 從對話移除標籤
        for (const convId of conversationIdsArray) {
          for (const tagId of data.tagIds) {
            await drizzleDb.delete(conversationTags)
              .where(
                and(
                  eq(conversationTags.conversationId, convId),
                  eq(conversationTags.tagId, parseInt(tagId))
                )
              );
          }
        }
        break;

      default:
        return validationErrorResponse(c, [
          { field: 'operation', message: `Invalid operation: ${operation}. Valid operations: assign, close, reopen, set_priority, add_tags, remove_tags` }
        ]);
    }

    console.log(`📦 [Conversations] Bulk ${operation} completed for ${conversationIdsArray.length} conversations`);
    return successResponse(c, {
      operation,
      affectedCount: conversationIdsArray.length,
      conversationIds: conversationIdsArray
    }, `Bulk ${operation} completed successfully`);

  } catch (error) {
    log.error('Conversations: Bulk operation error', { error: error instanceof Error ? error.message : String(error) });
    return errorResponse(c, error instanceof Error ? error.message : 'Failed to perform bulk operation', 500);
  }
});

// ==================== Priority 2: MULTI-SEGMENT 3-param routes ====================

// 🎯 新的專用訊息流 SSE 端點
conversationHandler.get('/:conversationId/messages/stream', async (c) => {
  try {
    console.log('🔍 [SSE Debug] Starting SSE endpoint handler');

    // 手動驗證token（EventSource 無法設置自定義 headers）
    const authHeader = c.req.header('Authorization');
    const token = c.req.query('token'); // 從 query 參數獲取 token

    console.log('🔍 [SSE Debug] Auth header:', authHeader ? 'Present' : 'Missing');
    console.log('🔍 [SSE Debug] Token query:', token ? 'Present' : 'Missing');

    let authToken: string | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      authToken = authHeader.substring(7);
    } else if (token) {
      authToken = token;
    }

    if (!authToken) {
      log.error('SSE Debug: No auth token found');
      return c.json({
        error: 'Missing authentication token',
        message: 'Please provide token via Authorization header or query parameter'
      }, 401);
    }

    console.log('🔍 [SSE Debug] Verifying JWT...');

    // 檢查環境變量
    if (!c.env.JWT_SECRET) {
      log.error('SSE Debug: JWT_SECRET is undefined');
      throw new Error('JWT_SECRET environment variable is not configured');
    }

    if (!c.env.DB) {
      log.error('SSE Debug: DB is undefined');
      throw new Error('DB environment variable is not configured');
    }

    // 驗證 JWT
    const payload = await verifyJWT(authToken, c.env.JWT_SECRET);
    console.log('✅ [SSE Debug] JWT verified, userId:', payload.userId);

    const user = await getUserById(c.env.DB, payload.userId);
    console.log('✅ [SSE Debug] User fetched:', user.id, user.displayName);

    if (!user || !user.isActive) {
      return c.json({ error: 'Invalid or inactive user account' }, 401);
    }

    const conversationId = c.req.param('conversationId');
    console.log(`📡 [SSE] Starting message stream for conversation: ${conversationId}, user: ${user.id}`);

    // 🔒 權限檢查：用戶是否可以訪問這個對話
    console.log('🔍 [SSE Debug] Checking permissions...');
    const visibleConversationIds = await PermissionService.getVisibleConversations(user.id, c.env.DB);
    console.log(`✅ [SSE Debug] Visible conversations: ${visibleConversationIds.length} total`);

    if (!visibleConversationIds.includes(conversationId)) {
      log.error('SSE Debug: Access denied to conversation', { conversationId });
      return c.json({
        error: 'Access denied to conversation',
        conversationId: conversationId
      }, 403);
    }

    console.log('✅ [SSE Debug] Permission check passed, creating SSE stream...');

    // 設置 SSE headers（使用統一 CORS 配置）
    const sseCorsHeaders3 = getSSECorsHeaders(c.req.header('Origin'));
    Object.entries(sseCorsHeaders3).forEach(([key, value]) => {
      c.header(key, value);
    });

    let isConnected = true;
    let lastMessageId: string | null = null;
    // let lastUpdateTimestamp = new Date().toISOString();

    // 創建流
    const stream = new ReadableStream({
      start(controller) {
        console.log(`🔌 [SSE] Stream established for conversation: ${conversationId}`);

        // 發送連接確認
        const connectionMessage = `data: ${JSON.stringify({
          type: 'connection_established',
          conversationId: conversationId,
          userId: user.id,
          timestamp: new Date().toISOString()
        })}\n\n`;
        controller.enqueue(new TextEncoder().encode(connectionMessage));

        // 發送初始訊息（最近10條）
        // 🎯 與前端 pageSize 配置保持一致，剩餘歷史消息由 HTTP 分頁加載提供
        const sendInitialMessages = async () => {
          if (!isConnected) return;

          try {
            const initialMessages = await getRecentMessages(conversationId, 10, c.env.DB);

            if (initialMessages.length > 0) {
              // 更新最後訊息ID和時間戳
              lastMessageId = initialMessages[initialMessages.length - 1]?.id || null;
              // lastUpdateTimestamp = initialMessages[initialMessages.length - 1].createdAt || new Date().toISOString();

              const data = `data: ${JSON.stringify({
                type: 'initial_messages',
                conversationId: conversationId,
                messages: initialMessages,
                count: initialMessages.length,
                lastMessageId: lastMessageId,
                timestamp: new Date().toISOString()
              })}\n\n`;

              controller.enqueue(new TextEncoder().encode(data));
              console.log(`📤 [SSE] Sent ${initialMessages.length} initial messages for ${conversationId}`);
            } else {
              // 沒有訊息時也發送確認
              const data = `data: ${JSON.stringify({
                type: 'initial_messages',
                conversationId: conversationId,
                messages: [],
                count: 0,
                timestamp: new Date().toISOString()
              })}\n\n`;

              controller.enqueue(new TextEncoder().encode(data));
              console.log(`📤 [SSE] No messages found for conversation ${conversationId}`);
            }
          } catch (error) {
            log.error('SSE: Error sending initial messages', { error: error instanceof Error ? error.message : String(error) });
          }
        };

        // 檢查新訊息
        const checkNewMessages = async () => {
          if (!isConnected) return;

          try {
            const newMessages = await getMessagesAfter(conversationId, lastMessageId, c.env.DB);

            if (newMessages.length > 0) {
              // 更新最後訊息ID和時間戳
              lastMessageId = newMessages[newMessages.length - 1]?.id || null;
              // lastUpdateTimestamp = newMessages[newMessages.length - 1].createdAt || new Date().toISOString();

              const data = `data: ${JSON.stringify({
                type: 'new_messages',
                conversationId: conversationId,
                messages: newMessages,
                count: newMessages.length,
                lastMessageId: lastMessageId,
                timestamp: new Date().toISOString()
              })}\n\n`;

              controller.enqueue(new TextEncoder().encode(data));
              console.log(`📤 [SSE] Sent ${newMessages.length} new messages for ${conversationId}`);
            }
          } catch (error) {
            log.error('SSE: Error checking new messages', { error: error instanceof Error ? error.message : String(error) });
          }
        };

        // 發送心跳
        const sendHeartbeat = () => {
          if (!isConnected) return;

          try {
            const heartbeat = `data: ${JSON.stringify({
              type: 'heartbeat',
              conversationId: conversationId,
              timestamp: new Date().toISOString(),
              lastMessageId: lastMessageId
            })}\n\n`;

            controller.enqueue(new TextEncoder().encode(heartbeat));
          } catch (error) {
            log.warn('SSE: Heartbeat failed', { error: error instanceof Error ? error.message : String(error) });
            isConnected = false;
            controller.close();
          }
        };

        // 立即發送初始訊息
        sendInitialMessages();

        // ⚡ 設置檢查間隔：每3秒檢查新訊息（高頻率以確保實時性）
        const messageCheckInterval = setInterval(checkNewMessages, 3000);

        // 💓 心跳間隔：每30秒發送心跳
        const heartbeatInterval = setInterval(sendHeartbeat, 30000);

        // 🧹 清理函數
        const cleanup = () => {
          isConnected = false;
          clearInterval(messageCheckInterval);
          clearInterval(heartbeatInterval);
          controller.close();
          console.log(`🔌 [SSE] Stream closed for conversation: ${conversationId}`);
        };

        // 5分鐘後自動斷開連接（防止資源洩漏）
        const connectionTimeout = setTimeout(cleanup, 5 * 60 * 1000);

        // 存儲清理函數以供外部調用
        (controller as any).cleanup = () => {
          clearTimeout(connectionTimeout);
          cleanup();
        };
      },

      cancel() {
        console.log(`🚫 [SSE] Stream cancelled by client for conversation: ${conversationId}`);
        isConnected = false;
      }
    });

    // 使用統一的 SSE CORS 配置
    const sseResponseHeaders = getSSECorsHeaders(c.req.header('Origin'));
    return new Response(stream, { headers: sseResponseHeaders });

  } catch (error) {
    log.error('SSE: Error setting up message stream', {
      error: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown'
    });
    return c.json({
      success: false,
      error: 'Failed to establish message stream',
      reason: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// ==================== Priority 3: MULTI-SEGMENT 2-param routes ====================

// 指派對話到團隊/用戶
conversationHandler.post('/:id/assign', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const conversationId = c.req.param('id');
    const { teamId, userId, reason } = await c.req.json();

    // 檢查權限
    const hasPermission = await PermissionService.checkPermission(
      user.id,
      'conversation',
      'assign',
      undefined, // context
      c.env.DB   // 傳入資料庫以正確檢查用戶角色
    );

    if (!hasPermission) {
      return c.json({ error: 'Permission denied' }, 403);
    }

    // 更新對話指派
    const drizzleDb = createDbClient(c.env.DB);
    const timestamp = new Date().toISOString();

    // 🆕 P1-4: Get old conversation to track previous assignment for cache invalidation
    const oldConversation = await drizzleDb
      .select({ assignedUserId: conversations.assignedUserId })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get();
    const oldAssignedUserId = oldConversation?.assignedUserId;

    console.log('🔧 [Assign API] Updating conversation:', {
      conversationId,
      teamId,
      userId,
      status: 'assigned'
    });

    await drizzleDb
      .update(conversations)
      .set({
        assignedTeamId: teamId || null,
        assignedUserId: userId || null,
        status: 'assigned',  // 🔧 FIX: Add status field
        updatedAt: timestamp
      })
      .where(eq(conversations.id, conversationId));

    console.log('✅ [Assign API] Database UPDATE completed');

    // 🆕 P1-4: Invalidate conversation cache for affected agents
    const authService = new WebSocketAuthService(c.env, c.env.DB, c.env.CACHE);

    // Invalidate cache for previously assigned agent (if exists)
    if (oldAssignedUserId && oldAssignedUserId !== userId) {
      await authService.invalidateAgentConversationCache(oldAssignedUserId);
      console.log(`🗑️  [Assign API] Invalidated conversation cache for old agent: ${oldAssignedUserId}`);
    }

    // Invalidate cache for newly assigned agent (if exists)
    if (userId) {
      await authService.invalidateAgentConversationCache(userId);
      console.log(`🗑️  [Assign API] Invalidated conversation cache for new agent: ${userId}`);
    }

    // 記錄轉移歷史 (使用 Drizzle ORM)
    if (reason) {
      const transferRecord: NewConversationTransfer = {
        conversationId,
        toTeamId: teamId || null,
        toUserId: userId || null,
        transferReason: reason,
        transferredBy: String(user.id),
        createdAt: timestamp
      };

      await drizzleDb.insert(conversationTransfers).values(transferRecord);
    }

    // 🚀 WebSocket Broadcasting: Conversation Assignment
    try {
      const broadcastService = new WebSocketBroadcastService(c.env);
      await broadcastService.broadcastConversationEvent({
        type: 'conversation_assigned',
        conversationId,
        userId: String(user.id),
        data: {
          assignedTeamId: teamId,
          assignedUserId: userId,
          assignedBy: {
            id: user.id,
            name: user.displayName,
            role: user.role
          },
          reason,
          timestamp
        },
        priority: 'normal'
      });
      console.log('✅ [WebSocket] Conversation assignment broadcasted');
    } catch (broadcastError) {
      log.warn('WebSocket: Assignment broadcast failed, continuing with fallback', { error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError) });
    }

    // 🔧 FIX: 获取并返回完整的对话对象
    console.log('🔍 [Assign API] Fetching updated conversation with JOIN:', {
      conversationId,
      expectedTeamId: teamId
    });

    const [updatedConversation] = await drizzleDb
      .select()
      .from(conversations)
      .leftJoin(teams, eq(conversations.assignedTeamId, teams.id))
      .leftJoin(customers, eq(conversations.customerId, customers.id))  // 🔧 FIX: Add customer JOIN
      .where(eq(conversations.id, conversationId))
      .limit(1);

    console.log('📊 [Assign API] JOIN query result:', {
      hasResult: !!updatedConversation,
      hasConversation: !!updatedConversation?.conversations,
      hasTeam: !!updatedConversation?.teams,
      hasCustomer: !!updatedConversation?.customers,
      conversationId: updatedConversation?.conversations?.id,
      assignedTeamIdInDB: updatedConversation?.conversations?.assignedTeamId,
      teamId: updatedConversation?.teams?.id,
      teamName: updatedConversation?.teams?.name,
      customerId: updatedConversation?.customers?.id,
      customerName: updatedConversation?.customers?.displayName  // 🔧 FIX: Use displayName
    });

    if (!updatedConversation) {
      log.error('Assign API: Failed to retrieve updated conversation');
      return c.json({
        success: false,
        error: 'Failed to retrieve updated conversation'
      }, 500);
    }

    // 构建返回对象，確保 customer 對象包含 name 字段
    const conversationData: any = {
      ...updatedConversation.conversations,
      assignedTeam: updatedConversation.teams || undefined,
      customer: updatedConversation.customers ? {
        ...updatedConversation.customers,
        name: updatedConversation.customers.displayName  // 🔧 FIX: 添加 name 字段以匹配前端類型定義
      } : undefined
    };

    console.log('✅ [Assign API] Conversation assigned successfully:', {
      id: conversationId,
      status: conversationData.status,
      assignedTeamId: conversationData.assignedTeamId,
      hasAssignedTeam: !!conversationData.assignedTeam,
      assignedTeamName: conversationData.assignedTeam?.name,
      hasCustomer: !!conversationData.customer,
      customerName: conversationData.customer?.displayName  // 🔧 FIX: Use displayName
    });

    return c.json({
      success: true,
      message: 'Conversation assigned successfully',
      data: conversationData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    log.error('Assign conversation error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : ERROR_MESSAGES.ASSIGN_CONVERSATION_FAILED,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 取消指派對話
conversationHandler.post('/:id/unassign', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const conversationId = c.req.param('id');
    const { reason } = await c.req.json().catch(() => ({}));

    // 檢查權限（需要 assign 權限才能取消指派）
    const hasPermission = await PermissionService.checkPermission(
      user.id,
      'conversation',
      'assign',
      undefined,
      c.env.DB
    );

    if (!hasPermission) {
      return c.json({ error: 'Permission denied' }, 403);
    }

    const drizzleDb = createDbClient(c.env.DB);

    // 檢查對話是否存在
    const [conversation] = await drizzleDb
      .select()
      .from(conversations)
      .leftJoin(teams, eq(conversations.assignedTeamId, teams.id))
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!conversation || !conversation.conversations) {
      return c.json({ error: 'Conversation not found' }, 404);
    }

    // 檢查對話是否已指派
    const conv = conversation.conversations;
    if (!conv.assignedTeamId && !conv.assignedUserId) {
      return c.json({ error: 'Conversation is not assigned' }, 400);
    }

    // 記錄取消指派前的狀態
    const previousAssignment = {
      teamId: conv.assignedTeamId,
      teamName: conversation.teams?.name,
      userId: conv.assignedUserId
    };

    console.log('🗑️ [Unassign API] Unassigning conversation:', {
      conversationId,
      previousAssignment,
      unassignedBy: user.displayName || user.id
    });

    // 取消指派：清除 teamId 和 userId，將狀態改回 'open'
    const timestamp = new Date().toISOString();

    try {
      // 使用原始 SQL 执行 UPDATE（避免 Drizzle ORM 的 NULL 处理问题）
      await c.env.DB.prepare(
        `UPDATE conversations
         SET assigned_team_id = NULL,
             assigned_user_id = NULL,
             status = ?,
             updated_at = ?
         WHERE id = ?`
      ).bind('active', timestamp, conversationId).run();

      console.log('✅ [Unassign API] Database UPDATE completed (raw SQL)');
    } catch (dbError) {
      log.error('Unassign API: Database UPDATE failed', {
        error: dbError instanceof Error ? dbError.message : String(dbError),
        conversationId
      });
      throw dbError;
    }

    // 🆕 P1-4: Invalidate conversation cache for previously assigned agent
    if (previousAssignment.userId) {
      const authService = new WebSocketAuthService(c.env, c.env.DB, c.env.CACHE);
      await authService.invalidateAgentConversationCache(previousAssignment.userId);
      console.log(`🗑️  [Unassign API] Invalidated conversation cache for agent: ${previousAssignment.userId}`);
    }

    // 記錄取消指派歷史
    if (reason) {
      const transferRecord: NewConversationTransfer = {
        conversationId,
        fromTeamId: previousAssignment.teamId || null,
        fromUserId: previousAssignment.userId || null,
        toTeamId: null,
        toUserId: null,
        transferReason: reason || '取消指派',
        transferredBy: String(user.id),
        createdAt: timestamp
      };

      await drizzleDb.insert(conversationTransfers).values(transferRecord);
    }

    // 🚀 WebSocket Broadcasting: Conversation Unassignment
    try {
      const broadcastService = new WebSocketBroadcastService(c.env);
      await broadcastService.broadcastConversationEvent({
        type: 'conversation_unassigned',
        conversationId,
        userId: String(user.id),
        data: {
          previousTeamId: previousAssignment.teamId,
          previousTeamName: previousAssignment.teamName,
          previousUserId: previousAssignment.userId,
          unassignedBy: {
            id: user.id,
            name: user.displayName,
            role: user.role
          },
          reason: reason || '取消指派',
          timestamp
        },
        priority: 'high'
      });
      console.log('✅ [WebSocket] Conversation unassignment broadcasted');
    } catch (broadcastError) {
      log.warn('WebSocket: Unassignment broadcast failed, continuing', { error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError) });
    }

    // 獲取並返回更新後的完整對話對象
    const [updatedConversation] = await drizzleDb
      .select()
      .from(conversations)
      .leftJoin(teams, eq(conversations.assignedTeamId, teams.id))
      .leftJoin(customers, eq(conversations.customerId, customers.id))
      .where(eq(conversations.id, conversationId))
      .limit(1);

    const conversationData: any = {
      ...updatedConversation?.conversations,
      assignedTeam: updatedConversation?.teams || undefined,
      customer: updatedConversation?.customers ? {
        id: updatedConversation.customers.id,
        name: updatedConversation.customers.displayName, // 🔧 FIX: 添加 name 字段以匹配前端類型定義
        displayName: updatedConversation.customers.displayName, // 保留向後兼容
        platformUserId: updatedConversation.customers.platformUserId,
        platform: updatedConversation.customers.platform,
        avatarUrl: updatedConversation.customers.avatarUrl,
        createdAt: updatedConversation.customers.createdAt
      } : undefined
    };

    console.log('✅ [Unassign API] Conversation unassigned successfully');

    return c.json({
      success: true,
      message: 'Conversation unassigned successfully',
      data: conversationData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    log.error('Unassign conversation error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to unassign conversation',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 轉移對話
conversationHandler.post('/:id/transfer', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const conversationId = c.req.param('id');
    const { fromTeamId, toTeamId, fromUserId, toUserId, reason } = await c.req.json();

    // 檢查權限
    const hasPermission = await PermissionService.checkPermission(
      user.id,
      'conversation',
      'transfer'
    );

    if (!hasPermission) {
      return c.json({ error: 'Permission denied' }, 403);
    }

    // 更新對話指派
    const drizzleDb = createDbClient(c.env.DB);
    const timestamp = new Date().toISOString();

    // 🆕 P1-4: Get old conversation to track previous assignment for cache invalidation
    const oldConversation = await drizzleDb
      .select({ assignedUserId: conversations.assignedUserId })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get();

    await drizzleDb
      .update(conversations)
      .set({
        assignedTeamId: toTeamId || null,
        assignedUserId: toUserId || null,
        status: 'active',
        updatedAt: timestamp
      })
      .where(eq(conversations.id, conversationId));

    // 🆕 P1-4: Invalidate conversation cache for affected agents
    const authService = new WebSocketAuthService(c.env, c.env.DB, c.env.CACHE);

    // Invalidate cache for source agent (fromUserId or previous assignedUserId)
    const sourceAgentId = fromUserId || oldConversation?.assignedUserId;
    if (sourceAgentId) {
      await authService.invalidateAgentConversationCache(sourceAgentId);
      console.log(`🗑️  [Transfer API] Invalidated conversation cache for source agent: ${sourceAgentId}`);
    }

    // Invalidate cache for destination agent (toUserId)
    if (toUserId && toUserId !== sourceAgentId) {
      await authService.invalidateAgentConversationCache(toUserId);
      console.log(`🗑️  [Transfer API] Invalidated conversation cache for destination agent: ${toUserId}`);
    }

    // 記錄轉移歷史 (使用 Drizzle ORM)
    const transferRecord: NewConversationTransfer = {
      conversationId,
      fromTeamId: fromTeamId || null,
      toTeamId: toTeamId || null,
      fromUserId: fromUserId || null,
      toUserId: toUserId || null,
      transferReason: reason,
      transferredBy: String(user.id),
      createdAt: timestamp
    };

    await drizzleDb.insert(conversationTransfers).values(transferRecord);

    // 🚀 WebSocket Broadcasting: Conversation Transfer
    try {
      const broadcastService = new WebSocketBroadcastService(c.env);
      await broadcastService.broadcastConversationEvent({
        type: 'conversation_transferred',
        conversationId,
        userId: String(user.id),
        data: {
          from: {
            teamId: fromTeamId,
            userId: fromUserId
          },
          to: {
            teamId: toTeamId,
            userId: toUserId
          },
          transferredBy: {
            id: user.id,
            name: user.displayName,
            role: user.role
          },
          reason,
          timestamp
        },
        priority: 'high'
      });
      console.log('✅ [WebSocket] Conversation transfer broadcasted');
    } catch (broadcastError) {
      log.warn('WebSocket: Transfer broadcast failed, continuing with fallback', { error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError) });
    }

    return c.json({
      success: true,
      message: 'Conversation transferred successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    log.error('Transfer conversation error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : ERROR_MESSAGES.FAILED_TO_TRANSFER_CONVERSATION,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 上傳附件（在消息發送之前）
conversationHandler.post('/:id/attachments', jwtAuth, async (c) => {
  try {
    const conversationId = c.req.param('id');
    const user = c.get('user');

    if (!conversationId) {
      return c.json({
        success: false,
        error: 'Conversation ID is required'
      }, 400);
    }

    const db = createDbClient(c.env.DB);

    // 檢查對話是否存在
    const conversation = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get();

    if (!conversation) {
      return c.json({
        success: false,
        error: 'Conversation not found'
      }, 404);
    }

    // 解析 FormData
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const messageType = formData.get('messageType') as string;

    // 驗證文件
    if (!file || file.size === 0) {
      return c.json({
        success: false,
        error: 'No file provided'
      }, 400);
    }

    // 文件大小限制：10MB
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return c.json({
        success: false,
        error: 'File too large (max 10MB)'
      }, 400);
    }

    // 生成 R2 key
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substr(2, 9);
    const fileExtension = file.name.split('.').pop() || 'bin';
    const r2Key = `attachments/${conversationId}/pending/${timestamp}_${randomStr}.${fileExtension}`;

    // 上傳到 R2
    try {
      const arrayBuffer = await file.arrayBuffer();
      await c.env.R2_BUCKET.put(r2Key, arrayBuffer, {
        httpMetadata: {
          contentType: file.type
        }
      });
    } catch (error) {
      log.error('R2 upload error', { error: error instanceof Error ? error.message : String(error) });
      return c.json({
        success: false,
        error: 'Failed to upload file to storage'
      }, 500);
    }

    // 生成公開 URL - 使用 API 代理端點而非直接 R2 URL
    const requestUrl = new URL(c.req.url);
    const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
    const fileUrl = `${baseUrl}/api/files/public/${r2Key}`;
    console.log(`[Upload] Generated proxy URL: ${fileUrl}`);

    // 保存附件記錄到資料庫（messageId 為 null，等待消息創建時關聯）
    const attachmentId = `att_${timestamp}_${randomStr}`;

    await db.insert(fileAttachments).values({
      id: attachmentId,
      messageId: null, // Will be updated when message is sent
      conversationId, // Associate with conversation for tracking
      filename: file.name,
      mimeType: file.type,
      fileSize: file.size,
      fileUrl,
      r2Key,
      uploadStatus: 'completed', // Direct upload completed
      createdAt: new Date().toISOString()
    });

    return c.json({
      success: true,
      data: {
        attachmentId,
        url: fileUrl,
        filename: file.name,
        mimeType: file.type,
        size: file.size
      }
    });
  } catch (error) {
    log.error('Upload attachment error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, 500);
  }
});

// 發送訊息 - Simplified with extracted services
conversationHandler.post('/:id/messages', jwtAuth, async (c) => {
  // 🔵 Phase 1 Emergency Debug Logging
  console.log('🔵 [ENTRY] ========== MESSAGE HANDLER REACHED ==========');
  console.log('🔵 [ENTRY] Timestamp:', new Date().toISOString());
  console.log('🔵 [ENTRY] Conversation ID:', c.req.param('id'));
  console.log('🔵 [ENTRY] Method:', c.req.method);
  console.log('🔵 [ENTRY] Path:', c.req.path);

  try {
    console.log('🔵 [AUTH] Checking user context...');
    const user = c.get('user');
    console.log('🔵 [AUTH] User ID:', user?.id);
    console.log('🔵 [AUTH] User Role:', user?.role);
    console.log('🔵 [AUTH] User Name:', user?.displayName);

    // 1. Validate and parse request
    console.log('🔵 [PARSE] Starting request validation...');
    const request = await MessageRequestService.validateAndParse(c);
    console.log('🔵 [PARSE] Request validated successfully');
    console.log('🔵 [PARSE] Content length:', request.content?.length);
    console.log('🔵 [PARSE] Sender ID:', request.senderId);

    // 2. Check permissions
    console.log('🔵 [PERMISSION] Checking permissions...');
    const hasPermission = await PermissionService.checkPermission(
      user.id,
      'message',
      'send',
      {
        userId: Number(user.id),
        role: user.role,
        resourceId: request.conversationId
      },
      c.env.DB
    );

    console.log('🔵 [PERMISSION] Permission check result:', hasPermission);

    if (!hasPermission) {
      console.log('🔴 [PERMISSION] Permission denied for user:', user.id);
      return errorResponse(c, user.role === 'agent'
        ? '權限不足，您無權對此訊息進行任何操作。只有指派給您的對話或團隊負責人能夠回覆未指派的對話。'
        : 'Permission denied', 403);
    }

    // 3. Send message (Async Pattern)
    console.log('🔵 [SERVICE] Creating MessageService instance...');
    const messageService = new MessageService(c.env);
    
    console.log('🔵 [SERVICE] Creating pending message...');
    const result = await messageService.createPendingMessage(request);

    // 確保訊息已成功創建
    if (!result.messageId || !result.message) {
      throw new Error('Failed to create pending message: missing messageId or message data');
    }

    console.log('🔵 [SERVICE] Pending message created, ID:', result.messageId);

    // 3.1 Broadcast Pending Message
    try {
      const broadcastService = new WebSocketBroadcastService(c.env);
      await broadcastService.broadcastMessageEvent({
        type: 'message_sent',
        conversationId: request.conversationId,
        messageId: result.messageId,
        agentId: request.senderId,
        data: {
          content: request.content,
          messageType: request.messageType,
          sender: {
            id: user.id,
            name: user.displayName,
            role: user.role
          },
          deliveryStatus: 'pending',
          timestamp: new Date().toISOString()
        },
        priority: 'normal'
      });
    } catch (broadcastError) {
      log.warn('WEBSOCKET: Pending message broadcast failed', { error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError) });
    }

    // 4. Trigger background sending
    console.log('🔵 [BACKGROUND] Scheduling background delivery...');
    c.executionCtx.waitUntil(
      messageService.processBackgroundSending(result.messageId, request, user)
    );

    // 5. Return response immediately
    console.log('🔵 [RESPONSE] Returning early success response...');
    
    // Transform to frontend format (Pending status)
    // ✅ Safe metadata parsing with error handling
    let parsedMetadata = {};
    if (result.message.metadata) {
      try {
        parsedMetadata = JSON.parse(result.message.metadata as string);
      } catch (parseError) {
        log.warn('Failed to parse message metadata', { error: parseError instanceof Error ? parseError.message : String(parseError) });
        parsedMetadata = {};
      }
    }

    const formattedMessage = {
      id: result.message.id,
      conversationId: result.message.conversationId,
      senderType: 'agent' as const,
      senderId: result.message.agentSenderId || request.senderId,
      senderName: user.displayName,
      content: result.message.content,
      mediaUrl: '',
      mediaType: result.message.messageType as 'text' | 'image' | 'video' | 'file',
      platform: 'line' as const,
      createdAt: result.message.createdAt ? new Date(result.message.createdAt).getTime() : Date.now(),
      timestamp: result.message.createdAt ? new Date(result.message.createdAt).getTime() : Date.now(),
      deliveryStatus: 'pending',
      isSent: false,
      platformMessageId: null as string | null,
      metadata: parsedMetadata
    };

    return successResponse(c, formattedMessage, 'Message queued for delivery');

  } catch (error) {
    log.error('Message handler exception', {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error)
    });
    return errorResponse(c, error instanceof Error ? error.message : 'Failed to send message', 500);
  }
});

// 獲取對話的訊息（支持分頁）
conversationHandler.get('/:id/messages', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const conversationId = c.req.param('id');

    // 獲取分頁參數
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '30', 10)));
    const offset = (page - 1) * pageSize;

    console.log(`📄 [Messages API] Getting messages for conversation ${conversationId}, page=${page}, pageSize=${pageSize}, offset=${offset}`);

    // 檢查權限
    const hasPermission = await PermissionService.checkPermission(
      user.id,
      'conversation',
      'view',
      {
        userId: Number(user.id),
        role: user.role,
        resourceId: conversationId
      },
      c.env.DB
    );

    if (!hasPermission) {
      return c.json({
        success: false,
        error: 'Permission denied',
        timestamp: new Date().toISOString()
      }, 403);
    }

    // 檢查對話是否存在
    const drizzleDb = createDbClient(c.env.DB);
    const conversation = await drizzleDb
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get();

    if (!conversation) {
      return c.json({
        success: false,
        error: 'Conversation not found',
        timestamp: new Date().toISOString()
      }, 404);
    }

    // 獲取訊息總數
    const totalResult = await drizzleDb
      .select({ count: count() })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .get();

    const total = totalResult?.count || 0;
    console.log(`📊 [Messages API] Total messages in conversation: ${total}`);

    // 獲取分頁訊息（包含發送者資訊）
    const messageList = await drizzleDb
      .select({
        // Message fields
        id: messages.id,
        conversationId: messages.conversationId,
        senderType: messages.senderType,
        customerSenderId: messages.customerSenderId,
        agentSenderId: messages.agentSenderId,
        content: messages.content,
        messageType: messages.messageType,
        platformMessageId: messages.platformMessageId,
        isSent: messages.isSent,
        deliveryStatus: messages.deliveryStatus,
        metadata: messages.metadata,
        sentAt: messages.sentAt,
        recallDeadline: messages.recallDeadline,
        recalledAt: messages.recalledAt,
        isRecalled: messages.isRecalled,
        createdAt: messages.createdAt,
        // Customer info for customer messages
        customerName: customers.displayName,
        // Agent info for agent messages
        agentName: agents.displayName
      })
      .from(messages)
      .leftJoin(customers,
        and(
          eq(messages.senderType, 'customer'),
          eq(messages.customerSenderId, customers.id)
        )
      )
      .leftJoin(agents,
        and(
          eq(messages.senderType, 'agent'),
          eq(messages.agentSenderId, agents.id)
        )
      )
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt)) // 最新的消息在前面
      .limit(pageSize)
      .offset(offset);

    console.log(`📄 [Messages API] Retrieved ${messageList.length} messages for page ${page}`);

    // ✅ 轉換為前端期望的 Message 格式
    const formattedMessages = messageList.map(row => ({
      id: row.id,
      conversationId: row.conversationId,
      senderType: row.senderType === 'customer' ? 'user' as const : row.senderType as 'agent' | 'system',
      senderId: row.senderType === 'customer'
        ? row.customerSenderId?.toString() || ''
        : row.agentSenderId || '',
      senderName: row.senderType === 'customer' ? row.customerName : row.agentName,
      content: row.content,
      mediaUrl: '', // 需要從 metadata 或其他表獲取
      mediaType: row.messageType as 'text' | 'image' | 'video' | 'file',
      platform: 'line' as const, // 需要從 conversation->customer 獲取
      createdAt: row.createdAt ? new Date(row.createdAt).getTime() : Date.now(),
      // 額外的數據庫字段
      platformMessageId: row.platformMessageId,
      isSent: row.isSent,
      deliveryStatus: row.deliveryStatus,
      metadata: row.metadata,
      sentAt: row.sentAt,
      isRecalled: row.isRecalled,
      recallDeadline: row.recallDeadline,
      recalledAt: row.recalledAt
    }));

    // ✅ 返回分頁響應格式
    const totalPages = Math.ceil(total / pageSize);
    const paginatedResponse = {
      items: formattedMessages,
      page,
      pageSize,
      total,
      totalPages,
      hasMore: page < totalPages
    };

    console.log(`📊 [Messages API] Returning page ${page}/${totalPages}, ${formattedMessages.length} items, hasMore: ${paginatedResponse.hasMore}`);

    return c.json({
      success: true,
      data: paginatedResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    log.error('Get messages error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get messages',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// ==================== Priority 4: SINGLE PARAM routes ====================

// 獲取特定對話詳情
conversationHandler.get('/:id', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const conversationId = c.req.param('id');

    // 檢查權限
    const hasPermission = await PermissionService.checkPermission(
      user.id,
      'conversation',
      'view',
      {
        userId: Number(user.id),
        role: user.role,
        resourceId: conversationId
      },
      c.env.DB
    );

    if (!hasPermission) {
      return c.json({ error: 'Permission denied' }, 403);
    }

    const drizzleDb = createDbClient(c.env.DB);

    // 🔧 FIX: 使用完整的 JOIN 查詢，返回與 assign/unassign API 相同的數據結構
    const [result] = await drizzleDb
      .select()
      .from(conversations)
      .leftJoin(teams, eq(conversations.assignedTeamId, teams.id))
      .leftJoin(customers, eq(conversations.customerId, customers.id))
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!result || !result.conversations) {
      return c.json({
        success: false,
        error: 'Conversation not found',
        timestamp: new Date().toISOString()
      }, 404);
    }

    // 構建完整的對話對象，包含嵌套的 customer 和 assignedTeam 對象
    const conversationData: any = {
      ...result.conversations,
      // 包含完整的 assignedTeam 對象（如果已指派）
      assignedTeam: result.teams || undefined,
      // 包含完整的 customer 對象
      customer: result.customers ? {
        id: result.customers.id,
        name: result.customers.displayName, // 🔧 FIX: 添加 name 字段以匹配前端類型定義
        displayName: result.customers.displayName, // 保留向後兼容
        platformUserId: result.customers.platformUserId,
        platform: result.customers.platform,
        avatarUrl: result.customers.avatarUrl,
        email: result.customers.email,
        phone: result.customers.phone,
        sourceTeamId: result.customers.sourceTeamId,
        metadata: result.customers.metadata,
        createdAt: result.customers.createdAt,
        updatedAt: result.customers.updatedAt
      } : undefined
    };

    return c.json({
      success: true,
      data: conversationData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    log.error('Get conversation error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get conversation',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// ==================== Priority 5: WILDCARD routes ====================

// 獲取用戶可見的對話列表
conversationHandler.get('/', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    console.log('🔍 [Conversation Handler] GET / - User authenticated:', user);
    console.log('🔍 [Conversation Handler] User ID type:', typeof user.id, 'Value:', user.id);
    console.log('🔍 [Conversation Handler] Calling PermissionService.getVisibleConversations...');

    const visibleConversationIds = await PermissionService.getVisibleConversations(user.id, c.env.DB);

    console.log('📋 [Conversation Handler] Visible conversation IDs returned:', visibleConversationIds);
    console.log('📊 [Conversation Handler] Total visible conversations:', visibleConversationIds.length);

    // 如果沒有可見對話，返回空列表
    if (visibleConversationIds.length === 0) {
      console.log('❌ [Conversation Handler] No visible conversations found, returning empty array');
      return c.json({
        success: true,
        data: [],
        timestamp: new Date().toISOString()
      });
    }

    // 🔧 FIX: 使用完整 JOIN 查詢，返回嵌套對象結構 (統一類型定義)
    console.log('🔍 [Conversation Handler] Querying conversation data with IDs:', visibleConversationIds);
    const drizzleDb = createDbClient(c.env.DB);
    const conversationResults = await drizzleDb
      .select()
      .from(conversations)
      .leftJoin(customers, eq(conversations.customerId, customers.id))
      .leftJoin(teams, eq(conversations.assignedTeamId, teams.id))
      .where(inArray(conversations.id, visibleConversationIds))
      .orderBy(desc(conversations.updatedAt));

    // 構建完整的對話對象數組，包含嵌套的 customer 和 assignedTeam 對象
    const conversationData = conversationResults.map(result => ({
      ...result.conversations,
      // 🔧 完整的 customer 對象 (匹配前端類型定義)
      customer: result.customers ? {
        id: result.customers.id,
        name: result.customers.displayName,        // 🔧 映射到 name 字段
        displayName: result.customers.displayName, // 保留向後兼容
        platform: result.customers.platform,
        platformUserId: result.customers.platformUserId,
        avatarUrl: result.customers.avatarUrl,
        createdAt: result.customers.createdAt
      } : undefined,
      // 🔧 完整的 assignedTeam 對象
      assignedTeam: result.teams ? {
        id: result.teams.id,
        name: result.teams.name,
        description: result.teams.description
      } : undefined,
      // 保留扁平字段以向後兼容舊版前端
      customerName: result.customers?.displayName,
      platform: result.customers?.platform,
      platformUserId: result.customers?.platformUserId
    }));

    console.log('📊 [Conversation Handler] Retrieved conversation data:', conversationData);

    // ⚡ Enterprise Cache: Get latest messages using background job + cache system
    const { LatestMessageCache } = await import('../../../services/latest-message-cache');
    const latestMessageCache = new LatestMessageCache(c.env);

    console.log('🚀 [Conversation Handler] Using enterprise cache for latest messages');
    const conversationIds = conversationData.map(c => c.id);

    const latestMessagesMap = await latestMessageCache.getLatestMessages(conversationIds);
    const lastMessages = Array.from(latestMessagesMap.values());

    // 結合數據并統一為camelCase格式 (using cache structure)
    const combinedData = conversationData.map(conv => {
      const lastMsg = lastMessages.find((msg: any) => msg?.conversationId === conv.id);
      return {
        ...conv,
        // 構建lastMessage對象以匹配前端期望的結構
        lastMessage: lastMsg?.content ? {
          id: lastMsg.messageId || '',
          content: lastMsg.content,
          createdAt: lastMsg.createdAt,
          senderType: lastMsg.senderType || 'agent',
          messageType: lastMsg.messageType || 'text'
        } : null,
        // 保留原有字段以確保向後兼容
        lastMessageContent: lastMsg?.content || null,
        lastMessageAtActual: lastMsg?.createdAt || null
      };
    });

    return c.json({
      success: true,
      data: combinedData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    log.error('Get conversations error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get conversations',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// ==================== Helper Functions ====================

/**
 * 獲取對話的最近訊息
 * @param conversationId 對話ID
 * @param limit 訊息數量限制
 * @param db 資料庫實例
 * @returns 訊息列表（按時間升序）
 */
async function getRecentMessages(conversationId: string, limit: number, db: D1Database) {
  const drizzleDb = createDbClient(db);

  try {
    const recentMessages = await drizzleDb
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        senderType: messages.senderType,
        customerSenderId: messages.customerSenderId,
        agentSenderId: messages.agentSenderId,
        content: messages.content,
        messageType: messages.messageType,
        createdAt: messages.createdAt,
        isSent: messages.isSent,
        deliveryStatus: messages.deliveryStatus,
        isRecalled: messages.isRecalled
      })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.isRecalled, false)  // 排除已撤回的訊息
        )
      )
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    // 反轉結果以獲得時間升序（最舊在前，最新在後）
    return recentMessages.reverse();
  } catch (error) {
    log.error('SSE: Error fetching recent messages', { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

/**
 * 獲取指定時間點之後的新訊息
 * @param conversationId 對話ID
 * @param afterTimestamp 時間戳（ISO string）
 * @param db 資料庫實例
 * @returns 新訊息列表（按時間升序）
 */
async function getMessagesAfterTimestamp(conversationId: string, afterTimestamp: string, db: D1Database) {
  const drizzleDb = createDbClient(db);

  try {
    const newMessages = await drizzleDb
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        senderType: messages.senderType,
        customerSenderId: messages.customerSenderId,
        agentSenderId: messages.agentSenderId,
        content: messages.content,
        messageType: messages.messageType,
        createdAt: messages.createdAt,
        isSent: messages.isSent,
        deliveryStatus: messages.deliveryStatus,
        isRecalled: messages.isRecalled
      })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.isRecalled, false),  // 排除已撤回的訊息
          gt(messages.createdAt, afterTimestamp)  // ✅ 修復：使用 Drizzle ORM 的 gt 操作符
        )
      )
      .orderBy(messages.createdAt);  // 時間升序

    return newMessages;
  } catch (error) {
    log.error('SSE: Error fetching messages after timestamp', { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

/**
 * 獲取指定訊息ID之後的新訊息
 * @param conversationId 對話ID
 * @param lastMessageId 最後已知訊息ID
 * @param db 資料庫實例
 * @returns 新訊息列表（按時間升序）
 */
async function getMessagesAfter(conversationId: string, lastMessageId: string | null, db: D1Database) {
  if (!lastMessageId) {
    // 如果沒有最後訊息ID，返回最近的訊息
    return getRecentMessages(conversationId, 50, db);
  }

  const drizzleDb = createDbClient(db);

  try {
    // 首先獲取最後已知訊息的時間戳
    const lastMessage = await drizzleDb
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(eq(messages.id, lastMessageId))
      .limit(1);

    if (lastMessage.length === 0) {
      log.warn('SSE: Last message not found, returning recent messages', { lastMessageId });
      return getRecentMessages(conversationId, 50, db);
    }

    // 獲取該時間戳之後的所有訊息
    const createdAt = lastMessage[0]?.createdAt || new Date().toISOString();
    return getMessagesAfterTimestamp(conversationId, createdAt, db);
  } catch (error) {
    log.error('SSE: Error fetching messages after last message', { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

export default conversationHandler;
