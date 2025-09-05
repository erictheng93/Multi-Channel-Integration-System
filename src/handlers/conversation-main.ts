// 對話管理處理器 - 主要實現
import { Hono } from 'hono';
import { eq, inArray, desc, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { conversations, customers, messages, agents, conversationTransfers } from '../db/schema';
import type { Bindings } from '../types';
import type { NewConversationTransfer } from '../db/schema';
import { ERROR_MESSAGES } from '../utils/error-messages';
import { PermissionService } from '../services/permission-service';
import { jwtAuth } from '../middleware/auth';
import { verifyJWT, getUserById } from '../utils/auth';

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

    // 方案1：簡化查詢 - 為每個對話單獨查詢最新消息
    const conversationIds = conversationData.map(c => c.id);
    let lastMessages: any[] = [];
    
    if (conversationIds.length > 0) {
      // 為每個對話查詢最新消息（性能較低但穩定）
      for (const conversationId of conversationIds) {
        const latestMessage = await drizzleDb
          .select({
            conversationId: messages.conversationId,
            lastMessageContent: messages.content,
            lastMessageAtActual: messages.createdAt
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
    
    // 結合數據并統一為camelCase格式
    const combinedData = conversationData.map(conv => {
      const lastMsg = lastMessages.find((msg: any) => msg.conversationId === conv.id);
      return {
        ...conv,
        // 構建lastMessage對象以匹配前端期望的結構
        lastMessage: lastMsg?.lastMessageContent ? {
          content: lastMsg.lastMessageContent,
          createdAt: lastMsg.lastMessageAtActual
        } : null,
        // 保留原有字段以確保向後兼容
        lastMessageContent: lastMsg?.lastMessageContent || null,
        lastMessageAtActual: lastMsg?.lastMessageAtActual || null
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

// 發送訊息
conversationHandler.post('/:id/messages', jwtAuth, async (c) => {
  try {
    const conversationId = c.req.param('id');
    // const payload = c.get('jwtPayload'); // Not used
    const user = c.get('user');
    const { content, mediaUrl, mediaType, attachmentIds } = await c.req.json();
    
    console.log(`🚀 [Agent Message] POST /:id/messages called`);
    console.log(`📝 [Agent Message] conversationId: ${conversationId}`);
    console.log(`👤 [Agent Message] user:`, { id: user?.id, role: user?.role, displayName: user?.displayName });
    console.log(`💬 [Agent Message] content:`, content?.substring(0, 50) + '...');

    if (!content && !mediaUrl && (!attachmentIds || attachmentIds.length === 0)) {
      return c.json({
        success: false,
        error: 'Content, media, or attachments are required',
        timestamp: new Date().toISOString()
      }, 400);
    }

    // 檢查權限
    console.log(`🔒 [Agent Message] Checking permissions for user: ${user.id}, role: ${user.role}`);
    const hasPermission = await PermissionService.checkPermission(
      user.id, // ✅ agents表ID是TEXT類型，保持字符串
      'message', 
      'send',
      { 
        userId: Number(user.id), // ✅ 保持一致的字符串ID
        role: user.role,
        resourceId: conversationId 
      },
      c.env.DB
    );
    
    console.log(`🔒 [Agent Message] Permission check result: ${hasPermission}`);
    
    if (!hasPermission) {
      console.log(`❌ [Agent Message] Permission denied for user ${user.id}`);
      
      // 根據用戶角色提供更明確的錯誤訊息
      let errorMessage = 'Permission denied';
      if (user.role === 'agent') {
        errorMessage = '權限不足，您無權對此訊息進行任何操作。只有指派給您的對話或團隊負責人能夠回覆未指派的對話。';
      }
      
      return c.json({ 
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
      }, 403);
    }

    // 獲取對話資訊以確定平台
    const drizzleDb = drizzle(c.env.DB);
    const conversation = await drizzleDb
      .select({
        id: conversations.id,
        customerId: conversations.customerId,
        platform: customers.platform,
        platform_user_id: customers.platformUserId
      })
      .from(conversations)
      .innerJoin(customers, eq(conversations.customerId, customers.id))
      .where(eq(conversations.id, conversationId))
      .get();

    if (!conversation) {
      return c.json({
        success: false,
        error: 'Conversation not found',
        timestamp: new Date().toISOString()
      }, 404);
    }

    // 生成訊息 ID
    const messageId = crypto.randomUUID();
    const hasAttachments = attachmentIds && attachmentIds.length > 0;

    console.log(`💬 [Agent Message] Creating message: ${messageId} for conversation: ${conversationId}`);

    // 並行執行：儲存訊息到資料庫
    const timestamp = new Date().toISOString();
    const messageInsertPromise = drizzleDb
      .insert(messages)
      .values({
        id: messageId,
        conversationId: conversationId,
        senderType: 'agent',
        agentSenderId: String(user.id), // ✅ 確保為字串類型
        content: content || '',
        messageType: mediaType || 'text',
        platformMessageId: null,
        isSent: false,
        deliveryStatus: 'pending',
        metadata: hasAttachments ? JSON.stringify({ attachmentIds }) : null,
        createdAt: timestamp
      });

    // 並行執行：準備活動記錄服務
    const activityServicePromise = import('../services/activity-service');

    // 等待資料庫插入完成
    await messageInsertPromise;
    console.log(`✅ [Agent Message] Stored in database: ${messageId}`);

    // 並行執行：發送到平台 & 準備更新操作
    const conversationData = conversation as any;
    let sendResult = false;

    const [platformResult, activityServiceModule] = await Promise.allSettled([
      // 發送到平台 (LINE/Facebook)
      (async () => {
        try {
          if (conversationData.platform === 'line') {
            const { pushLineMessage, createTextMessage } = await import('../utils/line');
            
            if (content) {
              const messages = [createTextMessage(content)];
              return await pushLineMessage(
                c.env.LINE_CHANNEL_ACCESS_TOKEN, 
                String(conversationData.platform_user_id), 
                messages
              );
            }
          }
          // TODO: 添加 Facebook 支援
          return false;
        } catch (error) {
          console.error(`❌ [Agent Message] Failed to send to platform:`, error);
          return false;
        }
      })(),
      // 載入活動記錄服務
      activityServicePromise
    ]);

    // 取得平台發送結果
    if (platformResult.status === 'fulfilled') {
      sendResult = platformResult.value;
    }
    console.log(`📤 [Agent Message] Platform send result: ${sendResult}`);

    // 並行執行：更新訊息狀態、對話時間、記錄活動
    const updateTimestamp = new Date().toISOString();
    
    const parallelOperations = [
      // 更新訊息發送狀態
      drizzleDb
        .update(messages)
        .set({
          isSent: sendResult,
          deliveryStatus: sendResult ? 'sent' : 'failed',
          sentAt: updateTimestamp
        })
        .where(eq(messages.id, messageId)),
      
      // 更新對話最後訊息時間
      drizzleDb
        .update(conversations)
        .set({
          lastMessageAt: updateTimestamp,
          updatedAt: updateTimestamp
        })
        .where(eq(conversations.id, conversationId))
    ];

    // 並行記錄活動（不阻塞主流程）
    if (activityServiceModule.status === 'fulfilled') {
      const logActivityPromise = (async () => {
        try {
          const { ActivityService } = activityServiceModule.value;
          const activityService = new ActivityService(c.env.DB);
          await activityService.logActivity({
            userId: String(user.id), // ✅ 確保為字串類型
            userName: user.displayName || 'Agent',
            userRole: user.role || 'agent',
            action: 'message_send',
            resourceType: 'conversation',
            resourceId: conversationId,
            details: {
              conversationId: conversationId,
              messageId: messageId,
              platform: conversationData.platform,
              messageType: mediaType || 'text',
              contentLength: content?.length || 0,
              sendResult: sendResult
            }
          });
        } catch (activityError) {
          console.warn('Failed to record activity:', activityError);
        }
      })();
      
      // 不等待活動記錄完成，讓它在背景執行
      logActivityPromise.catch(() => {}); // 靜默處理錯誤
    }

    // 等待關鍵更新操作完成
    await Promise.all(parallelOperations);

    return c.json({
      success: true,
      data: {
        messageId: messageId,
        conversationId: conversationId,
        content: content,
        messageType: mediaType || 'text',
        sendResult: sendResult,
        deliveryStatus: sendResult ? 'sent' : 'failed'
      },
      message: 'Message sent successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Send message error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 獲取對話的所有訊息
conversationHandler.get('/:id/messages', jwtAuth, async (c) => {
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

    // 獲取對話中的所有訊息（包含發送者資訊）
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
      .orderBy(desc(messages.createdAt)); // ✅ 最新的消息在前面

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

    return c.json({
      success: true,
      data: formattedMessages,
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

export default conversationHandler;