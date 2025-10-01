// QRCode 權限控制中間件
// 負責 QR Code 相關操作的權限驗證

import type { Context, Next } from 'hono';
import type { Bindings } from '@/types';
import { errorResponse } from '@shared/utils/api-response';
import { QR_CODE_PERMISSIONS } from '@modules/qrcode/types/qrcode-types';

// ======================== 權限檢查中間件 ========================

/**
 * QR Code 基礎認證中間件
 * 確保用戶已登入並設置基本用戶資訊
 */
export async function qrCodeAuthMiddleware(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    // 檢查是否已通過基本認證
    const userId = (c as any).get('userId');
    const userRole = (c as any).get('userRole') || 'guest';
    const teamId = Number((c as any).get('teamId') || 0);

    if (!userId) {
      return errorResponse(c, 'Authentication required', 401);
    }

    // 設置 QRCode 特定的上下文
    c.set('qrCode', null);
    c.set('canAccess', false);
    c.set('canModify', false);

    await next();
  } catch (error) {
    console.error('QRCode auth middleware error:', error);
    return errorResponse(c, 'Authentication failed', 401);
  }
}

/**
 * QR Code 創建權限檢查
 */
export async function requireCreatePermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const userRole = (c as any).get('userRole');

    // 檢查用戶角色是否有創建權限
    if (!hasRolePermission(userRole, 'create')) {
      return errorResponse(c, 'Insufficient permissions to create QR codes', 403);
    }

    // 檢查團隊配額（如果需要）
    const teamId = Number((c as any).get('teamId') || 0);
    if (teamId && !await checkTeamQuota(Number(teamId), c.env.DB)) {
      return errorResponse(c, 'Team QR code quota exceeded', 403);
    }

    await next();
  } catch (error) {
    console.error('Create permission check error:', error);
    return errorResponse(c, 'Permission check failed', 500);
  }
}

/**
 * QR Code 管理權限檢查
 * 檢查用戶是否可以修改特定的 QR Code
 */
export async function requireManagePermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const qrCodeId = c.req.param('id');
    const userId = Number((c as any).get('userId') || 0);
    const userRole = (c as any).get('userRole');
    const teamId = Number((c as any).get('teamId') || 0);

    if (!qrCodeId) {
      return errorResponse(c, 'QR code ID is required', 400);
    }

    // 從資料庫獲取 QR Code 資訊
    const qrCode = await getQRCodeById(qrCodeId, c.env.DB);

    if (!qrCode) {
      return errorResponse(c, 'QR code not found', 404);
    }

    // 檢查權限
    const canAccess = await canUserAccessQRCode(qrCode, userId, userRole, teamId);
    const canModify = await canUserModifyQRCode(qrCode, userId, userRole, teamId);

    if (!canAccess) {
      return errorResponse(c, 'QR code not found', 404); // 隱藏權限錯誤
    }

    if (!canModify) {
      return errorResponse(c, 'Insufficient permissions to modify this QR code', 403);
    }

    // 設置上下文
    c.set('qrCode', qrCode);
    c.set('canAccess', canAccess);
    c.set('canModify', canModify);

    await next();
  } catch (error) {
    console.error('Manage permission check error:', error);
    return errorResponse(c, 'Permission check failed', 500);
  }
}

/**
 * QR Code 讀取權限檢查
 */
export async function requireReadPermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const qrCodeId = c.req.param('id');
    const userId = Number((c as any).get('userId') || 0);
    const userRole = (c as any).get('userRole');
    const teamId = Number((c as any).get('teamId') || 0);

    if (!qrCodeId) {
      return errorResponse(c, 'QR code ID is required', 400);
    }

    // 從資料庫獲取 QR Code 資訊
    const qrCode = await getQRCodeById(qrCodeId, c.env.DB);

    if (!qrCode) {
      return errorResponse(c, 'QR code not found', 404);
    }

    // 檢查讀取權限
    const canAccess = await canUserAccessQRCode(qrCode, userId, userRole, teamId);

    if (!canAccess) {
      return errorResponse(c, 'QR code not found', 404); // 隱藏權限錯誤
    }

    // 設置上下文
    c.set('qrCode', qrCode);
    c.set('canAccess', true);
    c.set('canModify', await canUserModifyQRCode(qrCode, userId, userRole, teamId));

    await next();
  } catch (error) {
    console.error('Read permission check error:', error);
    return errorResponse(c, 'Permission check failed', 500);
  }
}

/**
 * 批次操作權限檢查
 */
export async function requireBatchPermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const userRole = (c as any).get('userRole');

    // 只有 admin 和 team 可以執行批次操作
    if (!['admin', 'team'].includes(userRole)) {
      return errorResponse(c, 'Insufficient permissions for batch operations', 403);
    }

    // 檢查批次操作配額
    const requestBody = await c.req.json();
    const batchSize = requestBody?.qrCodes?.length || 0;

    if (batchSize > 50) { // 最大批次大小
      return errorResponse(c, 'Batch size exceeds maximum limit (50)', 400);
    }

    await next();
  } catch (error) {
    console.error('Batch permission check error:', error);
    return errorResponse(c, 'Permission check failed', 500);
  }
}

/**
 * 管理員功能權限檢查
 */
export async function requireAdminPermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const userRole = (c as any).get('userRole');

    if (userRole !== 'admin') {
      return errorResponse(c, 'Administrator access required', 403);
    }

    await next();
  } catch (error) {
    console.error('Admin permission check error:', error);
    return errorResponse(c, 'Permission check failed', 500);
  }
}

