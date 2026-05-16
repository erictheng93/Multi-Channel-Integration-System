// System Middleware 統一導出
// Unified export for system middleware

// ======================== 權限控制中間件 ========================
export {
  checkSystemAccess,
  checkHealthViewPermission,
  checkStatusViewPermission,
  checkInfoViewPermission,
  checkStatsViewPermission,
  checkSettingsViewPermission,
  checkSettingsUpdatePermission,
  checkIntegrationsManagePermission,
  checkMetricsViewPermission,
  checkBackupCreatePermission,
  checkBackupRestorePermission,
  checkCacheManagePermission,
  checkSystemRestartPermission,
  checkAdvancedAccessPermission,
  validatePlatformParam,
  logSystemOperation
} from './system-auth';

export type {
  SystemPermissions,
  SystemAccessScope
} from './system-auth';

// ======================== 資料驗證中間件 ========================
export {
  validateBackupId,
  validateMessageId,
  validateConversationId,
  validateSystemSettingsUpdate,
  validatePlatformParameter,
  validateRateLimit,
  validateRequestSize,
  sanitizeString,
  validateNumberRange
} from './system-validation';

// ======================== 中間件配置 ========================

/**
 * 中間件配置選項
 */
export interface SystemMiddlewareConfig {
  enablePermissionCheck: boolean;
  enableRateLimit: boolean;
  enableLogging: boolean;
  enableValidation: boolean;
  enableSizeLimit: boolean;
}

/**
 * 預設中間件配置
 */
export const DEFAULT_SYSTEM_MIDDLEWARE_CONFIG: SystemMiddlewareConfig = {
  enablePermissionCheck: true,
  enableRateLimit: true,
  enableLogging: true,
  enableValidation: true,
  enableSizeLimit: true
};

/**
 * Create system middleware stack.
 * Individual middleware functions should be applied directly in handlers.
 * Middleware compositions are disabled for deployment stability.
 */
export function createSystemMiddleware(_config?: Partial<SystemMiddlewareConfig>) {
  return [];
}

/**
 * Create operation-specific middleware.
 * Individual middleware functions should be applied directly in handlers.
 */
export function createSystemOperationMiddleware(
  _operation: 'health' | 'status' | 'info' | 'stats' | 'settings-view' | 'settings-update' |
              'integrations' | 'metrics' | 'backup-create' | 'backup-restore' |
              'cache-manage' | 'system-restart' | 'advanced' | 'conversation',
  _config?: Partial<SystemMiddlewareConfig>
): Array<(c: unknown, next: () => Promise<void>) => Promise<void | Response>> {
  return [];
}

// ======================== 中間件工具函數 ========================

/**
 * 檢查中間件是否啟用
 */
export function isMiddlewareEnabled(middlewareType: keyof SystemMiddlewareConfig, config: Partial<SystemMiddlewareConfig>): boolean {
  const finalConfig = { ...DEFAULT_SYSTEM_MIDDLEWARE_CONFIG, ...config };
  return finalConfig[middlewareType];
}

/**
 * 動態添加中間件到現有陣列
 */
export function addMiddleware(
  existingMiddleware: unknown[],
  newMiddleware: unknown[],
  position: 'before' | 'after' = 'after'
) {
  if (position === 'before') {
    return [...newMiddleware, ...existingMiddleware];
  }
  return [...existingMiddleware, ...newMiddleware];
}

/**
 * 從中間件陣列中移除特定中間件
 */
export function removeMiddleware(middlewareArray: unknown[], middlewareToRemove: unknown[]) {
  return middlewareArray.filter(middleware => !middlewareToRemove.includes(middleware));
}
