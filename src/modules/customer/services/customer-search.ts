// Customer 搜索服務
// 提供客戶的搜索、篩選、分頁等功能

import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc, like, sql, or, inArray, count } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import {
  customers,
  customerTags,
  tags,
  teams,
  conversations,
  messages
} from '@/db/schema';
import {
  CustomerListItem,
  CustomerFilters,
  CustomerSearchQuery,
  CustomerSearchResult,
  CustomerListResponse,
  CustomerSearchResponse
} from '../types/customer-types';
import type { JWTPayload } from '@/types';

export class CustomerSearchService {
  private drizzleDb: ReturnType<typeof drizzle>;

  constructor(private db: D1Database) {
    this.drizzleDb = drizzle(db);
  }

  // ======================== 客戶列表查詢 ========================

  /**
   * 獲取客戶列表 (支持搜索和篩選)
   */
  async getCustomerList(
    filters: CustomerFilters = {},
    pagination: { page: number; pageSize: number },
    userPayload?: JWTPayload
  ): Promise<CustomerListResponse> {
    try {
      const { page, pageSize } = pagination;
      const offset = (page - 1) * pageSize;

      // 建立篩選條件
      const conditions = this.buildFilterConditions(filters, userPayload);

      // 建立子查詢：對話統計
      const conversationStatsSubquery = this.drizzleDb
        .select({
          customerId: conversations.customerId,
          totalConversations: sql<number>`COUNT(*)`.as('total_conversations'),
          activeConversations: sql<number>`COUNT(CASE WHEN ${conversations.status} = 'active' THEN 1 END)`.as('active_conversations'),
        })
        .from(conversations)
        .groupBy(conversations.customerId)
        .as('conv_stats');

      // 建立子查詢：最後對話時間
      const lastConversationSubquery = this.drizzleDb
        .select({
          customerId: conversations.customerId,
          lastConversationAt: sql<string>`MAX(${conversations.createdAt})`.as('last_conversation_at'),
        })
        .from(conversations)
        .groupBy(conversations.customerId)
        .as('last_conv');

      // 主查詢
      const query = this.drizzleDb.select({
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
        totalConversations: conversationStatsSubquery.totalConversations,
        activeConversations: conversationStatsSubquery.activeConversations,
        lastConversationAt: lastConversationSubquery.lastConversationAt,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
        metadata: customers.metadata,
      })
      .from(customers)
      .leftJoin(teams, eq(customers.sourceTeamId, teams.id))
      .leftJoin(customerTags, eq(customers.id, customerTags.customerId))
      .leftJoin(tags, eq(customerTags.tagId, tags.id))
      .leftJoin(conversationStatsSubquery, eq(customers.id, conversationStatsSubquery.customerId))
      .leftJoin(lastConversationSubquery, eq(customers.id, lastConversationSubquery.customerId))
      .where(and(...conditions))
      .groupBy(customers.id)
      .orderBy(desc(customers.updatedAt))
      .limit(pageSize)
      .offset(offset);

      const result = await query.all();

      // 計算總數
      const totalCount = await this.getFilteredCustomersCount(filters, userPayload);

      // 格式化結果
      const customersData: CustomerListItem[] = result.map((row: any) => ({
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
        metadata: row.metadata,
      }));

      return {
        customers: customersData,
        pagination: {
          page,
          limit: pageSize,
          total: totalCount,
          totalPages: Math.ceil(totalCount / pageSize)
        }
      };
    } catch (error) {
      console.error('Error getting customer list:', error);
      throw error;
    }
  }

  // ======================== 快速搜索 ========================

  /**
   * 快速搜索客戶 (用於自動完成等場景)
   */
  async quickSearch(searchQuery: CustomerSearchQuery): Promise<CustomerSearchResponse> {
    try {
      const { q, limit = 10, platform } = searchQuery;

      if (q.length < 2) {
        return {
          results: [],
          query: q,
          total: 0
        };
      }

      const searchTerm = `%${q}%`;

      // 建立搜索條件
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

      // 使用優先級排序
      const orderByPriority = sql`
        CASE
          WHEN ${customers.displayName} LIKE ${searchTerm} THEN 1
          WHEN ${customers.email} LIKE ${searchTerm} THEN 2
          WHEN ${customers.phone} LIKE ${searchTerm} THEN 3
          WHEN ${customers.platformUserId} LIKE ${searchTerm} THEN 4
          ELSE 5
        END
      `;

      const searchResults = await this.drizzleDb
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
        .limit(limit)
        .all();

      const results: CustomerSearchResult[] = searchResults.map(row => ({
        id: row.id,
        platform: row.platform,
        platformUserId: row.platformUserId,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        email: row.email,
        phone: row.phone
      }));

      return {
        results,
        query: q,
        total: results.length
      };
    } catch (error) {
      console.error('Error in quick search:', error);
      throw error;
    }
  }

