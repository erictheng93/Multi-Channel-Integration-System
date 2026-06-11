// Customer Tags Handler
// 客戶標籤關聯管理 - 處理客戶與標籤的關聯操作

import { Context } from 'hono';
import { getValidatedParam } from '@/middleware/param-validator';
import type { Bindings } from '@/types';
import {
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
  handleApiError
} from '@/utils/api-response';
import { tagContracts } from '@shared/api-contracts';
import { contractJson } from '@/utils/api-contract-response';
import { customers, tags, customerTags } from '@/db/schema';
import { createDbClient } from '@/db/drizzle-factory';
import { sql, eq, and, or, inArray, isNull, isNotNull, asc, desc, count } from 'drizzle-orm';
import { WebSocketBroadcastService } from '@/services/websocket-broadcast-service';
import { ActivityCapture, ActivityService, ACTIVITY_ACTIONS, RESOURCE_TYPES } from '@modules/activities';
import { createContextLogger } from '@/utils/logger';
import { likeEscaped } from '@/utils/sql-like';

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
        // `%` and `_` inside the user-supplied search must be treated as
        // literals, not LIKE wildcards. `likeEscaped()` escapes those
        // characters and emits `... LIKE ? ESCAPE '\'` so the bound
        // pattern matches literally.
        conditions.push(
          or(
            likeEscaped(tags.name, search),
            likeEscaped(tags.description, search)
          ) as typeof conditions[number]
        );
      }

      const whereClause = and(...conditions);

      // ────────────────────────────────────────────────────────────────
      // Count subqueries. These use Drizzle's `sql` template tag, which
      // wraps table/column references as safely-quoted identifiers --
      // this is NOT the same as sql.raw(). No user input reaches SQL
      // outside of the parameter-bound values already vetted above.
      // ────────────────────────────────────────────────────────────────
      // NOTE: We use fully-qualified table.column names via sql.raw()
      // inside correlated subqueries because Drizzle's column references
      // (e.g. ${customerTags.customerId}) emit UNQUALIFIED names like
      // "customer_id" — which become ambiguous when multiple JOINed
      // tables share column names ("id", "customer_id", "deleted_at").
      // The outer ${tags.id} reference is safe because it resolves in
      // the outer SELECT context where only the "tags" table is present.
      // ────────────────────────────────────────────────────────────────
      const customerCountExpr = sql<number>`(
        SELECT COUNT(DISTINCT "customer_tags"."customer_id")
        FROM "customer_tags"
        WHERE "customer_tags"."tag_id" = "tags"."id"
      )`.as('customerCount');

      // Counts conversations belonging to customers that have this tag
      // (joining via customer_tags -> customers -> conversations). Both
      // soft-deletes are excluded to match the pre-refactor behaviour.
      const conversationCountExpr = sql<number>`(
        SELECT COUNT(DISTINCT "conversations"."id")
        FROM "customer_tags"
        INNER JOIN "customers" ON "customer_tags"."customer_id" = "customers"."id"
        INNER JOIN "conversations" ON "conversations"."customer_id" = "customers"."id"
        WHERE "customer_tags"."tag_id" = "tags"."id"
          AND "customers"."deleted_at" IS NULL
          AND "conversations"."deleted_at" IS NULL
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
      const tagItems = tagsData.map(tag => ({
        ...tag,
        color: tag.color || '#3B82F6'
      }));

      return contractJson(c, tagContracts.list, {
        success: true,
        data: tagItems,
        pagination: {
          page: pageNum,
          limit,
          total: totalCount,
          totalPages,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1
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
      const customerTagItems = tagsData.map(tag => ({
        ...tag,
        color: tag.color || '#3B82F6'
      }));

      return contractJson(c, tagContracts.getCustomerTags, {
        success: true,
        data: customerTagItems,
        message: 'Customer tags retrieved successfully'
      });

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
        const assignedByValue = typeof assignedBy === 'string' ? assignedBy : assignedBy.toString();
        const assignedAt = new Date().toISOString();
        const capture = new ActivityCapture(c.env.DB);
        const meta = {
          userId: payload?.userId?.toString() || 'system',
          userName: payload?.displayName || payload?.username || 'System',
          userRole: payload?.role || 'system',
          ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
          userAgent: c.req.header('User-Agent')
        };
        const statements = newTagIds.flatMap(tagId => {
          const newState = {
            customerId,
            tagId,
            assignedBy: assignedByValue,
            assignedAt
          };

          return [
            capture.buildReversibleLog({
              request: {
                ...meta,
                action: ACTIVITY_ACTIONS.TAG_ASSIGN,
                resourceType: RESOURCE_TYPES.CUSTOMER,
                resourceId: `${customerId}:${tagId}`,
                details: { customerId, tagId, operation: 'add' }
              },
              restoreHandler: 'customer.tag-assign',
              previousState: { customerId, tagId },
              newState
            }),
            c.env.DB
              .prepare(
                `INSERT INTO customer_tags
                   (customer_id, tag_id, assigned_by, assigned_at)
                 VALUES (?, ?, ?, ?)`
              )
              .bind(customerId, tagId, assignedByValue, assignedAt)
          ];
        });

        await c.env.DB.batch(statements);

        log.info(`[Customer Tags] Added ${newTagIds.length} tags using batch insert`);

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

      return contractJson(c, tagContracts.addTagsToCustomer, {
        success: true,
        data: {
          added: newTagIds.length,
          alreadyExists: tagIds.length - newTagIds.length
        },
        message: `Successfully added ${newTagIds.length} tags to customer`
      });

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

      const payload = c.get('jwtPayload');
      const placeholders = tagIds.map(() => '?').join(', ');
      const existingAssignmentsResult = await c.env.DB
        .prepare(
          `SELECT customer_id, tag_id, assigned_by, assigned_at
           FROM customer_tags
           WHERE customer_id = ?
             AND tag_id IN (${placeholders})`
        )
        .bind(customerId, ...tagIds)
        .all<{
          customer_id: number;
          tag_id: number;
          assigned_by: string | null;
          assigned_at: string | null;
        }>();
      const existingAssignments = existingAssignmentsResult.results || [];
      const capture = new ActivityCapture(c.env.DB);
      const meta = {
        userId: payload?.userId?.toString() || 'system',
        userName: payload?.displayName || payload?.username || 'System',
        userRole: payload?.role || 'system',
        ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
        userAgent: c.req.header('User-Agent')
      };
      const statements = existingAssignments.flatMap(row => {
        const tagId = Number(row.tag_id);
        const previousState = {
          customerId,
          tagId,
          assignedBy: row.assigned_by ?? meta.userId,
          assignedAt: row.assigned_at ?? null
        };

        return [
          capture.buildReversibleLog({
            request: {
              ...meta,
              action: ACTIVITY_ACTIONS.TAG_UNASSIGN,
              resourceType: RESOURCE_TYPES.CUSTOMER,
              resourceId: `${customerId}:${tagId}`,
              details: { customerId, tagId, operation: 'remove' }
            },
            restoreHandler: 'customer.tag-unassign',
            previousState,
            newState: {}
          }),
          c.env.DB
            .prepare(
              `DELETE FROM customer_tags
               WHERE customer_id = ?
                 AND tag_id = ?`
            )
            .bind(customerId, tagId)
        ];
      });

      if (statements.length === 0) {
        statements.push(
          ...tagIds.map(tagId =>
            c.env.DB
              .prepare(
                `DELETE FROM customer_tags
                 WHERE customer_id = ?
                   AND tag_id = ?`
              )
              .bind(customerId, tagId)
          )
        );
      }

      if (statements.length > 0) {
        await c.env.DB.batch(statements);
      }

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

      return contractJson(c, tagContracts.removeTagsFromCustomer, {
        success: true,
        message: `Successfully removed ${tagIds.length} tags from customer`
      });

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

      return contractJson(c, tagContracts.setCustomerTags, {
        success: true,
        data: { totalTags: tagIds.length },
        message: `Successfully set ${tagIds.length} tags for customer`
      });

    } catch (error) {
      return handleApiError(error, c);
    }
  }
};