/**
 * 統計查看權限檢查
 */
export async function requireStatsPermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const userRole = (c as any).get('userRole');
    const requestedTeamId = c.req.query('teamId');
    const userTeamId = Number((c as any).get('teamId') || 0);

    // admin 可以查看所有統計
    if (userRole === 'admin') {
      await next();
      return;
    }

    // team 和 agent 只能查看自己團隊的統計
    if (requestedTeamId && parseInt(requestedTeamId) !== userTeamId) {
      return errorResponse(c, 'Cannot access other team statistics', 403);
    }

    await next();
  } catch (error) {
    console.error('Stats permission check error:', error);
    return errorResponse(c, 'Permission check failed', 500);
  }
}

// ======================== 權限檢查輔助函數 ========================

/**
 * 檢查角色是否有特定權限
 */
function hasRolePermission(role: string, action: string): boolean {
  const rolePermissions = {
    admin: ['create', 'read', 'update', 'delete', 'batch', 'manage_all', 'view_stats'],
    team: ['create', 'read', 'update', 'delete', 'batch', 'view_stats'],
    agent: ['create', 'read', 'update']
  };

  return rolePermissions[role as keyof typeof rolePermissions]?.includes(action) || false;
}

/**
 * 檢查用戶是否可以訪問特定 QR Code
 */
async function canUserAccessQRCode(
  qrCode: any,
  userId: number,
  userRole: string,
  teamId?: number
): Promise<boolean> {
  // 管理員可以訪問所有 QR Code
  if (userRole === 'admin') {
    return true;
  }

  // 創建者可以訪問自己的 QR Code
  if (qrCode.createdBy === userId) {
    return true;
  }

  // 同團隊成員可以訪問團隊內的 QR Code
  if (teamId && qrCode.teamId === teamId) {
    return true;
  }

  // 公開狀態的 QR Code 可以被訪問（如果有這個設定）
  if (qrCode.isPublic) {
    return true;
  }

  return false;
}

/**
 * 檢查用戶是否可以修改特定 QR Code
 */
async function canUserModifyQRCode(
  qrCode: any,
  userId: number,
  userRole: string,
  teamId?: number
): Promise<boolean> {
  // 管理員可以修改所有 QR Code
  if (userRole === 'admin') {
    return true;
  }

  // 創建者可以修改自己的 QR Code
  if (qrCode.createdBy === userId) {
    return true;
  }

  // 團隊長可以修改團隊內的 QR Code
  if (userRole === 'team' && teamId && qrCode.teamId === teamId) {
    return true;
  }

  return false;
}

/**
 * 從資料庫獲取 QR Code
 */
async function getQRCodeById(id: string, db: D1Database): Promise<any> {
  try {
    const stmt = db.prepare('SELECT * FROM qr_codes WHERE id = ?');
    const result = await stmt.bind(id).first();
    return result;
  } catch (error) {
    console.error('Error fetching QR code:', error);
    return null;
  }
}

/**
 * 檢查團隊配額
 */
async function checkTeamQuota(teamId: number, db: D1Database): Promise<boolean> {
  try {
    // 檢查團隊當前 QR Code 數量
    const stmt = db.prepare('SELECT COUNT(*) as count FROM qr_codes WHERE team_id = ? AND status != "disabled"');
    const result = await stmt.bind(teamId).first();
    const currentCount = (result as any)?.count || 0;

    // 假設每個團隊最多 100 個 QR Code
    const maxQuota = 100;

    return currentCount < maxQuota;
  } catch (error) {
    console.error('Error checking team quota:', error);
    return false; // 安全起見，配額檢查失敗時不允許創建
  }
}

// ======================== 速率限制中間件 ========================

/**
 * QR Code 創建速率限制
 */
export async function qrCodeCreateRateLimit(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const userId = Number((c as any).get('userId') || 0);
    const cacheKey = `qrcode-create-limit-${userId}`;

    if (c.env.CACHE) {
      const count = await c.env.CACHE.get(cacheKey);
      const currentCount = count ? parseInt(count) : 0;

      // 每小時最多創建 10 個 QR Code
      if (currentCount >= 10) {
        return errorResponse(c, 'Rate limit exceeded. Maximum 10 QR codes per hour.', 429);
      }

      // 增加計數器
      await c.env.CACHE.put(cacheKey, (currentCount + 1).toString(), { expirationTtl: 3600 });
    }

    await next();
  } catch (error) {
    console.error('Rate limit check error:', error);
    // 速率限制檢查失敗時繼續執行，避免影響正常功能
    await next();
  }
}

/**
 * QR Code 掃描速率限制
 */
export async function qrCodeScanRateLimit(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    const cacheKey = `qrcode-scan-limit-${ipAddress}`;

    if (c.env.CACHE) {
      const count = await c.env.CACHE.get(cacheKey);
      const currentCount = count ? parseInt(count) : 0;

      // 每分鐘最多掃描 30 次（防止濫用）
      if (currentCount >= 30) {
        return errorResponse(c, 'Rate limit exceeded. Too many scans.', 429);
      }

      // 增加計數器
      await c.env.CACHE.put(cacheKey, (currentCount + 1).toString(), { expirationTtl: 60 });
    }

    await next();
  } catch (error) {
    console.error('Scan rate limit check error:', error);
    // 速率限制檢查失敗時繼續執行，避免影響掃描功能
    await next();
  }
}