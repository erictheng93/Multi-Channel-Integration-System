// src/handlers/tag.ts
// 標籤系統管理 - CRUD 操作、標籤關聯管理

import { Context } from 'hono';
import type { Bindings } from '../types';
import { 
  successResponse, 
  paginatedResponse,
  // errorResponse, 
  validationErrorResponse, 
  unauthorizedResponse,
  notFoundResponse,
  handleApiError 
} from '../utils/api-response';

interface TagWithStats {
  id: number;
  name: string;
  color: string;
  description?: string;
  teamId?: number;
  teamName?: string;
  isActive: boolean;
  createdBy?: number;
  createdByName?: string;
  customerCount: number;
  conversationCount: number;
  createdAt: string;
  updatedAt: string;
}

export const tagHandler = {
  // 獲取標籤列表
  async list(c: Context<{ Bindings: Bindings }>) {
    try {
      const payload = c.get('jwtPayload');
      const { 
        page = '1', 
        pageSize = '50',
        teamId,
        search,
        includeGlobal = 'true'
      } = c.req.query();

      const offset = (parseInt(page) - 1) * parseInt(pageSize);
      const limit = parseInt(pageSize);

      let query = `
        SELECT t.*,
               team.name as team_name,
               creator.display_name as created_by_name,
               COALESCE(customer_count.count, 0) as customer_count,
               COALESCE(conversation_count.count, 0) as conversation_count
        FROM tags t
        LEFT JOIN teams team ON t.team_id = team.id
        LEFT JOIN users creator ON t.created_by = creator.id
        LEFT JOIN (
          SELECT tag_id, COUNT(DISTINCT customer_id) as count
          FROM customer_tags
          GROUP BY tag_id
        ) customer_count ON t.id = customer_count.tag_id
        LEFT JOIN (
          SELECT tag_id, COUNT(DISTINCT conversation_id) as count
          FROM conversation_tags
          GROUP BY tag_id
        ) conversation_count ON t.id = conversation_count.tag_id
      `;

      const whereConditions: string[] = [];
      const params: any[] = [];

      // 只顯示活躍標籤
      whereConditions.push('t.is_active = TRUE');

      // 團隊篩選
      if (teamId) {
        if (includeGlobal === 'true') {
          whereConditions.push('(t.team_id = ? OR t.team_id IS NULL)');
          params.push(parseInt(teamId));
        } else {
          whereConditions.push('t.team_id = ?');
          params.push(parseInt(teamId));
        }
      } else if (payload?.teamId && payload?.role !== 'admin') {
        // 非管理員只能看到自己團隊的標籤和全局標籤
        if (includeGlobal === 'true') {
          whereConditions.push('(t.team_id = ? OR t.team_id IS NULL)');
          params.push(payload.teamId);
        } else {
          whereConditions.push('t.team_id = ?');
          params.push(payload.teamId);
        }
      }

      // 搜索
      if (search) {
        whereConditions.push('(t.name LIKE ? OR t.description LIKE ?)');
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm);
      }

      if (whereConditions.length > 0) {
        query += ' WHERE ' + whereConditions.join(' AND ');
      }

      query += ' ORDER BY customer_count DESC, t.name ASC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const result = await c.env.DB.prepare(query).bind(...params).all();

      // 計算總數
      let countQuery = 'SELECT COUNT(*) as total FROM tags t';
      if (whereConditions.length > 0) {
        countQuery += ' WHERE ' + whereConditions.join(' AND ');
      }

      const countParams = params.slice(0, -2); // 移除 LIMIT 和 OFFSET
      const countResult = await c.env.DB.prepare(countQuery).bind(...countParams).first();

      const tags: TagWithStats[] = result.results.map((row: any) => ({
        id: row.id,
        name: row.name,
        color: row.color,
        description: row.description,
        teamId: row.team_id,
        teamName: row.team_name,
        isActive: Boolean(row.is_active),
        createdBy: row.created_by,
        createdByName: row.created_by_name,
        customerCount: row.customer_count,
        conversationCount: row.conversation_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      return paginatedResponse(c, tags, {
        page: parseInt(page),
        limit,
        total: (countResult?.total as number) || 0
      }, 'Tags retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 創建標籤
  async create(c: Context<{ Bindings: Bindings }>) {
    try {
      const payload = c.get('jwtPayload');
      const { name, color = '#3B82F6', description, teamId } = await c.req.json();

      // 驗證必填欄位
      if (!name || !name.trim()) {
        return validationErrorResponse(c, [
          { field: 'name', message: 'Tag name is required' }
        ]);
      }

      // 驗證權限：只有管理員可以創建全局標籤
      if (!teamId && payload?.role !== 'admin') {
        return unauthorizedResponse(c, 'Only administrators can create global tags');
      }

      // 檢查標籤名稱是否已存在（同一團隊內）
      const existingTag = await c.env.DB.prepare(`
        SELECT id FROM tags 
        WHERE name = ? AND team_id ${teamId ? '= ?' : 'IS NULL'} AND is_active = TRUE
      `).bind(name, ...(teamId ? [teamId] : [])).first();

      if (existingTag) {
        return validationErrorResponse(c, [
          { field: 'name', message: 'Tag name already exists in this scope' }
        ]);
      }

      // 創建標籤
      const result = await c.env.DB.prepare(`
        INSERT INTO tags (name, color, description, team_id, created_by)
        VALUES (?, ?, ?, ?, ?)
        RETURNING *
      `).bind(
        name.trim(),
        color,
        description || null,
        teamId || null,
        payload?.userId
      ).run();

      if (!result.success) {
        throw new Error('Failed to create tag');
      }

      return successResponse(c, {
        id: result.meta?.last_row_id,
        name: name.trim(),
        color,
        description,
        teamId: teamId || null,
        isActive: true,
        createdBy: payload?.userId,
        customerCount: 0,
        conversationCount: 0
      }, 'Tag created successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取單一標籤詳情
  async get(c: Context<{ Bindings: Bindings }>) {
    try {
      const tagId = c.req.param('id');

      const tag = await c.env.DB.prepare(`
        SELECT t.*,
               team.name as team_name,
               creator.display_name as created_by_name,
               COALESCE(customer_count.count, 0) as customer_count,
               COALESCE(conversation_count.count, 0) as conversation_count
        FROM tags t
        LEFT JOIN teams team ON t.team_id = team.id
        LEFT JOIN users creator ON t.created_by = creator.id
        LEFT JOIN (
          SELECT tag_id, COUNT(DISTINCT customer_id) as count
          FROM customer_tags
          WHERE tag_id = ?
        ) customer_count ON t.id = customer_count.tag_id
        LEFT JOIN (
          SELECT tag_id, COUNT(DISTINCT conversation_id) as count
          FROM conversation_tags
          WHERE tag_id = ?
        ) conversation_count ON t.id = conversation_count.tag_id
        WHERE t.id = ?
      `).bind(tagId, tagId, tagId).first();

      if (!tag) {
        return notFoundResponse(c, 'Tag');
      }

      return successResponse(c, {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        description: tag.description,
        teamId: tag.team_id,
        teamName: tag.team_name,
        isActive: Boolean(tag.is_active),
        createdBy: tag.created_by,
        createdByName: tag.created_by_name,
        customerCount: tag.customer_count,
        conversationCount: tag.conversation_count,
        createdAt: tag.created_at,
        updatedAt: tag.updated_at
      }, 'Tag retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 更新標籤
  async update(c: Context<{ Bindings: Bindings }>) {
    try {
      const tagId = c.req.param('id');
      const { name, color, description, isActive } = await c.req.json();
      const payload = c.get('jwtPayload');

      // 檢查標籤是否存在
      const existingTag = await c.env.DB.prepare(`
        SELECT * FROM tags WHERE id = ?
      `).bind(tagId).first();

      if (!existingTag) {
        return notFoundResponse(c, 'Tag');
      }

      // 權限檢查：非管理員只能編輯自己團隊的標籤
      if (payload?.role !== 'admin' && existingTag.team_id !== payload?.teamId) {
        return unauthorizedResponse(c, 'You can only edit tags from your team');
      }

      // 如果更新名稱，檢查是否重複
      if (name && name !== existingTag.name) {
        const duplicateTag = await c.env.DB.prepare(`
          SELECT id FROM tags 
          WHERE name = ? AND team_id ${existingTag.team_id ? '= ?' : 'IS NULL'} 
          AND id != ? AND is_active = TRUE
        `).bind(
          name, 
          ...(existingTag.team_id ? [existingTag.team_id] : []), 
          tagId
        ).first();

        if (duplicateTag) {
          return validationErrorResponse(c, [
            { field: 'name', message: 'Tag name already exists in this scope' }
          ]);
        }
      }

      // 更新標籤
      await c.env.DB.prepare(`
        UPDATE tags 
        SET name = COALESCE(?, name),
            color = COALESCE(?, color),
            description = COALESCE(?, description),
            is_active = COALESCE(?, is_active),
            updated_at = datetime('now')
        WHERE id = ?
      `).bind(
        name || null,
        color || null,
        description !== undefined ? description : null,
        isActive !== undefined ? isActive : null,
        tagId
      ).run();

      return successResponse(c, null, 'Tag updated successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 刪除標籤（軟刪除）
  async delete(c: Context<{ Bindings: Bindings }>) {
    try {
      const tagId = c.req.param('id');
      const payload = c.get('jwtPayload');

      // 檢查標籤是否存在
      const existingTag = await c.env.DB.prepare(`
        SELECT * FROM tags WHERE id = ?
      `).bind(tagId).first();

      if (!existingTag) {
        return notFoundResponse(c, 'Tag');
      }

      // 權限檢查
      if (payload?.role !== 'admin' && existingTag.team_id !== payload?.teamId) {
        return unauthorizedResponse(c, 'You can only delete tags from your team');
      }

      // 軟刪除標籤
      await c.env.DB.prepare(`
        UPDATE tags 
        SET is_active = FALSE, updated_at = datetime('now')
        WHERE id = ?
      `).bind(tagId).run();

      return successResponse(c, null, 'Tag deleted successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取標籤使用統計
  async getUsageStats(c: Context<{ Bindings: Bindings }>) {
    try {
      const tagId = c.req.param('id');

      // 檢查標籤是否存在
      const tag = await c.env.DB.prepare(`
        SELECT * FROM tags WHERE id = ?
      `).bind(tagId).first();

      if (!tag) {
        return notFoundResponse(c, 'Tag');
      }

      // 客戶使用統計
      const customerStats = await c.env.DB.prepare(`
        SELECT 
          COUNT(*) as total_customers,
          COUNT(CASE WHEN c.platform = 'line' THEN 1 END) as line_customers,
          COUNT(CASE WHEN c.platform = 'facebook' THEN 1 END) as facebook_customers
        FROM customer_tags ct
        JOIN customers c ON ct.customer_id = c.id
        WHERE ct.tag_id = ?
      `).bind(tagId).first();

      // 對話使用統計
      const conversationStats = await c.env.DB.prepare(`
        SELECT 
          COUNT(*) as total_conversations,
          COUNT(CASE WHEN conv.status = 'active' THEN 1 END) as active_conversations,
          COUNT(CASE WHEN conv.status = 'closed' THEN 1 END) as closed_conversations
        FROM conversation_tags ct
        JOIN conversations conv ON ct.conversation_id = conv.id
        WHERE ct.tag_id = ?
      `).bind(tagId).first();

      // 最近使用趨勢（最近30天）
      const usageTrend = await c.env.DB.prepare(`
        SELECT 
          DATE(ct.assigned_at) as date,
          COUNT(*) as assignments
        FROM customer_tags ct
        WHERE ct.tag_id = ? 
        AND ct.assigned_at >= date('now', '-30 days')
        GROUP BY DATE(ct.assigned_at)
        ORDER BY date DESC
        LIMIT 30
      `).bind(tagId).all();

      // 最活躍的使用者
      const topAssigners = await c.env.DB.prepare(`
        SELECT 
          u.display_name,
          COUNT(*) as assignments
        FROM customer_tags ct
        JOIN users u ON ct.assigned_by = u.id
        WHERE ct.tag_id = ?
        AND ct.assigned_at >= date('now', '-30 days')
        GROUP BY ct.assigned_by, u.display_name
        ORDER BY assignments DESC
        LIMIT 10
      `).bind(tagId).all();

      return successResponse(c, {
        tagInfo: {
          id: tag.id,
          name: tag.name,
          color: tag.color
        },
        customers: {
          total: customerStats?.total_customers || 0,
          byPlatform: {
            line: customerStats?.line_customers || 0,
            facebook: customerStats?.facebook_customers || 0
          }
        },
        conversations: {
          total: conversationStats?.total_conversations || 0,
          active: conversationStats?.active_conversations || 0,
          closed: conversationStats?.closed_conversations || 0
        },
        usageTrend: usageTrend.results.map((row: any) => ({
          date: row.date,
          assignments: row.assignments
        })),
        topAssigners: topAssigners.results.map((row: any) => ({
          name: row.display_name,
          assignments: row.assignments
        }))
      }, 'Tag usage statistics retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 批量操作標籤
  async bulkOperation(c: Context<{ Bindings: Bindings }>) {
    try {
      const { operation, tagIds, data } = await c.req.json();
      // const payload = c.get('jwtPayload');

      if (!Array.isArray(tagIds) || tagIds.length === 0) {
        return validationErrorResponse(c, [
          { field: 'tagIds', message: 'Tag IDs array is required' }
        ]);
      }

      const placeholders = tagIds.map(() => '?').join(',');

      switch (operation) {
        case 'activate':
          await c.env.DB.prepare(`
            UPDATE tags 
            SET is_active = TRUE, updated_at = datetime('now')
            WHERE id IN (${placeholders})
          `).bind(...tagIds).run();
          break;

        case 'deactivate':
          await c.env.DB.prepare(`
            UPDATE tags 
            SET is_active = FALSE, updated_at = datetime('now')
            WHERE id IN (${placeholders})
          `).bind(...tagIds).run();
          break;

        case 'update_color':
          if (!data?.color) {
            return validationErrorResponse(c, [
              { field: 'data.color', message: 'Color is required for color update' }
            ]);
          }
          await c.env.DB.prepare(`
            UPDATE tags 
            SET color = ?, updated_at = datetime('now')
            WHERE id IN (${placeholders})
          `).bind(data.color, ...tagIds).run();
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
  }
};