// 對話管理處理器 - 主要實現
import { Hono } from 'hono';
import { eq, inArray, desc, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { conversations, customers, messages, agents } from '../db/schema';
import type { Bindings } from '../types';
import { ERROR_MESSAGES } from '../utils/error-messages';
import { PermissionService } from '../services/permission-service';
import { jwtAuth } from '../middleware/auth';

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

    // 記錄轉移歷史 (使用原生 SQL，因為 conversation_transfers 表未在 schema 中定義)
    if (reason) {
      await c.env.DB.prepare(`
        INSERT INTO conversation_transfers 
        (conversation_id, to_team_id, to_user_id, transfer_reason, transferred_by)
        VALUES (?, ?, ?, ?, ?)
      `).bind(conversationId, teamId, userId, reason, user.id).run();
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

    // 記錄轉移歷史 (使用原生 SQL，因為 conversation_transfers 表未在 schema 中定義)
    await c.env.DB.prepare(`
      INSERT INTO conversation_transfers 
      (conversation_id, from_team_id, to_team_id, from_user_id, to_user_id, transfer_reason, transferred_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(conversationId, fromTeamId, toTeamId, fromUserId, toUserId, reason, user.id).run();
    
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

    // 獲取最新消息內容 (由於 Drizzle 不支持複雜子查詢，使用原生 SQL)
    const conversationIds = conversationData.map(c => c.id);
    let lastMessages: any[] = [];
    
    if (conversationIds.length > 0) {
      const placeholders = conversationIds.map(() => '?').join(',');
      const lastMessageQuery = `
        SELECT 
          m1.conversation_id,
          m1.content as last_message_content,
          m1.created_at as last_message_at_actual
        FROM messages m1
        INNER JOIN (
          SELECT conversation_id, MAX(created_at) as max_created_at
          FROM messages
          WHERE conversation_id IN (${placeholders})
          GROUP BY conversation_id
        ) m2 ON m1.conversation_id = m2.conversation_id AND m1.created_at = m2.max_created_at
      `;
      
      const result = await c.env.DB.prepare(lastMessageQuery).bind(...conversationIds).all();
      lastMessages = result.results || [];
    }
    
    // 結合數據
    const combinedData = conversationData.map(conv => {
      const lastMsg = lastMessages.find((msg: any) => msg.conversation_id === conv.id);
      return {
        ...conv,
        last_message_content: lastMsg?.last_message_content || null,
        last_message_at_actual: lastMsg?.last_message_at_actual || null
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
      'read',
      { 
        userId: user.id,
        role: user.role,
        resourceId: conversationId 
      }
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
        customer_name: customers.displayName,
        platform: customers.platform,
        platform_user_id: customers.platformUserId
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
      'conversation', 
      'send_message',
      { 
        userId: user.id, // ✅ 保持一致的字符串ID
        role: user.role,
        resourceId: conversationId 
      },
      c.env.DB
    );
    
    console.log(`🔒 [Agent Message] Permission check result: ${hasPermission}`);
    
    if (!hasPermission) {
      console.log(`❌ [Agent Message] Permission denied for user ${user.id}`);
      return c.json({ 
        success: false,
        error: 'Permission denied',
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

    // 儲存訊息到資料庫
    const timestamp = new Date().toISOString();
    await drizzleDb
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

    console.log(`✅ [Agent Message] Stored in database: ${messageId}`);

    // 發送到平台 (LINE/Facebook)
    let sendResult = false;
    const conversationData = conversation as any;

    try {
      if (conversationData.platform === 'line') {
        const { pushLineMessage, createTextMessage } = await import('../utils/line');
        
        if (content) {
          const messages = [createTextMessage(content)];
          sendResult = await pushLineMessage(
            c.env.LINE_CHANNEL_ACCESS_TOKEN, 
            String(conversationData.platform_user_id), 
            messages
          );
        }
      }
      // TODO: 添加 Facebook 支援
      
      console.log(`📤 [Agent Message] Platform send result: ${sendResult}`);
    } catch (error) {
      console.error(`❌ [Agent Message] Failed to send to platform:`, error);
      sendResult = false;
    }

    // 更新訊息發送狀態
    const updateTimestamp = new Date().toISOString();
    await drizzleDb
      .update(messages)
      .set({
        isSent: sendResult,
        deliveryStatus: sendResult ? 'sent' : 'failed',
        sentAt: updateTimestamp
      })
      .where(eq(messages.id, messageId));

    // 更新對話最後訊息時間
    await drizzleDb
      .update(conversations)
      .set({
        lastMessageAt: updateTimestamp,
        updatedAt: updateTimestamp
      })
      .where(eq(conversations.id, conversationId));

    // 記錄活動
    try {
      const { ActivityService } = await import('../services/activity-service');
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
      'read',
      { 
        userId: user.id,
        role: user.role,
        resourceId: conversationId 
      }
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

export default conversationHandler;