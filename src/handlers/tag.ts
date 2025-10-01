// src/handlers/tag.ts
// 標籤系統管理 - CRUD 操作、標籤關聯管理

import { Context } from 'hono';
import type { Bindings } from '../types';
import { 
  successResponse, 
  paginatedResponse,
  errorResponse, 
  validationErrorResponse, 
  unauthorizedResponse,
  notFoundResponse,
  handleApiError 
} from '../utils/api-response';
import { tags } from '../db/schema';
import { drizzle } from 'drizzle-orm/d1';
import { sql, eq, and, or, asc, like, count, isNull } from 'drizzle-orm';


export const tagHandler = {
  // 獲取標籤列表
  async list(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = drizzle(c.env.DB);
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

      // Build a simplified query without complex joins for now
      let query = drizzleDb
        .select({
          id: tags.id,
          name: tags.name,
          color: tags.color,
          description: tags.description,
          teamId: tags.teamId,
          isActive: tags.isActive,
          createdBy: tags.createdBy,
          createdAt: tags.createdAt,
          updatedAt: tags.updatedAt,
        })
        .from(tags);

      // Build where conditions
      const whereConditions: any[] = [eq(tags.isActive, true)];

      // 團隊篩選
      if (teamId) {
        if (includeGlobal === 'true') {
          whereConditions.push(or(eq(tags.teamId, parseInt(teamId)), isNull(tags.teamId)));
        } else {
          whereConditions.push(eq(tags.teamId, parseInt(teamId)));
        }
      } else if (payload?.teamId && payload?.role !== 'admin') {
        // 非管理員只能看到自己團隊的標籤和全局標籤
        if (includeGlobal === 'true') {
          whereConditions.push(or(eq(tags.teamId, payload.teamId), isNull(tags.teamId)));
        } else {
          whereConditions.push(eq(tags.teamId, payload.teamId));
        }
      }

      // 搜索
      if (search) {
        const searchTerm = `%${search}%`;
        whereConditions.push(or(
          like(tags.name, searchTerm),
          like(tags.description, searchTerm)
        ));
      }

      if (whereConditions.length > 0) {
        query = query.where(and(...whereConditions)) as any;
      }

      query = (query as any)
        .orderBy(asc(tags.name))
        .limit(limit)
        .offset(offset);

      const result = await query;

      // 計算總數 - use the same where conditions
      let countQuery = drizzleDb
        .select({ total: count() })
        .from(tags);
      
      if (whereConditions.length > 0) {
        countQuery = countQuery.where(and(...whereConditions)) as any;
      }
      
      const countResult = await countQuery;

      const tagsResult: any[] = result.map((row: any) => ({
        id: row.id,
        name: row.name,
        color: row.color,
        description: row.description,
        teamId: row.teamId,
        teamName: null, // Simplified without join
        isActive: Boolean(row.isActive),
        createdBy: row.createdBy,
        createdByName: null, // Simplified without join
        customerCount: 0, // Simplified without subquery
        conversationCount: 0, // Simplified without subquery
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));

      return paginatedResponse(c, tagsResult, {
        page: parseInt(page),
        limit,
        total: countResult[0]?.total || 0
      }, 'Tags retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 創建標籤
  async create(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = drizzle(c.env.DB);
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
      const existingTag = await drizzleDb
        .select({ id: tags.id })
        .from(tags)
        .where(
          and(
            eq(tags.name, name),
            teamId ? eq(tags.teamId, teamId) : isNull(tags.teamId),
            eq(tags.isActive, true)
          )
        )
        .limit(1);

      if (existingTag.length > 0) {
        return validationErrorResponse(c, [
          { field: 'name', message: 'Tag name already exists in this scope' }
        ]);
      }

      // 創建標籤
      const result = await drizzleDb
        .insert(tags)
        .values({
          name: name.trim(),
          color: color,
          description: description || null,
          teamId: teamId || null,
          createdBy: typeof payload?.userId === 'string' ? payload.userId : payload?.userId?.toString() || 'system'
        })
        .returning();

      const insertedTag = result[0];
      
      if (!insertedTag) {
        return errorResponse(c, 'Failed to create tag', 500);
      }
      
      return successResponse(c, {
        id: insertedTag.id,
        name: insertedTag.name,
        color: insertedTag.color,
        description: insertedTag.description,
        teamId: insertedTag.teamId,
        isActive: insertedTag.isActive,
        createdBy: insertedTag.createdBy,
        customerCount: 0,
        conversationCount: 0,
        createdAt: insertedTag.createdAt,
        updatedAt: insertedTag.updatedAt
      }, 'Tag created successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取單一標籤詳情
  async get(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = drizzle(c.env.DB);
    try {
      const tagId = c.req.param('id');

      const tag = await drizzleDb.get(sql`
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
          WHERE tag_id = ${tagId}
        ) customer_count ON t.id = customer_count.tag_id
        LEFT JOIN (
          SELECT tag_id, COUNT(DISTINCT conversation_id) as count
          FROM conversation_tags
          WHERE tag_id = ${tagId}
        ) conversation_count ON t.id = conversation_count.tag_id
        WHERE t.id = ${tagId}
      `);

      if (!tag) {
        return notFoundResponse(c, 'Tag');
      }

      return successResponse(c, {
        id: (tag as any).id,
        name: (tag as any).name,
        color: (tag as any).color,
        description: (tag as any).description,
        teamId: (tag as any).team_id,
        teamName: (tag as any).team_name,
        isActive: Boolean((tag as any).is_active),
        createdBy: (tag as any).created_by,
        createdByName: (tag as any).created_by_name,
        customerCount: (tag as any).customer_count,
        conversationCount: (tag as any).conversation_count,
        createdAt: (tag as any).created_at,
        updatedAt: (tag as any).updated_at
      }, 'Tag retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 更新標籤
  async update(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = drizzle(c.env.DB);
    try {
      const tagId = c.req.param('id');
      const { name, color, description, isActive } = await c.req.json();
      const payload = c.get('jwtPayload');

      // 檢查標籤是否存在
      const existingTag = await drizzleDb.get(sql`
        SELECT * FROM tags WHERE id = ${tagId}
      `);

      if (!existingTag) {
        return notFoundResponse(c, 'Tag');
      }

      // 權限檢查：非管理員只能編輯自己團隊的標籤
      if (payload?.role !== 'admin' && (existingTag as any).teamId !== payload?.teamId) {
        return unauthorizedResponse(c, 'You can only edit tags from your team');
      }

      // 如果更新名稱，檢查是否重複
      if (name && name !== (existingTag as any).name) {
        const duplicateTag = await drizzleDb
          .select({ id: tags.id })
          .from(tags)
          .where(
            and(
              eq(tags.name, name),
              (existingTag as any).teamId ? eq(tags.teamId, (existingTag as any).teamId) : isNull(tags.teamId),
              sql`${tags.id} != ${tagId}`,
              eq(tags.isActive, true)
            )
          )
          .limit(1);

        if (duplicateTag.length > 0) {
          return validationErrorResponse(c, [
            { field: 'name', message: 'Tag name already exists in this scope' }
          ]);
        }
      }

      // 更新標籤
      await drizzleDb.run(sql`
        UPDATE tags 
        SET name = COALESCE(${name || null}, name),
            color = COALESCE(${color || null}, color),
            description = COALESCE(${description !== undefined ? description : null}, description),
            is_active = COALESCE(${isActive !== undefined ? isActive : null}, is_active),
            updated_at = datetime('now')
        WHERE id = ${tagId}
      `);

      return successResponse(c, null, 'Tag updated successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 刪除標籤（軟刪除）
  async delete(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = drizzle(c.env.DB);
    try {
      const tagId = c.req.param('id');
      const payload = c.get('jwtPayload');

      // 檢查標籤是否存在
      const existingTag = await drizzleDb.get(sql`
        SELECT * FROM tags WHERE id = ${tagId}
      `);

      if (!existingTag) {
        return notFoundResponse(c, 'Tag');
      }

      // 權限檢查
      if (payload?.role !== 'admin' && (existingTag as any).teamId !== payload?.teamId) {
        return unauthorizedResponse(c, 'You can only delete tags from your team');
      }

      // 軟刪除標籤
      await drizzleDb.run(sql`
        UPDATE tags 
        SET is_active = FALSE, updated_at = datetime('now')
        WHERE id = ${tagId}
      `);

      return successResponse(c, null, 'Tag deleted successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取標籤使用統計
  async getUsageStats(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = drizzle(c.env.DB);
    try {
      const tagId = c.req.param('id');

      // 檢查標籤是否存在
      const tag = await drizzleDb.get(sql`
        SELECT * FROM tags WHERE id = ${tagId}
      `);

      if (!tag) {
        return notFoundResponse(c, 'Tag');
      }

      // 客戶使用統計
      const customerStats = await drizzleDb.get(sql`
        SELECT 
          COUNT(*) as total_customers,
          COUNT(CASE WHEN c.platform = 'line' THEN 1 END) as line_customers,
          COUNT(CASE WHEN c.platform = 'facebook' THEN 1 END) as facebook_customers
        FROM customer_tags ct
        JOIN customers c ON ct.customer_id = c.id
        WHERE ct.tag_id = ${tagId}
      `);

      // 對話使用統計
      const conversationStats = await drizzleDb.get(sql`
        SELECT 
          COUNT(*) as total_conversations,
          COUNT(CASE WHEN conv.status = 'active' THEN 1 END) as active_conversations,
          COUNT(CASE WHEN conv.status = 'closed' THEN 1 END) as closed_conversations
        FROM conversation_tags ct
        JOIN conversations conv ON ct.conversation_id = conv.id
        WHERE ct.tag_id = ${tagId}
      `);

      // 最近使用趨勢（最近30天）
      const usageTrend = await drizzleDb.run(sql`
        SELECT 
          DATE(ct.assigned_at) as date,
          COUNT(*) as assignments
        FROM customer_tags ct
        WHERE ct.tag_id = ${tagId} 
        AND ct.assigned_at >= date('now', '-30 days')
        GROUP BY DATE(ct.assigned_at)
        ORDER BY date DESC
        LIMIT 30
      `);

      // 最活躍的使用者
      const topAssigners = await drizzleDb.run(sql`
        SELECT 
          u.display_name,
          COUNT(*) as assignments
        FROM customer_tags ct
        JOIN users u ON ct.assigned_by = u.id
        WHERE ct.tag_id = ${tagId}
        AND ct.assigned_at >= date('now', '-30 days')
        GROUP BY ct.assigned_by, u.display_name
        ORDER BY assignments DESC
        LIMIT 10
      `);

      return successResponse(c, {
        tagInfo: {
          id: (tag as any).id,
          name: (tag as any).name,
          color: (tag as any).color
        },
        customers: {
          total: (customerStats as any)?.total_customers || 0,
          byPlatform: {
            line: (customerStats as any)?.line_customers || 0,
            facebook: (customerStats as any)?.facebook_customers || 0
          }
        },
        conversations: {
          total: (conversationStats as any)?.total_conversations || 0,
          active: (conversationStats as any)?.active_conversations || 0,
          closed: (conversationStats as any)?.closed_conversations || 0
        },
        usageTrend: usageTrend.results || [].map((row: any) => ({
          date: row.date,
          assignments: row.assignments
        })),
        topAssigners: topAssigners.results || [].map((row: any) => ({
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
    const drizzleDb = drizzle(c.env.DB);
    try {
      const { operation, tagIds, data } = await c.req.json();
      // const payload = c.get('jwtPayload');

      if (!Array.isArray(tagIds) || tagIds.length === 0) {
        return validationErrorResponse(c, [
          { field: 'tagIds', message: 'Tag IDs array is required' }
        ]);
      }

      const tagIdsList = tagIds.map(id => `'${id}'`).join(',');

      switch (operation) {
        case 'activate':
          await drizzleDb.run(sql`
            UPDATE tags 
            SET is_active = TRUE, updated_at = datetime('now')
            WHERE id IN (${tagIdsList})
          `);
          break;

        case 'deactivate':
          await drizzleDb.run(sql`
            UPDATE tags 
            SET is_active = FALSE, updated_at = datetime('now')
            WHERE id IN (${tagIdsList})
          `);
          break;

        case 'update_color':
          if (!data?.color) {
            return validationErrorResponse(c, [
              { field: 'data.color', message: 'Color is required for color update' }
            ]);
          }
          await drizzleDb.run(sql`
            UPDATE tags 
            SET color = ${data.color}, updated_at = datetime('now')
            WHERE id IN (${tagIdsList})
          `);
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