// Customer Handlers 路由註冊
// 註冊所有客戶相關的API路由

import { Hono } from 'hono';
import { CustomerMainHandler } from '@modules/customer/handlers/customer-main';
import { CustomerAdvancedHandler } from '@modules/customer/handlers/customer';

// 中間件導入
import {
  checkCustomerAccess,
  checkSpecificCustomerAccess,
  checkCustomerEditPermission,
  checkCustomerDeletePermission,
  checkTagManagementPermission,
  checkStatsViewPermission,
  applyTeamScopeFilter
} from '../middleware/customer-auth';

import {
  validatePaginationParams,
  validateCustomerId,
  validateCreateCustomerData,
  validateUpdateCustomerData,
  validateTagOperation,
  validateSearchQuery,
  validateFilterParams,
  validateBatchOperation
} from '../middleware/customer-validation';

import type { Bindings } from '../../../types';

// 創建客戶路由實例
const customerRouter = new Hono<{ Bindings: Bindings }>();

// ======================== 健康檢查端點 ========================

/**
 * 健康檢查
 * GET /api/customers/health
 */
customerRouter.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    module: 'customer',
    version: '1.0.0'
  });
});

/**
 * 模組資訊
 * GET /api/customers/info
 */
customerRouter.get('/info', (c) => {
  return c.json({
    success: true,
    data: {
      module: 'customer',
      version: '1.0.0',
      endpoints: [
        'GET /health - Health check',
        'GET /info - Module information',
        'POST / - Create customer',
        'GET /:id - Get customer details',
        'GET /:id/basic - Get customer basic info',
        'PUT /:id - Update customer',
        'DELETE /:id - Soft delete customer',
        'HEAD /:id - Check customer exists',
        'GET /:id/exists - Check customer exists',
        'GET /platform/:platform/:platformUserId - Get by platform ID',
        'HEAD /platform/:platform/:platformUserId - Check platform customer exists',
        'GET /platform/:platform/:platformUserId/exists - Check platform customer exists',
        'POST /find-or-create - Find or create customer',
        'GET / - List customers (with filters)',
        'GET /search - Quick search',
        'POST /advanced-search - Advanced search',
        'GET /search/suggestions - Search suggestions',
        'GET /stats - Customer statistics',
        'GET /stats/platform-distribution - Platform distribution',
        'GET /stats/team-distribution - Team distribution',
        'GET /stats/activity - Activity statistics',
        'GET /stats/growth - Growth statistics',
        'GET /:id/tags - Get customer tags',
        'POST /:id/tags - Add customer tags',
        'DELETE /:id/tags - Remove customer tags',
        'PUT /:id/tags - Set customer tags',
        'GET /tags/available - Available tags',
        'GET /tags/usage-stats - Tag usage statistics',
        'POST /find-by-tags - Find customers by tags',
        'GET /without-tags - Customers without tags',
        'POST /batch/basic - Batch get basic info',
        'POST /batch/tags - Batch tag operations'
      ]
    },
    timestamp: new Date().toISOString()
  });
});

// ======================== 基礎CRUD路由 ========================

/**
 * 創建新客戶
 * POST /api/customers
 */
customerRouter.post(
  '/',
  checkCustomerAccess,
  checkCustomerEditPermission,
  validateCreateCustomerData,
  CustomerMainHandler.create
);

/**
 * 獲取客戶詳情
 * GET /api/customers/:id
 */
customerRouter.get(
  '/:id',
  checkCustomerAccess,
  validateCustomerId,
  checkSpecificCustomerAccess,
  CustomerMainHandler.get
);

/**
 * 獲取客戶基本資料
 * GET /api/customers/:id/basic
 */
customerRouter.get(
  '/:id/basic',
  checkCustomerAccess,
  validateCustomerId,
  checkSpecificCustomerAccess,
  CustomerMainHandler.getBasic
);

/**
 * 更新客戶資料
 * PUT /api/customers/:id
 */
