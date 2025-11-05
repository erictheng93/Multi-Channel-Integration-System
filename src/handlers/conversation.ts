// 使用 Drizzle ORM 和 KV 的對話處理器
import { Hono } from 'hono';
import { Context } from 'hono';
import { DatabaseService } from '../services/database';
import { databaseMiddleware, authMiddleware } from '../middleware/database';
import type { HonoContext } from '../types/bindings';
import type { Bindings } from '../types';
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
  handleApiError
} from '../utils/api-response';
import { drizzle } from 'drizzle-orm/d1';
import { sql, eq, and, desc, inArray, count, aliasedTable } from 'drizzle-orm';
import { realtime } from '@modules/realtime';
import { conversations as conversationTable, agents, conversationTransfers, teams, conversationTags } from '../db/schema';
import { requireAdmin } from '../middleware/auth';

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

// 發送訊息
conversations.post('/:id/messages', async (c) => {
  try {
    const conversationId = c.req.param('id');
    const agent = c.get('agent');
    const { content, messageType = 'text' } = await c.req.json();

    if (!content) {
      return c.json({
        success: false,
        error: 'Message content is required'
      }, 400);
    }

    if (!conversationId) {
      return c.json({
        success: false,
        error: 'Conversation ID is required'
      }, 400);
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
      }, 403);
    }

    // 檢查對話是否存在
    const conversation = await dbService.getConversationById(conversationId);
    if (!conversation) {
      return c.json({
        success: false,
        error: 'Conversation not found'
      }, 404);
    }

    // 建立訊息
    const message = await dbService.createMessage({
      conversationId,
      senderType: 'agent',
      agentSenderId: agent!.id, // Use correct schema field name
      content,
      messageType,
    });

    // 🚀 事件驅動推送：立即推送新消息事件到隊列
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
          userIds: conversation.assignedUserId ? [parseInt(conversation.assignedUserId)] : []
        },
        'high', // 消息創建是高優先級事件
        'user'
      );
      console.log(`🚀 [Message] Event queued for message ${message?.id || 'unknown'}`);
    } catch (eventError) {
      console.error('❌ [Message] Failed to queue event:', eventError);
      // 不影響消息創建的成功，只記錄錯誤
    }

    // 如果對話狀態是 pending，更新為 in-progress
    if (conversation.status === 'pending') {
      await dbService.updateConversation(conversationId, {
        status: 'in-progress',
        assignedUserId: agent!.id, // Keep as string - agents table uses TEXT id
      });

      // 🚀 推送對話狀態更新事件
      try {
        await realtime.createEvent(
          'conversation_status_changed',
          {
            conversationId: parseInt(conversationId),
            status: 'in-progress',
            assignedUserId: parseInt(agent!.id),
            customerName: conversation.customer?.displayName,
            updatedAt: new Date().toISOString(),
            changes: { status: { from: 'pending', to: 'in-progress' } }
          },
          {
            conversationId: parseInt(conversationId),
            userIds: [parseInt(agent!.id)]
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

    if (!['pending', 'in-progress', 'closed'].includes(status)) {
      return c.json({
        success: false,
        error: 'Invalid status'
      }, 400);
    }

    if (!conversationId) {
      return c.json({
        success: false,
        error: 'Conversation ID is required'
      }, 400);
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
      }, 403);
    }

    // 檢查對話是否存在
    const conversation = await dbService.getConversationById(conversationId);
    if (!conversation) {
      return c.json({
        success: false,
        error: 'Conversation not found'
      }, 404);
    }

    // 更新對話狀態
    const updates: any = { status };

    // 如果狀態變為 in-progress 且沒有指派客服，指派當前客服
    if (status === 'in-progress' && !conversation.assignedUserId) {
      updates.assignedUserId = agent!.id;
    }

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
      }, 400);
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
      }, 403);
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