  // ======================== 進階搜索 ========================

  /**
   * 進階搜索 (支持複雜條件)
   */
  async advancedSearch(
    filters: CustomerFilters,
    pagination: { page: number; pageSize: number },
    userPayload?: JWTPayload
  ): Promise<CustomerListResponse> {
    // 進階搜索實際上就是帶參數的客戶列表查詢
    return this.getCustomerList(filters, pagination, userPayload);
  }

  // ======================== 私有輔助方法 ========================

  /**
   * 建立篩選條件
   */
  private buildFilterConditions(filters: CustomerFilters, userPayload?: JWTPayload) {
    const conditions = [];

    // 權限過濾：非admin用戶只能看到自己團隊的客戶
    if (userPayload?.role !== 'admin' && userPayload?.primaryTeamId) {
      conditions.push(
        sql`(${customers.sourceTeamId} = ${userPayload.primaryTeamId} OR ${customers.sourceTeamId} IS NULL)`
      );
    }

    // 平台篩選
    if (filters.platform) {
      conditions.push(eq(customers.platform, filters.platform));
    }

    // 團隊篩選
    if (filters.teamId) {
      conditions.push(eq(customers.sourceTeamId, filters.teamId));
    }

    // 標籤篩選
    if (filters.tagId) {
      conditions.push(eq(customerTags.tagId, filters.tagId));
    }

    // 搜索關鍵字
    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(or(
        like(customers.displayName, searchTerm),
        like(customers.email, searchTerm),
        like(customers.phone, searchTerm),
        like(customers.platformUserId, searchTerm)
      ));
    }

    // Email 篩選
    if (filters.hasEmail === true) {
      conditions.push(sql`${customers.email} IS NOT NULL AND ${customers.email} != ''`);
    } else if (filters.hasEmail === false) {
      conditions.push(sql`(${customers.email} IS NULL OR ${customers.email} = '')`);
    }

    // 電話篩選
    if (filters.hasPhone === true) {
      conditions.push(sql`${customers.phone} IS NOT NULL AND ${customers.phone} != ''`);
    } else if (filters.hasPhone === false) {
      conditions.push(sql`(${customers.phone} IS NULL OR ${customers.phone} = '')`);
    }

    // 日期範圍篩選
    if (filters.dateFrom) {
      conditions.push(sql`${customers.createdAt} >= ${filters.dateFrom}`);
    }

    if (filters.dateTo) {
      conditions.push(sql`${customers.createdAt} <= ${filters.dateTo}`);
    }

    // 狀態篩選 (基於metadata中的_deleted標記)
    if (filters.status === 'active') {
      conditions.push(
        sql`(${customers.metadata} IS NULL OR ${customers.metadata} NOT LIKE '%"_deleted":true%')`
      );
    } else if (filters.status === 'inactive') {
      conditions.push(
        sql`${customers.metadata} LIKE '%"_deleted":true%'`
      );
    }

    return conditions;
  }

  /**
   * 計算篩選後的客戶總數
   */
  private async getFilteredCustomersCount(filters: CustomerFilters, userPayload?: JWTPayload): Promise<number> {
    const conditions = this.buildFilterConditions(filters, userPayload);

    const countQuery = this.drizzleDb
      .select({ total: sql<number>`COUNT(DISTINCT ${customers.id})` })
      .from(customers)
      .leftJoin(customerTags, eq(customers.id, customerTags.customerId))
      .where(and(...conditions));

    const result = await countQuery.get();
    return result?.total || 0;
  }

  // ======================== 搜索建議 ========================

  /**
   * 獲取搜索建議 (基於現有數據)
   */
  async getSearchSuggestions(query: string, limit: number = 5): Promise<string[]> {
    try {
      if (query.length < 2) {
        return [];
      }

      const searchTerm = `%${query}%`;

      // 從顯示名稱獲取建議
      const namesSuggestions = await this.drizzleDb
        .select({ displayName: customers.displayName })
        .from(customers)
        .where(
          and(
            like(customers.displayName, searchTerm),
            sql`${customers.displayName} IS NOT NULL`
          )
        )
        .limit(limit)
        .all();

      const suggestions = namesSuggestions
        .map(row => row.displayName)
        .filter((name): name is string => name !== null)
        .slice(0, limit);

      return suggestions;
    } catch (error) {
      console.error('Error getting search suggestions:', error);
      return [];
    }
  }
}