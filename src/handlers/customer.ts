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
  QueryParams,
  DatabaseRow
} from '../types';
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

      // 構建查詢
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

      // 執行查詢
      const result = await c.env.DB.prepare(query).bind(...params).all();

      // 計算總數
      let countQuery = `
        SELECT COUNT(DISTINCT c.id) as total 
        FROM customers c
        LEFT JOIN customer_tags ct ON c.id = ct.customer_id
      `;
      
      if (whereConditions.length > 0) {
        countQuery += ' WHERE ' + whereConditions.join(' AND ');
      }

      const countParams = params.slice(0, -2); // 移除 LIMIT 和 OFFSET
      const countResult = await c.env.DB.prepare(countQuery).bind(...countParams).first();

      // 格式化結果
      const customers = result.results.map((row: DatabaseRow) => ({
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

      return paginatedResponse(c, customers, {
        page: parseInt(page),
        limit,
        total: (countResult?.total as number) || 0
      }, 'Customers retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取單一客戶詳情
  async get(c: Context<{ Bindings: Bindings }>) {
    try {
      const customerId = c.req.param('id');

      const customer = await c.env.DB.prepare(`
        SELECT c.*,
               t.name as team_name,
               GROUP_CONCAT(tag.name, ',') as tag_names,
               GROUP_CONCAT(tag.color, ',') as tag_colors,
               GROUP_CONCAT(tag.id, ',') as tag_ids
        FROM customers c
        LEFT JOIN teams t ON c.source_team_id = t.id
        LEFT JOIN customer_tags ct ON c.id = ct.customer_id
        LEFT JOIN tags tag ON ct.tag_id = tag.id
        WHERE c.id = ?
        GROUP BY c.id
      `).bind(customerId).first();

      if (!customer) {
        return notFoundResponse(c, 'Customer');
      }

      // 獲取客戶的對話統計
      const conversationStats = await c.env.DB.prepare(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
          COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed,
          MAX(created_at) as last_conversation_at,
          MIN(created_at) as first_conversation_at
        FROM conversations
        WHERE customer_id = ?
      `).bind(customerId).first();

      // 獲取最近的訊息
      const recentMessages = await c.env.DB.prepare(`
        SELECT m.*, c.id as conversation_id
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.customer_id = ?
        ORDER BY m.created_at DESC
        LIMIT 5
      `).bind(customerId).all();

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
        tags: customer.tag_names && typeof customer.tag_names === 'string' 
          ? customer.tag_names.split(',').map((name: string, index: number) => ({
              id: customer.tag_ids && typeof customer.tag_ids === 'string' 
                ? customer.tag_ids.split(',')[index] 
                : undefined,
              name,
              color: customer.tag_colors && typeof customer.tag_colors === 'string'
                ? customer.tag_colors.split(',')[index] || '#3B82F6'
                : '#3B82F6'
            })) 
          : [],
        conversationStats: {
          total: conversationStats?.total || 0,
          active: conversationStats?.active || 0,
          closed: conversationStats?.closed || 0,
          lastConversationAt: conversationStats?.last_conversation_at,
          firstConversationAt: conversationStats?.first_conversation_at
        },
        recentMessages: recentMessages.results.map((msg: any) => ({
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

      // 檢查客戶是否存在
      const existingCustomer = await c.env.DB.prepare(`
        SELECT id FROM customers WHERE id = ?
      `).bind(customerId).first();

      if (!existingCustomer) {
        return notFoundResponse(c, 'Customer');
      }

      // 更新客戶資料
      await c.env.DB.prepare(`
        UPDATE customers 
        SET display_name = ?, phone = ?, email = ?, source_team_id = ?, 
            metadata = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(
        displayName || null,
        phone || null,
        email || null,
        sourceTeamId || null,
        metadata ? JSON.stringify(metadata) : null,
        customerId
      ).run();

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

      // 檢查客戶是否存在
      const customer = await c.env.DB.prepare(`
        SELECT id FROM customers WHERE id = ?
      `).bind(customerId).first();

      if (!customer) {
        return notFoundResponse(c, 'Customer');
      }

      // 批量添加標籤
      const insertPromises = tagIds.map(tagId => 
        c.env.DB.prepare(`
          INSERT OR IGNORE INTO customer_tags (customer_id, tag_id, assigned_by)
          VALUES (?, ?, ?)
        `).bind(customerId, tagId, payload?.userId).run()
      );

      await Promise.all(insertPromises);

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

      // 移除標籤
      const placeholders = tagIds.map(() => '?').join(',');
      await c.env.DB.prepare(`
        DELETE FROM customer_tags 
        WHERE customer_id = ? AND tag_id IN (${placeholders})
      `).bind(customerId, ...tagIds).run();

      return successResponse(c, null, 'Tags removed successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取客戶統計數據
  async getStats(c: Context<{ Bindings: Bindings }>) {
    try {
      const payload = c.get('jwtPayload');
      
      // 基礎統計查詢
      let baseQuery = `
        FROM customers c
        LEFT JOIN customer_tags ct ON c.id = ct.customer_id
        LEFT JOIN conversations conv ON c.id = conv.customer_id
      `;

      const whereConditions: string[] = [];
      const params: QueryParams = [];

      // 權限控制
      if (payload?.role !== 'admin' && payload?.teamId) {
        whereConditions.push('(c.source_team_id = ? OR c.source_team_id IS NULL)');
        params.push(payload.teamId);
      }

      const whereClause = whereConditions.length > 0 
        ? ' WHERE ' + whereConditions.join(' AND ') 
        : '';

      // 總客戶數
      const totalResult = await c.env.DB.prepare(`
        SELECT COUNT(DISTINCT c.id) as total ${baseQuery} ${whereClause}
      `).bind(...params).first();

      // 按平台統計
      const platformStats = await c.env.DB.prepare(`
        SELECT c.platform, COUNT(DISTINCT c.id) as count 
        ${baseQuery} ${whereClause}
        GROUP BY c.platform
      `).bind(...params).all();

      // 按團隊統計
      const teamStats = await c.env.DB.prepare(`
        SELECT t.name as team_name, COUNT(DISTINCT c.id) as count
        FROM customers c
        LEFT JOIN teams t ON c.source_team_id = t.id
        ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''}
        GROUP BY c.source_team_id, t.name
      `).bind(...params).all();

      // 有標籤的客戶數
      const taggedResult = await c.env.DB.prepare(`
        SELECT COUNT(DISTINCT c.id) as count
        ${baseQuery} ${whereClause} AND ct.tag_id IS NOT NULL
      `).bind(...params).first();

      // 有郵箱的客戶數
      const emailResult = await c.env.DB.prepare(`
        SELECT COUNT(DISTINCT c.id) as count
        ${baseQuery} ${whereClause} AND c.email IS NOT NULL AND c.email != ''
      `).bind(...params).first();

      // 有電話的客戶數
      const phoneResult = await c.env.DB.prepare(`
        SELECT COUNT(DISTINCT c.id) as count
        ${baseQuery} ${whereClause} AND c.phone IS NOT NULL AND c.phone != ''
      `).bind(...params).first();

      // 最近7天活躍客戶
      const recentActiveResult = await c.env.DB.prepare(`
        SELECT COUNT(DISTINCT c.id) as count
        FROM customers c
        JOIN conversations conv ON c.id = conv.customer_id
        JOIN messages m ON conv.id = m.conversation_id
        ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') + ' AND' : 'WHERE'}
        m.created_at >= datetime('now', '-7 days') AND m.sender_type = 'customer'
      `).bind(...params).first();

      const stats: CustomerStats = {
        total: (totalResult as DatabaseRow)?.total as number || 0,
        byPlatform: {},
        byTeam: {},
        withTags: (taggedResult as DatabaseRow)?.count as number || 0,
        withEmail: (emailResult as DatabaseRow)?.count as number || 0,
        withPhone: (phoneResult as DatabaseRow)?.count as number || 0,
        recentActive: (recentActiveResult as DatabaseRow)?.count as number || 0
      };

      // 格式化平台統計
      platformStats.results.forEach((row: DatabaseRow) => {
        stats.byPlatform[row.platform] = row.count;
      });

      // 格式化團隊統計
      teamStats.results.forEach((row: DatabaseRow) => {
        const teamName = row.team_name || '未分配';
        stats.byTeam[teamName] = row.count;
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

      let query = `
        SELECT c.id, c.platform, c.platform_user_id, c.display_name, 
               c.avatar_url, c.email, c.phone
        FROM customers c
        WHERE (
          c.display_name LIKE ? OR 
          c.email LIKE ? OR 
          c.phone LIKE ? OR
          c.platform_user_id LIKE ?
        )
      `;

      const params = Array(4).fill(`%${q}%`);

      if (platform) {
        query += ' AND c.platform = ?';
        params.push(platform);
      }

      query += ` ORDER BY 
        CASE 
          WHEN c.display_name LIKE ? THEN 1
          WHEN c.email LIKE ? THEN 2
          WHEN c.phone LIKE ? THEN 3
          ELSE 4
        END
        LIMIT ?
      `;

      params.push(`%${q}%`, `%${q}%`, `%${q}%`, parseInt(limit));

      const result = await c.env.DB.prepare(query).bind(...params).all();

      const customers = result.results.map((row: DatabaseRow) => ({
        id: row.id,
        platform: row.platform,
        platformUserId: row.platform_user_id,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        email: row.email,
        phone: row.phone
      }));

      return successResponse(c, customers, 'Search results retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  }
};