customerRouter.put(
  '/:id',
  checkCustomerAccess,
  checkCustomerEditPermission,
  validateCustomerId,
  checkSpecificCustomerAccess,
  validateUpdateCustomerData,
  CustomerMainHandler.update
);

/**
 * 軟刪除客戶
 * DELETE /api/customers/:id
 */
customerRouter.delete(
  '/:id',
  checkCustomerAccess,
  checkCustomerDeletePermission,
  validateCustomerId,
  checkSpecificCustomerAccess,
  CustomerMainHandler.softDelete
);

/**
 * 檢查客戶是否存在 (OPTIONS 方法)
 * OPTIONS /api/customers/:id
 */
customerRouter.options(
  '/:id',
  checkCustomerAccess,
  validateCustomerId,
  checkSpecificCustomerAccess,
  CustomerMainHandler.exists
);

/**
 * 檢查客戶是否存在 (GET 方法，用於直接查詢)
 * GET /api/customers/:id/exists
 */
customerRouter.get(
  '/:id/exists',
  checkCustomerAccess,
  validateCustomerId,
  checkSpecificCustomerAccess,
  CustomerMainHandler.exists
);

// ======================== 平台客戶路由 ========================

/**
 * 根據平台ID查詢客戶
 * GET /api/customers/platform/:platform/:platformUserId
 */
customerRouter.get(
  '/platform/:platform/:platformUserId',
  checkCustomerAccess,
  CustomerMainHandler.getByPlatformId
);

/**
 * 檢查平台客戶是否存在 (OPTIONS 方法)
 * OPTIONS /api/customers/platform/:platform/:platformUserId
 */
customerRouter.options(
  '/platform/:platform/:platformUserId',
  checkCustomerAccess,
  CustomerMainHandler.existsByPlatformId
);

/**
 * 檢查平台客戶是否存在 (GET 方法，用於直接查詢)
 * GET /api/customers/platform/:platform/:platformUserId/exists
 */
customerRouter.get(
  '/platform/:platform/:platformUserId/exists',
  checkCustomerAccess,
  CustomerMainHandler.existsByPlatformId
);

/**
 * 尋找或創建客戶
 * POST /api/customers/find-or-create
 */
customerRouter.post(
  '/find-or-create',
  checkCustomerAccess,
  checkCustomerEditPermission,
  CustomerMainHandler.findOrCreate
);

// ======================== 列表和搜索路由 ========================

/**
 * 獲取客戶列表 (支持篩選)
 * GET /api/customers
 */
customerRouter.get(
  '/',
  checkCustomerAccess,
  validatePaginationParams,
  validateFilterParams,
  applyTeamScopeFilter,
  CustomerAdvancedHandler.list
);

/**
 * 快速搜索客戶
 * GET /api/customers/search
 */
customerRouter.get(
  '/search',
  checkCustomerAccess,
  validateSearchQuery,
  CustomerAdvancedHandler.search
);

/**
 * 進階搜索
 * POST /api/customers/advanced-search
 */
customerRouter.post(
  '/advanced-search',
  checkCustomerAccess,
  validatePaginationParams,
  validateFilterParams,
  applyTeamScopeFilter,
  CustomerAdvancedHandler.advancedSearch
);

/**
 * 獲取搜索建議
 * GET /api/customers/search/suggestions
 */
customerRouter.get(
  '/search/suggestions',
  checkCustomerAccess,
  CustomerAdvancedHandler.searchSuggestions
);

// ======================== 統計路由 ========================

/**
 * 獲取客戶統計
 * GET /api/customers/stats
 */
customerRouter.get(
  '/stats',
  checkCustomerAccess,
  checkStatsViewPermission,
  CustomerAdvancedHandler.getStats
);

/**
 * 獲取平台分佈統計
 * GET /api/customers/stats/platform-distribution
 */
customerRouter.get(
  '/stats/platform-distribution',
  checkCustomerAccess,
  checkStatsViewPermission,
  CustomerAdvancedHandler.getPlatformDistribution
);

