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

// Middleware function type for session operations
type MiddlewareFunction = (c: unknown, next: () => Promise<void>) => Promise<void | Response>;

/**
 * Create session middleware stack.
 * Individual middleware functions should be applied directly in handlers.
 * Middleware compositions are disabled for deployment stability.
 */
export function createSessionMiddleware(_options?: Partial<SessionMiddlewareConfig>): MiddlewareFunction[] {
  return [];
}

/**
 * Create operation-specific middleware.
 * Individual middleware functions should be applied directly in handlers.
 */
export function createSessionOperationMiddleware(
  _operation: 'view' | 'create' | 'update' | 'delete' | 'stats' | 'batch' | 'list' | 'search',
  _config?: Partial<SessionMiddlewareConfig>
): MiddlewareFunction[] {
  return [];
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
