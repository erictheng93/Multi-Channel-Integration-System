// QRCode 模組中間件統一導出
// 集中導出所有 QR Code 相關的中間件

// ======================== 權限控制中間件 ========================
export {
  qrCodeAuthMiddleware,
  requireCreatePermission,
  requireManagePermission,
  requireReadPermission,
  requireBatchPermission,
  requireAdminPermission,
  requireStatsPermission,
  qrCodeCreateRateLimit,
  qrCodeScanRateLimit
} from './qrcode-auth';

// ======================== 數據驗證中間件 ========================
export {
  validateCreateRequest,
  validateUpdateRequest,
  validateQueryParams,
  validateBatchRequest
} from './qrcode-validation';

// ======================== 中間件組合器 ========================

import type { Context, Next } from 'hono';
import type { Bindings } from '@/types';
import {
  qrCodeAuthMiddleware,
  requireCreatePermission,
  requireManagePermission,
  requireReadPermission,
  qrCodeCreateRateLimit
} from './qrcode-auth';
import {
  validateCreateRequest,
  validateUpdateRequest,
  validateQueryParams
} from './qrcode-validation';

/**
 * QR Code 創建中間件鏈
 * 包含認證、權限、速率限制和數據驗證
 */
export function createQRCodeMiddleware() {
  return [
    qrCodeAuthMiddleware,
    requireCreatePermission,
    qrCodeCreateRateLimit,
    validateCreateRequest
  ];
}

/**
 * QR Code 管理中間件鏈
 * 包含認證、權限和數據驗證
 */
export function manageQRCodeMiddleware() {
  return [
    qrCodeAuthMiddleware,
    requireManagePermission,
    validateUpdateRequest
  ];
}

/**
 * QR Code 讀取中間件鏈
 * 包含認證、權限和查詢驗證
 */
export function readQRCodeMiddleware() {
  return [
    qrCodeAuthMiddleware,
    requireReadPermission
  ];
}

/**
 * QR Code 列表中間件鏈
 * 包含認證和查詢參數驗證
 */
export function listQRCodeMiddleware() {
  return [
    qrCodeAuthMiddleware,
    validateQueryParams
  ];
}

// ======================== 中間件配置 ========================

/**
 * QR Code 中間件配置
 */
export const QR_CODE_MIDDLEWARE_CONFIG = {
  // 速率限制配置
  rateLimit: {
    create: {
      maxRequests: 10,
      windowMs: 3600000, // 1 hour
    },
    scan: {
      maxRequests: 30,
      windowMs: 60000, // 1 minute
    },
    batch: {
      maxRequests: 5,
      windowMs: 3600000, // 1 hour
    }
  },

  // 權限配置
  permissions: {
    admin: ['create', 'read', 'update', 'delete', 'batch', 'manage_all', 'view_stats', 'admin'],
    team: ['create', 'read', 'update', 'delete', 'batch', 'view_stats'],
    agent: ['create', 'read', 'update']
  },

  // 驗證配置
  validation: {
    maxNameLength: 100,
    maxDescriptionLength: 500,
    maxContentLength: 4296,
    maxTagsCount: 10,
    maxTagLength: 50,
    maxCustomDataSize: 5000,
    maxBatchSize: 50,
    minSize: 100,
    maxSize: 2000
  },

  // 快取配置
  cache: {
    qrCodeDetailTtl: 300, // 5 minutes
    qrCodeListTtl: 60,    // 1 minute
    statsTtl: 900         // 15 minutes
  }
} as const;

// ======================== 錯誤處理中間件 ========================

/**
 * QR Code 錯誤處理中間件
 */
export async function qrCodeErrorHandler(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    await next();
  } catch (error) {
    console.error('QRCode operation error:', error);

    // 根據錯誤類型返回適當的響應
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return c.json({
          success: false,
          error: 'QR code not found',
          code: 'QR_CODE_NOT_FOUND'
        }, 404);
      }

      if (error.message.includes('permission')) {
        return c.json({
          success: false,
          error: 'Insufficient permissions',
          code: 'PERMISSION_DENIED'
        }, 403);
      }

      if (error.message.includes('validation') || error.message.includes('invalid')) {
        return c.json({
          success: false,
          error: error.message,
          code: 'VALIDATION_ERROR'
        }, 400);
      }

      if (error.message.includes('rate limit')) {
        return c.json({
          success: false,
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED'
        }, 429);
      }

      if (error.message.includes('quota')) {
        return c.json({
          success: false,
          error: 'Quota exceeded',
          code: 'QUOTA_EXCEEDED'
        }, 403);
      }
    }

    // 預設錯誤響應
    return c.json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, 500);
  }
}

// ======================== 日誌中間件 ========================

/**
 * QR Code 操作日誌中間件
 */
export async function qrCodeLoggerMiddleware(c: Context<{ Bindings: Bindings }>, next: Next) {
  const startTime = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const userId = String(c.get('userId' as any) || '');
  const userRole = String(c.get('userRole' as any) || '');
  const teamId = String(c.get('teamId' as any) || '');

  console.log(`[QRCode] ${method} ${path} - User: ${userId} (${userRole}) Team: ${teamId}`);

  try {
    await next();

    const duration = Date.now() - startTime;
    const status = c.res.status;

    console.log(`[QRCode] ${method} ${path} - ${status} (${duration}ms)`);

    // 記錄重要操作到數據庫或外部日誌服務
    if (['POST', 'PUT', 'DELETE'].includes(method)) {
      // TODO: 實現操作日誌記錄
      await logQRCodeOperation({
        userId: parseInt(userId as string),
        userRole,
        teamId: parseInt(teamId as string),
        method,
        path,
        status,
        duration
      });
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[QRCode] ${method} ${path} - ERROR (${duration}ms):`, error);
    throw error;
  }
}

/**
 * 記錄 QR Code 操作日誌
 */
async function logQRCodeOperation(logData: {
  userId: number;
  userRole: string;
  teamId: number;
  method: string;
  path: string;
  status: number;
  duration: number;
}): Promise<void> {
  try {
    // TODO: 實現日誌記錄邏輯
    // 可以記錄到數據庫、外部日誌服務或分析平台

    // 範例：記錄到 console（在生產環境中應該使用適當的日誌服務）
    const logEntry = {
      timestamp: new Date().toISOString(),
      module: 'qrcode',
      ...logData
    };

    console.log('QRCode Operation Log:', JSON.stringify(logEntry));

  } catch (error) {
    console.error('Failed to log QRCode operation:', error);
  }
}