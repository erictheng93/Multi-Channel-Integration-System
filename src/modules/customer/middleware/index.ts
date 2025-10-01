// Customer Middleware 導出
// 統一導出所有客戶中間件

// 權限中間件
export * from './customer-auth';

// 驗證中間件
export * from './customer-validation';

// 中間件組合 (可選)
import {
  checkCustomerAccess,
  checkSpecificCustomerAccess,
  checkCustomerEditPermission,
  checkCustomerDeletePermission,
  checkTagManagementPermission,
  checkStatsViewPermission,
  checkExportPermission,
  applyTeamScopeFilter
} from './customer-auth';

import {
  validatePaginationParams,
  validateCustomerId,
  validateCreateCustomerData,
  validateUpdateCustomerData,
  validateTagOperation,
  validateSearchQuery,
  validateFilterParams,
  validateBatchOperation
} from './customer-validation';

// 中間件組合工廠
export const CustomerMiddleware = {
  // 權限檢查
  auth: {
    checkCustomerAccess,
    checkSpecificCustomerAccess,
    checkCustomerEditPermission,
    checkCustomerDeletePermission,
    checkTagManagementPermission,
    checkStatsViewPermission,
    checkExportPermission,
    applyTeamScopeFilter
  },

  // 數據驗證
  validation: {
    validatePaginationParams,
    validateCustomerId,
    validateCreateCustomerData,
    validateUpdateCustomerData,
    validateTagOperation,
    validateSearchQuery,
    validateFilterParams,
    validateBatchOperation
  },

  // 常用中間件組合
  combinations: {
    // 基礎CRUD操作的中間件鏈
    basicCrud: [checkCustomerAccess],
    specificCustomer: [checkCustomerAccess, validateCustomerId, checkSpecificCustomerAccess],
    customerEdit: [checkCustomerAccess, checkCustomerEditPermission, validateCustomerId, checkSpecificCustomerAccess],
    customerDelete: [checkCustomerAccess, checkCustomerDeletePermission, validateCustomerId, checkSpecificCustomerAccess],

    // 標籤管理中間件鏈
    tagManagement: [checkCustomerAccess, checkTagManagementPermission, validateCustomerId, checkSpecificCustomerAccess, validateTagOperation],

    // 搜索和列表中間件鏈
    searchAndList: [checkCustomerAccess, validatePaginationParams, validateFilterParams, applyTeamScopeFilter],
    quickSearch: [checkCustomerAccess, validateSearchQuery],

    // 統計查看中間件鏈
    statsView: [checkCustomerAccess, checkStatsViewPermission],

    // 批量操作中間件鏈
    batchOperations: [checkCustomerAccess, validateBatchOperation]
  }
};