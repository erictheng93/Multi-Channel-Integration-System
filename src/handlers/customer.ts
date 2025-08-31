// src/handlers/customer.ts
// 客戶管理系統 - CRUD 操作、搜索和篩選

import { Context } from 'hono';
import type { 
  Bindings, 
  // Customer, // 暫時未使用
  // CustomerDbRecord, // 暫時未使用
  // CustomerStatsResult, // 暫時未使用
  // D1Result, // 暫時未使用
  // AuthPayload, // 暫時未使用
  QueryParams
} from '../types';
import { drizzle } from 'drizzle-orm/d1';
import { customers, conversations, messages, tags, customerTags, teams } from '../db/schema';
import { eq, and, count, desc, like, sql, or, inArray } from 'drizzle-orm';
import { 
  successResponse, 
  paginatedResponse,
  // errorResponse, // 暫時未使用 
  validationErrorResponse, 
  // unauthorizedResponse, // 暫時未使用
  notFoundResponse,
  handleApiError 
} from '../utils/api-response';

/*
interface CustomerFilters {
  platform?: string;
  teamId?: number;
  tagId?: number;
  search?: string;
  hasEmail?: boolean;
  hasPhone?: boolean;
  dateFrom?: string;
  dateTo?: string;
  status?: 'active' | 'inactive';
}
*/

interface CustomerStats {
  total: number;
  byPlatform: Record<string, number>;
  byTeam: Record<string, number>;
  withTags: number;
  withEmail: number;
  withPhone: number;
  recentActive: number; // 最近7天活躍
}

