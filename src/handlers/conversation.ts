// worker/src/handlers/conversation.ts
// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/src/handlers/conversation.ts
// Created by: API Handler Developer

import { Context } from 'hono';
import type { 
  Bindings, 
  QueryParams, 
  // ConversationDbRecord, // 暫時未使用
  DatabaseRow,
  // D1Result // 暫時未使用
} from '../types';
import { asString, asNumber } from '../types/database';
import { 
  successResponse, 
  paginatedResponse,
  errorResponse, 
  validationErrorResponse, 
  // unauthorizedResponse, // 暫時未使用
  notFoundResponse,
  handleApiError 
} from '../utils/api-response';
import { ActivityService } from '../services/activity-service';

/*
interface ConversationFilters {
  status?: string;
  priority?: string;
  assignedUserId?: number;
  assignedTeamId?: number;
  tagId?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  hasUnread?: boolean;
}
*/

export const conversationHandler = {
  // 取得對話列表（增強版）
  async list(c: Context<{ Bindings: Bindings }>) {
    try {
      const payload = c.get('jwtPayload');
      const { 
        page = '1', 
        pageSize = '20', 
        status,
        priority,
        assignedUserId,
        assignedTeamId,
        tagId,
        search,
        dateFrom,
        dateTo,
        hasUnread
      } = c.req.query();
      const offset = (parseInt(page) - 1) * parseInt(pageSize);

      // 建立查詢
      let query = `
        SELECT DISTINCT c.*,
               cu.display_name as user_name,
               cu.platform,
               cu.platform_user_id,
               cu.avatar_url,
               u.display_name as agent_name,
               u.email as agent_email,
               t.name as team_name,
               GROUP_CONCAT(tag.name, ',') as tag_names,
               GROUP_CONCAT(tag.color, ',') as tag_colors
        FROM conversations c
        LEFT JOIN customers cu ON c.customer_id = cu.id
        LEFT JOIN users u ON c.assigned_user_id = u.id
        LEFT JOIN teams t ON c.assigned_team_id = t.id
        LEFT JOIN conversation_tags ct ON c.id = ct.conversation_id
        LEFT JOIN tags tag ON ct.tag_id = tag.id AND tag.is_active = TRUE
      `;

      const params: QueryParams = [];
      const whereConditions: string[] = [];

      // 狀態篩選
      if (status) {
        whereConditions.push('c.status = ?');
        params.push(status);
      }

      // 優先級篩選
      if (priority) {
        whereConditions.push('c.priority = ?');
        params.push(priority);
      }

      // 指派用戶篩選
      if (assignedUserId) {
        whereConditions.push('c.assigned_user_id = ?');
        params.push(parseInt(assignedUserId));
      }

      // 指派團隊篩選
      if (assignedTeamId) {
        whereConditions.push('c.assigned_team_id = ?');
        params.push(parseInt(assignedTeamId));
      }

      // 標籤篩選
      if (tagId) {
        whereConditions.push('ct.tag_id = ?');
        params.push(parseInt(tagId));
      }

      // 搜索（客戶名稱或對話內容）
      if (search) {
        whereConditions.push(`(
          cu.display_name LIKE ? OR 
          cu.email LIKE ? OR 
          EXISTS (
            SELECT 1 FROM messages m 
            WHERE m.conversation_id = c.id AND m.content LIKE ?
          )
        )`);
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      // 日期範圍篩選
      if (dateFrom) {
        whereConditions.push('c.created_at >= ?');
        params.push(dateFrom);
      }
      if (dateTo) {
        whereConditions.push('c.created_at <= ?');
        params.push(dateTo);
      }

      // 未讀訊息篩選
      if (hasUnread === 'true') {
        whereConditions.push(`EXISTS (
          SELECT 1 FROM messages m 
          WHERE m.conversation_id = c.id 
            AND m.sender_type = 'customer' 
            AND m.created_at > COALESCE((
              SELECT MAX(created_at) 
              FROM messages m2 
              WHERE m2.conversation_id = c.id 
                AND m2.sender_type = 'agent'
            ), '1970-01-01')
        )`);
      }

      // 權限控制：非管理員只能看到分配給自己或自己團隊的對話
      if (payload && payload.role !== 'admin') {
        whereConditions.push('(c.assigned_user_id = ? OR c.assigned_team_id = ?)');
        params.push(payload.userId, payload.teamId);
      }

      if (whereConditions.length > 0) {
        query += ' WHERE ' + whereConditions.join(' AND ');
      }

      query += ` 
        GROUP BY c.id 
        ORDER BY 
          CASE c.priority 
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            WHEN 'low' THEN 4
            ELSE 5
          END,
          c.last_message_at DESC 
        LIMIT ? OFFSET ?
      `;
      params.push(parseInt(pageSize), offset);

      // 執行查詢
      const conversations = await c.env.DB.prepare(query).bind(...params).all();

      // 計算總數
      let countQuery = `
        SELECT COUNT(DISTINCT c.id) as total 
        FROM conversations c
        LEFT JOIN customers cu ON c.customer_id = cu.id
        LEFT JOIN conversation_tags ct ON c.id = ct.conversation_id
        LEFT JOIN tags tag ON ct.tag_id = tag.id AND tag.is_active = TRUE
      `;
      if (whereConditions.length > 0) {
        countQuery += ' WHERE ' + whereConditions.join(' AND ');
      }

      const countParams = params.slice(0, -2); // 移除 LIMIT 和 OFFSET 參數
      const countResult = await c.env.DB.prepare(countQuery).bind(...countParams).first();

      // 計算未讀數（可選：為了性能可以先設為 0，後續優化）
      const conversationIds = conversations?.results ? conversations.results.map((conv: DatabaseRow) => asNumber(conv.id)) : [];
      const unreadCounts: Record<string, number> = {};

      if (conversationIds.length > 0) {
        const placeholders = conversationIds.map(() => '?').join(',');
        const unreadQuery = await c.env.DB.prepare(`
          SELECT conversation_id, COUNT(*) as unread_count
          FROM messages 
          WHERE conversation_id IN (${placeholders}) 
            AND sender_type = 'customer' 
            AND created_at > COALESCE((
              SELECT MAX(created_at) 
              FROM messages m2 
              WHERE m2.conversation_id = messages.conversation_id 
                AND m2.sender_type = 'agent'
            ), '1970-01-01')
          GROUP BY conversation_id
        `).bind(...conversationIds).all();

        if (unreadQuery?.results) {
          unreadQuery.results.forEach((row: DatabaseRow) => {
            unreadCounts[asString(row.conversation_id)] = asNumber(row.unread_count);
          });
        }
      }

      // 格式化結果
      const formattedConversations = conversations?.results ? conversations.results.map((conv: DatabaseRow) => ({
        id: String(conv.id),
        userId: String(conv.customer_id),
        user: conv.user_name ? {
          id: String(conv.customer_id),
          name: conv.user_name,
          platform: conv.platform,
          platformUserId: conv.platform_user_id,
          avatarUrl: conv.avatar_url,
          createdAt: Date.now()
        } : null,
        assignedTo: conv.assigned_user_id ? String(conv.assigned_user_id) : undefined,
        assignedAgent: conv.assigned_user_id ? {
          id: String(conv.assigned_user_id),
          name: conv.agent_name,
          email: conv.agent_email,
          role: 'agent' as const,
          isActive: true,
          createdAt: Date.now()
        } : null,
        assignedTeam: conv.assigned_team_id ? {
          id: conv.assigned_team_id,
          name: conv.team_name
        } : null,
        status: conv.status === 'active' ? 'open' :
          conv.status === 'pending' ? 'assigned' : 'closed',
        priority: conv.priority || 'normal',
        tags: conv.tag_names ? conv.tag_names.split(',').map((name: string, index: number) => ({
          name,
          color: conv.tag_colors?.split(',')[index] || '#3B82F6'
        })) : [],
        lastMessageAt: conv.last_message_at ?
          new Date(String(conv.last_message_at)).getTime() :
          new Date(String(conv.created_at)).getTime(),
        unreadCount: unreadCounts[conv.id] || 0,
        createdAt: new Date(String(conv.created_at)).getTime(),
        updatedAt: new Date(String(conv.updated_at)).getTime(),
        internalNotes: conv.internal_notes
      })) : [];

      return paginatedResponse(c, formattedConversations, {
        page: parseInt(page),
        limit: parseInt(pageSize),
        total: (countResult?.total as number) || 0
      }, 'Conversations retrieved successfully');

    } catch (error) {
      console.error('Failed to get conversations:', error);
      return errorResponse(c, 'Failed to get conversations', 500);
    }
  },

  // 取得單一對話
  async get(c: Context<{ Bindings: Bindings }>) {
    try {
      const conversationId = c.req.param('id');

      const conversation = await c.env.DB.prepare(`
        SELECT c.*,
               cu.display_name as user_name,
               cu.platform,
               cu.platform_user_id,
               cu.avatar_url,
               u.displayName as agent_name,
               u.email as agent_email
        FROM conversations c
        LEFT JOIN customers cu ON c.customer_id = cu.id
        LEFT JOIN users u ON c.assigned_user_id = u.id
        WHERE c.id = ?
      `).bind(conversationId).first();

      if (!conversation) {
        return notFoundResponse(c, 'Conversation');
      }

      // 計算未讀數
      const unreadResult = await c.env.DB.prepare(`
        SELECT COUNT(*) as unread_count
        FROM messages 
        WHERE conversation_id = ? 
          AND sender_type = 'customer' 
          AND created_at > COALESCE((
            SELECT MAX(created_at) 
            FROM messages m2 
            WHERE m2.conversation_id = ? 
              AND m2.sender_type = 'agent'
          ), '1970-01-01')
      `).bind(conversationId, conversationId).first();

      return successResponse(c, {
        id: String(conversation.id),
        userId: String(conversation.customer_id),
        user: conversation.user_name ? {
          id: String(conversation.customer_id),
          name: conversation.user_name,
          platform: conversation.platform,
          platformUserId: conversation.platform_user_id,
          avatarUrl: conversation.avatar_url,
          createdAt: Date.now()
        } : null,
        assignedTo: conversation.assigned_user_id ? String(conversation.assigned_user_id) : undefined,
        assignedAgent: conversation.assigned_user_id ? {
          id: String(conversation.assigned_user_id),
          name: conversation.agent_name,
          email: conversation.agent_email,
          role: 'agent' as const,
          isActive: true,
          createdAt: Date.now()
        } : null,
        status: conversation.status === 'active' ? 'open' :
          conversation.status === 'pending' ? 'assigned' : 'closed',
        lastMessageAt: conversation.last_message_at ?
          new Date(String(conversation.last_message_at)).getTime() :
          new Date(String(conversation.created_at)).getTime(),
        unreadCount: unreadResult?.unread_count || 0,
        createdAt: new Date(String(conversation.created_at)).getTime(),
        updatedAt: new Date(String(conversation.updated_at)).getTime()
      });

    } catch (error) {
      console.error('Failed to get conversation:', error);
      return errorResponse(c, 'Failed to get conversation', 500);
    }
  },

  // 指派對話
  async assign(c: Context<{ Bindings: Bindings }>) {
    try {
      const conversationId = c.req.param('id');
      const { agentId } = await c.req.json();
      const payload = c.get('jwtPayload');

      // 如果沒有指定 agentId，則指派給當前用戶
      const assignToId = agentId || payload?.userId;

      if (!assignToId) {
        return errorResponse(c, 'Agent ID is required', 400);
      }

      // 獲取原始對話資訊
      const originalConversation = await c.env.DB.prepare(`
        SELECT assigned_user_id, status FROM conversations WHERE id = ?
      `).bind(conversationId).first<{ assigned_user_id: string | null; status: string }>();

      // 更新對話
      await c.env.DB.prepare(`
        UPDATE conversations 
        SET assigned_user_id = ?, status = 'pending', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(assignToId, conversationId).run();

      // 記錄活動
      const activityService = new ActivityService(c.env.DB);
      const isTransfer = originalConversation?.assigned_user_id && 
                        originalConversation.assigned_user_id !== assignToId;
      
      await activityService.logActivity({
        userId: payload?.userId || 'system',
        userName: payload?.username || 'System',
        userRole: payload?.role || 'system',
        action: isTransfer ? 'conversation_transfer' : 'conversation_assign',
        resourceType: 'conversation',
        resourceId: conversationId,
        details: {
          fromAgent: originalConversation?.assigned_user_id,
          toAgent: assignToId,
          previousStatus: originalConversation?.status
        },
        ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || undefined,
        userAgent: c.req.header('User-Agent') || undefined
      });

      return successResponse(c, null, 'Conversation assigned successfully');

    } catch (error) {
      console.error('Failed to assign conversation:', error);
      return errorResponse(c, 'Failed to assign conversation', 500);
    }
  },

  // 關閉對話
  async close(c: Context<{ Bindings: Bindings }>) {
    try {
      const conversationId = c.req.param('id');
      const payload = c.get('jwtPayload');

      // 獲取對話資訊
      const conversation = await c.env.DB.prepare(`
        SELECT assigned_user_id, status FROM conversations WHERE id = ?
      `).bind(conversationId).first<{ assigned_user_id: string | null; status: string }>();

      await c.env.DB.prepare(`
        UPDATE conversations 
        SET status = 'closed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(conversationId).run();

      // 記錄對話關閉活動
      if (payload) {
        const activityService = new ActivityService(c.env.DB);
        await activityService.logActivity({
          userId: payload.userId.toString(),
          userName: payload.username || 'User',
          userRole: payload.role,
          action: 'conversation_close',
          resourceType: 'conversation',
          resourceId: conversationId,
          details: {
            previousStatus: conversation?.status,
            assignedAgent: conversation?.assigned_user_id
          },
          ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
          userAgent: c.req.header('User-Agent')
        });
      }

      return successResponse(c, null, 'Conversation closed successfully');

    } catch (error) {
      console.error('Failed to close conversation:', error);
      return errorResponse(c, 'Failed to close conversation', 500);
    }
  },

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

      const transferHistory = transfers?.results ? transfers.results.map((transfer: DatabaseRow) => ({
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

      } else if (strategy === 'skill_based') {
        // 基於技能的分配（這裡可以根據標籤或客戶類型進行智能分配）
        // 簡化實現：根據對話的標籤匹配客服
        for (const conv of unassignedConversations.results.slice(0, 10)) {
          // 獲取對話標籤
          const conversationTags = await c.env.DB.prepare(`
            SELECT tag_id FROM conversation_tags WHERE conversation_id = ?
          `).bind(conv.id).all();

          if (conversationTags?.results && conversationTags.results.length > 0) {
            // 找到有相關技能的客服（簡化邏輯）
            const skillBasedAgent = await c.env.DB.prepare(`
              SELECT u.id, COUNT(c.id) as workload
              FROM users u
              LEFT JOIN conversations c ON u.id = c.assigned_user_id AND c.status IN ('active', 'assigned')
              WHERE u.is_active = TRUE AND u.role = 'agent'
              ${teamId ? 'AND u.team_id = ?' : ''}
              GROUP BY u.id
              ORDER BY workload ASC
              LIMIT 1
            `).bind(...(teamId ? [teamId] : [])).first();

            if (skillBasedAgent) {
              await c.env.DB.prepare(`
                UPDATE conversations 
                SET assigned_user_id = ?, status = 'assigned', updated_at = datetime('now')
                WHERE id = ?
              `).bind(skillBasedAgent.id, conv.id).run();

              assignedCount++;
            }
          }
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