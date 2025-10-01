// System 模組權限控制中間件
// System access control and permission middleware

import { Context, Next } from 'hono';
import type { Bindings, JWTPayload } from '@/types';
import {
  unauthorizedResponse,
  forbiddenResponse
} from '@shared/utils/api-response';

// ======================== 系統權限類型 ========================

export interface SystemPermissions {
  canViewHealth: boolean;
  canViewStatus: boolean;
  canViewInfo: boolean;
  canViewStats: boolean;
  canViewSettings: boolean;
  canUpdateSettings: boolean;
  canManageIntegrations: boolean;
  canViewMetrics: boolean;
  canCreateBackups: boolean;
  canRestoreBackups: boolean;
  canManageCache: boolean;
  canRestartSystem: boolean;
  canAccessAdvanced: boolean;
}

export interface SystemAccessScope {
  isGlobalAccess: boolean;
  restrictedFeatures?: string[];
  allowedOperations?: string[];
}

// ======================== 基礎權限檢查 ========================

/**
 * 檢查用戶是否有系統模組的基本存取權限
 */
export async function checkSystemAccess(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const userPayload = c.get('jwtPayload') as JWTPayload;

    if (!userPayload) {
      return unauthorizedResponse(c, 'Authentication required for system access');
    }

    // 檢查用戶角色是否有系統權限
    const allowedRoles = ['admin', 'team'];
    if (!allowedRoles.includes(userPayload.role)) {
      return forbiddenResponse(c, 'Insufficient permissions for system access');
    }

    // 將用戶權限資訊存入 context
    c.set('systemPermissions', await getSystemPermissions(userPayload));
    c.set('systemAccessScope', await getSystemAccessScope(userPayload));

    return await next();
  } catch (error) {
    console.error('Error in system access check:', error);
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

// ======================== 功能權限檢查 ========================

/**
 * 檢查健康檢查存取權限
 */
export async function checkHealthViewPermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    // 健康檢查端點對所有已認證用戶開放
    const userPayload = c.get('jwtPayload') as JWTPayload;

    if (!userPayload) {
      return unauthorizedResponse(c, 'Authentication required');
    }

    return await next();
  } catch (error) {
    console.error('Error in health view permission check:', error);
    return c.json({
      success: false,
      error: 'Health permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

/**
 * 檢查系統狀態檢視權限
 */
export async function checkStatusViewPermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const permissions = c.get('systemPermissions');

    if (!permissions || !permissions.canViewStatus) {
      return forbiddenResponse(c, 'No permission to view system status');
    }

    return await next();
  } catch (error) {
    console.error('Error in status view permission check:', error);
    return c.json({
      success: false,
      error: 'Status permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

/**
 * 檢查系統資訊檢視權限
 */
export async function checkInfoViewPermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const permissions = c.get('systemPermissions');

    if (!permissions || !permissions.canViewInfo) {
      return forbiddenResponse(c, 'No permission to view system information');
    }

    return await next();
  } catch (error) {
    console.error('Error in info view permission check:', error);
    return c.json({
      success: false,
      error: 'Info permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

/**
 * 檢查統計檢視權限
 */
export async function checkStatsViewPermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const permissions = c.get('systemPermissions');

    if (!permissions || !permissions.canViewStats) {
      return forbiddenResponse(c, 'No permission to view system statistics');
    }

    return await next();
  } catch (error) {
    console.error('Error in stats view permission check:', error);
    return c.json({
      success: false,
      error: 'Stats permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

/**
 * 檢查設置檢視權限
 */
export async function checkSettingsViewPermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const permissions = c.get('systemPermissions');

    if (!permissions || !permissions.canViewSettings) {
      return forbiddenResponse(c, 'No permission to view system settings');
    }

    return await next();
  } catch (error) {
    console.error('Error in settings view permission check:', error);
    return c.json({
      success: false,
      error: 'Settings view permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

/**
 * 檢查設置更新權限
 */
export async function checkSettingsUpdatePermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const permissions = c.get('systemPermissions');

    if (!permissions || !permissions.canUpdateSettings) {
      return forbiddenResponse(c, 'No permission to update system settings');
    }

    return await next();
  } catch (error) {
    console.error('Error in settings update permission check:', error);
    return c.json({
      success: false,
      error: 'Settings update permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

/**
 * 檢查整合管理權限
 */
export async function checkIntegrationsManagePermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const permissions = c.get('systemPermissions');

    if (!permissions || !permissions.canManageIntegrations) {
      return forbiddenResponse(c, 'No permission to manage integrations');
    }

    return await next();
  } catch (error) {
    console.error('Error in integrations manage permission check:', error);
    return c.json({
      success: false,
      error: 'Integrations permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

/**
 * 檢查指標檢視權限
 */
export async function checkMetricsViewPermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const permissions = c.get('systemPermissions');

    if (!permissions || !permissions.canViewMetrics) {
      return forbiddenResponse(c, 'No permission to view system metrics');
    }

    return await next();
  } catch (error) {
    console.error('Error in metrics view permission check:', error);
    return c.json({
      success: false,
      error: 'Metrics permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

/**
 * 檢查備份創建權限
 */
export async function checkBackupCreatePermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const permissions = c.get('systemPermissions');

    if (!permissions || !permissions.canCreateBackups) {
      return forbiddenResponse(c, 'No permission to create backups');
    }

    return await next();
  } catch (error) {
    console.error('Error in backup create permission check:', error);
    return c.json({
      success: false,
      error: 'Backup create permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

/**
 * 檢查備份恢復權限
 */
export async function checkBackupRestorePermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const permissions = c.get('systemPermissions');

    if (!permissions || !permissions.canRestoreBackups) {
      return forbiddenResponse(c, 'No permission to restore backups');
    }

    return await next();
  } catch (error) {
    console.error('Error in backup restore permission check:', error);
    return c.json({
      success: false,
      error: 'Backup restore permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

/**
 * 檢查快取管理權限
 */
export async function checkCacheManagePermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const permissions = c.get('systemPermissions');

    if (!permissions || !permissions.canManageCache) {
      return forbiddenResponse(c, 'No permission to manage cache');
    }

    return await next();
  } catch (error) {
    console.error('Error in cache manage permission check:', error);
    return c.json({
      success: false,
      error: 'Cache manage permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

/**
 * 檢查系統重啟權限 (僅限 Admin)
 */
export async function checkSystemRestartPermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const userPayload = c.get('jwtPayload') as JWTPayload;
    const permissions = c.get('systemPermissions');

    // 系統重啟僅限管理員
    if (userPayload.role !== 'admin' || !permissions?.canRestartSystem) {
      return forbiddenResponse(c, 'Only administrators can restart the system');
    }

    return await next();
  } catch (error) {
    console.error('Error in system restart permission check:', error);
    return c.json({
      success: false,
      error: 'System restart permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

/**
 * 檢查進階功能存取權限
 */
export async function checkAdvancedAccessPermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const permissions = c.get('systemPermissions');

    if (!permissions || !permissions.canAccessAdvanced) {
      return forbiddenResponse(c, 'No permission to access advanced features');
    }

    return await next();
  } catch (error) {
    console.error('Error in advanced access permission check:', error);
    return c.json({
      success: false,
      error: 'Advanced access permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

// ======================== 權限計算函數 ========================

/**
 * 根據用戶資訊計算系統權限
 */
async function getSystemPermissions(userPayload: JWTPayload): Promise<SystemPermissions> {
  // 根據角色設定基礎權限
  switch (userPayload.role) {
    case 'admin':
      return {
        canViewHealth: true,
        canViewStatus: true,
        canViewInfo: true,
        canViewStats: true,
        canViewSettings: true,
        canUpdateSettings: true,
        canManageIntegrations: true,
        canViewMetrics: true,
        canCreateBackups: true,
        canRestoreBackups: true,
        canManageCache: true,
        canRestartSystem: true,
        canAccessAdvanced: true,
      };

    case 'team':
      return {
        canViewHealth: true,
        canViewStatus: true,
        canViewInfo: true,
        canViewStats: true,
        canViewSettings: true,
        canUpdateSettings: false,
        canManageIntegrations: false,
        canViewMetrics: true,
        canCreateBackups: false,
        canRestoreBackups: false,
        canManageCache: false,
        canRestartSystem: false,
        canAccessAdvanced: false,
      };

    default:
      return {
        canViewHealth: true,
        canViewStatus: false,
        canViewInfo: false,
        canViewStats: false,
        canViewSettings: false,
        canUpdateSettings: false,
        canManageIntegrations: false,
        canViewMetrics: false,
        canCreateBackups: false,
        canRestoreBackups: false,
        canManageCache: false,
        canRestartSystem: false,
        canAccessAdvanced: false,
      };
  }
}

/**
 * 根據用戶資訊計算系統存取範圍
 */
async function getSystemAccessScope(userPayload: JWTPayload): Promise<SystemAccessScope> {
  // Admin 有全域存取權限
  if (userPayload.role === 'admin') {
    return {
      isGlobalAccess: true,
    };
  }

  // Team 角色有部分功能限制
  if (userPayload.role === 'team') {
    return {
      isGlobalAccess: false,
      restrictedFeatures: ['settings', 'integrations', 'backups', 'cache', 'restart'],
      allowedOperations: ['view', 'read', 'monitor'],
    };
  }

  // 預設最小權限
  return {
    isGlobalAccess: false,
    restrictedFeatures: ['settings', 'integrations', 'backups', 'cache', 'restart', 'stats', 'metrics'],
    allowedOperations: ['health'],
  };
}

// ======================== 平台驗證 ========================

/**
 * 驗證平台參數
 */
export async function validatePlatformParam(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const platform = c.req.param('platform');

    if (!platform) {
      return c.json({
        success: false,
        error: 'Platform parameter is required',
        timestamp: new Date().toISOString()
      }, 400);
    }

    const supportedPlatforms = ['line', 'facebook'];
    if (!supportedPlatforms.includes(platform)) {
      return c.json({
        success: false,
        error: `Invalid platform. Must be one of: ${supportedPlatforms.join(', ')}`,
        timestamp: new Date().toISOString()
      }, 400);
    }

    return await next();
  } catch (error) {
    console.error('Error validating platform param:', error);
    return c.json({
      success: false,
      error: 'Platform parameter validation failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

// ======================== 請求驗證 ========================

/**
 * 驗證請求大小
 */
export async function validateRequestSize(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const contentLength = c.req.header('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      const maxSize = 10 * 1024 * 1024; // 10MB

      if (size > maxSize) {
        return c.json({
          success: false,
          error: 'Request size too large',
          timestamp: new Date().toISOString()
        }, 413);
      }
    }

    return await next();
  } catch (error) {
    console.error('Error in request size validation:', error);
    return c.json({
      success: false,
      error: 'Request validation failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

/**
 * 驗證請求頻率限制
 */
export async function validateRateLimit(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const userPayload = c.get('jwtPayload') as JWTPayload;

    if (!userPayload) {
      return unauthorizedResponse(c, 'Authentication required for rate limiting');
    }

    // 簡單的頻率限制實作，實際使用時可以使用 KV 存儲
    // 這裡只是做基本的檢查
    // const rateLimitKey = `rate_limit:${userPayload.userId}`; // TODO: 實作真正的頻率限制

    // 暫時允許所有請求，實際實作需要使用 KV
    return await next();
  } catch (error) {
    console.error('Error in rate limit validation:', error);
    return c.json({
      success: false,
      error: 'Rate limit validation failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

// ======================== 操作記錄 ========================

/**
 * 記錄系統操作
 */
export async function logSystemOperation(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const userPayload = c.get('jwtPayload') as JWTPayload;
    const method = c.req.method;
    const path = new URL(c.req.url).pathname;
    const startTime = Date.now();

    // 執行操作
    await next();

    // 記錄操作（僅記錄敏感操作）
    const sensitiveOperations = [
      'PUT /api/system/settings',
      'POST /api/system/integrations',
      'POST /api/system/backup',
      'POST /api/system/restore',
      'POST /api/system/restart',
      'POST /api/system/cache/clear'
    ];

    const operationKey = `${method} ${path}`;
    if (sensitiveOperations.some(op => operationKey.includes(op))) {
      const duration = Date.now() - startTime;

      // 這裡可以記錄到資料庫或日誌系統
      console.log(`[SYSTEM OPERATION] ${userPayload.userId} (${userPayload.role}) performed ${operationKey} in ${duration}ms`);
    }
  } catch (error) {
    console.error('Error in system operation logging:', error);
    // 不影響主要流程，繼續執行
    return await next();
  }
}