/**
 * 獲取團隊分佈統計
 * GET /api/customers/stats/team-distribution
 */
customerRouter.get(
  '/stats/team-distribution',
  checkCustomerAccess,
  checkStatsViewPermission,
  CustomerAdvancedHandler.getTeamDistribution
);

/**
 * 獲取活躍度統計
 * GET /api/customers/stats/activity
 */
customerRouter.get(
  '/stats/activity',
  checkCustomerAccess,
  checkStatsViewPermission,
  CustomerAdvancedHandler.getActivityStats
);

/**
 * 獲取增長統計
 * GET /api/customers/stats/growth
 */
customerRouter.get(
  '/stats/growth',
  checkCustomerAccess,
  checkStatsViewPermission,
  CustomerAdvancedHandler.getGrowthStats
);

// ======================== 標籤管理路由 ========================

/**
 * 獲取客戶標籤
 * GET /api/customers/:id/tags
 */
customerRouter.get(
  '/:id/tags',
  checkCustomerAccess,
  validateCustomerId,
  checkSpecificCustomerAccess,
  CustomerAdvancedHandler.getCustomerTags
);

/**
 * 為客戶添加標籤
 * POST /api/customers/:id/tags
 */
customerRouter.post(
  '/:id/tags',
  checkCustomerAccess,
  checkTagManagementPermission,
  validateCustomerId,
  checkSpecificCustomerAccess,
  validateTagOperation,
  CustomerAdvancedHandler.addCustomerTags
);

/**
 * 從客戶移除標籤
 * DELETE /api/customers/:id/tags
 */
customerRouter.delete(
  '/:id/tags',
  checkCustomerAccess,
  checkTagManagementPermission,
  validateCustomerId,
  checkSpecificCustomerAccess,
  validateTagOperation,
  CustomerAdvancedHandler.removeCustomerTags
);

/**
 * 設置客戶標籤 (替換所有現有標籤)
 * PUT /api/customers/:id/tags
 */
customerRouter.put(
  '/:id/tags',
  checkCustomerAccess,
  checkTagManagementPermission,
  validateCustomerId,
  checkSpecificCustomerAccess,
  validateTagOperation,
  CustomerAdvancedHandler.setCustomerTags
);

/**
 * 獲取所有可用標籤
 * GET /api/customers/tags/available
 */
customerRouter.get(
  '/tags/available',
  checkCustomerAccess,
  CustomerAdvancedHandler.getAvailableTags
);

/**
 * 獲取標籤使用統計
 * GET /api/customers/tags/usage-stats
 */
customerRouter.get(
  '/tags/usage-stats',
  checkCustomerAccess,
  checkStatsViewPermission,
  CustomerAdvancedHandler.getTagUsageStats
);

/**
 * 根據標籤查找客戶
 * POST /api/customers/find-by-tags
 */
customerRouter.post(
  '/find-by-tags',
  checkCustomerAccess,
  CustomerAdvancedHandler.findCustomersByTags
);

/**
 * 獲取沒有標籤的客戶
 * GET /api/customers/without-tags
 */
customerRouter.get(
  '/without-tags',
  checkCustomerAccess,
  CustomerAdvancedHandler.getCustomersWithoutTags
);

// ======================== 批量操作路由 ========================

/**
 * 批量獲取客戶基本資料
 * POST /api/customers/batch/basic
 */
customerRouter.post(
  '/batch/basic',
  checkCustomerAccess,
  validateBatchOperation,
  CustomerMainHandler.getBatchBasic
);

/**
 * 批量標籤操作
 * POST /api/customers/batch/tags
 */
customerRouter.post(
  '/batch/tags',
  checkCustomerAccess,
  checkTagManagementPermission,
  CustomerAdvancedHandler.batchTagOperation
);

// 導出客戶路由
export { customerRouter };

// 導出所有handler類 (供其他模組使用)
export { CustomerMainHandler, CustomerAdvancedHandler };

// 導出中間件 (供其他模組使用)
export * from '../middleware/customer-auth';
export * from '../middleware/customer-validation';