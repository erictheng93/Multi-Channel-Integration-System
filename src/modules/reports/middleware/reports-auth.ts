// Reports 模組權限控制中間件
// Reports module authentication and permission middleware

import type { Context, Next } from 'hono';
import type { Bindings } from '@/types';
import { verifyJWT } from '@/utils/auth';
import { PermissionService } from '@/services/permission-service';
import type { PermissionContext } from '@/types/services';
import { HTTP_STATUS } from '@/constants/http-status';
import { nowISO, nowMs } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('ReportsAuth')

// ======================== 基礎權限檢查 ========================

/**
 * 檢查基本報告系統存取權限
 */
export async function checkReportsAccess(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({
        success: false,
        error: 'Missing or invalid authorization header',
        timestamp: nowISO()
      }, HTTP_STATUS.UNAUTHORIZED);
    }

    const token = authHeader.substring(7);
    const payload = await verifyJWT(token, c.env.JWT_SECRET);

    if (!payload) {
      return c.json({
        success: false,
        error: 'Invalid or expired token',
        timestamp: nowISO()
      }, HTTP_STATUS.UNAUTHORIZED);
    }

    // 將 JWT payload 存储到 context 中
    c.set('jwtPayload', payload);
    return await next();
  } catch (error) {
    log.error('Reports access check error', {}, error instanceof Error ? error : String(error));
    return c.json({
      success: false,
      error: 'Authentication failed',
      timestamp: nowISO()
    }, HTTP_STATUS.UNAUTHORIZED);
  }
}

// ======================== 報告權限檢查 ========================

/**
 * 檢查報告檢視權限
 */
