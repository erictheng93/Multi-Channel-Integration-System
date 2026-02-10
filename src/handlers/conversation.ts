// 使用 Drizzle ORM 和 KV 的對話處理器
import { Hono } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import { Context } from 'hono';
import { DatabaseService } from '../services/database';
import { databaseMiddleware, authMiddleware } from '../middleware/database';
import type { HonoContext } from '../types/bindings';
import type { Bindings } from '../types';
import { CONVERSATION_STATUS } from '../constants/conversation-status';
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
  handleApiError
} from '../utils/api-response';
import { createDbClient } from '../db/drizzle-factory';
import { sql, eq, and, desc, inArray, count, aliasedTable } from 'drizzle-orm';
import { realtime } from '@modules/realtime';
import { conversations as conversationTable, agents, conversationTransfers, teams, conversationTags } from '../db/schema';
import { requireAdmin } from '../middleware/auth';
import { WebSocketAuthService } from '../services/websocket-auth-service';

const conversations = new Hono<HonoContext>();

// Apply middleware
conversations.use('*', databaseMiddleware);
conversations.use('*', authMiddleware);

// ==================== ROUTE REGISTRATION (Proper Priority Order) ====================
// Routes MUST be registered in this order to avoid conflicts:
// 1. MULTI-SEGMENT: /:id/messages, /:id/status, /:id/mark-read, /:id/assign, /:id/transfer
// 2. SINGLE PARAMETERIZED: /:id
// 3. WILDCARD: / - MUST be registered LAST to avoid intercepting /:id

// ==================== Priority 1: MULTI-SEGMENT routes (/:id/xxx) ====================

