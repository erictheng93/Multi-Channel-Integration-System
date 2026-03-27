// src/modules/tags/services/tag-service.ts
// Tag system management - CRUD operations, tag association management

import { Context } from 'hono';
import type { Bindings } from '@/types';
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  validationErrorResponse,
  badRequestResponse,
  notFoundResponse,
  handleApiError
} from '@/utils/api-response';
import { tags } from '@/db/schema';
import { createDbClient } from '@/db/drizzle-factory';
import { sql, eq, and, inArray } from 'drizzle-orm';
import { nowISO } from '@/utils/timestamp'
import { ActivityService, ACTIVITY_ACTIONS, RESOURCE_TYPES } from '@modules/activities';

// ── Raw SQL result type interfaces ──────────────────────────────────────────

/** Shape returned by the tag detail query with JOINs (get endpoint) */
interface TagDetailRow {
  id: number;
  name: string;
  color: string | null;
  description: string | null;
  team_id: number | null;
  team_name: string | null;
  is_active: number;
  created_by: string | null;
  created_by_name: string | null;
  customer_count: number;
  conversation_count: number;
  created_at: string;
  updated_at: string;
}

/** Shape returned by the tag row query (SELECT * FROM tags) */
interface TagRow {
  id: number;
  name: string;
  color: string | null;
  description: string | null;
  team_id: number | null;
  is_active: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Shape returned by the tag list query with usage counts */
interface TagListRow {
  id: number;
  name: string;
  color: string | null;
  description: string | null;
  team_id: number | null;
  is_active: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customer_count: number;
  conversation_count: number;
}

/** Shape returned by the updated tag query with counts (update endpoint) */
interface TagWithCountsRow {
  id: number;
  name: string;
  color: string | null;
  description: string | null;
  team_id: number | null;
  is_active: number;
  created_by: string | null;
  customer_count: number;
  conversation_count: number;
  created_at: string;
  updated_at: string;
}

/** Shape returned by the customer stats query */
interface CustomerStatsRow {
  total_customers: number;
  line_customers: number;
  facebook_customers: number;
}

/** Shape returned by the conversation stats query */
interface ConversationStatsRow {
  total_conversations: number;
  active_conversations: number;
  closed_conversations: number;
}

/** Shape returned by the usage trend query */
interface UsageTrendRow {
  date: string;
  assignments: number;
}

/** Shape returned by the top assigners query */
interface TopAssignerRow {
  display_name: string;
  assignments: number;
}

/** Shape returned by COUNT(*) queries */
interface CountRow {
  total: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

// HEX color format validation (supports 3-digit or 6-digit format)
const isValidHexColor = (color: string): boolean => {
  if (!color || typeof color !== 'string') return false;
  // Supports #RGB or #RRGGBB format
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color);
};

// Normalize color format (convert 3-digit to 6-digit)
const normalizeHexColor = (color: string): string => {
  if (!color) return '#3B82F6'; // Default color

  // If not a valid HEX format, return default color
  if (!isValidHexColor(color)) return '#3B82F6';

  // Convert 3-digit format to 6-digit format
  if (color.length === 4) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  return color.toUpperCase();
};

/** Extract user info from JWT payload for activity logging */
const extractActivityMeta = (c: Context<{ Bindings: Bindings }>) => {
  const payload = c.get('jwtPayload');
  return {
    userId: payload?.userId?.toString() || 'system',
    userName: payload?.displayName || payload?.username || 'System',
    userRole: payload?.role || 'system',
    ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
    userAgent: c.req.header('User-Agent')
  };
};

/** Fire-and-forget activity log for tag operations */
const logTagActivity = (
  c: Context<{ Bindings: Bindings }>,
  action: string,
  resourceId: string,
  details: Record<string, unknown>
) => {
  const meta = extractActivityMeta(c);
  const activityService = new ActivityService(c.env.DB);
  activityService.logActivity({
    ...meta,
    action,
    resourceType: RESOURCE_TYPES.TAG,
    resourceId,
    details
  }).catch(() => {});
};

export const tagHandler = {
  // Get tag list (simplified model: all tags visible to all agents)
  async list(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const {
        page = '1',
        pageSize = '50',
        search
      } = c.req.query();

      const pageNum = Math.max(1, parseInt(page) || 1);
      const limit = Math.min(parseInt(pageSize) || 50, 100);
      const offset = (pageNum - 1) * limit;

      // Build WHERE clause for search
      const searchCondition = search
        ? sql`AND (t.name LIKE ${'%' + search + '%'} OR t.description LIKE ${'%' + search + '%'})`
        : sql``;

      // Run main query and count query in parallel
      const [result, countResult] = await Promise.all([
        drizzleDb.all(sql`
          SELECT
            t.id,
            t.name,
            t.color,
            t.description,
            t.team_id,
            t.is_active,
            t.created_by,
            t.created_at,
            t.updated_at,
            (SELECT COUNT(*) FROM customer_tags ct2
              JOIN customers c2 ON ct2.customer_id = c2.id
              WHERE ct2.tag_id = t.id AND c2.deleted_at IS NULL) as customer_count,
            (SELECT COUNT(DISTINCT cv2.id) FROM customer_tags ct3
              JOIN customers c3 ON ct3.customer_id = c3.id
              JOIN conversations cv2 ON cv2.customer_id = c3.id
              WHERE ct3.tag_id = t.id AND c3.deleted_at IS NULL AND cv2.deleted_at IS NULL) as conversation_count
          FROM tags t
          WHERE t.is_active = 1
          AND t.deleted_at IS NULL
          ${searchCondition}
          ORDER BY t.name ASC
          LIMIT ${limit} OFFSET ${offset}
        `),
        drizzleDb.get(sql`
          SELECT COUNT(*) as total
          FROM tags t
          WHERE t.is_active = 1
          AND t.deleted_at IS NULL
          ${searchCondition}
        `)
      ]);

      const tagsResult = (result as TagListRow[]).map((row: TagListRow) => ({
        id: row.id,
        name: row.name,
        color: row.color,
        description: row.description,
        teamId: row.team_id,
        teamName: null as string | null,
        isActive: Boolean(row.is_active),
        createdBy: row.created_by,
        createdByName: null as string | null,
        customerCount: row.customer_count || 0,
        conversationCount: row.conversation_count || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      return paginatedResponse(c, tagsResult, {
        page: pageNum,
        limit,
        total: (countResult as CountRow | undefined)?.total || 0
      }, 'Tags retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // Create tag
  async create(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const payload = c.get('jwtPayload');
      const { name, color = '#3B82F6', description, teamId: _teamId } = await c.req.json();

      if (!name || !name.trim()) {
        return badRequestResponse(c, 'Tag name is required');
      }

      if (color && !isValidHexColor(color)) {
        return validationErrorResponse(c, [
          { field: 'color', message: 'Invalid color format. Use HEX format (e.g., #FF5733 or #F53)' }
        ]);
      }

      const normalizedColor = normalizeHexColor(color);


      const existingTag = await drizzleDb
        .select({ id: tags.id })
        .from(tags)
        .where(
          and(
            eq(tags.name, name),
            eq(tags.isActive, true)
          )
        )
        .limit(1);

      if (existingTag.length > 0) {
        return errorResponse(c, 'Tag name already exists', 409);
      }

      const result = await drizzleDb
        .insert(tags)
        .values({
          name: name.trim(),
          color: normalizedColor,
          description: description || null,
          teamId: null, // Simplified: unified as global tags
          createdBy: typeof payload?.userId === 'string' ? payload.userId : payload?.userId?.toString() || 'system'
        })
        .returning();

      const insertedTag = result[0];

      if (!insertedTag) {
        return errorResponse(c, 'Failed to create tag', 500);
      }

      logTagActivity(c, ACTIVITY_ACTIONS.TAG_CREATE, insertedTag.id?.toString() || '', { name, color, description });

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
      }, 'Tag created successfully', 201);

    } catch (error) {
      // Handle JSON parsing errors
      if (error instanceof SyntaxError) {
        return badRequestResponse(c, 'Invalid JSON');
      }
      return handleApiError(error, c);
    }
  },

  // Get single tag details
  async get(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
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
        LEFT JOIN agents creator ON t.created_by = creator.id
        LEFT JOIN (
          SELECT tag_id, COUNT(DISTINCT customer_id) as count
          FROM customer_tags
          WHERE tag_id = ${tagId}
        ) customer_count ON t.id = customer_count.tag_id
        LEFT JOIN (
          SELECT ct3.tag_id, COUNT(DISTINCT cv2.id) as count
          FROM customer_tags ct3
          JOIN customers c3 ON ct3.customer_id = c3.id
          JOIN conversations cv2 ON cv2.customer_id = c3.id
          WHERE ct3.tag_id = ${tagId} AND c3.deleted_at IS NULL AND cv2.deleted_at IS NULL
        ) conversation_count ON t.id = conversation_count.tag_id
        WHERE t.id = ${tagId}
      `);

      if (!tag) {
        return notFoundResponse(c, 'Tag');
      }

      const row = tag as TagDetailRow;
      return successResponse(c, {
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
      }, 'Tag retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // Update tag
  async update(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const tagId = c.req.param('id');
      const { name, color, description, isActive } = await c.req.json();

      const existingTag = await drizzleDb.get(sql`
        SELECT * FROM tags WHERE id = ${tagId}
      `);

      if (!existingTag) {
        return notFoundResponse(c, 'Tag');
      }

      let normalizedColor = color;
      if (color !== undefined && color !== null) {
        if (!isValidHexColor(color)) {
          return validationErrorResponse(c, [
            { field: 'color', message: 'Invalid color format. Use HEX format (e.g., #FF5733 or #F53)' }
          ]);
        }
        normalizedColor = normalizeHexColor(color);
      }

      const existingRow = existingTag as TagRow;
      if (name && name !== existingRow.name) {
        const duplicateTag = await drizzleDb
          .select({ id: tags.id })
          .from(tags)
          .where(
            and(
              eq(tags.name, name),
              sql`${tags.id} != ${tagId}`,
              eq(tags.isActive, true)
            )
          )
          .limit(1);

        if (duplicateTag.length > 0) {
          return validationErrorResponse(c, [
            { field: 'name', message: 'Tag name already exists' }
          ]);
        }
      }

      // Update tag
      await drizzleDb.run(sql`
        UPDATE tags
        SET name = COALESCE(${name || null}, name),
            color = COALESCE(${normalizedColor || null}, color),
            description = COALESCE(${description !== undefined ? description : null}, description),
            is_active = COALESCE(${isActive !== undefined ? isActive : null}, is_active),
            updated_at = datetime('now')
        WHERE id = ${tagId}
      `);

      // Query updated tag to return complete data
      const updatedTag = await drizzleDb.get(sql`
        SELECT t.*,
               COALESCE(customer_count.count, 0) as customer_count,
               COALESCE(conversation_count.count, 0) as conversation_count
        FROM tags t
        LEFT JOIN (
          SELECT tag_id, COUNT(DISTINCT customer_id) as count
          FROM customer_tags
          WHERE tag_id = ${tagId}
        ) customer_count ON t.id = customer_count.tag_id
        LEFT JOIN (
          SELECT ct3.tag_id, COUNT(DISTINCT cv2.id) as count
          FROM customer_tags ct3
          JOIN customers c3 ON ct3.customer_id = c3.id
          JOIN conversations cv2 ON cv2.customer_id = c3.id
          WHERE ct3.tag_id = ${tagId} AND c3.deleted_at IS NULL AND cv2.deleted_at IS NULL
        ) conversation_count ON t.id = conversation_count.tag_id
        WHERE t.id = ${tagId}
      `);

      if (!updatedTag) {
        return errorResponse(c, 'Failed to retrieve updated tag', 500);
      }

      const updatedRow = updatedTag as TagWithCountsRow;

      logTagActivity(c, ACTIVITY_ACTIONS.TAG_UPDATE, String(tagId ?? ''), { name, color, description, isActive });

      return successResponse(c, {
        id: updatedRow.id,
        name: updatedRow.name,
        color: updatedRow.color,
        description: updatedRow.description,
        teamId: updatedRow.team_id,
        isActive: Boolean(updatedRow.is_active),
        createdBy: updatedRow.created_by,
        customerCount: updatedRow.customer_count,
        conversationCount: updatedRow.conversation_count,
        createdAt: updatedRow.created_at,
        updatedAt: updatedRow.updated_at
      }, 'Tag updated successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // Delete tag (soft delete)
  async delete(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const tagId = c.req.param('id');

      const existingTag = await drizzleDb.get(sql`
        SELECT id, name FROM tags WHERE id = ${tagId}
      `);

      if (!existingTag) {
        return notFoundResponse(c, 'Tag');
      }

      const tagRow = existingTag as Pick<TagRow, 'id' | 'name'>;
      const tagName = tagRow.name;

      // Soft delete tag
      await drizzleDb.run(sql`
        UPDATE tags
        SET is_active = 0, deleted_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ${tagId}
      `);

      logTagActivity(c, ACTIVITY_ACTIONS.TAG_DELETE, tagId || '', { tagName });

      return successResponse(c, null, 'Tag deleted successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // Get tag usage statistics
  async getUsageStats(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const tagId = c.req.param('id');

      const tag = await drizzleDb.get(sql`
        SELECT id, name, color FROM tags WHERE id = ${tagId}
      `);

      if (!tag) {
        return notFoundResponse(c, 'Tag');
      }

      // Run all 4 independent stat queries in parallel
      const [customerStats, conversationStats, usageTrendResults, topAssignersResults] = await Promise.all([
        drizzleDb.get(sql`
          SELECT
            COUNT(*) as total_customers,
            COUNT(CASE WHEN c.platform = 'line' THEN 1 END) as line_customers,
            COUNT(CASE WHEN c.platform = 'facebook' THEN 1 END) as facebook_customers
          FROM customer_tags ct
          JOIN customers c ON ct.customer_id = c.id
          WHERE ct.tag_id = ${tagId}
        `),
        drizzleDb.get(sql`
          SELECT
            COUNT(DISTINCT conv.id) as total_conversations,
            COUNT(DISTINCT CASE WHEN conv.status = 'active' THEN conv.id END) as active_conversations,
            COUNT(DISTINCT CASE WHEN conv.status = 'closed' THEN conv.id END) as closed_conversations
          FROM customer_tags ct
          JOIN customers c ON ct.customer_id = c.id
          JOIN conversations conv ON conv.customer_id = c.id
          WHERE ct.tag_id = ${tagId}
            AND c.deleted_at IS NULL
            AND conv.deleted_at IS NULL
        `),
        drizzleDb.all(sql`
          SELECT
            DATE(ct.assigned_at) as date,
            COUNT(*) as assignments
          FROM customer_tags ct
          WHERE ct.tag_id = ${tagId}
          AND ct.assigned_at >= date('now', '-30 days')
          GROUP BY DATE(ct.assigned_at)
          ORDER BY date DESC
          LIMIT 30
        `),
        drizzleDb.all(sql`
          SELECT
            a.display_name,
            COUNT(*) as assignments
          FROM customer_tags ct
          JOIN agents a ON ct.assigned_by = a.id
          WHERE ct.tag_id = ${tagId}
          AND ct.assigned_at >= date('now', '-30 days')
          GROUP BY ct.assigned_by, a.display_name
          ORDER BY assignments DESC
          LIMIT 10
        `)
      ]);

      const tagRow = tag as Pick<TagRow, 'id' | 'name' | 'color'>;
      const custStats = customerStats as CustomerStatsRow | null;
      const convStats = conversationStats as ConversationStatsRow | null;
      const trendRows = (usageTrendResults || []) as UsageTrendRow[];
      const assignerRows = (topAssignersResults || []) as TopAssignerRow[];

      return successResponse(c, {
        tagInfo: {
          id: tagRow.id,
          name: tagRow.name,
          color: tagRow.color
        },
        customers: {
          total: custStats?.total_customers || 0,
          byPlatform: {
            line: custStats?.line_customers || 0,
            facebook: custStats?.facebook_customers || 0
          }
        },
        conversations: {
          total: convStats?.total_conversations || 0,
          active: convStats?.active_conversations || 0,
          closed: convStats?.closed_conversations || 0
        },
        usageTrend: trendRows.map((row) => ({
          date: row.date,
          assignments: row.assignments
        })),
        topAssigners: assignerRows.map((row) => ({
          name: row.display_name,
          assignments: row.assignments
        }))
      }, 'Tag usage statistics retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // Bulk operations on tags
  async bulkOperation(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const { operation, tagIds, data } = await c.req.json();
      // const payload = c.get('jwtPayload');

      if (!Array.isArray(tagIds) || tagIds.length === 0) {
        return validationErrorResponse(c, [
          { field: 'tagIds', message: 'Tag IDs array is required' }
        ]);
      }

      // SECURITY FIX: Validate tag IDs are numeric and sanitize
      const validatedIds = tagIds.filter(id => {
        return typeof id === 'number' ||
               (typeof id === 'string' && /^[0-9]+$/.test(id));
      });

      if (validatedIds.length !== tagIds.length) {
        return badRequestResponse(c, 'Invalid tag ID format detected');
      }

      // Convert to integers for parameterized queries
      const idArray = validatedIds.map(id => parseInt(id.toString(), 10));

      // SECURITY FIX: Use parameterized queries with Drizzle ORM
      switch (operation) {
        case 'activate':
          await drizzleDb
            .update(tags)
            .set({
              isActive: true,
              updatedAt: nowISO()
            })
            .where(inArray(tags.id, idArray));
          break;

        case 'deactivate':
          await drizzleDb
            .update(tags)
            .set({
              isActive: false,
              updatedAt: nowISO()
            })
            .where(inArray(tags.id, idArray));
          break;

        case 'update_color':
          if (!data?.color) {
            return validationErrorResponse(c, [
              { field: 'data.color', message: 'Color is required for color update' }
            ]);
          }
          await drizzleDb
            .update(tags)
            .set({
              color: data.color,
              updatedAt: nowISO()
            })
            .where(inArray(tags.id, idArray));
          break;

        default:
          return validationErrorResponse(c, [
            { field: 'operation', message: 'Invalid operation' }
          ]);
      }

      return successResponse(c, null, `Bulk ${operation} completed successfully`);

    } catch (error) {
      // Handle JSON parsing errors
      if (error instanceof SyntaxError) {
        return badRequestResponse(c, 'Invalid JSON');
      }
      return handleApiError(error, c);
    }
  },

  // Get customers for a tag
  async getTagCustomers(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const tagId = c.req.param('id');
      const page = Math.max(1, parseInt(c.req.query('page') || '1') || 1);
      const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
      const offset = (page - 1) * limit;

      // Check if tag exists
      const tag = await drizzleDb.get(sql`
        SELECT * FROM tags WHERE id = ${tagId} AND deleted_at IS NULL
      `);

      if (!tag) {
        return notFoundResponse(c, 'Tag');
      }

      // Get customers using this tag
      // Optimized query: removed LEFT JOIN on agents table since assigned_by_name is not displayed in UI
      const customers = await drizzleDb.all(sql`
        SELECT
          c.id,
          c.platform,
          c.platform_user_id,
          c.display_name,
          c.avatar_url,
          c.email,
          c.phone,
          c.created_at,
          ct.assigned_at,
          ct.assigned_by
        FROM customer_tags ct
        JOIN customers c ON ct.customer_id = c.id
        WHERE ct.tag_id = ${tagId}
          AND c.deleted_at IS NULL
        ORDER BY ct.assigned_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      // Get total count (join customers to exclude soft-deleted records)
      const countResult = await drizzleDb.get(sql`
        SELECT COUNT(*) as total
        FROM customer_tags ct
        JOIN customers c ON ct.customer_id = c.id
        WHERE ct.tag_id = ${tagId}
          AND c.deleted_at IS NULL
      `);

      const total = (countResult as CountRow | null)?.total || 0;
      const totalPages = Math.ceil(total / limit);

      return successResponse(c, {
        customers: customers || [],
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      }, 'Tag customers retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // Get conversations for a tag
  async getTagConversations(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const tagId = c.req.param('id');
      const page = Math.max(1, parseInt(c.req.query('page') || '1') || 1);
      const limit = Math.min(parseInt(c.req.query('limit') || '20') || 20, 100);
      const offset = (page - 1) * limit;

      // Check if tag exists
      const tag = await drizzleDb.get(sql`
        SELECT * FROM tags WHERE id = ${tagId} AND deleted_at IS NULL
      `);

      if (!tag) {
        return notFoundResponse(c, 'Tag');
      }

      // Get conversations for this tag (via customer_tags → customers → conversations)
      // Tags are applied to customers, so we find conversations belonging to tagged customers
      const conversations = await drizzleDb.all(sql`
        SELECT DISTINCT
          conv.id,
          conv.status,
          cust.platform as channel,
          conv.created_at,
          conv.updated_at,
          cust.display_name as customer_name,
          cust.avatar_url as customer_avatar,
          cust.platform as customer_platform,
          ct.assigned_at,
          ct.assigned_by
        FROM customer_tags ct
        JOIN customers cust ON ct.customer_id = cust.id
        JOIN conversations conv ON conv.customer_id = cust.id
        WHERE ct.tag_id = ${tagId}
          AND conv.deleted_at IS NULL
          AND cust.deleted_at IS NULL
        ORDER BY ct.assigned_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      // Get total count (via customer_tags → customers → conversations)
      const countResult = await drizzleDb.get(sql`
        SELECT COUNT(DISTINCT conv.id) as total
        FROM customer_tags ct
        JOIN customers cust ON ct.customer_id = cust.id
        JOIN conversations conv ON conv.customer_id = cust.id
        WHERE ct.tag_id = ${tagId}
          AND conv.deleted_at IS NULL
          AND cust.deleted_at IS NULL
      `);

      const total = (countResult as CountRow | null)?.total || 0;
      const totalPages = Math.ceil(total / limit);

      return successResponse(c, {
        conversations: conversations || [],
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      }, 'Tag conversations retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  }
};
