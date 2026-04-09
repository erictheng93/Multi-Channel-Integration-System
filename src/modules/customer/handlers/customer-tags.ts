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
import { customers, tags, customerTags, conversations } from '@/db/schema';
import { createDbClient } from '@/db/drizzle-factory';
import { sql, eq, and, or, inArray, like, isNull, isNotNull, asc, desc, count } from 'drizzle-orm';
import { WebSocketBroadcastService } from '@/services/websocket-broadcast-service';
import { ActivityService, ACTIVITY_ACTIONS, RESOURCE_TYPES } from '@modules/activities';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('CustomerTagsHandler');

export const customerTagsHandler = {
  /**
   * 獲取可用的標籤列表（用於標籤選擇器）
   * GET /api/customers/tags/available
   *
   * Rewritten to use Drizzle's typed query builder. The previous version
   * built the SQL via template literal concatenation and passed it to
   * sql.raw(), which was a smell even though quotes in `search` were
   * escaped. Every value now flows through eq/or/like/and, which bind as
   * parameters. The two COUNT columns are still correlated subqueries
   * (expressed via Drizzle's `sql` template tag, which safely quotes
   * table/column identifiers) -- there is no remaining sql.raw() call.
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

      const pageNum = parseInt(page);
      const limit = parseInt(pageSize);
      const offset = (pageNum - 1) * limit;

      // ────────────────────────────────────────────────────────────────
      // Build WHERE conditions. Every value passed to a drizzle operator
      // is bound as a parameter -- SQL injection is impossible by
      // construction.
      // ────────────────────────────────────────────────────────────────
      const conditions = [eq(tags.isActive, true)];

      if (payload?.primaryTeamId && payload?.role !== 'admin') {
        // Non-admin: scope to caller's team (and optionally global tags).
        if (includeGlobal === 'true') {
          conditions.push(
            or(eq(tags.teamId, payload.primaryTeamId), isNull(tags.teamId)) as typeof conditions[number]
          );
        } else {
          conditions.push(eq(tags.teamId, payload.primaryTeamId));
        }
      } else if (includeGlobal === 'false') {
        // Admin explicitly asking to exclude global tags.
        conditions.push(isNotNull(tags.teamId));
      }

      if (search) {
        // `like()` binds the pattern, so `%`/`_` retain their SQL LIKE
        // wildcard semantics (matching prior behaviour) but cannot break
        // out of the parameter slot.
        const pattern = `%${search}%`;
        conditions.push(
          or(like(tags.name, pattern), like(tags.description, pattern)) as typeof conditions[number]
        );
      }

      const whereClause = and(...conditions);

      // ────────────────────────────────────────────────────────────────
      // Count subqueries. These use Drizzle's `sql` template tag, which
      // wraps table/column references as safely-quoted identifiers --
      // this is NOT the same as sql.raw(). No user input reaches SQL
      // outside of the parameter-bound values already vetted above.
      // ────────────────────────────────────────────────────────────────
      const customerCountExpr = sql<number>`(
        SELECT COUNT(DISTINCT ${customerTags.customerId})
        FROM ${customerTags}
        WHERE ${customerTags.tagId} = ${tags.id}
      )`.as('customerCount');

      // Counts conversations belonging to customers that have this tag
      // (joining via customer_tags -> customers -> conversations). Both
      // soft-deletes are excluded to match the pre-refactor behaviour.
      const conversationCountExpr = sql<number>`(
        SELECT COUNT(DISTINCT ${conversations.id})
        FROM ${customerTags}
        INNER JOIN ${customers} ON ${customerTags.customerId} = ${customers.id}
        INNER JOIN ${conversations} ON ${conversations.customerId} = ${customers.id}
        WHERE ${customerTags.tagId} = ${tags.id}
          AND ${customers.deletedAt} IS NULL
          AND ${conversations.deletedAt} IS NULL
      )`.as('conversationCount');

      // Page + total in parallel
      const [tagsData, countRows] = await Promise.all([
        drizzleDb
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
            customerCount: customerCountExpr,
            conversationCount: conversationCountExpr,
          })
          .from(tags)
          .where(whereClause)
          .orderBy(asc(tags.name))
          .limit(limit)
          .offset(offset),
        drizzleDb
          .select({ total: count() })
          .from(tags)
          .where(whereClause),
      ]);

      const totalCount = countRows[0]?.total ?? 0;
      const totalPages = Math.ceil(totalCount / limit);

      return c.json({
        success: true,
        data: tagsData,
        pagination: {
          page: pageNum,
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

      // Fetch the customer's tags via a parameterised inner join. Rewritten
      // from a sql.raw() template concatenation -- customerId is now bound
      // through eq() rather than interpolated into the query string.
      const tagsData = await drizzleDb
        .select({
          id: tags.id,
          name: tags.name,
          color: tags.color,
          description: tags.description,
          teamId: tags.teamId,
          assignedAt: customerTags.assignedAt,
          assignedBy: customerTags.assignedBy,
        })
        .from(customerTags)
        .innerJoin(tags, eq(customerTags.tagId, tags.id))
        .where(
          and(
            eq(customerTags.customerId, customerId),
            eq(tags.isActive, true)
          )
        )
        .orderBy(desc(customerTags.assignedAt));

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
        log.info('[customer-tags] Debug - payload:', { detail: payload });
        log.debug('Debug - payload.userId', { userId: payload?.userId });
        const assignedBy = payload?.userId;

        if (!assignedBy) {
          log.error('[customer-tags] Error - No assignedBy found, payload:', { detail: payload });
          return errorResponse(c, 'Unauthorized: User ID not found in token', 401);
        }

        // 優化：使用 Drizzle 批量插入（單條 SQL 語句）
        const tagInsertValues = newTagIds.map(tagId => ({
          customerId,
          tagId,
          assignedBy: typeof assignedBy === 'string' ? assignedBy : assignedBy.toString()
        }));

        await drizzleDb
          .insert(customerTags)
          .values(tagInsertValues);

        log.info(`[Customer Tags] Added ${newTagIds.length} tags using batch insert`);

        // Activity log (fire-and-forget)
        const customerForLog = await drizzleDb.select({ displayName: customers.displayName }).from(customers).where(eq(customers.id, customerId)).limit(1);
        const custName = customerForLog[0]?.displayName || String(customerId);
        const tagsForLog = await drizzleDb.select({ name: tags.name }).from(tags).where(inArray(tags.id, newTagIds));
        const tagNames = tagsForLog.map(t => t.name).join(', ');
        const activityService = new ActivityService(c.env.DB);
        activityService.logActivity({
          userId: payload?.userId?.toString() || 'system',
          userName: payload?.displayName || payload?.username || 'System',
          userRole: payload?.role || 'system',
          action: ACTIVITY_ACTIONS.TAG_ASSIGN,
          resourceType: RESOURCE_TYPES.CUSTOMER,
          resourceId: customerId.toString(),
          details: { customerName: custName, tagName: tagNames, tagIds: newTagIds, operation: 'add' },
          ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
          userAgent: c.req.header('User-Agent')
        }).catch(() => {});
      }

      // Broadcast tag change event for real-time updates
      if (newTagIds.length > 0) {
        try {
          const broadcastService = new WebSocketBroadcastService(c.env);
          await broadcastService.broadcastCustomerTagEvent({
            customerId,
            operation: 'add',
            tagIds: newTagIds,
            changedBy: String(payload?.userId || 'unknown')
          });
        } catch (broadcastError) {
          log.warn('[Customer Tags] Broadcast failed (non-blocking):', { detail: broadcastError });
        }
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

      // Activity log (fire-and-forget)
      const payload = c.get('jwtPayload');
      const customerForLog = await drizzleDb.select({ displayName: customers.displayName }).from(customers).where(eq(customers.id, customerId)).limit(1);
      const custName = customerForLog[0]?.displayName || String(customerId);
      const tagsForLog = await drizzleDb.select({ name: tags.name }).from(tags).where(inArray(tags.id, tagIds));
      const tagNames = tagsForLog.map(t => t.name).join(', ');
      const activityService = new ActivityService(c.env.DB);
      activityService.logActivity({
        userId: payload?.userId?.toString() || 'system',
        userName: payload?.displayName || payload?.username || 'System',
        userRole: payload?.role || 'system',
        action: ACTIVITY_ACTIONS.TAG_UNASSIGN,
        resourceType: RESOURCE_TYPES.CUSTOMER,
        resourceId: customerId.toString(),
        details: { customerName: custName, tagName: tagNames, tagIds, operation: 'remove' },
        ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
        userAgent: c.req.header('User-Agent')
      }).catch(() => {});

      // Broadcast tag change event for real-time updates
      try {
        const broadcastService = new WebSocketBroadcastService(c.env);
        await broadcastService.broadcastCustomerTagEvent({
          customerId,
          operation: 'remove',
          tagIds,
          changedBy: String(payload?.userId || 'unknown')
        });
      } catch (broadcastError) {
        log.warn('[Customer Tags] Broadcast failed (non-blocking):', { detail: broadcastError });
      }

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

        // 優化：使用 Drizzle 批量插入（單條 SQL 語句）
        const tagInsertValues = tagIds.map(tagId => ({
          customerId,
          tagId,
          assignedBy: typeof assignedBy === 'string' ? assignedBy : assignedBy.toString()
        }));

        await drizzleDb
          .insert(customerTags)
          .values(tagInsertValues);

        log.info(`[Customer Tags] Set ${tagIds.length} tags using batch insert`);
      }

      // Activity log (fire-and-forget)
      const customerForLog = await drizzleDb.select({ displayName: customers.displayName }).from(customers).where(eq(customers.id, customerId)).limit(1);
      const custName = customerForLog[0]?.displayName || String(customerId);
      const tagsForLog = tagIds.length > 0 ? await drizzleDb.select({ name: tags.name }).from(tags).where(inArray(tags.id, tagIds)) : [];
      const tagNames = tagsForLog.map(t => t.name).join(', ');
      const activityService = new ActivityService(c.env.DB);
      activityService.logActivity({
        userId: payload?.userId?.toString() || 'system',
        userName: payload?.displayName || payload?.username || 'System',
        userRole: payload?.role || 'system',
        action: ACTIVITY_ACTIONS.TAG_ASSIGN,
        resourceType: RESOURCE_TYPES.CUSTOMER,
        resourceId: customerId.toString(),
        details: { customerName: custName, tagName: tagNames, tagIds, operation: 'set' },
        ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
        userAgent: c.req.header('User-Agent')
      }).catch(() => {});

      // Broadcast tag change event for real-time updates
      try {
        const broadcastService = new WebSocketBroadcastService(c.env);
        await broadcastService.broadcastCustomerTagEvent({
          customerId,
          operation: 'set',
          tagIds,
          changedBy: String(payload?.userId || 'unknown')
        });
      } catch (broadcastError) {
        log.warn('[Customer Tags] Broadcast failed (non-blocking):', { detail: broadcastError });
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