export const customerHandler = {
  // 獲取客戶列表（支持搜索和篩選）
  async list(c: Context<{ Bindings: Bindings }>) {
    try {
      const payload = c.get('jwtPayload');
      const { 
        page = '1', 
        pageSize = '20', 
        platform,
        teamId,
        tagId,
        search,
        hasEmail,
        hasPhone,
        dateFrom,
        dateTo,
        // status = 'active' // 暫時未使用
      } = c.req.query();

      const offset = (parseInt(page) - 1) * parseInt(pageSize);
      const limit = parseInt(pageSize);

      // 構建查詢 - 保持複雜 GROUP_CONCAT 查詢暫時使用原生 SQL
      // 這是因為 Drizzle 目前還不支援 GROUP_CONCAT 以及複雜的子查詢
      const drizzleDb = drizzle(c.env.DB);
      
      let query = `
        SELECT DISTINCT c.*,
               t.name as team_name,
               GROUP_CONCAT(tag.name, ',') as tag_names,
               GROUP_CONCAT(tag.color, ',') as tag_colors,
               conv_count.total_conversations,
               conv_count.active_conversations,
               last_conv.last_conversation_at
        FROM customers c
        LEFT JOIN teams t ON c.source_team_id = t.id
        LEFT JOIN customer_tags ct ON c.id = ct.customer_id
        LEFT JOIN tags tag ON ct.tag_id = tag.id
        LEFT JOIN (
          SELECT customer_id, 
                 COUNT(*) as total_conversations,
                 COUNT(CASE WHEN status = 'active' THEN 1 END) as active_conversations
          FROM conversations 
          GROUP BY customer_id
        ) conv_count ON c.id = conv_count.customer_id
        LEFT JOIN (
          SELECT customer_id, MAX(created_at) as last_conversation_at
          FROM conversations 
          GROUP BY customer_id
        ) last_conv ON c.id = last_conv.customer_id
      `;

      const whereConditions: string[] = [];
      const params: QueryParams = [];

      // 權限控制：非管理員只能看到自己團隊的客戶
      if (payload?.role !== 'admin' && payload?.teamId) {
        whereConditions.push('(c.source_team_id = ? OR c.source_team_id IS NULL)');
        params.push(payload.teamId);
      }

      // 平台篩選
      if (platform) {
        whereConditions.push('c.platform = ?');
        params.push(platform);
      }

      // 團隊篩選
      if (teamId) {
        whereConditions.push('c.source_team_id = ?');
        params.push(parseInt(teamId));
      }

      // 標籤篩選
      if (tagId) {
        whereConditions.push('ct.tag_id = ?');
        params.push(parseInt(tagId));
      }

      // 搜索（姓名、郵箱、電話）
      if (search) {
        whereConditions.push(`(
          c.display_name LIKE ? OR 
          c.email LIKE ? OR 
          c.phone LIKE ? OR
          c.platform_user_id LIKE ?
        )`);
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }

      // 郵箱篩選
      if (hasEmail === 'true') {
        whereConditions.push('c.email IS NOT NULL AND c.email != ""');
      } else if (hasEmail === 'false') {
        whereConditions.push('(c.email IS NULL OR c.email = "")');
      }

      // 電話篩選
      if (hasPhone === 'true') {
        whereConditions.push('c.phone IS NOT NULL AND c.phone != ""');
      } else if (hasPhone === 'false') {
        whereConditions.push('(c.phone IS NULL OR c.phone = "")');
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

      if (whereConditions.length > 0) {
        query += ' WHERE ' + whereConditions.join(' AND ');
      }

      query += ' GROUP BY c.id ORDER BY c.updated_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      // 手動替換參數到查詢中
      let finalQuery = query;
      let paramIndex = 0;
      while (finalQuery.includes('?') && paramIndex < params.length) {
        const param = params[paramIndex];
        const escapedParam = typeof param === 'string' ? `'${param.replace(/'/g, "''")}'` : String(param);
        finalQuery = finalQuery.replace('?', escapedParam);
        paramIndex++;
      }
      
      // 使用 Drizzle sql 執行查詢
      const result = await drizzleDb.all(sql.raw(finalQuery));

      // 計算總數 - 使用 Drizzle ORM 進行簡化計數
      let countQuery = `
        SELECT COUNT(DISTINCT c.id) as total 
        FROM customers c
        LEFT JOIN customer_tags ct ON c.id = ct.customer_id
      `;
      
      if (whereConditions.length > 0) {
        countQuery += ' WHERE ' + whereConditions.join(' AND ');
      }

      const countParams = params.slice(0, -2); // 移除 LIMIT 和 OFFSET
      
      // 手動替換計數查詢的參數
      let finalCountQuery = countQuery;
      let countParamIndex = 0;
      while (finalCountQuery.includes('?') && countParamIndex < countParams.length) {
        const param = countParams[countParamIndex];
        const escapedParam = typeof param === 'string' ? `'${param.replace(/'/g, "''")}'` : String(param);
        finalCountQuery = finalCountQuery.replace('?', escapedParam);
        countParamIndex++;
      }
      
      const totalResult = await drizzleDb.get(sql.raw(finalCountQuery));

      // 格式化結果
      const customersData = result.map((row: any) => ({
        id: row.id,
        platform: row.platform,
        platformUserId: row.platform_user_id,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        phone: row.phone,
        email: row.email,
        sourceTeamId: row.source_team_id,
        teamName: row.team_name,
        tags: row.tag_names ? row.tag_names.split(',').map((name: string, index: number) => ({
          name,
          color: row.tag_colors?.split(',')[index] || '#3B82F6'
        })) : [],
        totalConversations: row.total_conversations || 0,
        activeConversations: row.active_conversations || 0,
        lastConversationAt: row.last_conversation_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        metadata: row.metadata ? JSON.parse(row.metadata) : null
      }));

      return paginatedResponse(c, customersData, {
        page: parseInt(page),
        limit,
        total: Number((totalResult as any)?.total) || 0
      }, 'Customers retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取單一客戶詳情
  async get(c: Context<{ Bindings: Bindings }>) {
    try {
      const customerId = c.req.param('id');

      // 使用 Drizzle ORM 查詢客戶基本資料
      const drizzleDb = drizzle(c.env.DB);
      
      const customer = await drizzleDb
        .select({
          id: customers.id,
          platform: customers.platform,
          platform_user_id: customers.platformUserId,
          display_name: customers.displayName,
          avatar_url: customers.avatarUrl,
          phone: customers.phone,
          email: customers.email,
          source_team_id: customers.sourceTeamId,
          metadata: customers.metadata,
          created_at: customers.createdAt,
          updated_at: customers.updatedAt,
          team_name: teams.name
        })
        .from(customers)
        .leftJoin(teams, eq(customers.sourceTeamId, teams.id))
        .where(eq(customers.id, parseInt(customerId)))
        .get();
      
      if (!customer) {
        return notFoundResponse(c, 'Customer');
      }
      
      // 獨立查詢標籤資料
      const customerTagsData = await drizzleDb
        .select({
          tag_id: tags.id,
          tag_name: tags.name,
          tag_color: tags.color
        })
        .from(customerTags)
        .innerJoin(tags, eq(customerTags.tagId, tags.id))
        .where(eq(customerTags.customerId, parseInt(customerId)))
        .all();

      if (!customer) {
        return notFoundResponse(c, 'Customer');
      }

      // 獲取客戶的對話統計 - using Drizzle ORM
      
      const totalConversations = await drizzleDb
        .select({ count: count() })
        .from(conversations)
        .where(eq(conversations.customerId, parseInt(customerId)))
        .get();
        
      const activeConversations = await drizzleDb
        .select({ count: count() })
        .from(conversations)
        .where(and(
          eq(conversations.customerId, parseInt(customerId)),
          eq(conversations.status, 'active')
        ))
        .get();
        
      const closedConversations = await drizzleDb
        .select({ count: count() })
        .from(conversations)
        .where(and(
          eq(conversations.customerId, parseInt(customerId)),
          eq(conversations.status, 'closed')
        ))
        .get();
        
      // 使用 Drizzle ORM 查詢對話日期
      const conversationDates = await drizzleDb
        .select({
          last_conversation_at: sql<string>`MAX(${conversations.createdAt})`,
          first_conversation_at: sql<string>`MIN(${conversations.createdAt})`
        })
        .from(conversations)
        .where(eq(conversations.customerId, parseInt(customerId)))
        .get();

      // 獲取最近的訊息 - using Drizzle ORM  
      const recentMessages = await drizzleDb
        .select({
          id: messages.id,
          content: messages.content,
          messageType: messages.messageType,
          senderType: messages.senderType,
          createdAt: messages.createdAt,
          conversationId: conversations.id
        })
        .from(messages)
        .innerJoin(conversations, eq(messages.conversationId, conversations.id))
        .where(eq(conversations.customerId, parseInt(customerId)))
        .orderBy(desc(messages.createdAt))
        .limit(5)
        .all();

      const customerData = {
        id: customer.id,
        platform: customer.platform,
        platformUserId: customer.platform_user_id,
        displayName: customer.display_name,
        avatarUrl: customer.avatar_url,
        phone: customer.phone,
        email: customer.email,
        sourceTeamId: customer.source_team_id,
        teamName: customer.team_name,
        tags: customerTagsData.map(tag => ({
          id: tag.tag_id,
          name: tag.tag_name,
          color: tag.tag_color || '#3B82F6'
        })),
        conversationStats: {
          total: totalConversations?.count || 0,
          active: activeConversations?.count || 0,
          closed: closedConversations?.count || 0,
          lastConversationAt: conversationDates?.last_conversation_at,
          firstConversationAt: conversationDates?.first_conversation_at
        },
        recentMessages: recentMessages.map((msg: any) => ({
          id: msg.id,
          conversationId: msg.conversation_id,
          senderType: msg.sender_type,
          content: msg.content,
          messageType: msg.message_type,
          createdAt: msg.created_at
        })),
        createdAt: customer.created_at,
        updatedAt: customer.updated_at,
        metadata: customer.metadata && typeof customer.metadata === 'string' 
          ? JSON.parse(customer.metadata) 
          : null
      };

      return successResponse(c, customerData, 'Customer retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 更新客戶資料
  async update(c: Context<{ Bindings: Bindings }>) {
    try {
      const customerId = c.req.param('id');
      const { displayName, phone, email, sourceTeamId, metadata } = await c.req.json();

      // 使用 Drizzle ORM 檢查客戶是否存在
      const drizzleDb = drizzle(c.env.DB);
      const existingCustomer = await drizzleDb
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.id, parseInt(customerId)))
        .get();

      if (!existingCustomer) {
        return notFoundResponse(c, 'Customer');
      }

      // 使用 Drizzle ORM 更新客戶資料
      await drizzleDb
        .update(customers)
        .set({
          displayName: displayName || null,
          phone: phone || null,
          email: email || null,
          sourceTeamId: sourceTeamId || null,
          metadata: metadata ? JSON.stringify(metadata) : null,
          updatedAt: new Date().toISOString()
        })
        .where(eq(customers.id, parseInt(customerId)));

      return successResponse(c, null, 'Customer updated successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 為客戶添加標籤
  async addTags(c: Context<{ Bindings: Bindings }>) {
    try {
      const customerId = c.req.param('id');
      const { tagIds } = await c.req.json();
      const payload = c.get('jwtPayload');

      if (!Array.isArray(tagIds) || tagIds.length === 0) {
        return validationErrorResponse(c, [
          { field: 'tagIds', message: 'Tag IDs array is required' }
        ]);
      }

      // 使用 Drizzle ORM 檢查客戶是否存在
      const drizzleDb = drizzle(c.env.DB);
      const customer = await drizzleDb
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.id, parseInt(customerId)))
        .get();

      if (!customer) {
        return notFoundResponse(c, 'Customer');
      }

      // 使用 Drizzle ORM 批量添加標籤
      const insertData = tagIds.map(tagId => ({
        customerId: parseInt(customerId),
        tagId: parseInt(tagId),
        assignedBy: payload?.userId ? String(payload.userId) : null
      }));

      // 使用 onConflictDoNothing 來模擬 INSERT OR IGNORE
      for (const tagData of insertData) {
        try {
          await ((drizzleDb as any)
            .insert(customerTags)
            .values(tagData));
        } catch (error) {
          // Ignore duplicate key errors (simulates INSERT OR IGNORE)
        }
      }

      return successResponse(c, null, 'Tags added successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 移除客戶標籤
  async removeTags(c: Context<{ Bindings: Bindings }>) {
    try {
      const customerId = c.req.param('id');
      const { tagIds } = await c.req.json();

      if (!Array.isArray(tagIds) || tagIds.length === 0) {
        return validationErrorResponse(c, [
          { field: 'tagIds', message: 'Tag IDs array is required' }
        ]);
      }

      // 使用 Drizzle ORM 移除標籤
      const drizzleDb = drizzle(c.env.DB);
      await drizzleDb
        .delete(customerTags)
        .where(and(
          eq(customerTags.customerId, parseInt(customerId)),
          inArray(customerTags.tagId, tagIds.map(id => parseInt(id)))
        ));

      return successResponse(c, null, 'Tags removed successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取客戶統計數據
  async getStats(c: Context<{ Bindings: Bindings }>) {
    try {
      const payload = c.get('jwtPayload');
      
      // 使用 Drizzle ORM 進行統計查詢
      const drizzleDb = drizzle(c.env.DB);
      
      // 構建權限控制條件
      const baseConditions = [];
      if (payload?.role !== 'admin' && payload?.teamId) {
        baseConditions.push(
          sql`(${customers.sourceTeamId} = ${payload.teamId} OR ${customers.sourceTeamId} IS NULL)`
        );
      }
      const baseCondition = baseConditions.length > 0 ? and(...baseConditions) : undefined;
      
      // 總客戶數
      const totalResult = await drizzleDb
        .select({ total: count(customers.id) })
        .from(customers)
        .where(baseCondition)
        .get();

      // 按平台統計
      const platformStats = await drizzleDb
        .select({
          platform: customers.platform,
          count: count(customers.id)
        })
        .from(customers)
        .where(baseCondition)
        .groupBy(customers.platform)
        .all();

      // 按團隊統計
      const teamStats = await drizzleDb
        .select({
          team_name: sql<string>`COALESCE(${teams.name}, '未分配')`,
          count: count(customers.id)
        })
        .from(customers)
        .leftJoin(teams, eq(customers.sourceTeamId, teams.id))
        .where(baseCondition)
        .groupBy(customers.sourceTeamId, teams.name)
        .all();

      // 有標籤的客戶數
      const taggedResult = await drizzleDb
        .select({ count: count(customers.id) })
        .from(customers)
        .innerJoin(customerTags, eq(customers.id, customerTags.customerId))
        .where(baseCondition)
        .get();

      // 有郵箱的客戶數
      const emailConditions = baseConditions.slice();
      emailConditions.push(sql`${customers.email} IS NOT NULL AND ${customers.email} != ''`);
      const emailResult = await drizzleDb
        .select({ count: count(customers.id) })
        .from(customers)
        .where(emailConditions.length > 0 ? and(...emailConditions) : undefined)
        .get();

      // 有電話的客戶數
      const phoneConditions = baseConditions.slice();
      phoneConditions.push(sql`${customers.phone} IS NOT NULL AND ${customers.phone} != ''`);
      const phoneResult = await drizzleDb
        .select({ count: count(customers.id) })
        .from(customers)
        .where(phoneConditions.length > 0 ? and(...phoneConditions) : undefined)
        .get();

      // 最近7天活躍客戶
      const recentActiveConditions = baseConditions.slice();
      recentActiveConditions.push(
        sql`${messages.createdAt} >= datetime('now', '-7 days')`,
        eq(messages.senderType, 'customer')
      );
      const recentActiveResult = await drizzleDb
        .select({ count: count(customers.id) })
        .from(customers)
        .innerJoin(conversations, eq(customers.id, conversations.customerId))
        .innerJoin(messages, eq(conversations.id, messages.conversationId))
        .where(recentActiveConditions.length > 0 ? and(...recentActiveConditions) : undefined)
        .get();

      const stats: CustomerStats = {
        total: totalResult?.total || 0,
        byPlatform: {},
        byTeam: {},
        withTags: taggedResult?.count || 0,
        withEmail: emailResult?.count || 0,
        withPhone: phoneResult?.count || 0,
        recentActive: recentActiveResult?.count || 0
      };

      // 格式化平台統計
      platformStats.forEach(row => {
        stats.byPlatform[row.platform] = row.count;
      });

      // 格式化團隊統計
      teamStats.forEach(row => {
        stats.byTeam[row.team_name] = row.count;
      });

      return successResponse(c, stats, 'Customer statistics retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 搜索客戶（快速搜索API）
  async search(c: Context<{ Bindings: Bindings }>) {
    try {
      const { q, limit = '10', platform } = c.req.query();

      if (!q || q.length < 2) {
        return validationErrorResponse(c, [
          { field: 'q', message: 'Search query must be at least 2 characters' }
        ]);
      }

      // 使用 Drizzle ORM 進行搜索
      const drizzleDb = drizzle(c.env.DB);
      const searchTerm = `%${q}%`;
      
      // 構建搜索條件
      const searchConditions = [
        like(customers.displayName, searchTerm),
        like(customers.email, searchTerm),
        like(customers.phone, searchTerm),
        like(customers.platformUserId, searchTerm)
      ];
      
      const conditions = [or(...searchConditions)];
      
      if (platform) {
        conditions.push(eq(customers.platform, platform));
      }
      
      // 使用 CASE 表達式進行排序（藉由 sql 模板）
      const orderByPriority = sql`
        CASE 
          WHEN ${customers.displayName} LIKE ${searchTerm} THEN 1
          WHEN ${customers.email} LIKE ${searchTerm} THEN 2
          WHEN ${customers.phone} LIKE ${searchTerm} THEN 3
          ELSE 4
        END
      `;
      
      const searchResults = await drizzleDb
        .select({
          id: customers.id,
          platform: customers.platform,
          platform_user_id: customers.platformUserId,
          display_name: customers.displayName,
          avatar_url: customers.avatarUrl,
          email: customers.email,
          phone: customers.phone
        })
        .from(customers)
        .where(and(...conditions))
        .orderBy(orderByPriority)
        .limit(parseInt(limit))
        .all();

      const customersData = searchResults.map(row => ({
        id: row.id,
        platform: row.platform,
        platformUserId: row.platform_user_id,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        email: row.email,
        phone: row.phone
      }));

      return successResponse(c, customersData, 'Search results retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  }
};