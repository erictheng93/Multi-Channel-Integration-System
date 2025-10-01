// Session Middleware 統一導出
// Unified export for session middleware

// ======================== 權限控制中間件 ========================
export {
  checkSessionAccess,
  checkSessionViewPermission,
  checkSessionCreatePermission,
  checkSessionUpdatePermission,
  checkSessionDeletePermission,
  checkSessionStatsPermission,
  checkSessionBatchPermission,
  logSessionOperation
} from './session-auth';

export type {
  SessionPermissions,
  SessionAccessScope
} from './session-auth';

// ======================== 資料驗證中間件 ========================
export {
  validateRequestSize,
  validateRateLimit,
  validateSessionId,
  validateConversationId,
  validateCreateSessionData,
  validateUpdateSessionData,
  validateSessionListQuery,
  validateSessionSearchQuery,
  validateBatchSessionOperation,
  sanitizeString,
  validateNumberRange,
  validateUUID,
  validateISODate
} from './session-validation';

// ======================== 中間件組合 ========================
// 注意：暫時不導出中間件組合以避免部署錯誤
// TODO: 在系統穩定後重新啟用中間件組合

/**
 * 基本會話存取中間件組合
 */
// export const basicSessionAccess = [
//   checkSessionAccess,
//   logSessionOperation
// ];

/**
 * 會話檢視中間件組合
 */
// export const sessionViewAccess = [
//   checkSessionAccess,
//   checkSessionViewPermission
// ];

/**
 * 會話創建中間件組合
 */
// export const sessionCreateAccess = [
//   validateRequestSize,
//   validateCreateSessionData,
//   validateRateLimit,
//   checkSessionAccess,
//   checkSessionCreatePermission,
//   logSessionOperation
// ];

/**
 * 會話更新中間件組合
 */
// export const sessionUpdateAccess = [
//   validateRequestSize,
//   validateSessionId,
//   validateUpdateSessionData,
//   validateRateLimit,
//   checkSessionAccess,
//   checkSessionUpdatePermission,
//   logSessionOperation
// ];

/**
 * 會話刪除中間件組合
 */
// export const sessionDeleteAccess = [
//   validateSessionId,
//   validateRateLimit,
//   checkSessionAccess,
//   checkSessionDeletePermission,
//   logSessionOperation
// ];

/**
 * 統計檢視中間件組合
 */
// export const sessionStatsAccess = [
//   checkSessionAccess,
//   checkSessionStatsPermission
// ];

/**
 * 批量操作中間件組合
 */
// export const sessionBatchAccess = [
//   validateRequestSize,
//   validateBatchSessionOperation,
//   validateRateLimit,
//   checkSessionAccess,
//   checkSessionBatchPermission,
//   logSessionOperation
// ];

/**
 * 會話列表查詢中間件組合
 */
// export const sessionListAccess = [
//   validateSessionListQuery,
//   checkSessionAccess,
//   checkSessionViewPermission
// ];

/**
 * 會話搜尋中間件組合
 */
// export const sessionSearchAccess = [
//   validateSessionSearchQuery,
//   checkSessionAccess,
//   checkSessionViewPermission
// ];

// ======================== 中間件配置 ========================

/**
 * 中間件配置選項
 */
export interface SessionMiddlewareConfig {
  enablePermissionCheck: boolean;
  enableRateLimit: boolean;
  enableLogging: boolean;
  enableValidation: boolean;
  enableSizeLimit: boolean;
}

/**
 * 預設中間件配置
 */
export const DEFAULT_SESSION_MIDDLEWARE_CONFIG: SessionMiddlewareConfig = {
  enablePermissionCheck: true,
  enableRateLimit: true,
  enableLogging: true,
  enableValidation: true,
  enableSizeLimit: true
};

/**
 * 根據配置動態組合中間件
 */
export function createSessionMiddleware(config: Partial<SessionMiddlewareConfig> = {}) {
  const finalConfig = { ...DEFAULT_SESSION_MIDDLEWARE_CONFIG, ...config };
  const middleware = [];

  if (finalConfig.enableSizeLimit) {
    // TODO: Implement validateRequestSize middleware
    // middleware.push(validateRequestSize);
  }

  if (finalConfig.enableRateLimit) {
    // TODO: Implement validateRateLimit middleware
    // middleware.push(validateRateLimit);
  }

  // TODO: 在系統穩定後重新啟用
  // if (finalConfig.enablePermissionCheck) {
  //   middleware.push(checkSessionAccess);
  // }

  // if (finalConfig.enableLogging) {
  //   middleware.push(logSessionOperation);
  // }

  return middleware;
}

/**
 * 為特定操作類型創建中間件
 */
export function createSessionOperationMiddleware(
  operation: 'view' | 'create' | 'update' | 'delete' | 'stats' | 'batch' | 'list' | 'search',
  config: Partial<SessionMiddlewareConfig> = {}
) {
  const finalConfig = { ...DEFAULT_SESSION_MIDDLEWARE_CONFIG, ...config };

  switch (operation) {
    case 'view':
      return []; // return sessionViewAccess when enabled
    case 'create':
      return []; // return sessionCreateAccess when enabled
    case 'update':
      return []; // return sessionUpdateAccess when enabled
    case 'delete':
      return []; // return sessionDeleteAccess when enabled
    case 'stats':
      return []; // return sessionStatsAccess when enabled
    case 'batch':
      return []; // return sessionBatchAccess when enabled
    case 'list':
      return []; // return sessionListAccess when enabled
    case 'search':
      return []; // return sessionSearchAccess when enabled
    default:
      return []; // return basicSessionAccess when enabled
  }
}

// ======================== 中間件工具函數 ========================

/**
 * 檢查中間件是否啟用
 */
export function isMiddlewareEnabled(middlewareType: keyof SessionMiddlewareConfig, config: Partial<SessionMiddlewareConfig>): boolean {
  const finalConfig = { ...DEFAULT_SESSION_MIDDLEWARE_CONFIG, ...config };
  return finalConfig[middlewareType];
}

/**
 * 動態添加中間件到現有陣列
 */
export function addMiddleware(
  existingMiddleware: any[],
  newMiddleware: any[],
  position: 'before' | 'after' = 'after'
): any[] {
  if (position === 'before') {
    return [...newMiddleware, ...existingMiddleware];
  }
  return [...existingMiddleware, ...newMiddleware];
}

/**
 * 從中間件陣列中移除特定中間件
 */
export function removeMiddleware(middlewareArray: any[], middlewareToRemove: any[]): any[] {
  return middlewareArray.filter(middleware => !middlewareToRemove.includes(middleware));
}