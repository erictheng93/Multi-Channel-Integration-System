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
import { sql, eq, and, or, asc, like, count, inArray } from 'drizzle-orm';

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

      const offset = (parseInt(page) - 1) * parseInt(pageSize);
      const limit = parseInt(pageSize);

      // Simplified query: return all active tags
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

      // Search (simplified: no team distinction)
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

      // Count total - use the same where conditions
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
        teamName: null as string | null, // Simplified without join
        isActive: Boolean(row.isActive),
        createdBy: row.createdBy,
        createdByName: null as string | null, // Simplified without join
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

  // Create tag
  async create(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const payload = c.get('jwtPayload');
      const { name, color = '#3B82F6', description, teamId } = await c.req.json();

      // Validate required fields
      if (!name || !name.trim()) {
        return badRequestResponse(c, 'Tag name is required');
      }

      // Validate color format
      if (color && !isValidHexColor(color)) {
        return validationErrorResponse(c, [
          { field: 'color', message: 'Invalid color format. Use HEX format (e.g., #FF5733 or #F53)' }
        ]);
      }

      // Normalize color format
      const normalizedColor = normalizeHexColor(color);

      // Simplified permission model: all agents can create tags (no global/team distinction)
      // Tags are stored uniformly, teamId kept as null (globally visible)

      // Check if tag name already exists (global scope, no team distinction)
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

      // Create tag (simplified model: all tags are globally visible, teamId = null)
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

  // Update tag
  async update(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const tagId = c.req.param('id');
      const { name, color, description, isActive } = await c.req.json();
      const payload = c.get('jwtPayload');

      // Check if tag exists
      const existingTag = await drizzleDb.get(sql`
        SELECT * FROM tags WHERE id = ${tagId}
      `);

      if (!existingTag) {
        return notFoundResponse(c, 'Tag');
      }

      // Simplified permission model: all agents can edit any tag

      // Validate color format (if color provided)
      let normalizedColor = color;
      if (color !== undefined && color !== null) {
        if (!isValidHexColor(color)) {
          return validationErrorResponse(c, [
            { field: 'color', message: 'Invalid color format. Use HEX format (e.g., #FF5733 or #F53)' }
          ]);
        }
        normalizedColor = normalizeHexColor(color);
      }

      // If updating name, check for duplicates (global scope)
      if (name && name !== (existingTag as any).name) {
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
          SELECT tag_id, COUNT(DISTINCT conversation_id) as count
          FROM conversation_tags
          WHERE tag_id = ${tagId}
        ) conversation_count ON t.id = conversation_count.tag_id
        WHERE t.id = ${tagId}
      `);

      if (!updatedTag) {
        return errorResponse(c, 'Failed to retrieve updated tag', 500);
      }

      return successResponse(c, {
        id: (updatedTag as any).id,
        name: (updatedTag as any).name,
        color: (updatedTag as any).color,
        description: (updatedTag as any).description,
        teamId: (updatedTag as any).team_id,
        isActive: Boolean((updatedTag as any).is_active),
        createdBy: (updatedTag as any).created_by,
        customerCount: (updatedTag as any).customer_count,
        conversationCount: (updatedTag as any).conversation_count,
        createdAt: (updatedTag as any).created_at,
        updatedAt: (updatedTag as any).updated_at
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
      const payload = c.get('jwtPayload');

      // Check if tag exists
      const existingTag = await drizzleDb.get(sql`
        SELECT * FROM tags WHERE id = ${tagId}
      `);

      if (!existingTag) {
        return notFoundResponse(c, 'Tag');
      }

      // Simplified permission model: all agents can delete any tag

      // Soft delete tag
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

  // Get tag usage statistics
  async getUsageStats(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const tagId = c.req.param('id');

      // Check if tag exists
      const tag = await drizzleDb.get(sql`
        SELECT * FROM tags WHERE id = ${tagId}
      `);

      if (!tag) {
        return notFoundResponse(c, 'Tag');
      }

      // Customer usage statistics
      const customerStats = await drizzleDb.get(sql`
        SELECT
          COUNT(*) as total_customers,
          COUNT(CASE WHEN c.platform = 'line' THEN 1 END) as line_customers,
          COUNT(CASE WHEN c.platform = 'facebook' THEN 1 END) as facebook_customers
        FROM customer_tags ct
        JOIN customers c ON ct.customer_id = c.id
        WHERE ct.tag_id = ${tagId}
      `);

      // Conversation usage statistics
      const conversationStats = await drizzleDb.get(sql`
        SELECT
          COUNT(*) as total_conversations,
          COUNT(CASE WHEN conv.status = 'active' THEN 1 END) as active_conversations,
          COUNT(CASE WHEN conv.status = 'closed' THEN 1 END) as closed_conversations
        FROM conversation_tags ct
        JOIN conversations conv ON ct.conversation_id = conv.id
        WHERE ct.tag_id = ${tagId}
      `);

      // Recent usage trend (last 30 days)
      const usageTrendResults = await drizzleDb.all(sql`
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

      // Most active assigners (Fixed: use agents table instead of users)
      const topAssignersResults = await drizzleDb.all(sql`
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
        usageTrend: (usageTrendResults || []).map((row: any) => ({
          date: row.date,
          assignments: row.assignments
        })),
        topAssigners: (topAssignersResults || []).map((row: any) => ({
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
              updatedAt: new Date().toISOString()
            })
            .where(inArray(tags.id, idArray));
          break;

        case 'deactivate':
          await drizzleDb
            .update(tags)
            .set({
              isActive: false,
              updatedAt: new Date().toISOString()
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
              updatedAt: new Date().toISOString()
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
      const page = parseInt(c.req.query('page') || '1');
      const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
      const offset = (page - 1) * limit;

      // Check if tag exists
      const tag = await drizzleDb.get(sql`
        SELECT * FROM tags WHERE id = ${tagId}
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
        ORDER BY ct.assigned_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      // Get total count
      const countResult = await drizzleDb.get(sql`
        SELECT COUNT(*) as total
        FROM customer_tags
        WHERE tag_id = ${tagId}
      `);

      const total = (countResult as any)?.total || 0;
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
  }
};
