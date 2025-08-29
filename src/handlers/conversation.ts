// 使用 Drizzle ORM 和 KV 的對話處理器
import { Hono } from 'hono';
import { Context } from 'hono';
import { DatabaseService } from '../services/database';
import { databaseMiddleware, authMiddleware } from '../middleware/database';
import type { HonoContext, Bindings } from '../types/bindings';
import { 
  successResponse, 
  errorResponse, 
  validationErrorResponse, 
  notFoundResponse,
  handleApiError 
} from '../utils/api-response';

const conversations = new Hono<HonoContext>();

// Apply middleware
conversations.use('*', databaseMiddleware);
conversations.use('*', authMiddleware);

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
    // const offset = (pageNum - 1) * limitNum; // 暫時未使用

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
    console.error('Get conversations error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal server error' 
    }, 500);
  }
});

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
    console.error('Get conversation error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal server error' 
    }, 500);
  }
});

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

    // 如果對話狀態是 pending，更新為 in-progress
    if (conversation.status === 'pending') {
      await dbService.updateConversation(conversationId, {
        status: 'in-progress',
        assignedUserId: agent!.id, // Keep as string - agents table uses TEXT id
      });
    }

    return c.json({
      success: true,
      data: message
    });

  } catch (error) {
    console.error('Send message error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal server error' 
    }, 500);
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
    console.error('Update conversation status error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal server error' 
    }, 500);
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
    console.error('Mark messages as read error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal server error' 
    }, 500);
  }
});

