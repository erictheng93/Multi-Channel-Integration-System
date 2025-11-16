// src/handlers/customer.ts
// 客戶管理系統 - CRUD 操作、搜索和篩選

import { Context } from 'hono';
import type { 
  Bindings
} from '../types';
import { drizzle } from 'drizzle-orm/d1';
import { customers, conversations, messages, tags, customerTags, teams } from '../db/schema';
import { eq, and, count, desc, like, sql, or, inArray } from 'drizzle-orm';
import {
  successResponse,
  paginatedResponse,
  validationErrorResponse,
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
      } = c.req.query();

      const offset = (parseInt(page) - 1) * parseInt(pageSize);
      const limit = parseInt(pageSize);

      const drizzleDb = drizzle(c.env.DB);
      
      const conditions = [];
      if (payload?.role !== 'admin' && payload?.teamId) {
        conditions.push(sql`(${customers.sourceTeamId} = ${payload.teamId} OR ${customers.sourceTeamId} IS NULL)`);
      }
      if (platform) {
        conditions.push(eq(customers.platform, platform));
      }
      if (teamId) {
        conditions.push(eq(customers.sourceTeamId, parseInt(teamId)));
      }
      if (tagId) {
        conditions.push(eq(customerTags.tagId, parseInt(tagId)));
      }
      if (search) {
        const searchTerm = `%${search}%`;
        conditions.push(or(
          like(customers.displayName, searchTerm),
          like(customers.email, searchTerm),
          like(customers.phone, searchTerm),
          like(customers.platformUserId, searchTerm)
        ));
      }
      if (hasEmail === 'true') {
        conditions.push(sql`${customers.email} IS NOT NULL AND ${customers.email} != ''`);
      } else if (hasEmail === 'false') {
        conditions.push(sql`(${customers.email} IS NULL OR ${customers.email} = '')`);
      }
      if (hasPhone === 'true') {
        conditions.push(sql`${customers.phone} IS NOT NULL AND ${customers.phone} != ''`);
      } else if (hasPhone === 'false') {
        conditions.push(sql`(${customers.phone} IS NULL OR ${customers.phone} = '')`);
      }
      if (dateFrom) {
        conditions.push(sql`${customers.createdAt} >= ${dateFrom}`);
      }
      if (dateTo) {
        conditions.push(sql`${customers.createdAt} <= ${dateTo}`);
      }

      const convCountSubquery = drizzleDb
        .select({
          customerId: conversations.customerId,
          totalConversations: sql<number>`COUNT(*)`.as('total_conversations'),
          activeConversations: sql<number>`COUNT(CASE WHEN ${conversations.status} = 'active' THEN 1 END)`.as('active_conversations'),
        })
        .from(conversations)
        .groupBy(conversations.customerId)
        .as('conv_count');

      const lastConvSubquery = drizzleDb
        .select({
          customerId: conversations.customerId,
          lastConversationAt: sql<string>`MAX(${conversations.createdAt})`.as('last_conversation_at'),
        })
        .from(conversations)
        .groupBy(conversations.customerId)
        .as('last_conv');

      const query = drizzleDb.select({
        id: customers.id,
        platform: customers.platform,
        platformUserId: customers.platformUserId,
        displayName: customers.displayName,
        avatarUrl: customers.avatarUrl,
        phone: customers.phone,
        email: customers.email,
        sourceTeamId: customers.sourceTeamId,
        teamName: teams.name,
        tagNames: sql<string>`GROUP_CONCAT(${tags.name}, ',')`.as('tag_names'),
        tagColors: sql<string>`GROUP_CONCAT(${tags.color}, ',')`.as('tag_colors'),
        totalConversations: convCountSubquery.totalConversations,
        activeConversations: convCountSubquery.activeConversations,
        lastConversationAt: lastConvSubquery.lastConversationAt,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
        metadata: customers.metadata,
      })
      .from(customers)
      .leftJoin(teams, eq(customers.sourceTeamId, teams.id))
      .leftJoin(customerTags, eq(customers.id, customerTags.customerId))
      .leftJoin(tags, eq(customerTags.tagId, tags.id))
      .leftJoin(convCountSubquery, eq(customers.id, convCountSubquery.customerId))
      .leftJoin(lastConvSubquery, eq(customers.id, lastConvSubquery.customerId))
      .where(and(...conditions))
      .groupBy(customers.id)
      .orderBy(desc(customers.updatedAt))
      .limit(limit)
      .offset(offset);

      const result = await query.all();

      const countQuery = drizzleDb
        .select({ total: sql<number>`COUNT(DISTINCT ${customers.id})` })
        .from(customers)
        .leftJoin(customerTags, eq(customers.id, customerTags.customerId))
        .where(and(...conditions));
      
      const totalResult = await countQuery.get();

      const customersData = result.map((row: any) => ({
        id: row.id,
        platform: row.platform,
        platformUserId: row.platformUserId,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        phone: row.phone,
        email: row.email,
        sourceTeamId: row.sourceTeamId,
        teamName: row.teamName,
        tags: row.tagNames ? row.tagNames.split(',').map((name: string, index: number) => ({
          name,
          color: row.tagColors?.split(',')[index] || '#3B82F6'
        })) : [],
        totalConversations: row.totalConversations || 0,
        activeConversations: row.activeConversations || 0,
        lastConversationAt: row.lastConversationAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        metadata: row.metadata ? JSON.parse(row.metadata) : null
      }));

      return paginatedResponse(c, customersData, {
        page: parseInt(page),
        limit,
        total: totalResult?.total || 0
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
          platformUserId: customers.platformUserId,
          displayName: customers.displayName,
          avatarUrl: customers.avatarUrl,
          phone: customers.phone,
          email: customers.email,
          sourceTeamId: customers.sourceTeamId,
          metadata: customers.metadata,
          createdAt: customers.createdAt,
          updatedAt: customers.updatedAt,
          teamName: teams.name
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
          tagId: tags.id,
          tagName: tags.name,
          tagColor: tags.color
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
          lastConversationAt: sql<string>`MAX(${conversations.createdAt})`,
          firstConversationAt: sql<string>`MIN(${conversations.createdAt})`
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
        platformUserId: customer.platformUserId,
        displayName: customer.displayName,
        avatarUrl: customer.avatarUrl,
        phone: customer.phone,
        email: customer.email,
        sourceTeamId: customer.sourceTeamId,
        teamName: customer.teamName,
        tags: customerTagsData.map(tag => ({
          id: tag.tagId,
          name: tag.tagName,
          color: tag.tagColor || '#3B82F6'
        })),
        conversationStats: {
          total: totalConversations?.count || 0,
          active: activeConversations?.count || 0,
          closed: closedConversations?.count || 0,
          lastConversationAt: conversationDates?.lastConversationAt,
          firstConversationAt: conversationDates?.firstConversationAt
        },
        recentMessages: recentMessages.map((msg: any) => ({
          id: msg.id,
          conversationId: msg.conversationId,
          senderType: msg.senderType,
          content: msg.content,
          messageType: msg.messageType,
          createdAt: msg.createdAt
        })),
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
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
      
      const drizzleDb = drizzle(c.env.DB);
      
      const baseConditions = [];
      if (payload?.role !== 'admin' && payload?.teamId) {
        baseConditions.push(
          sql`(${customers.sourceTeamId} = ${payload.teamId} OR ${customers.sourceTeamId} IS NULL)`
        );
      }
      const baseCondition = baseConditions.length > 0 ? and(...baseConditions) : undefined;
      
      const totalResult = await drizzleDb
        .select({ total: count(customers.id) })
        .from(customers)
        .where(baseCondition)
        .get();

      const platformStats = await drizzleDb
        .select({
          platform: customers.platform,
          count: count(customers.id)
        })
        .from(customers)
        .where(baseCondition)
        .groupBy(customers.platform)
        .all();

      const teamStats = await drizzleDb
        .select({
          teamName: sql<string>`COALESCE(${teams.name}, '未分配')`,
          count: count(customers.id)
        })
        .from(customers)
        .leftJoin(teams, eq(customers.sourceTeamId, teams.id))
        .where(baseCondition)
        .groupBy(customers.sourceTeamId, teams.name)
        .all();

      const taggedResult = await drizzleDb
        .select({ count: count(customers.id) })
        .from(customers)
        .innerJoin(customerTags, eq(customers.id, customerTags.customerId))
        .where(baseCondition)
        .get();

      const emailConditions = baseConditions.slice();
      emailConditions.push(sql`${customers.email} IS NOT NULL AND ${customers.email} != ''`);
      const emailResult = await drizzleDb
        .select({ count: count(customers.id) })
        .from(customers)
        .where(and(...emailConditions))
        .get();

      const phoneConditions = baseConditions.slice();
      phoneConditions.push(sql`${customers.phone} IS NOT NULL AND ${customers.phone} != ''`);
      const phoneResult = await drizzleDb
        .select({ count: count(customers.id) })
        .from(customers)
        .where(and(...phoneConditions))
        .get();

      const recentActiveConditions = baseConditions.slice();
      recentActiveConditions.push(
        sql`${messages.createdAt} >= datetime('now', '-7 days')`,
        eq(messages.senderType, 'customer')
      );
      const recentActiveResult = await drizzleDb
        .select({ count: sql<number>`COUNT(DISTINCT ${customers.id})` })
        .from(customers)
        .innerJoin(conversations, eq(customers.id, conversations.customerId))
        .innerJoin(messages, eq(conversations.id, messages.conversationId))
        .where(and(...recentActiveConditions))
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

      platformStats.forEach(row => {
        stats.byPlatform[row.platform] = row.count;
      });

      teamStats.forEach(row => {
        stats.byTeam[row.teamName] = row.count;
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
          platformUserId: customers.platformUserId,
          displayName: customers.displayName,
          avatarUrl: customers.avatarUrl,
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
        platformUserId: row.platformUserId,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        email: row.email,
        phone: row.phone
      }));

      return successResponse(c, customersData, 'Search results retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  }
};