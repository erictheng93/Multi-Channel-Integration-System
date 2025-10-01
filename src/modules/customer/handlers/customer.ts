// Customer 進階處理器
// 提供客戶的搜索、篩選、統計和標籤管理功能

import { Context } from 'hono';
import {
  successResponse,
  paginatedResponse,
  handleApiError
} from '@shared/utils/api-response';
import { CustomerSearchService } from '@modules/customer/services/customer-search';
import { CustomerStatsService } from '@modules/customer/services/customer-stats';
import { CustomerTagService } from '@modules/customer/services/customer-tags';
import {
  CustomerListResponse,
  CustomerSearchResponse,
  CustomerStatsResponse,
  CustomerFilters,
  CustomerSearchQuery,
  CustomerTagOperation
} from '../types/customer-types';
import type { Bindings, JWTPayload } from '@/types';

/**
 * Customer 進階功能處理器類
 */
export class CustomerAdvancedHandler {
  /**
   * 獲取客戶列表 (支持篩選和搜索)
   * GET /api/customers
   */
  static async list(c: Context<{ Bindings: Bindings }>) {
    try {
      const filters = c.get('customerFilters') as CustomerFilters;
      const pagination = c.get('paginationParams') as { page: number; pageSize: number };
      const userPayload = c.get('jwtPayload') as JWTPayload;

      const searchService = new CustomerSearchService(c.env.DB);
      const result = await searchService.getCustomerList(filters, pagination, userPayload);

      return c.json({
        success: true,
        data: result.customers,
        pagination: result.pagination,
        filters,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting customer list:', error);
      return handleApiError(error, c);
    }
  }

  /**
   * 快速搜索客戶
   * GET /api/customers/search
   */
  static async search(c: Context<{ Bindings: Bindings }>) {
    try {
      const searchQuery = c.get('searchQuery') as CustomerSearchQuery;

      const searchService = new CustomerSearchService(c.env.DB);
      const result = await searchService.quickSearch(searchQuery);

      return successResponse(c, result, 'Search completed successfully');
    } catch (error) {
      console.error('Error searching customers:', error);
      return handleApiError(error, c);
    }
  }

  /**
   * 進階搜索
   * POST /api/customers/advanced-search
   */
  static async advancedSearch(c: Context<{ Bindings: Bindings }>) {
    try {
      const filters = c.get('customerFilters') as CustomerFilters;
      const pagination = c.get('paginationParams') as { page: number; pageSize: number };
      const userPayload = c.get('jwtPayload') as JWTPayload;

      const searchService = new CustomerSearchService(c.env.DB);
      const result = await searchService.advancedSearch(filters, pagination, userPayload);

      return c.json({
        success: true,
        data: result.customers,
        pagination: result.pagination,
        filters,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error in advanced search:', error);
      return handleApiError(error, c);
    }
  }

  /**
   * 獲取搜索建議
   * GET /api/customers/search/suggestions
   */
  static async searchSuggestions(c: Context<{ Bindings: Bindings }>) {
    try {
      const { q, limit = '5' } = c.req.query();

      if (!q || q.length < 2) {
        return successResponse(c, [], 'Query too short for suggestions');
      }

      const searchService = new CustomerSearchService(c.env.DB);
      const suggestions = await searchService.getSearchSuggestions(q, parseInt(limit));

      return successResponse(c, suggestions, 'Search suggestions retrieved successfully');
    } catch (error) {
      console.error('Error getting search suggestions:', error);
      return handleApiError(error, c);
    }
  }

  /**
   * 獲取客戶統計
   * GET /api/customers/stats
   */
  static async getStats(c: Context<{ Bindings: Bindings }>) {
    try {
      const userPayload = c.get('jwtPayload') as JWTPayload;

      const statsService = new CustomerStatsService(c.env.DB);
      const stats = await statsService.getCustomerStats(userPayload);

      return successResponse(c, stats, 'Customer statistics retrieved successfully');
    } catch (error) {
      console.error('Error getting customer stats:', error);
      return handleApiError(error, c);
    }
  }

  /**
   * 獲取平台分佈統計
   * GET /api/customers/stats/platform-distribution
   */
  static async getPlatformDistribution(c: Context<{ Bindings: Bindings }>) {
    try {
      const userPayload = c.get('jwtPayload') as JWTPayload;

      const statsService = new CustomerStatsService(c.env.DB);
      const distribution = await statsService.getPlatformDistribution(userPayload);

      return successResponse(c, distribution, 'Platform distribution retrieved successfully');
    } catch (error) {
      console.error('Error getting platform distribution:', error);
      return handleApiError(error, c);
    }
  }

  /**
   * 獲取團隊分佈統計
   * GET /api/customers/stats/team-distribution
   */
  static async getTeamDistribution(c: Context<{ Bindings: Bindings }>) {
    try {
      const userPayload = c.get('jwtPayload') as JWTPayload;

      const statsService = new CustomerStatsService(c.env.DB);
      const distribution = await statsService.getTeamDistribution(userPayload);

      return successResponse(c, distribution, 'Team distribution retrieved successfully');
    } catch (error) {
      console.error('Error getting team distribution:', error);
      return handleApiError(error, c);
    }
  }

  /**
   * 獲取活躍度統計
   * GET /api/customers/stats/activity
   */
  static async getActivityStats(c: Context<{ Bindings: Bindings }>) {
    try {
      const { days = '30' } = c.req.query();
      const userPayload = c.get('jwtPayload') as JWTPayload;

      const daysNum = parseInt(days);
      if (isNaN(daysNum) || daysNum < 1 || daysNum > 365) {
        return c.json({
          success: false,
          error: 'Days parameter must be between 1 and 365',
          timestamp: new Date().toISOString()
        }, 400);
      }

      const statsService = new CustomerStatsService(c.env.DB);
      const activityStats = await statsService.getActivityStats(userPayload, daysNum);

      return successResponse(c, activityStats, 'Activity statistics retrieved successfully');
    } catch (error) {
      console.error('Error getting activity stats:', error);
      return handleApiError(error, c);
    }
  }

  /**
   * 獲取增長統計
   * GET /api/customers/stats/growth
   */
  static async getGrowthStats(c: Context<{ Bindings: Bindings }>) {
    try {
      const { months = '12' } = c.req.query();
      const userPayload = c.get('jwtPayload') as JWTPayload;

      const monthsNum = parseInt(months);
      if (isNaN(monthsNum) || monthsNum < 1 || monthsNum > 24) {
        return c.json({
          success: false,
          error: 'Months parameter must be between 1 and 24',
          timestamp: new Date().toISOString()
        }, 400);
      }

      const statsService = new CustomerStatsService(c.env.DB);
      const growthStats = await statsService.getGrowthStats(userPayload, monthsNum);

      return successResponse(c, growthStats, 'Growth statistics retrieved successfully');
    } catch (error) {
      console.error('Error getting growth stats:', error);
      return handleApiError(error, c);
    }
  }

  // ======================== 標籤管理 ========================

  /**
   * 獲取客戶標籤
   * GET /api/customers/:id/tags
   */
  static async getCustomerTags(c: Context<{ Bindings: Bindings }>) {
    try {
      const customerId = parseInt(c.get('customerId') as string);

      const tagService = new CustomerTagService(c.env.DB);
      const tags = await tagService.getCustomerTags(customerId);

      return successResponse(c, tags, 'Customer tags retrieved successfully');
    } catch (error) {
      console.error('Error getting customer tags:', error);
      return handleApiError(error, c);
    }
  }

  /**
   * 為客戶添加標籤
   * POST /api/customers/:id/tags
   */
  static async addCustomerTags(c: Context<{ Bindings: Bindings }>) {
    try {
      const customerId = parseInt(c.get('customerId') as string);
      const tagOperation = c.get('tagOperation') as CustomerTagOperation;
      const userPayload = c.get('jwtPayload') as JWTPayload;

      const tagService = new CustomerTagService(c.env.DB);
      await tagService.addTagsToCustomer(customerId, tagOperation.tagIds, userPayload);

      return successResponse(c, null, 'Tags added to customer successfully');
    } catch (error) {
      console.error('Error adding customer tags:', error);
      return handleApiError(error, c);
    }
  }

  /**
   * 從客戶移除標籤
   * DELETE /api/customers/:id/tags
   */
  static async removeCustomerTags(c: Context<{ Bindings: Bindings }>) {
    try {
      const customerId = parseInt(c.get('customerId') as string);
      const tagOperation = c.get('tagOperation') as CustomerTagOperation;

      const tagService = new CustomerTagService(c.env.DB);
      await tagService.removeTagsFromCustomer(customerId, tagOperation.tagIds);

      return successResponse(c, null, 'Tags removed from customer successfully');
    } catch (error) {
      console.error('Error removing customer tags:', error);
      return handleApiError(error, c);
    }
  }

  /**
   * 設置客戶標籤 (替換所有現有標籤)
   * PUT /api/customers/:id/tags
   */
  static async setCustomerTags(c: Context<{ Bindings: Bindings }>) {
    try {
      const customerId = parseInt(c.get('customerId') as string);
      const tagOperation = c.get('tagOperation') as CustomerTagOperation;
      const userPayload = c.get('jwtPayload') as JWTPayload;

      const tagService = new CustomerTagService(c.env.DB);
      await tagService.setCustomerTags(customerId, tagOperation.tagIds, userPayload);

      return successResponse(c, null, 'Customer tags updated successfully');
    } catch (error) {
      console.error('Error setting customer tags:', error);
      return handleApiError(error, c);
    }
  }

  /**
   * 獲取所有可用標籤
   * GET /api/customers/tags/available
   */
  static async getAvailableTags(c: Context<{ Bindings: Bindings }>) {
    try {
      const tagService = new CustomerTagService(c.env.DB);
      const tags = await tagService.getAvailableTags();

      return successResponse(c, tags, 'Available tags retrieved successfully');
    } catch (error) {
      console.error('Error getting available tags:', error);
      return handleApiError(error, c);
    }
  }

  /**
   * 獲取標籤使用統計
   * GET /api/customers/tags/usage-stats
   */
  static async getTagUsageStats(c: Context<{ Bindings: Bindings }>) {
    try {
      const tagService = new CustomerTagService(c.env.DB);
      const stats = await tagService.getTagUsageStats();

      return successResponse(c, stats, 'Tag usage statistics retrieved successfully');
    } catch (error) {
      console.error('Error getting tag usage stats:', error);
      return handleApiError(error, c);
    }
  }

  /**
   * 根據標籤查找客戶
   * POST /api/customers/find-by-tags
   */
  static async findCustomersByTags(c: Context<{ Bindings: Bindings }>) {
    try {
      let requestData: {
        tagIds: number[];
        matchAll?: boolean;
      };

      try {
        requestData = await c.req.json();
      } catch (error) {
        return c.json({
          success: false,
          error: 'Invalid JSON data',
          timestamp: new Date().toISOString()
        }, 400);
      }

      const { tagIds, matchAll = false } = requestData;

      if (!Array.isArray(tagIds) || tagIds.length === 0) {
        return c.json({
          success: false,
          error: 'Tag IDs array is required',
          timestamp: new Date().toISOString()
        }, 400);
      }

      const tagService = new CustomerTagService(c.env.DB);
      const customerIds = await tagService.findCustomersByTags(tagIds, matchAll);

      return successResponse(c, { customerIds, matchAll, tagIds }, 'Customers found by tags successfully');
    } catch (error) {
      console.error('Error finding customers by tags:', error);
      return handleApiError(error, c);
    }
  }

  /**
   * 獲取沒有標籤的客戶
   * GET /api/customers/without-tags
   */
  static async getCustomersWithoutTags(c: Context<{ Bindings: Bindings }>) {
    try {
      const tagService = new CustomerTagService(c.env.DB);
      const customerIds = await tagService.getCustomersWithoutTags();

      return successResponse(c, { customerIds }, 'Customers without tags retrieved successfully');
    } catch (error) {
      console.error('Error getting customers without tags:', error);
      return handleApiError(error, c);
    }
  }

  // ======================== 批量操作 ========================

  /**
   * 批量標籤操作
   * POST /api/customers/batch/tags
   */
  static async batchTagOperation(c: Context<{ Bindings: Bindings }>) {
    try {
      let requestData: {
        customerIds: number[];
        tagIds: number[];
        action: 'add' | 'remove';
      };

      try {
        requestData = await c.req.json();
      } catch (error) {
        return c.json({
          success: false,
          error: 'Invalid JSON data',
          timestamp: new Date().toISOString()
        }, 400);
      }

      const { customerIds, tagIds, action } = requestData;
      const userPayload = c.get('jwtPayload') as JWTPayload;

      if (!Array.isArray(customerIds) || !Array.isArray(tagIds)) {
        return c.json({
          success: false,
          error: 'Customer IDs and tag IDs must be arrays',
          timestamp: new Date().toISOString()
        }, 400);
      }

      if (!['add', 'remove'].includes(action)) {
        return c.json({
          success: false,
          error: 'Action must be "add" or "remove"',
          timestamp: new Date().toISOString()
        }, 400);
      }

      const tagService = new CustomerTagService(c.env.DB);
      let results;

      if (action === 'add') {
        results = await tagService.addTagsToMultipleCustomers(customerIds, tagIds, userPayload);
      } else {
        results = await tagService.removeTagsFromMultipleCustomers(customerIds, tagIds);
      }

      return successResponse(c, results, `Batch tag ${action} operation completed`);
    } catch (error) {
      console.error('Error in batch tag operation:', error);
      return handleApiError(error, c);
    }
  }
}