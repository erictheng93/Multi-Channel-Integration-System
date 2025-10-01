// Customer 模組主要導出檔案
// 統一導出客戶模組的所有功能和類型

// ======================== Handlers 導出 ========================
export { customerRouter } from './handlers/index';
export { CustomerMainHandler, CustomerAdvancedHandler } from './handlers/index';

// ======================== Services 導出 ========================
export { CustomerCrudService } from './services/customer-crud';
export { CustomerSearchService } from './services/customer-search';
export { CustomerStatsService } from './services/customer-stats';
export { CustomerTagService } from './services/customer-tags';

// ======================== Types 導出 ========================
export * from './types/customer-types';

// ======================== Middleware 導出 ========================
export * from './middleware/customer-auth';
export * from './middleware/customer-validation';

// ======================== 模組資訊 ========================
export const CUSTOMER_MODULE_INFO = {
  name: 'customer',
  version: '1.0.0',
  description: 'Customer management module with CRUD, search, stats, and tag management',
  routes: {
    base: '/api/customers',
    endpoints: [
      // Basic CRUD
      'GET /',                          // List customers with filters
      'POST /',                         // Create customer
      'GET /:id',                       // Get customer details
      'PUT /:id',                       // Update customer
      'DELETE /:id',                    // Soft delete customer
      'HEAD /:id',                      // Check customer exists
      'GET /:id/basic',                 // Get basic customer info

      // Platform operations
      'GET /platform/:platform/:platformUserId',  // Get by platform ID
      'HEAD /platform/:platform/:platformUserId', // Check platform customer exists
      'POST /find-or-create',                      // Find or create customer

      // Search operations
      'GET /search',                    // Quick search
      'POST /advanced-search',          // Advanced search with filters
      'GET /search/suggestions',        // Search suggestions

      // Statistics
      'GET /stats',                     // General stats
      'GET /stats/platform-distribution', // Platform distribution
      'GET /stats/team-distribution',   // Team distribution
      'GET /stats/activity',            // Activity stats
      'GET /stats/growth',              // Growth stats

      // Tag management
      'GET /:id/tags',                  // Get customer tags
      'POST /:id/tags',                 // Add tags to customer
      'DELETE /:id/tags',               // Remove tags from customer
      'PUT /:id/tags',                  // Set customer tags
      'GET /tags/available',            // Get available tags
      'GET /tags/usage-stats',          // Tag usage statistics
      'POST /find-by-tags',             // Find customers by tags
      'GET /without-tags',              // Get customers without tags

      // Batch operations
      'POST /batch/basic',              // Batch get basic info
      'POST /batch/tags'                // Batch tag operations
    ]
  },
  features: [
    'Multi-platform customer management',
    'Advanced search and filtering',
    'Real-time statistics and analytics',
    'Flexible tag management system',
    'Role-based access control',
    'Batch operations support',
    'Data validation and sanitization',
    'Comprehensive error handling'
  ],
  dependencies: [
    '../../shared/database/schema',
    '../../shared/utils/api-response',
    '../../shared/utils/drizzle-converters',
    '../../shared/types',
    'drizzle-orm',
    'hono'
  ]
} as const;