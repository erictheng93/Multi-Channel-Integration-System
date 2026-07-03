// Messaging Middleware 統一導出
// Unified export for messaging middleware

// ======================== 權限控制中間件 ========================
export {
  checkMessageAccess,
  checkSpecificMessageAccess,
  checkMessageSendPermission,
  checkMessageRecallPermission,
  checkBatchOperationPermission,
  checkStatsViewPermission,
  applyMessageScopeFilter,
  validateMessageSender
} from './message-auth';

// ======================== 資料驗證中間件 ========================
export {
  validateMessageId,
  validateConversationId,
  validatePaginationParams,
  validateCreateMessageData,
  validateUpdateMessageData,
  validateRecallRequest,
  validateBatchSendData,
  validateSearchQuery
} from './message-validation';

// ======================== 中間件組合 ========================
// Import the actual functions for middleware arrays
import {
  checkMessageAccess as _checkMessageAccess,
  checkSpecificMessageAccess as _checkSpecificMessageAccess,
  checkMessageSendPermission as _checkMessageSendPermission,
  checkMessageRecallPermission as _checkMessageRecallPermission,
  checkBatchOperationPermission as _checkBatchOperationPermission,
  checkStatsViewPermission as _checkStatsViewPermission,
  applyMessageScopeFilter as _applyMessageScopeFilter,
  validateMessageSender as _validateMessageSender
} from './message-auth';

import {
  validateMessageId as _validateMessageId,
  validateCreateMessageData as _validateCreateMessageData,
  validateRecallRequest as _validateRecallRequest,
  validateBatchSendData as _validateBatchSendData,
  validateSearchQuery as _validateSearchQuery
} from './message-validation';

/**
 * 基本訊息存取中間件組合
 * 包含身份驗證和權限檢查
 */
export const basicMessageAccess = [
  _checkMessageAccess,
  _applyMessageScopeFilter
];

/**
 * 特定訊息存取中間件組合
 * 包含ID驗證、身份驗證和特定訊息權限檢查
 */
export const specificMessageAccess = [
  _validateMessageId,
  _checkMessageAccess,
  _checkSpecificMessageAccess
];

/**
 * 訊息發送中間件組合
 * 包含數據驗證、身份驗證和發送權限檢查
 */
export const messageSendAccess = [
  _validateCreateMessageData,
  _checkMessageAccess,
  _checkMessageSendPermission,
  _validateMessageSender
];

/**
 * 訊息召回中間件組合
 * 包含ID驗證、召回數據驗證、身份驗證和召回權限檢查
 */
export const messageRecallAccess = [
  _validateMessageId,
  _validateRecallRequest,
  _checkMessageAccess,
  _checkSpecificMessageAccess,
  _checkMessageRecallPermission
];

/**
 * 批量操作中間件組合
 * 包含批量數據驗證、身份驗證和批量操作權限檢查
 */
export const batchOperationAccess = [
  _validateBatchSendData,
  _checkMessageAccess,
  _checkBatchOperationPermission
];

/**
 * 統計檢視中間件組合
 * 包含身份驗證和統計檢視權限檢查
 */
export const statsViewAccess = [
  _checkMessageAccess,
  _checkStatsViewPermission
];

/**
 * 搜尋中間件組合
 * 包含搜尋參數驗證、身份驗證和範圍過濾
 */
export const messageSearchAccess = [
  _validateSearchQuery,
  _checkMessageAccess,
  _applyMessageScopeFilter
];

// ======================== 中間件配置 ========================

/**
 * 中間件配置選項
 */
export interface MessageMiddlewareConfig {
  enablePermissionCheck: boolean;
  enableScopeFilter: boolean;
  enableDataValidation: boolean;
  enableSenderValidation: boolean;
}

/**
 * 預設中間件配置
 */
export const DEFAULT_MIDDLEWARE_CONFIG: MessageMiddlewareConfig = {
  enablePermissionCheck: true,
  enableScopeFilter: true,
  enableDataValidation: true,
  enableSenderValidation: true
};

/**
 * 根據配置動態組合中間件
 */
export function createMessageMiddleware(config: Partial<MessageMiddlewareConfig> = {}) {
  const finalConfig = { ...DEFAULT_MIDDLEWARE_CONFIG, ...config };
  const middleware = [];

  if (finalConfig.enablePermissionCheck) {
    middleware.push(_checkMessageAccess);
  }

  if (finalConfig.enableScopeFilter) {
    middleware.push(_applyMessageScopeFilter);
  }

  return middleware;
}

/**
 * 為特定操作類型創建中間件
 */
export function createOperationMiddleware(
  operation: 'send' | 'recall' | 'batch' | 'search' | 'stats',
  config: Partial<MessageMiddlewareConfig> = {}
) {
  const finalConfig = { ...DEFAULT_MIDDLEWARE_CONFIG, ...config };

  switch (operation) {
    case 'send':
      return messageSendAccess.filter(m =>
        finalConfig.enableDataValidation || m !== _validateCreateMessageData
      );

    case 'recall':
      return messageRecallAccess.filter(m =>
        finalConfig.enableDataValidation || m !== _validateRecallRequest
      );

    case 'batch':
      return batchOperationAccess.filter(m =>
        finalConfig.enableDataValidation || m !== _validateBatchSendData
      );

    case 'search':
      return messageSearchAccess.filter(m =>
        finalConfig.enableDataValidation || m !== _validateSearchQuery
      );

    case 'stats':
      return statsViewAccess;

    default:
      return basicMessageAccess;
  }
}