export async function checkReportsViewPermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const payload = c.get('jwtPayload');

    if (!payload) {
      return c.json({
        success: false,
        error: 'Authentication required',
        timestamp: nowISO()
      }, HTTP_STATUS.UNAUTHORIZED);
    }

    // 使用 PermissionService 進行細緻權限檢查
    const context: PermissionContext = {
      userId: payload.userId,
      role: payload.role,
      teamId: payload.primaryTeamId
    };

    const hasPermission = await PermissionService.checkPermission(
      payload.userId,
      'report',
      'read',
      context,
      c.env.DB
    );

    if (!hasPermission) {
      return c.json({
        success: false,
        error: 'Insufficient permissions to view reports',
        timestamp: nowISO()
      }, HTTP_STATUS.FORBIDDEN);
    }

    return await next();
  } catch (error) {
    log.error('Reports view permission check error', {}, error instanceof Error ? error : String(error));
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

/**
 * 檢查報告生成權限
 */
export async function checkReportsGeneratePermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const payload = c.get('jwtPayload');

    if (!payload) {
      return c.json({
        success: false,
        error: 'Authentication required',
        timestamp: nowISO()
      }, HTTP_STATUS.UNAUTHORIZED);
    }

    // 使用 PermissionService 檢查創建權限
    const context: PermissionContext = {
      userId: payload.userId,
      role: payload.role,
      teamId: payload.primaryTeamId
    };

    const hasPermission = await PermissionService.checkPermission(
      payload.userId,
      'report',
      'create',
      context,
      c.env.DB
    );

    if (!hasPermission) {
      return c.json({
        success: false,
        error: 'Insufficient permissions to generate reports',
        timestamp: nowISO()
      }, HTTP_STATUS.FORBIDDEN);
    }

    return await next();
  } catch (error) {
    log.error('Reports generate permission check error', {}, error instanceof Error ? error : String(error));
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

/**
 * 檢查報告下載權限
 */
export async function checkReportsDownloadPermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const payload = c.get('jwtPayload');

    if (!payload) {
      return c.json({
        success: false,
        error: 'Authentication required',
        timestamp: nowISO()
      }, HTTP_STATUS.UNAUTHORIZED);
    }

    // 使用 PermissionService 檢查導出權限
    // 根據角色自動應用範圍限制：team 角色有 teamScope，agent 角色有 own 限制
    const context: PermissionContext = {
      userId: payload.userId,
      role: payload.role,
      teamId: payload.primaryTeamId
    };

    const hasPermission = await PermissionService.checkPermission(
      payload.userId,
      'report',
      'export',
      context,
      c.env.DB
    );

    if (!hasPermission) {
      return c.json({
        success: false,
        error: 'Insufficient permissions to download reports',
        timestamp: nowISO()
      }, HTTP_STATUS.FORBIDDEN);
    }

    return await next();
  } catch (error) {
    log.error('Reports download permission check error', {}, error instanceof Error ? error : String(error));
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

/**
 * 檢查報告刪除權限
 * Admin 可以刪除所有報告，Team 和 Agent 只能刪除自己的報告
 */
export async function checkReportsDeletePermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const payload = c.get('jwtPayload');

    if (!payload) {
      return c.json({
        success: false,
        error: 'Authentication required',
        timestamp: nowISO()
      }, HTTP_STATUS.UNAUTHORIZED);
    }

    // 獲取報告 ID 用於所有權檢查
    const reportId = c.req.param('reportId') || c.req.param('id');

    // 構建權限上下文
    // Note: ownerId 應該在 handler 層從資料庫查詢後設置
    // 這裡先使用基本檢查，實際所有權驗證應在 handler 中進行
    const context: PermissionContext = {
      userId: payload.userId,
      role: payload.role,
      teamId: payload.primaryTeamId
    };

    const hasPermission = await PermissionService.checkPermission(
      payload.userId,
      'report',
      'delete',
      context,
      c.env.DB
    );

    if (!hasPermission) {
      return c.json({
        success: false,
        error: 'Insufficient permissions to delete reports',
        timestamp: nowISO()
      }, HTTP_STATUS.FORBIDDEN);
    }

    // 存儲報告 ID 供 handler 使用進行進一步驗證
    if (reportId) {
      c.set('reportId', reportId);
    }

    return await next();
  } catch (error) {
    log.error('Reports delete permission check error', {}, error instanceof Error ? error : String(error));
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

/**
 * 檢查報告統計檢視權限
 */
export async function checkReportsStatsPermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const payload = c.get('jwtPayload');

    if (!payload) {
      return c.json({
        success: false,
        error: 'Authentication required',
        timestamp: nowISO()
      }, HTTP_STATUS.UNAUTHORIZED);
    }

    // SECURITY: Admin-only access (2-tier role system)
    if (payload.role !== 'admin') {
      return c.json({
        success: false,
        error: 'Insufficient permissions to view report statistics',
        timestamp: nowISO()
      }, HTTP_STATUS.FORBIDDEN);
    }

    return await next();
  } catch (error) {
    log.error('Reports stats permission check error', {}, error instanceof Error ? error : String(error));
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

/**
 * 檢查批量操作權限
 */
export async function checkReportsBatchPermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const payload = c.get('jwtPayload');

    if (!payload) {
      return c.json({
        success: false,
        error: 'Authentication required',
        timestamp: nowISO()
      }, HTTP_STATUS.UNAUTHORIZED);
    }

    // SECURITY: Admin-only access (2-tier role system)
    if (payload.role !== 'admin') {
      return c.json({
        success: false,
        error: 'Insufficient permissions for batch operations',
        timestamp: nowISO()
      }, HTTP_STATUS.FORBIDDEN);
    }

    return await next();
  } catch (error) {
    log.error('Reports batch permission check error', {}, error instanceof Error ? error : String(error));
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

/**
 * 檢查排程報告權限
 */
export async function checkScheduledReportsPermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const payload = c.get('jwtPayload');

    if (!payload) {
      return c.json({
        success: false,
        error: 'Authentication required',
        timestamp: nowISO()
      }, HTTP_STATUS.UNAUTHORIZED);
    }

    // 使用 PermissionService 檢查排程權限
    const context: PermissionContext = {
      userId: payload.userId,
      role: payload.role,
      teamId: payload.primaryTeamId
    };

    const hasPermission = await PermissionService.checkPermission(
      payload.userId,
      'report',
      'schedule',
      context,
      c.env.DB
    );

    if (!hasPermission) {
      return c.json({
        success: false,
        error: 'Insufficient permissions to manage scheduled reports',
        timestamp: nowISO()
      }, HTTP_STATUS.FORBIDDEN);
    }

    return await next();
  } catch (error) {
    log.error('Scheduled reports permission check error', {}, error instanceof Error ? error : String(error));
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

/**
 * 檢查特殊報告類型權限
 */
export async function checkSpecialReportTypePermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const payload = c.get('jwtPayload');

    if (!payload) {
      return c.json({
        success: false,
        error: 'Authentication required',
        timestamp: nowISO()
      }, HTTP_STATUS.UNAUTHORIZED);
    }

    // 檢查報告類型
    const reportType = (c.get('reportParams') as any)?.type || c.req.param('type');

    // 某些報告類型需要特殊權限
    const restrictedReportTypes = ['system_health', 'custom', 'team_analytics'];

    // SECURITY: Admin-only access for restricted report types (2-tier role system)
    if (restrictedReportTypes.includes(reportType)) {
      if (payload.role !== 'admin') {
        return c.json({
          success: false,
          error: `Insufficient permissions for report type: ${reportType}`,
          timestamp: nowISO()
        }, HTTP_STATUS.FORBIDDEN);
      }
    }

    return await next();
  } catch (error) {
    log.error('Special report type permission check error', {}, error instanceof Error ? error : String(error));
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// ======================== 日誌記錄中間件 ========================

/**
 * 記錄報告操作日誌
 */
export async function logReportsOperation(c: Context<{ Bindings: Bindings }>, next: Next) {
  const startTime = nowMs();

  try {
    const payload = c.get('jwtPayload');
    const method = c.req.method;
    const path = c.req.path;

    log.info('Reports operation started', { method, path, userId: payload?.userId || 'unknown' });

    await next();

    const duration = Date.now() - startTime;
    log.info('Reports operation completed', { method, path, durationMs: duration });
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error('Reports operation failed', { method: c.req.method, path: c.req.path, durationMs: duration }, error instanceof Error ? error : String(error));
    throw error;
  }
}

// ======================== 類型定義 ========================

export interface ReportsPermissions {
  canView: boolean;
  canGenerate: boolean;
  canDownload: boolean;
  canDelete: boolean;
  canViewStats: boolean;
  canBatchOperate: boolean;
  canSchedule: boolean;
  canViewSystemReports: boolean;
  canCreateCustomReports: boolean;
}

export type ReportsAccessScope = 'all' | 'team' | 'own' | 'basic' | 'none';

export interface ReportTypePermissions {
  conversation_summary: string[];
  agent_performance: string[];
  team_analytics: string[];
  customer_satisfaction: string[];
  platform_usage: string[];
  message_statistics: string[];
  response_time_analysis: string[];
  workload_distribution: string[];
  system_health: string[];
  custom: string[];
}