// 上傳附件（在消息發送之前）
conversations.post('/:id/attachments', async (c) => {
  try {
    const conversationId = c.req.param('id');
    const agent = c.get('agent');

    if (!conversationId) {
      return c.json({
        success: false,
        error: 'Conversation ID is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const db = c.get('db');
    const kv = c.get('kv');
    const dbService = new DatabaseService(db, kv);

    // 檢查權限 - 確保代理可以存取此對話
    const canAccess = await dbService.canAgentAccessConversation(agent!, conversationId);
    if (!canAccess) {
      return c.json({
        success: false,
        error: 'Access denied'
      }, HTTP_STATUS.FORBIDDEN);
    }

    // 檢查對話是否存在
    const conversation = await dbService.getConversationById(conversationId);
    if (!conversation) {
      return c.json({
        success: false,
        error: 'Conversation not found'
      }, HTTP_STATUS.NOT_FOUND);
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
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 文件大小限制：10MB
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return c.json({
        success: false,
        error: 'File too large (max 10MB)'
      }, HTTP_STATUS.BAD_REQUEST);
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
      console.error('R2 upload error:', error);
      return c.json({
        success: false,
        error: 'Failed to upload file to storage'
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    // 生成公開 URL - 使用 API 代理端點而非直接 R2 URL
    // 這樣可以繞過 R2 公開訪問未配置的問題
    const requestUrl = new URL(c.req.url);
    const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
    const fileUrl = `${baseUrl}/api/files/public/${r2Key}`;
    console.log(`[Upload] Generated proxy URL: ${fileUrl}`);

    // 保存附件記錄到資料庫（messageId 為 null，等待消息創建時關聯）
    const { fileAttachments } = await import('../db/schema');
    const attachmentId = `att_${timestamp}_${randomStr}`;

    const drizzleDb = createDbClient(c.env.DB);
    await drizzleDb.insert(fileAttachments).values({
      id: attachmentId,
      messageId: null, // Will be updated when message is sent
      filename: file.name,
      mimeType: file.type,
      fileSize: file.size,
      fileUrl,
      r2Key,
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
    console.error('Upload attachment error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// 發送訊息
conversations.post('/:id/messages', async (c) => {
  try {
    const conversationId = c.req.param('id');
    const agent = c.get('agent');
    const { content, messageType = 'text', attachmentIds } = await c.req.json();

    if (!content) {
      return c.json({
        success: false,
        error: 'Message content is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!conversationId) {
      return c.json({
        success: false,
        error: 'Conversation ID is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const db = c.get('db');
    const kv = c.get('kv');
    const dbService = new DatabaseService(db, kv);

    // 檢查權限 - 確保代理可以存取此對話
    const canAccess = await dbService.canAgentAccessConversation(agent!, conversationId);
    if (!canAccess) {
      return c.json({
        success: false,
        error: 'Access denied'
      }, HTTP_STATUS.FORBIDDEN);
    }

    // 檢查對話是否存在
    const conversation = await dbService.getConversationById(conversationId);
    if (!conversation) {
      return c.json({
        success: false,
        error: 'Conversation not found'
      }, HTTP_STATUS.NOT_FOUND);
    }

    // 建立訊息
    const message = await dbService.createMessage({
      conversationId,
      senderType: 'agent',
      agentSenderId: agent!.id, // Use correct schema field name
      content,
      messageType,
      senderName: agent!.displayName || null,
    });

    // 如果有附件，更新附件的 messageId
    if (attachmentIds && Array.isArray(attachmentIds) && attachmentIds.length > 0) {
      const { fileAttachments } = await import('../db/schema');
      const drizzleDb = createDbClient(c.env.DB);

      // 批量更新所有附件的 messageId
      await drizzleDb.update(fileAttachments)
        .set({ messageId: message.id })
        .where(inArray(fileAttachments.id, attachmentIds))
        .execute();

      console.log(`✅ [Message] Updated ${attachmentIds.length} attachments for message ${message.id}`);
    }

    // 🚀 事件驅動推送：立即推送新消息事件到隊列
    // Note: assignedUserId removed - only team assignment is supported now
    try {
      await realtime.createEvent(
        'message_created',
        {
          messageId: message?.id?.toString() || '',
          conversationId: parseInt(conversationId),
          content: message?.content || '',
          messageType: (message?.messageType as 'text' | 'image' | 'file') || 'text',
          senderType: 'agent',
          senderId: agent!.id,
          senderName: agent!.displayName || `Agent ${agent!.id}`,
          customerName: conversation.customer?.displayName,
          agentName: agent!.displayName,
          metadata: message?.metadata ? JSON.parse(message.metadata) : undefined,
          createdAt: message?.createdAt || new Date().toISOString(),
          isRead: false
        },
        {
          conversationId: parseInt(conversationId),
          userIds: []  // Team members will be notified via WebSocket broadcast
        },
        'high', // 消息創建是高優先級事件
        'user'
      );
      console.log(`🚀 [Message] Event queued for message ${message?.id || 'unknown'}`);
    } catch (eventError) {
      console.error('❌ [Message] Failed to queue event:', eventError);
      // 不影響消息創建的成功，只記錄錯誤
    }

    // 如果這是客服首次回覆（firstResponseAt 為空），設置首次回覆時間
    if (!conversation.firstResponseAt) {
      await dbService.updateConversation(conversationId, {
        firstResponseAt: new Date().toISOString()
      });
      console.log(`🎯 [First Response] Set firstResponseAt for conversation ${conversationId}`);
    }

    // 如果對話狀態是 pending，更新為 in-progress (不再自動指派個人)
    if (conversation.status === CONVERSATION_STATUS.PENDING) {
      await dbService.updateConversation(conversationId, {
        status: CONVERSATION_STATUS.IN_PROGRESS
        // Note: assignedUserId auto-assignment removed - only team assignment is supported
      });

      // 🚀 推送對話狀態更新事件
      try {
        await realtime.createEvent(
          'conversation_status_changed',
          {
            conversationId: parseInt(conversationId),
            status: CONVERSATION_STATUS.IN_PROGRESS,
            // Note: assignedUserId removed - only team assignment is supported
            customerName: conversation.customer?.displayName,
            updatedAt: new Date().toISOString(),
            changes: { status: { from: CONVERSATION_STATUS.PENDING, to: CONVERSATION_STATUS.IN_PROGRESS } }
          },
          {
            conversationId: parseInt(conversationId),
            userIds: []  // Team members will be notified via WebSocket broadcast
          },
          'normal',
          'user'
        );
      } catch (eventError) {
        console.error('❌ [Conversation] Failed to queue status change event:', eventError);
      }
    }

    return c.json({
      success: true,
      data: message
    });

  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

// 更新對話狀態
conversations.patch('/:id/status', async (c) => {
  try {
    const conversationId = c.req.param('id');
    const agent = c.get('agent');
    const { status } = await c.req.json();

    if (![CONVERSATION_STATUS.ACTIVE, CONVERSATION_STATUS.PENDING, CONVERSATION_STATUS.IN_PROGRESS, CONVERSATION_STATUS.ASSIGNED, CONVERSATION_STATUS.WAITING].includes(status)) {
      return c.json({
        success: false,
        error: 'Invalid status'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!conversationId) {
      return c.json({
        success: false,
        error: 'Conversation ID is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const db = c.get('db');
    const kv = c.get('kv');
    const dbService = new DatabaseService(db, kv);

    // 檢查權限 - 確保代理可以存取此對話
    const canAccess = await dbService.canAgentAccessConversation(agent!, conversationId);
    if (!canAccess) {
      return c.json({
        success: false,
        error: 'Access denied'
      }, HTTP_STATUS.FORBIDDEN);
    }

    // 檢查對話是否存在
    const conversation = await dbService.getConversationById(conversationId);
    if (!conversation) {
      return c.json({
        success: false,
        error: 'Conversation not found'
      }, HTTP_STATUS.NOT_FOUND);
    }

    // 更新對話狀態
    const updates: any = { status };

    // Note: Individual assignment removed - only team assignment is supported now
    // Status changes no longer auto-assign to individual agents

    const updatedConversation = await dbService.updateConversation(conversationId, updates);

    return c.json({
      success: true,
      data: updatedConversation
    });

  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

// 標記訊息為已讀
conversations.post('/:id/mark-read', async (c) => {
  try {
    const conversationId = c.req.param('id');
    const agent = c.get('agent');

    if (!conversationId) {
      return c.json({
        success: false,
        error: 'Conversation ID is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const db = c.get('db');
    const kv = c.get('kv');
    const dbService = new DatabaseService(db, kv);

    // 檢查權限 - 確保代理可以存取此對話
    const canAccess = await dbService.canAgentAccessConversation(agent!, conversationId);
    if (!canAccess) {
      return c.json({
        success: false,
        error: 'Access denied'
      }, HTTP_STATUS.FORBIDDEN);
    }

    await dbService.markMessagesAsRead(conversationId, agent!.id);

    return c.json({
      success: true,
      message: 'Messages marked as read'
    });

  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

// 分配對話 - 僅管理員可執行 (只支援團隊指派，個人指派已移除)
conversations.post('/:id/assign', requireAdmin(), async (c) => {
  try {
    const conversationId = c.req.param('id');
    const agent = c.get('agent');
    const { teamId, reason } = await c.req.json();
    // Note: userId removed - only team assignment is supported now
    const db = c.get('db');
    const kv = c.get('kv');
    const dbService = new DatabaseService(db, kv);

    // 管理員權限已由 requireAdmin() 中間件確認，移除冗餘檢查

    // Validate teamId is provided
    if (!teamId) {
      return c.json({
        success: false,
        error: 'Team ID is required for assignment'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // ✅ 使用 DatabaseService.updateConversation 方法，自動處理緩存清除
    await dbService.updateConversation(conversationId, {
      assignedTeamId: teamId,
      status: CONVERSATION_STATUS.ASSIGNED
    });

    // 🔧 FIX: 获取更新后的完整对话对象,包括 assignedTeam
    const updatedConversation = await dbService.getConversationById(conversationId);

    if (!updatedConversation) {
      return c.json({
        success: false,
        error: 'Failed to retrieve updated conversation'
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    console.log('✅ [Assign API] Conversation assigned:', {
      id: conversationId,
      status: updatedConversation.status,
      assignedTeamId: updatedConversation.assignedTeamId,
      assignedTeam: updatedConversation.assignedTeam
    });

    return c.json({
      success: true,
      message: 'Conversation assigned successfully',
      data: updatedConversation  // 返回完整的对话对象
    });

  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

// 取消指派對話 (只檢查團隊指派)
conversations.post('/:id/unassign', requireAdmin(), async (c) => {
  try {
    const conversationId = c.req.param('id');
    const agent = c.get('agent');
    const { reason } = await c.req.json().catch(() => ({}));
    const db = c.get('db');
    const kv = c.get('kv');
    const dbService = new DatabaseService(db, kv);

    // 管理員權限已由 requireAdmin() 中間件確認

    // 檢查對話是否存在
    const conversation = await dbService.getConversationById(conversationId);
    if (!conversation) {
      return c.json({
        success: false,
        error: 'Conversation not found'
      }, HTTP_STATUS.NOT_FOUND);
    }

    // 檢查對話是否已指派 (只檢查團隊)
    if (!conversation.assignedTeamId) {
      return c.json({
        success: false,
        error: 'Conversation is not assigned'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 記錄取消指派前的狀態 (只記錄團隊)
    const previousAssignment = {
      teamId: conversation.assignedTeamId,
      teamName: conversation.assignedTeam?.name
    };

    // 取消指派：清除 teamId，將狀態改回 'open'
    await dbService.updateConversation(conversationId, {
      assignedTeamId: null,
      status: 'open'
    });

    console.log(`✅ [Unassign API] Conversation unassigned from team: ${previousAssignment.teamId}`);

    // 獲取更新後的完整對話對象
    const updatedConversation = await dbService.getConversationById(conversationId);

    if (!updatedConversation) {
      return c.json({
        success: false,
        error: 'Failed to retrieve updated conversation'
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    console.log('✅ [Unassign API] Conversation unassigned:', {
      id: conversationId,
      previousAssignment,
      newStatus: updatedConversation.status,
      reason: reason || 'No reason provided',
      unassignedBy: agent?.displayName || agent?.id
    });

    // 發送 WebSocket 事件通知取消指派
    try {
      await realtime.createEvent(
        'conversation_unassigned',
        {
          conversationId,
          previousTeamId: previousAssignment.teamId,
          previousTeamName: previousAssignment.teamName,
          // Note: previousUserId/previousUserName removed - only team-based assignment is supported
          reason: reason || 'No reason provided',
          unassignedBy: agent?.displayName || agent?.id,
          timestamp: Date.now()
        },
        {
          conversationId: conversationId,
          // 通知之前指派的團隊
          ...(previousAssignment.teamId && { teamId: previousAssignment.teamId }),
          broadcast: true // 廣播給所有相關用戶
        },
        'high', // 高優先級通知
        'api'
      );
    } catch (eventError) {
      console.error('❌ [Unassign API] Failed to send realtime event:', eventError);
      // 繼續執行，不中斷流程
    }

    return c.json({
      success: true,
      message: 'Conversation unassigned successfully',
      data: updatedConversation
    });

  } catch (error) {
    console.error('Unassign operation failed:', error);
    return handleApiError(error, c);
  }
});

// 轉移對話
conversations.post('/:id/transfer', async (c) => {
  const drizzleDb = createDbClient(c.env.DB);
  try {
    const conversationId = c.req.param('id');
    const agent = c.get('agent');
    const {
      fromTeamId,
      toTeamId,
      // Note: fromUserId and toUserId removed - only team-based transfer is supported
      reason,
      transferType = 'manual'
    } = await c.req.json();
    const payload = c.get('jwtPayload');

    // 檢查權限 - 需要 transfer 權限
    const { PermissionService } = await import('../services/permission-service');
    const hasPermission = await PermissionService.checkPermission(
      agent!.id,
      'conversation',
      'transfer'
    );

    if (!hasPermission) {
      return c.json({
        success: false,
        error: 'Permission denied'
      }, HTTP_STATUS.FORBIDDEN);
    }

    // Validate toTeamId is provided
    if (!toTeamId) {
      return c.json({
        success: false,
        error: 'Target team ID is required for transfer'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 獲取當前對話資訊
    const conversation = await drizzleDb.select()
      .from(conversationTable)
      .where(eq(conversationTable.id, conversationId))
      .get();

    if (!conversation) {
      return notFoundResponse(c, 'Conversation');
    }

    // 記錄轉移歷史 (只記錄團隊)
    await drizzleDb.insert(conversationTransfers)
      .values({
        conversationId: conversationId,
        fromTeamId: fromTeamId || conversation.assignedTeamId,
        toTeamId: toTeamId,
        // Note: fromUserId and toUserId removed - only team-based transfer
        transferReason: reason || null,
        transferredBy: payload?.userId ? (typeof payload.userId === 'string' ? payload.userId : payload.userId.toString()) : 'system',
        transferType: transferType
      });

    // 更新對話指派 (只更新團隊)
    await drizzleDb.update(conversationTable)
      .set({
        assignedTeamId: toTeamId,
        status: 'transferred',
        updatedAt: sql`datetime('now')`
      })
      .where(eq(conversationTable.id, conversationId));

    console.log(`✅ [Transfer API] Conversation transferred to team: ${toTeamId}`);

    return c.json({
      success: true,
      message: 'Conversation transferred successfully'
    });

  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

// ==================== Priority 2: SINGLE PARAMETERIZED routes (/:id) ====================

// 獲取特定對話
conversations.get('/:id', async (c) => {
  try {
    const conversationId = c.req.param('id');
    const agent = c.get('agent');
    const db = c.get('db');
    const kv = c.get('kv');
    const dbService = new DatabaseService(db, kv);

    if (!conversationId) {
      return c.json({ 
        success: false, 
        error: 'Conversation ID is required' 
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 檢查權限 - 確保代理可以存取此對話
    const canAccess = await dbService.canAgentAccessConversation(agent!, conversationId);
    if (!canAccess) {
      return c.json({ 
        success: false, 
        error: 'Access denied' 
      }, HTTP_STATUS.FORBIDDEN);
    }

    // 獲取對話資訊
    const conversation = await dbService.getConversationById(conversationId);
    
    if (!conversation) {
      return c.json({ 
        success: false, 
        error: 'Conversation not found' 
      }, HTTP_STATUS.NOT_FOUND);
    }

    // 獲取對話中的訊息
    const messages = await dbService.getMessagesByConversationId(conversationId, 100);

    return c.json({
      success: true,
      data: {
        conversation,
        messages: messages.reverse(), // 按時間順序排列
      }
    });

  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

// 發送訊息

// ==================== Priority 3: WILDCARD routes (/) - MUST BE LAST! ====================

// 獲取對話列表
conversations.get('/', async (c) => {
  try {
    const agent = c.get('agent');
    const db = c.get('db');
    const kv = c.get('kv');
    const dbService = new DatabaseService(db, kv);

    const { status, limit = '50', page = '1' } = c.req.query();
    const limitNum = Math.min(parseInt(limit), 100);
    const pageNum = Math.max(parseInt(page), 1);

    // 根據角色獲取對話 - 使用新的三層權限體系
    const conversationList = await dbService.getConversationsByRole(agent!, status, limitNum);

    return c.json({
      success: true,
      data: {
        conversations: conversationList,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: conversationList.length,
        }
      }
    });

  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

// 傳統處理器方法（為了向後兼容）
const handlerMethods = {
  // 設定對話優先級
  async setPriority(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const conversationId = c.req.param('id');
      const { priority } = await c.req.json();

      const validPriorities = ['low', 'normal', 'high', 'urgent'];
      if (!validPriorities.includes(priority)) {
        return validationErrorResponse(c, [
          { field: 'priority', message: 'Invalid priority level' }
        ]);
      }

      await drizzleDb.update(conversationTable)
        .set({ 
          priority: priority,
          updatedAt: sql`datetime('now')`
        })
        .where(eq(conversationTable.id, conversationId));

      return successResponse(c, null, 'Conversation priority updated successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 轉移對話
  async transfer(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const conversationId = c.req.param('id');
      // Note: toUserId removed - only team-based transfer is supported now
      const {
        toTeamId,
        reason,
        transferType = 'manual'
      } = await c.req.json();
      const payload = c.get('jwtPayload');

      // 獲取當前對話資訊
      const conversation = await drizzleDb.select()
        .from(conversationTable)
        .where(eq(conversationTable.id, conversationId))
        .get();

      if (!conversation) {
        return notFoundResponse(c, 'Conversation');
      }

      // 記錄轉移歷史 (only team-based transfer is supported now)
      await drizzleDb.insert(conversationTransfers)
        .values({
          conversationId: conversationId,
          fromTeamId: conversation.assignedTeamId,
          toTeamId: toTeamId || null,
          // Note: fromUserId/toUserId removed - only team-based transfer
          transferReason: reason || null,
          transferredBy: payload?.userId ? (typeof payload.userId === 'string' ? payload.userId : payload.userId.toString()) : 'system',
          transferType: transferType
        });

      // 更新對話指派 (only team assignment is supported now)
      await drizzleDb.update(conversationTable)
        .set({
          assignedTeamId: toTeamId || null,
          // Note: assignedUserId removed - only team-based assignment
          status: 'transferred',
          updatedAt: sql`datetime('now')`
        })
        .where(eq(conversationTable.id, conversationId));

      // Note: Cache invalidation for individual agents removed - using team-based access control now

      return successResponse(c, null, 'Conversation transferred successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 為對話添加標籤
  // ✅ 優化版本：使用 Drizzle 批量插入（單條 SQL 語句）
  async addTags(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const conversationId = c.req.param('id');
      const { tagIds } = await c.req.json();
      const payload = c.get('jwtPayload');

      if (!Array.isArray(tagIds) || tagIds.length === 0) {
        return validationErrorResponse(c, [
          { field: 'tagIds', message: 'Tag IDs array is required' }
        ]);
      }

      // 檢查對話是否存在
      const conversation = await drizzleDb.select({ id: conversationTable.id })
        .from(conversationTable)
        .where(eq(conversationTable.id, conversationId))
        .get();

      if (!conversation) {
        return notFoundResponse(c, 'Conversation');
      }

      // ✅ 優化：構建批量插入值，使用單條 SQL 語句
      const assignedBy = payload?.userId ? (typeof payload.userId === 'string' ? payload.userId : payload.userId.toString()) : 'system';
      const tagInsertValues = tagIds.map(tagId => ({
        conversationId: conversationId,
        tagId: tagId,
        assignedBy: assignedBy
      }));

      // Drizzle 支持 values() 接受數組，生成單條 INSERT 語句
      await drizzleDb.insert(conversationTags)
        .values(tagInsertValues)
        .onConflictDoNothing();

      console.log(`📦 [Tags] Added ${tagIds.length} tags to conversation ${conversationId} using batch insert`);

      return successResponse(c, null, 'Tags added successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 移除對話標籤
  async removeTags(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const conversationId = c.req.param('id');
      const { tagIds } = await c.req.json();

      if (!Array.isArray(tagIds) || tagIds.length === 0) {
        return validationErrorResponse(c, [
          { field: 'tagIds', message: 'Tag IDs array is required' }
        ]);
      }

      await drizzleDb.delete(conversationTags)
        .where(and(
          eq(conversationTags.conversationId, conversationId),
          inArray(conversationTags.tagId, tagIds)
        ));

      return successResponse(c, null, 'Tags removed successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 設定內部備註
  async setNotes(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const conversationId = c.req.param('id');
      const { notes } = await c.req.json();

      await drizzleDb.update(conversationTable)
        .set({
          internalNotes: notes || null,
          updatedAt: sql`datetime('now')`
        })
        .where(eq(conversationTable.id, conversationId));

      return successResponse(c, null, 'Internal notes updated successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取對話轉移歷史
  async getTransferHistory(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const conversationId = c.req.param('id');

      const ft = aliasedTable(teams, 'ft');
      const tt = aliasedTable(teams, 'tt');
      const fu = aliasedTable(agents, 'fu');
      const tu = aliasedTable(agents, 'tu');
      const bu = aliasedTable(agents, 'bu');
      
      // Note: fromUserId/toUserId removed - only team-based transfer is supported now
      const transfers = await drizzleDb
        .select({
          id: conversationTransfers.id,
          conversationId: conversationTransfers.conversationId,
          fromTeamId: conversationTransfers.fromTeamId,
          toTeamId: conversationTransfers.toTeamId,
          transferReason: conversationTransfers.transferReason,
          transferredBy: conversationTransfers.transferredBy,
          transferType: conversationTransfers.transferType,
          createdAt: conversationTransfers.createdAt,
          fromTeamName: ft.name,
          toTeamName: tt.name,
          transferredByName: bu.displayName
        })
        .from(conversationTransfers)
        .leftJoin(ft, eq(conversationTransfers.fromTeamId, ft.id))
        .leftJoin(tt, eq(conversationTransfers.toTeamId, tt.id))
        .leftJoin(bu, eq(conversationTransfers.transferredBy, bu.id))
        .where(eq(conversationTransfers.conversationId, conversationId))
        .orderBy(desc(conversationTransfers.createdAt));

      const transferHistory = transfers.map((transfer: any) => ({
        id: transfer.id,
        fromTeam: transfer.fromTeamId ? {
          id: transfer.fromTeamId,
          name: transfer.fromTeamName
        } : null,
        toTeam: transfer.toTeamId ? {
          id: transfer.toTeamId,
          name: transfer.toTeamName
        } : null,
        // Note: fromUser/toUser removed - only team-based transfer is supported now
        reason: transfer.transferReason,
        transferredBy: {
          id: transfer.transferredBy,
          name: transfer.transferredByName
        },
        transferType: transfer.transferType,
        createdAt: transfer.createdAt
      }));

      return successResponse(c, transferHistory, 'Transfer history retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 批量操作對話  
  async bulkOperation(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const { operation, conversationIds, data } = await c.req.json();
      const payload = c.get('jwtPayload');

      if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
        return validationErrorResponse(c, [
          { field: 'conversationIds', message: 'Conversation IDs array is required' }
        ]);
      }

      const conversationIdsArray = conversationIds;

      switch (operation) {
        case 'assign': {
          // Note: Individual assignment (userId) removed - only team-based assignment is supported now
          if (!data?.teamId) {
            return validationErrorResponse(c, [
              { field: 'data', message: 'Team ID is required for assignment' }
            ]);
          }

          await drizzleDb.update(conversationTable)
            .set({
              // Note: assignedUserId removed - only team-based assignment
              assignedTeamId: data.teamId || null,
              status: CONVERSATION_STATUS.ASSIGNED,
              updatedAt: sql`datetime('now')`
            })
            .where(inArray(conversationTable.id, conversationIdsArray));

          // Note: Cache invalidation for individual agents removed - using team-based access control now
          console.log(`📦 [Bulk Assign] Assigned ${conversationIdsArray.length} conversations to team ${data.teamId}`);
          break;
        }

        case 'close':
          return validationErrorResponse(c, [
            { field: 'operation', message: 'Close operation is no longer supported' }
          ]);

        case 'reopen':
          return validationErrorResponse(c, [
            { field: 'operation', message: 'Reopen operation is no longer supported' }
          ]);

        case 'set_priority':
          if (!data?.priority) {
            return validationErrorResponse(c, [
              { field: 'data.priority', message: 'Priority is required' }
            ]);
          }
          await drizzleDb.update(conversationTable)
            .set({
              priority: data.priority,
              updatedAt: sql`datetime('now')`
            })
            .where(inArray(conversationTable.id, conversationIdsArray));
          break;

        case 'add_tags':
          if (!data?.tagIds || !Array.isArray(data.tagIds)) {
            return validationErrorResponse(c, [
              { field: 'data.tagIds', message: 'Tag IDs array is required' }
            ]);
          }
          // ✅ 優化：使用 Drizzle 批量插入（單條 SQL 語句）
          const assignedBy = payload?.userId ? (typeof payload.userId === 'string' ? payload.userId : payload.userId.toString()) : 'system';
          const tagInsertValues: { conversationId: string; tagId: number; assignedBy: string }[] = [];

          for (const convId of conversationIds) {
            for (const tagId of data.tagIds) {
              tagInsertValues.push({
                conversationId: convId,
                tagId: parseInt(tagId),
                assignedBy: assignedBy
              });
            }
          }

          // 使用 Drizzle 批量插入（每批最多 100 條記錄以避免 SQL 語句過長）
          const BULK_BATCH_SIZE = 100;
          for (let i = 0; i < tagInsertValues.length; i += BULK_BATCH_SIZE) {
            const batch = tagInsertValues.slice(i, i + BULK_BATCH_SIZE);
            if (batch.length > 0) {
              await drizzleDb.insert(conversationTags)
                .values(batch)
                .onConflictDoNothing();
            }
          }

          console.log(`📦 [Bulk Tags] Inserted ${tagInsertValues.length} tag associations using batch insert`);
          break;

        default:
          return validationErrorResponse(c, [
            { field: 'operation', message: 'Invalid operation' }
          ]);
      }

      return successResponse(c, null, `Bulk ${operation} completed successfully`);

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 自動分配邏輯
  async autoAssign(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const { strategy = 'round_robin', teamId } = await c.req.json();

      // 獲取未分配的對話 - 使用 Drizzle ORM
      // Note: Individual assignment (assignedUserId) removed - only team-based assignment is supported now
      const baseConditions = [
        eq(conversationTable.status, CONVERSATION_STATUS.ACTIVE),
        sql`${conversationTable.assignedTeamId} IS NULL`
      ];
      
      if (teamId) {
        baseConditions.push(
          sql`(${conversationTable.assignedTeamId} = ${teamId} OR ${conversationTable.assignedTeamId} IS NULL)`
        );
      }
      
      const unassignedConversations = await drizzleDb
        .select({ id: conversationTable.id })
        .from(conversationTable)
        .where(and(...baseConditions))
        .orderBy(conversationTable.createdAt)
        .limit(50);

      if (!unassignedConversations || unassignedConversations.length === 0) {
        return successResponse(c, { assigned: 0 }, 'No unassigned conversations found');
      }

      let assignedCount = 0;

      if (strategy === 'round_robin') {
        // Note: Individual assignment (assignedUserId) removed - only team-based assignment is supported now
        // Auto-assign to specified team or default team
        if (!teamId) {
          return errorResponse(c, 'Team ID is required for auto-assignment', 400);
        }

        // Assign all unassigned conversations to the specified team
        for (const conv of unassignedConversations) {
          await drizzleDb.update(conversationTable)
            .set({
              assignedTeamId: teamId,
              status: CONVERSATION_STATUS.ASSIGNED,
              updatedAt: sql`datetime('now')`
            })
            .where(eq(conversationTable.id, conv.id));

          assignedCount++;
        }

        // Note: Cache invalidation for individual agents removed - using team-based access control now
        console.log(`📦 [Auto Assign] Assigned ${assignedCount} conversations to team ${teamId}`);
      }

      return successResponse(c, {
        assigned: assignedCount,
        strategy,
        total: unassignedConversations.length
      }, `Auto assignment completed`);

    } catch (error) {
      return handleApiError(error, c);
    }
  }
};

// 導出 Hono app 和傳統處理器對象
export const conversationHandler = Object.assign(conversations, handlerMethods);
export default conversations;