// 傳統處理器方法（為了向後兼容）
const handlerMethods = {
  // 設定對話優先級
  async setPriority(c: Context<{ Bindings: Bindings }>) {
    try {
      const conversationId = c.req.param('id');
      const { priority } = await c.req.json();

      const validPriorities = ['low', 'normal', 'high', 'urgent'];
      if (!validPriorities.includes(priority)) {
        return validationErrorResponse(c, [
          { field: 'priority', message: 'Invalid priority level' }
        ]);
      }

      await c.env.DB.prepare(`
        UPDATE conversations 
        SET priority = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(priority, conversationId).run();

      return successResponse(c, null, 'Conversation priority updated successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 轉移對話
  async transfer(c: Context<{ Bindings: Bindings }>) {
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
      const conversation = await c.env.DB.prepare(`
        SELECT * FROM conversations WHERE id = ?
      `).bind(conversationId).first();

      if (!conversation) {
        return notFoundResponse(c, 'Conversation');
      }

      // 記錄轉移歷史
      await c.env.DB.prepare(`
        INSERT INTO conversation_transfers 
        (conversation_id, from_team_id, to_team_id, from_user_id, to_user_id, 
         transfer_reason, transferred_by, transfer_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        conversationId,
        conversation.assigned_team_id,
        toTeamId || null,
        conversation.assigned_user_id,
        toUserId || null,
        reason || null,
        payload?.userId,
        transferType
      ).run();

      // 更新對話指派
      await c.env.DB.prepare(`
        UPDATE conversations 
        SET assigned_team_id = ?, assigned_user_id = ?, 
            status = 'transferred', updated_at = datetime('now')
        WHERE id = ?
      `).bind(toTeamId || null, toUserId || null, conversationId).run();

      return successResponse(c, null, 'Conversation transferred successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 為對話添加標籤
  async addTags(c: Context<{ Bindings: Bindings }>) {
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
      const conversation = await c.env.DB.prepare(`
        SELECT id FROM conversations WHERE id = ?
      `).bind(conversationId).first();

      if (!conversation) {
        return notFoundResponse(c, 'Conversation');
      }

      // 批量添加標籤
      const insertPromises = tagIds.map(tagId => 
        c.env.DB.prepare(`
          INSERT OR IGNORE INTO conversation_tags (conversation_id, tag_id, assigned_by)
          VALUES (?, ?, ?)
        `).bind(conversationId, tagId, payload?.userId).run()
      );

      await Promise.all(insertPromises);

      return successResponse(c, null, 'Tags added successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 移除對話標籤
  async removeTags(c: Context<{ Bindings: Bindings }>) {
    try {
      const conversationId = c.req.param('id');
      const { tagIds } = await c.req.json();

      if (!Array.isArray(tagIds) || tagIds.length === 0) {
        return validationErrorResponse(c, [
          { field: 'tagIds', message: 'Tag IDs array is required' }
        ]);
      }

      const placeholders = tagIds.map(() => '?').join(',');
      await c.env.DB.prepare(`
        DELETE FROM conversation_tags 
        WHERE conversation_id = ? AND tag_id IN (${placeholders})
      `).bind(conversationId, ...tagIds).run();

      return successResponse(c, null, 'Tags removed successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 設定內部備註
  async setNotes(c: Context<{ Bindings: Bindings }>) {
    try {
      const conversationId = c.req.param('id');
      const { notes } = await c.req.json();

      await c.env.DB.prepare(`
        UPDATE conversations 
        SET internal_notes = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(notes || null, conversationId).run();

      return successResponse(c, null, 'Internal notes updated successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取對話轉移歷史
  async getTransferHistory(c: Context<{ Bindings: Bindings }>) {
    try {
      const conversationId = c.req.param('id');

      const transfers = await c.env.DB.prepare(`
        SELECT ct.*, 
               ft.name as from_team_name, 
               tt.name as to_team_name,
               fu.display_name as from_user_name, 
               tu.display_name as to_user_name,
               bu.display_name as transferred_by_name
        FROM conversation_transfers ct
        LEFT JOIN teams ft ON ct.from_team_id = ft.id
        LEFT JOIN teams tt ON ct.to_team_id = tt.id
        LEFT JOIN users fu ON ct.from_user_id = fu.id
        LEFT JOIN users tu ON ct.to_user_id = tu.id
        LEFT JOIN users bu ON ct.transferred_by = bu.id
        WHERE ct.conversation_id = ?
        ORDER BY ct.created_at DESC
      `).bind(conversationId).all();

      const transferHistory = transfers?.results ? transfers.results.map((transfer: any) => ({
        id: transfer.id,
        fromTeam: transfer.from_team_id ? {
          id: transfer.from_team_id,
          name: transfer.from_team_name
        } : null,
        toTeam: transfer.to_team_id ? {
          id: transfer.to_team_id,
          name: transfer.to_team_name
        } : null,
        fromUser: transfer.from_user_id ? {
          id: transfer.from_user_id,
          name: transfer.from_user_name
        } : null,
        toUser: transfer.to_user_id ? {
          id: transfer.to_user_id,
          name: transfer.to_user_name
        } : null,
        reason: transfer.transfer_reason,
        transferredBy: {
          id: transfer.transferred_by,
          name: transfer.transferred_by_name
        },
        transferType: transfer.transfer_type,
        createdAt: transfer.created_at
      })) : [];

      return successResponse(c, transferHistory, 'Transfer history retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 批量操作對話  
  async bulkOperation(c: Context<{ Bindings: Bindings }>) {
    try {
      const { operation, conversationIds, data } = await c.req.json();
      const payload = c.get('jwtPayload');

      if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
        return validationErrorResponse(c, [
          { field: 'conversationIds', message: 'Conversation IDs array is required' }
        ]);
      }

      const placeholders = conversationIds.map(() => '?').join(',');

      switch (operation) {
        case 'assign':
          if (!data?.userId && !data?.teamId) {
            return validationErrorResponse(c, [
              { field: 'data', message: 'User ID or Team ID is required for assignment' }
            ]);
          }
          await c.env.DB.prepare(`
            UPDATE conversations 
            SET assigned_user_id = ?, assigned_team_id = ?, 
                status = 'assigned', updated_at = datetime('now')
            WHERE id IN (${placeholders})
          `).bind(data.userId || null, data.teamId || null, ...conversationIds).run();
          break;

        case 'close':
          await c.env.DB.prepare(`
            UPDATE conversations 
            SET status = 'closed', updated_at = datetime('now')
            WHERE id IN (${placeholders})
          `).bind(...conversationIds).run();
          break;

        case 'reopen':
          await c.env.DB.prepare(`
            UPDATE conversations 
            SET status = 'active', updated_at = datetime('now')
            WHERE id IN (${placeholders})
          `).bind(...conversationIds).run();
          break;

        case 'set_priority':
          if (!data?.priority) {
            return validationErrorResponse(c, [
              { field: 'data.priority', message: 'Priority is required' }
            ]);
          }
          await c.env.DB.prepare(`
            UPDATE conversations 
            SET priority = ?, updated_at = datetime('now')
            WHERE id IN (${placeholders})
          `).bind(data.priority, ...conversationIds).run();
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
                c.env.DB.prepare(`
                  INSERT OR IGNORE INTO conversation_tags (conversation_id, tag_id, assigned_by)
                  VALUES (?, ?, ?)
                `).bind(convId, tagId, payload?.userId).run()
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
    try {
      const { strategy = 'round_robin', teamId } = await c.req.json();

      // 獲取未分配的對話
      const unassignedConversations = await c.env.DB.prepare(`
        SELECT id FROM conversations 
        WHERE status = 'active' AND assigned_user_id IS NULL
        ${teamId ? 'AND (assigned_team_id = ? OR assigned_team_id IS NULL)' : ''}
        ORDER BY created_at ASC
        LIMIT 50
      `).bind(...(teamId ? [teamId] : [])).all();

      if (!unassignedConversations?.results || unassignedConversations.results.length === 0) {
        return successResponse(c, { assigned: 0 }, 'No unassigned conversations found');
      }

      let assignedCount = 0;

      if (strategy === 'round_robin') {
        // 輪詢分配：找到工作量最少的客服
        const availableAgents = await c.env.DB.prepare(`
          SELECT u.id, COUNT(c.id) as workload
          FROM users u
          LEFT JOIN conversations c ON u.id = c.assigned_user_id AND c.status IN ('active', 'assigned')
          WHERE u.is_active = TRUE AND u.role = 'agent'
          ${teamId ? 'AND u.team_id = ?' : ''}
          GROUP BY u.id
          ORDER BY workload ASC, u.id ASC
        `).bind(...(teamId ? [teamId] : [])).all();

        if (!availableAgents?.results || availableAgents.results.length === 0) {
          return errorResponse(c, 'No available agents found', 400);
        }

        // 依序分配給工作量最少的客服
        const agents = availableAgents.results;
        let agentIndex = 0;

        for (const conv of unassignedConversations.results) {
          const agentId = agents[agentIndex]?.id;
          
          await c.env.DB.prepare(`
            UPDATE conversations 
            SET assigned_user_id = ?, status = 'assigned', updated_at = datetime('now')
            WHERE id = ?
          `).bind(agentId, conv.id).run();

          assignedCount++;
          agentIndex = (agentIndex + 1) % agents.length;
        }
      }

      return successResponse(c, { 
        assigned: assignedCount,
        strategy,
        total: unassignedConversations?.results?.length || 0 
      }, `Auto assignment completed`);

    } catch (error) {
      return handleApiError(error, c);
    }
  }
};

// 導出 Hono app 和傳統處理器對象
export const conversationHandler = Object.assign(conversations, handlerMethods);
export default conversations;