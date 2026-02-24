// Customer Tags Handler
// 客戶標籤關聯管理 - 處理客戶與標籤的關聯操作

import { Context } from 'hono';
import { getValidatedParam } from '@/middleware/param-validator';
import type { Bindings } from '@/types';
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
  handleApiError
} from '@/utils/api-response';
import { customers, tags, customerTags } from '@/db/schema';
import { createDbClient } from '@/db/drizzle-factory';
import { sql, eq, and, inArray } from 'drizzle-orm';

export const customerTagsHandler = {
  /**
   * 獲取可用的標籤列表（用於標籤選擇器）
   * GET /api/customers/tags/available
   */
  async getAvailableTags(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const payload = c.get('jwtPayload');
      const {
        page = '1',
        pageSize = '100',
        search,
        includeGlobal = 'true'
      } = c.req.query();

      const offset = (parseInt(page) - 1) * parseInt(pageSize);
      const limit = parseInt(pageSize);

      // Build base query with direct value substitution
      let whereConditions: string[] = ['t.is_active = 1'];

      // 團隊篩選
      if (payload?.primaryTeamId && payload?.role !== 'admin') {
        // 非管理員只能看到自己團隊的標籤和全局標籤
        if (includeGlobal === 'true') {
          whereConditions.push(`(t.team_id = ${payload.primaryTeamId} OR t.team_id IS NULL)`);
        } else {
          whereConditions.push(`t.team_id = ${payload.primaryTeamId}`);
        }
      } else if (includeGlobal === 'false') {
        whereConditions.push(`t.team_id IS NOT NULL`);
      }

      // 搜索
      if (search) {
        const escapedSearch = search.replace(/'/g, "''");
        whereConditions.push(`(t.name LIKE '%${escapedSearch}%' OR t.description LIKE '%${escapedSearch}%')`);
      }

      const whereClause = whereConditions.join(' AND ');

      // 獲取標籤數據
      const tagsQuery = `
        SELECT
          t.id,
          t.name,
          t.color,
          t.description,
          t.team_id as teamId,
          t.is_active as isActive,
          t.created_by as createdBy,
          t.created_at as createdAt,
          t.updated_at as updatedAt,
          COALESCE(customer_count.count, 0) as customerCount,
          (SELECT COUNT(DISTINCT cv2.id) FROM customer_tags ct3
            JOIN customers c3 ON ct3.customer_id = c3.id
            JOIN conversations cv2 ON cv2.customer_id = c3.id
            WHERE ct3.tag_id = t.id AND c3.deleted_at IS NULL AND cv2.deleted_at IS NULL) as conversationCount
        FROM tags t
        LEFT JOIN (
          SELECT tag_id, COUNT(DISTINCT customer_id) as count
          FROM customer_tags
          GROUP BY tag_id
        ) customer_count ON t.id = customer_count.tag_id
        WHERE ${whereClause}
        ORDER BY t.name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const tagsResult = await drizzleDb.all(sql.raw(tagsQuery));

      // 獲取總數
      const countQuery = `
        SELECT COUNT(*) as total
        FROM tags t
        WHERE ${whereClause}
      `;

      const countResult = await drizzleDb.all(sql.raw(countQuery));
      const countData = Array.isArray(countResult) ? countResult : ((countResult as any)?.results || []);
      const totalCount = (countData[0] as any)?.total || 0;
      const totalPages = Math.ceil(totalCount / limit);

      const tagsData = Array.isArray(tagsResult) ? tagsResult : ((tagsResult as any)?.results || []);

      return c.json({
        success: true,
        data: tagsData,
        pagination: {
          page: parseInt(page),
          limit,
          total: totalCount,
          totalPages
        },
        message: 'Available tags retrieved successfully'
      });

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  /**
   * 獲取客戶的所有標籤
   * GET /api/customers/:customerId/tags
   */
  async getCustomerTags(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const customerId = getValidatedParam<number>(c, 'customerId');

      // 檢查客戶是否存在
      const customer = await drizzleDb
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1);

      if (!customer || customer.length === 0) {
        return notFoundResponse(c, 'Customer');
      }

      // 獲取客戶的標籤
      const customerTagsQuery = `
        SELECT
          t.id,
          t.name,
          t.color,
          t.description,
          t.team_id as teamId,
          ct.assigned_at as assignedAt,
          ct.assigned_by as assignedBy
        FROM customer_tags ct
        JOIN tags t ON ct.tag_id = t.id
        WHERE ct.customer_id = ${customerId}
        AND t.is_active = 1
        ORDER BY ct.assigned_at DESC
      `;

      const customerTagsData = await drizzleDb.all(sql.raw(customerTagsQuery));
      const tagsData = Array.isArray(customerTagsData) ? customerTagsData : ((customerTagsData as any)?.results || []);

      return successResponse(c, tagsData, 'Customer tags retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  /**
   * 為客戶添加標籤
   * POST /api/customers/:customerId/tags
   */
  async addTagsToCustomer(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const customerId = getValidatedParam<number>(c, 'customerId');
      const { tagIds } = await c.req.json();
      const payload = c.get('jwtPayload');

      // 驗證輸入
      if (!Array.isArray(tagIds) || tagIds.length === 0) {
        return validationErrorResponse(c, [
          { field: 'tagIds', message: 'Tag IDs array is required and cannot be empty' }
        ]);
      }

      // 檢查客戶是否存在
      const customer = await drizzleDb
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1);

      if (!customer || customer.length === 0) {
        return notFoundResponse(c, 'Customer');
      }

      // 檢查標籤是否都存在且有效
      const validTags = await drizzleDb
        .select({ id: tags.id })
        .from(tags)
        .where(
          and(
            inArray(tags.id, tagIds),
            eq(tags.isActive, true)
          )
        );

      if (validTags.length !== tagIds.length) {
        return validationErrorResponse(c, [
          { field: 'tagIds', message: 'Some tag IDs are invalid or inactive' }
        ]);
      }

      // 獲取已存在的標籤關聯
      const existingTags = await drizzleDb
        .select({ tagId: customerTags.tagId })
        .from(customerTags)
        .where(
          and(
            eq(customerTags.customerId, customerId),
            inArray(customerTags.tagId, tagIds)
          )
        );

      const existingTagIds = new Set(existingTags.map(t => t.tagId));
      const newTagIds = tagIds.filter(id => !existingTagIds.has(id));

      // 添加新的標籤關聯
      if (newTagIds.length > 0) {
        // 確保有有效的用戶ID（JWT認證已確保payload.userId存在）
        console.log('[customer-tags] Debug - payload:', payload);
        console.log('[customer-tags] Debug - payload.userId:', payload?.userId);
        const assignedBy = payload?.userId;

        if (!assignedBy) {
          console.error('[customer-tags] Error - No assignedBy found, payload:', payload);
          return errorResponse(c, 'Unauthorized: User ID not found in token', 401);
        }

        // ✅ 優化：使用 Drizzle 批量插入（單條 SQL 語句）
        const tagInsertValues = newTagIds.map(tagId => ({
          customerId,
          tagId,
          assignedBy: typeof assignedBy === 'string' ? assignedBy : assignedBy.toString()
        }));

        await drizzleDb
          .insert(customerTags)
          .values(tagInsertValues);

        console.log(`📦 [Customer Tags] Added ${newTagIds.length} tags using batch insert`);
      }

      return successResponse(
        c,
        {
          added: newTagIds.length,
          alreadyExists: tagIds.length - newTagIds.length
        },
        `Successfully added ${newTagIds.length} tags to customer`
      );

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  /**
   * 從客戶移除標籤
   * DELETE /api/customers/:customerId/tags
   */
  async removeTagsFromCustomer(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const customerId = getValidatedParam<number>(c, 'customerId');
      const { tagIds } = await c.req.json();

      // 驗證輸入
      if (!Array.isArray(tagIds) || tagIds.length === 0) {
        return validationErrorResponse(c, [
          { field: 'tagIds', message: 'Tag IDs array is required and cannot be empty' }
        ]);
      }

      // 檢查客戶是否存在
      const customer = await drizzleDb
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1);

      if (!customer || customer.length === 0) {
        return notFoundResponse(c, 'Customer');
      }

      // 刪除標籤關聯
      await drizzleDb
        .delete(customerTags)
        .where(
          and(
            eq(customerTags.customerId, customerId),
            inArray(customerTags.tagId, tagIds)
          )
        );

      return successResponse(c, null, `Successfully removed ${tagIds.length} tags from customer`);

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  /**
   * 設置客戶標籤（替換所有現有標籤）
   * PUT /api/customers/:customerId/tags
   */
  async setCustomerTags(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const customerId = getValidatedParam<number>(c, 'customerId');
      const { tagIds } = await c.req.json();
      const payload = c.get('jwtPayload');

      // 驗證輸入
      if (!Array.isArray(tagIds)) {
        return validationErrorResponse(c, [
          { field: 'tagIds', message: 'Tag IDs must be an array' }
        ]);
      }

      // 檢查客戶是否存在
      const customer = await drizzleDb
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1);

      if (!customer || customer.length === 0) {
        return notFoundResponse(c, 'Customer');
      }

      // 如果 tagIds 不為空，檢查標籤是否都存在且有效
      if (tagIds.length > 0) {
        const validTags = await drizzleDb
          .select({ id: tags.id })
          .from(tags)
          .where(
            and(
              inArray(tags.id, tagIds),
              eq(tags.isActive, true)
            )
          );

        if (validTags.length !== tagIds.length) {
          return validationErrorResponse(c, [
            { field: 'tagIds', message: 'Some tag IDs are invalid or inactive' }
          ]);
        }
      }

      // 刪除所有現有標籤關聯
      await drizzleDb
        .delete(customerTags)
        .where(eq(customerTags.customerId, customerId));

      // 添加新的標籤關聯
      if (tagIds.length > 0) {
        // 確保有有效的用戶ID（JWT認證已確保payload.userId存在）
        const assignedBy = payload?.userId;

        if (!assignedBy) {
          return errorResponse(c, 'Unauthorized: User ID not found in token', 401);
        }

        // ✅ 優化：使用 Drizzle 批量插入（單條 SQL 語句）
        const tagInsertValues = tagIds.map(tagId => ({
          customerId,
          tagId,
          assignedBy: typeof assignedBy === 'string' ? assignedBy : assignedBy.toString()
        }));

        await drizzleDb
          .insert(customerTags)
          .values(tagInsertValues);

        console.log(`📦 [Customer Tags] Set ${tagIds.length} tags using batch insert`);
      }

      return successResponse(
        c,
        { totalTags: tagIds.length },
        `Successfully set ${tagIds.length} tags for customer`
      );

    } catch (error) {
      return handleApiError(error, c);
    }
  }
};