// 分配對話 - 僅管理員可執行
conversations.post('/:id/assign', requireAdmin(), async (c) => {
  try {
    const conversationId = c.req.param('id');
    const agent = c.get('agent');
    const { teamId, userId, reason } = await c.req.json();
    const db = c.get('db');
    const kv = c.get('kv');
    const dbService = new DatabaseService(db, kv);

    // 管理員權限已由 requireAdmin() 中間件確認，移除冗餘檢查

    // ✅ 使用 DatabaseService.updateConversation 方法，自動處理緩存清除
    await dbService.updateConversation(conversationId, {
      assignedTeamId: teamId || null,
      assignedUserId: userId || null,
      status: 'assigned'
    });

    // 🔧 FIX: 获取更新后的完整对话对象,包括 assignedTeam 和 assignedAgent
    const updatedConversation = await dbService.getConversationById(conversationId);

    if (!updatedConversation) {
      return c.json({
        success: false,
        error: 'Failed to retrieve updated conversation'
      }, 500);
    }

    console.log('✅ [Assign API] Conversation assigned:', {
      id: conversationId,
      status: updatedConversation.status,
      assignedTeamId: updatedConversation.assignedTeamId,
      assignedTeam: updatedConversation.assignedTeam,
      assignedUserId: updatedConversation.assignedUserId
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

// 取消指派對話
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
      }, 404);
    }

    // 檢查對話是否已指派
    if (!conversation.assignedTeamId && !conversation.assignedUserId) {
      return c.json({
        success: false,
        error: 'Conversation is not assigned'
      }, 400);
    }

    // 記錄取消指派前的狀態
    const previousAssignment = {
      teamId: conversation.assignedTeamId,
      teamName: conversation.assignedTeam?.name,
      userId: conversation.assignedUserId,
      userName: conversation.assignedAgent?.name
    };

    // 取消指派：清除 teamId 和 userId，將狀態改回 'open'
    await dbService.updateConversation(conversationId, {
      assignedTeamId: null,
      assignedUserId: null,
      status: 'open'
    });

    // 獲取更新後的完整對話對象
    const updatedConversation = await dbService.getConversationById(conversationId);

    if (!updatedConversation) {
      return c.json({
        success: false,
        error: 'Failed to retrieve updated conversation'
      }, 500);
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
          previousUserId: previousAssignment.userId,
          previousUserName: previousAssignment.userName,
          reason: reason || 'No reason provided',
          unassignedBy: agent?.displayName || agent?.id,
          timestamp: Date.now()
        },
        {
          conversationId: conversationId,
          // 通知之前指派的團隊或用戶
          ...(previousAssignment.teamId && { teamId: previousAssignment.teamId }),
          ...(previousAssignment.userId && { userId: previousAssignment.userId }),
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
  const drizzleDb = drizzle(c.env.DB);
  try {
    const conversationId = c.req.param('id');
    const agent = c.get('agent');
    const {
      fromTeamId,
      toTeamId,
      fromUserId,
      toUserId,
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
      }, 403);
    }

    // 獲取當前對話資訊
    const conversation = await drizzleDb.select()
      .from(conversationTable)
      .where(eq(conversationTable.id, conversationId))
      .get();

    if (!conversation) {
      return notFoundResponse(c, 'Conversation');
    }

    // 記錄轉移歷史
    await drizzleDb.insert(conversationTransfers)
      .values({
        conversationId: conversationId,
        fromTeamId: fromTeamId || conversation.assignedTeamId,
        toTeamId: toTeamId || null,
        fromUserId: fromUserId || conversation.assignedUserId,
        toUserId: toUserId || null,
        transferReason: reason || null,
        transferredBy: payload?.userId ? (typeof payload.userId === 'string' ? payload.userId : payload.userId.toString()) : 'system',
        transferType: transferType
      });

    // 更新對話指派
    await drizzleDb.update(conversationTable)
      .set({
        assignedTeamId: toTeamId || null,
        assignedUserId: toUserId || null,
        status: 'transferred',
        updatedAt: sql`datetime('now')`
      })
      .where(eq(conversationTable.id, conversationId));

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
      }, 400);
    }

    // 檢查權限 - 確保代理可以存取此對話
    const canAccess = await dbService.canAgentAccessConversation(agent!, conversationId);
    if (!canAccess) {
      return c.json({ 
        success: false, 
        error: 'Access denied' 
      }, 403);
    }

    // 獲取對話資訊
    const conversation = await dbService.getConversationById(conversationId);
    
    if (!conversation) {
      return c.json({ 
        success: false, 
        error: 'Conversation not found' 
      }, 404);
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
    const drizzleDb = drizzle(c.env.DB);
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
    const drizzleDb = drizzle(c.env.DB);
    try {
      const conversationId = c.req.param('id');
      const { 
        toTeamId, 
        toUserId, 
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

      // 記錄轉移歷史
      await drizzleDb.insert(conversationTransfers)
        .values({
          conversationId: conversationId,
          fromTeamId: conversation.assignedTeamId,
          toTeamId: toTeamId || null,
          fromUserId: conversation.assignedUserId,
          toUserId: toUserId || null,
          transferReason: reason || null,
          transferredBy: payload?.userId ? (typeof payload.userId === 'string' ? payload.userId : payload.userId.toString()) : 'system',
          transferType: transferType
        });

      // 更新對話指派
      await drizzleDb.update(conversationTable)
        .set({
          assignedTeamId: toTeamId || null,
          assignedUserId: toUserId || null,
          status: 'transferred',
          updatedAt: sql`datetime('now')`
        })
        .where(eq(conversationTable.id, conversationId));

      return successResponse(c, null, 'Conversation transferred successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 為對話添加標籤
  async addTags(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = drizzle(c.env.DB);
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

      // 批量添加標籤
      const insertPromises = tagIds.map(tagId => 
        drizzleDb.insert(conversationTags)
          .values({
            conversationId: conversationId,
            tagId: tagId,
            assignedBy: payload?.userId ? (typeof payload.userId === 'string' ? payload.userId : payload.userId.toString()) : 'system'
          })
          .onConflictDoNothing()
      );

      await Promise.all(insertPromises);

      return successResponse(c, null, 'Tags added successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 移除對話標籤
  async removeTags(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = drizzle(c.env.DB);
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
    const drizzleDb = drizzle(c.env.DB);
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
    const drizzleDb = drizzle(c.env.DB);
    try {
      const conversationId = c.req.param('id');

      const ft = aliasedTable(teams, 'ft');
      const tt = aliasedTable(teams, 'tt');
      const fu = aliasedTable(agents, 'fu');
      const tu = aliasedTable(agents, 'tu');
      const bu = aliasedTable(agents, 'bu');
      
      const transfers = await drizzleDb
        .select({
          id: conversationTransfers.id,
          conversationId: conversationTransfers.conversationId,
          fromTeamId: conversationTransfers.fromTeamId,
          toTeamId: conversationTransfers.toTeamId,
          fromUserId: conversationTransfers.fromUserId,
          toUserId: conversationTransfers.toUserId,
          transferReason: conversationTransfers.transferReason,
          transferredBy: conversationTransfers.transferredBy,
          transferType: conversationTransfers.transferType,
          createdAt: conversationTransfers.createdAt,
          fromTeamName: ft.name,
          toTeamName: tt.name,
          fromUserName: fu.displayName,
          toUserName: tu.displayName,
          transferredByName: bu.displayName
        })
        .from(conversationTransfers)
        .leftJoin(ft, eq(conversationTransfers.fromTeamId, ft.id))
        .leftJoin(tt, eq(conversationTransfers.toTeamId, tt.id))
        .leftJoin(fu, eq(conversationTransfers.fromUserId, fu.id))
        .leftJoin(tu, eq(conversationTransfers.toUserId, tu.id))
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
        fromUser: transfer.fromUserId ? {
          id: transfer.fromUserId,
          name: transfer.fromUserName
        } : null,
        toUser: transfer.toUserId ? {
          id: transfer.toUserId,
          name: transfer.toUserName
        } : null,
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
    const drizzleDb = drizzle(c.env.DB);
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
        case 'assign':
          if (!data?.userId && !data?.teamId) {
            return validationErrorResponse(c, [
              { field: 'data', message: 'User ID or Team ID is required for assignment' }
            ]);
          }
          await drizzleDb.update(conversationTable)
            .set({
              assignedUserId: data.userId || null,
              assignedTeamId: data.teamId || null,
              status: 'assigned',
              updatedAt: sql`datetime('now')`
            })
            .where(inArray(conversationTable.id, conversationIdsArray));
          break;

        case 'close':
          await drizzleDb.update(conversationTable)
            .set({
              status: 'closed',
              updatedAt: sql`datetime('now')`
            })
            .where(inArray(conversationTable.id, conversationIdsArray));
          break;

        case 'reopen':
          await drizzleDb.update(conversationTable)
            .set({
              status: 'active',
              updatedAt: sql`datetime('now')`
            })
            .where(inArray(conversationTable.id, conversationIdsArray));
          break;

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
          // 為每個對話添加標籤
          const tagInsertPromises = [];
          for (const convId of conversationIds) {
            for (const tagId of data.tagIds) {
              tagInsertPromises.push(
                drizzleDb.insert(conversationTags)
                  .values({
                    conversationId: convId, // 保持字符串
                    tagId: parseInt(tagId),
                    assignedBy: payload?.userId ? (typeof payload.userId === 'string' ? payload.userId : payload.userId.toString()) : 'system'
                  })
                  .onConflictDoNothing()
              );
            }
          }
          await Promise.all(tagInsertPromises);
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
    const drizzleDb = drizzle(c.env.DB);
    try {
      const { strategy = 'round_robin', teamId } = await c.req.json();

      // 獲取未分配的對話 - 使用 Drizzle ORM
      const baseConditions = [
        eq(conversationTable.status, 'active'),
        sql`${conversationTable.assignedUserId} IS NULL`
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
        // 輪詢分配：找到工作量最少的客服 - 使用 Drizzle ORM
        const agentConditions = [
          eq(agents.isActive, true),
          eq(agents.role, 'agent')
        ];
        
        if (teamId) {
          agentConditions.push(eq(agents.teamId, teamId));
        }
        
        const availableAgents = await drizzleDb
          .select({
            id: agents.id,
            workload: count(conversationTable.id).as('workload')
          })
          .from(agents)
          .leftJoin(conversationTable, and(
            eq(agents.id, conversationTable.assignedUserId),
            inArray(conversationTable.status, ['active', 'assigned'])
          ))
          .where(and(...agentConditions))
          .groupBy(agents.id)
          .orderBy(sql`workload ASC`, agents.id);

        if (!availableAgents || availableAgents.length === 0) {
          return errorResponse(c, 'No available agents found', 400);
        }

        // 依序分配給工作量最少的客服
        const agentsData = availableAgents;
        let agentIndex = 0;

        for (const conv of unassignedConversations) {
          const agentId = agentsData[agentIndex]?.id;
          
          await drizzleDb.update(conversationTable)
            .set({
              assignedUserId: agentId,
              status: 'assigned',
              updatedAt: sql`datetime('now')`
            })
            .where(eq(conversationTable.id, conv.id));

          assignedCount++;
          agentIndex = (agentIndex + 1) % agentsData.length;
        }
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