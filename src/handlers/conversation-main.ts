// 對話管理處理器 - 主要實現
import { Hono } from 'hono';
import { eq, inArray, desc, and, count, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { conversations, customers, messages, agents, conversationTransfers } from '../db/schema';
import type { Bindings } from '../types';
import type { NewConversationTransfer } from '../db/schema';
import { ERROR_MESSAGES } from '../utils/error-messages';
import { PermissionService } from '../services/permission-service';
import { jwtAuth } from '../middleware/auth';
import { verifyJWT, getUserById } from '../utils/auth';
import { WebSocketBroadcastService } from '../services/websocket-broadcast-service';
import { ApiResponse } from '../utils/api-response-simplified';

const conversationHandler = new Hono<{ Bindings: Bindings }>();

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
      'assign'
    );
    
    if (!hasPermission) {
      return c.json({ error: 'Permission denied' }, 403);
    }

    // 更新對話指派
    const drizzleDb = drizzle(c.env.DB);
    const timestamp = new Date().toISOString();
    
    await drizzleDb
      .update(conversations)
      .set({
        assignedTeamId: teamId || null,
        assignedUserId: userId || null,
        updatedAt: timestamp
      })
      .where(eq(conversations.id, conversationId));

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
      console.warn('⚠️ [WebSocket] Assignment broadcast failed, continuing with fallback:', broadcastError);
    }

    return c.json({
      success: true,
      message: 'Conversation assigned successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Assign conversation error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : ERROR_MESSAGES.ASSIGN_CONVERSATION_FAILED,
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
    const drizzleDb = drizzle(c.env.DB);
    const timestamp = new Date().toISOString();
    
    await drizzleDb
      .update(conversations)
      .set({
        assignedTeamId: toTeamId || null,
        assignedUserId: toUserId || null,
        status: 'active',
        updatedAt: timestamp
      })
      .where(eq(conversations.id, conversationId));

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
      console.warn('⚠️ [WebSocket] Transfer broadcast failed, continuing with fallback:', broadcastError);
    }

    return c.json({
      success: true,
      message: 'Conversation transferred successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Transfer conversation error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : ERROR_MESSAGES.FAILED_TO_TRANSFER_CONVERSATION,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

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

    // 使用 Drizzle ORM 查詢對話列表
    console.log('🔍 [Conversation Handler] Querying conversation data with IDs:', visibleConversationIds);
    const drizzleDb = drizzle(c.env.DB);
    const conversationData = await drizzleDb
      .select({
        // 對話資料
        id: conversations.id,
        customerId: conversations.customerId,
        assignedTeamId: conversations.assignedTeamId,
        assignedUserId: conversations.assignedUserId,
        status: conversations.status,
        lastMessageAt: conversations.lastMessageAt,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        // 客戶資料
        customerName: customers.displayName,
        platform: customers.platform,
        platformUserId: customers.platformUserId
      })
      .from(conversations)
      .leftJoin(customers, eq(conversations.customerId, customers.id))
      .where(inArray(conversations.id, visibleConversationIds))
      .orderBy(desc(conversations.updatedAt));
      
    console.log('📊 [Conversation Handler] Retrieved conversation data:', conversationData);

    // ⚡ Enterprise Cache: Get latest messages using background job + cache system
    const { LatestMessageCache } = await import('../services/latest-message-cache');
    const latestMessageCache = new LatestMessageCache(c.env);

    console.log('🚀 [Conversation Handler] Using enterprise cache for latest messages');
    const conversationIds = conversationData.map(c => c.id);

    const latestMessagesMap = await latestMessageCache.getLatestMessages(conversationIds);
    const lastMessages = Array.from(latestMessagesMap.values());
    
    // 結合數據并統一為camelCase格式 (using cache structure)
    const combinedData = conversationData.map(conv => {
      const lastMsg = lastMessages.find((msg: any) => msg.conversationId === conv.id);
      return {
        ...conv,
        // 構建lastMessage對象以匹配前端期望的結構
        lastMessage: lastMsg?.content ? {
          id: lastMsg.messageId,
          content: lastMsg.content,
          createdAt: lastMsg.createdAt,
          senderType: lastMsg.senderType,
          messageType: lastMsg.messageType
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
    console.error('Get conversations error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get conversations',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

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

    const drizzleDb = drizzle(c.env.DB);
    const conversation = await drizzleDb
      .select({
        // 對話資料
        id: conversations.id,
        customerId: conversations.customerId,
        assignedTeamId: conversations.assignedTeamId,
        assignedUserId: conversations.assignedUserId,
        status: conversations.status,
        lastMessageAt: conversations.lastMessageAt,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        // 客戶資料
        customerName: customers.displayName,
        platform: customers.platform,
        platformUserId: customers.platformUserId
      })
      .from(conversations)
      .leftJoin(customers, eq(conversations.customerId, customers.id))
      .where(eq(conversations.id, conversationId))
      .get();

    if (!conversation) {
      return c.json({
        success: false,
        error: 'Conversation not found',
        timestamp: new Date().toISOString()
      }, 404);
    }

    return c.json({
      success: true,
      data: conversation,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get conversation error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get conversation',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 發送訊息 - Simplified with extracted services
conversationHandler.post('/:id/messages', jwtAuth, async (c) => {
  try {
    const { MessageRequestService } = await import('../utils/api-response-simplified');
    const { MessageService } = await import('../services/message-service-simplified');
    const { ApiResponse } = await import('../utils/api-response-simplified');
    const { WebSocketBroadcastService } = await import('../services/websocket-broadcast-service');

    // 1. Validate and parse request
    const request = await MessageRequestService.validateAndParse(c);

    // 2. Check permissions
    const user = c.get('user');
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

    if (!hasPermission) {
      return ApiResponse.forbidden(c, user.role === 'agent'
        ? '權限不足，您無權對此訊息進行任何操作。只有指派給您的對話或團隊負責人能夠回覆未指派的對話。'
        : 'Permission denied');
    }

    // 3. Send message through service
    const messageService = new MessageService(c.env);
    const result = await messageService.sendMessage(request);

    if (!result.success) {
      return ApiResponse.error(c, result.error, 400);
    }

    // 4. Broadcast WebSocket event
    try {
      const broadcastService = new WebSocketBroadcastService(c.env);
      await broadcastService.broadcastMessageEvent({
        type: 'message_sent',
        conversationId: request.conversationId,
        messageId: result.messageId!,
        agentId: request.senderId,
        data: {
          content: request.content,
          messageType: request.messageType,
          sender: {
            id: user.id,
            name: user.displayName,
            role: user.role
          },
          deliveryStatus: 'sent',
          timestamp: new Date().toISOString()
        },
        priority: 'normal'
      });
    } catch (broadcastError) {
      console.warn('⚠️ [WebSocket] Message broadcast failed:', broadcastError);
    }

    return ApiResponse.success(c, {
      messageId: result.messageId,
      conversationId: request.conversationId,
      content: request.content,
      messageType: request.messageType,
      deliveryStatus: 'sent'
    }, 'Message sent successfully');

  } catch (error) {
    return ApiResponse.error(c, error);
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
    const drizzleDb = drizzle(c.env.DB);
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
    console.error('Get messages error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get messages',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// SSE推送端點 - 實時對話更新
conversationHandler.get('/stream', async (c) => {
  // 手動驗證token，因為EventSource無法設置自定義headers
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
    
    // 設定SSE headers
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Headers', 'Cache-Control');

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
            console.warn('❌ [SSE Stream] Heartbeat failed:', error);
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
            const drizzleDb = drizzle(c.env.DB);
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
            console.error('❌ [SSE Stream] Failed to send conversation update:', error);
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

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    });

  } catch (error) {
    console.error('❌ [SSE Stream] Error setting up SSE:', error);
    return c.json({
      success: false,
      error: 'Failed to establish SSE connection',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// =================== 訊息流 SSE 系統 ===================
// 🚀 Phase 1: 專用訊息流端點實施

/**
 * 獲取對話的最近訊息
 * @param conversationId 對話ID
 * @param limit 訊息數量限制
 * @param db 資料庫實例
 * @returns 訊息列表（按時間升序）
 */
async function getRecentMessages(conversationId: string, limit: number, db: D1Database) {
  const drizzleDb = drizzle(db);

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
    console.error('❌ [SSE] Error fetching recent messages:', error);
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
  const drizzleDb = drizzle(db);

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
          sql`datetime(${messages.createdAt}) > datetime('${afterTimestamp}')`
        )
      )
      .orderBy(messages.createdAt);  // 時間升序

    return newMessages;
  } catch (error) {
    console.error('❌ [SSE] Error fetching messages after timestamp:', error);
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

  const drizzleDb = drizzle(db);

  try {
    // 首先獲取最後已知訊息的時間戳
    const lastMessage = await drizzleDb
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(eq(messages.id, lastMessageId))
      .limit(1);

    if (lastMessage.length === 0) {
      console.warn(`⚠️ [SSE] Last message ${lastMessageId} not found, returning recent messages`);
      return getRecentMessages(conversationId, 50, db);
    }

    // 獲取該時間戳之後的所有訊息
    const createdAt = lastMessage[0]?.createdAt || new Date().toISOString();
    return getMessagesAfterTimestamp(conversationId, createdAt, db);
  } catch (error) {
    console.error('❌ [SSE] Error fetching messages after last message:', error);
    return [];
  }
}

// 🎯 新的專用訊息流 SSE 端點
conversationHandler.get('/:conversationId/messages/stream', async (c) => {
  try {
    // 手動驗證token（EventSource 無法設置自定義 headers）
    const authHeader = c.req.header('Authorization');
    const token = c.req.query('token'); // 從 query 參數獲取 token

    let authToken: string | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      authToken = authHeader.substring(7);
    } else if (token) {
      authToken = token;
    }

    if (!authToken) {
      return c.json({
        error: 'Missing authentication token',
        message: 'Please provide token via Authorization header or query parameter'
      }, 401);
    }

    // 驗證 JWT
    const payload = await verifyJWT(authToken, c.env.JWT_SECRET);
    const user = await getUserById(c.env.DB, payload.userId);

    if (!user || !user.isActive) {
      return c.json({ error: 'Invalid or inactive user account' }, 401);
    }

    const conversationId = c.req.param('conversationId');
    console.log(`📡 [SSE] Starting message stream for conversation: ${conversationId}, user: ${user.id}`);

    // 🔒 權限檢查：用戶是否可以訪問這個對話
    const visibleConversationIds = await PermissionService.getVisibleConversations(user.id, c.env.DB);

    if (!visibleConversationIds.includes(conversationId)) {
      return c.json({
        error: 'Access denied to conversation',
        conversationId: conversationId
      }, 403);
    }

    // 設置 SSE headers
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Headers', 'Cache-Control');

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

        // 發送初始訊息（最近30條）
        const sendInitialMessages = async () => {
          if (!isConnected) return;

          try {
            const initialMessages = await getRecentMessages(conversationId, 30, c.env.DB);

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
            console.error('❌ [SSE] Error sending initial messages:', error);
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
            console.error('❌ [SSE] Error checking new messages:', error);
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
            console.warn('❌ [SSE] Heartbeat failed:', error);
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

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    });

  } catch (error) {
    console.error('❌ [SSE] Error setting up message stream:', error);
    return c.json({
      success: false,
      error: 'Failed to establish message stream',
      reason: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

export default conversationHandler;