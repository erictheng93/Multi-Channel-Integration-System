// Reports 模組權限控制中間件
// Reports module authentication and permission middleware

import type { Context, Next } from 'hono';
import type { Bindings } from '../../../types';
import { verifyJWT } from '../../../utils/auth';

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
        timestamp: new Date().toISOString()
      }, 401);
    }

    const token = authHeader.substring(7);
    const payload = await verifyJWT(token, c.env.JWT_SECRET);

    if (!payload) {
      return c.json({
        success: false,
        error: 'Invalid or expired token',
        timestamp: new Date().toISOString()
      }, 401);
    }

    // 將 JWT payload 存储到 context 中
    c.set('jwtPayload', payload);
    await next();
  } catch (error) {
    console.error('Reports access check error:', error);
    return c.json({
      success: false,
      error: 'Authentication failed',
      timestamp: new Date().toISOString()
    }, 401);
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
        timestamp: new Date().toISOString()
      }, 401);
    }

    // Admin 和 Team 角色可以檢視所有報告，Agent 只能檢視基本報告
    if (!['admin', 'team', 'agent'].includes(payload.role)) {
      return c.json({
        success: false,
        error: 'Insufficient permissions to view reports',
        timestamp: new Date().toISOString()
      }, 403);
    }

    await next();
  } catch (error) {
    console.error('Reports view permission check error:', error);
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
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
        timestamp: new Date().toISOString()
      }, 401);
    }

    // 所有角色都可以生成報告，但會有不同的數據範圍
    if (!['admin', 'team', 'agent'].includes(payload.role)) {
      return c.json({
        success: false,
        error: 'Insufficient permissions to generate reports',
        timestamp: new Date().toISOString()
      }, 403);
    }

    await next();
  } catch (error) {
    console.error('Reports generate permission check error:', error);
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
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
        timestamp: new Date().toISOString()
      }, 401);
    }

    // 檢查用戶是否有權限下載特定報告
    // TODO: 實現更細緻的權限檢查，確保用戶只能下載自己生成的報告或有權限的報告
    if (!['admin', 'team', 'agent'].includes(payload.role)) {
      return c.json({
        success: false,
        error: 'Insufficient permissions to download reports',
        timestamp: new Date().toISOString()
      }, 403);
    }

    await next();
  } catch (error) {
    console.error('Reports download permission check error:', error);
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

/**
 * 檢查報告刪除權限
 */
export async function checkReportsDeletePermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const payload = c.get('jwtPayload');

    if (!payload) {
      return c.json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString()
      }, 401);
    }

    // Admin 可以刪除所有報告，Team 和 Agent 只能刪除自己的報告
    if (!['admin', 'team', 'agent'].includes(payload.role)) {
      return c.json({
        success: false,
        error: 'Insufficient permissions to delete reports',
        timestamp: new Date().toISOString()
      }, 403);
    }

    await next();
  } catch (error) {
    console.error('Reports delete permission check error:', error);
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
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
        timestamp: new Date().toISOString()
      }, 401);
    }

    // 只有 Admin 和 Team 角色可以檢視報告統計
    if (!['admin', 'team'].includes(payload.role)) {
      return c.json({
        success: false,
        error: 'Insufficient permissions to view report statistics',
        timestamp: new Date().toISOString()
      }, 403);
    }

    await next();
  } catch (error) {
    console.error('Reports stats permission check error:', error);
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
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
        timestamp: new Date().toISOString()
      }, 401);
    }

    // 只有 Admin 和 Team 角色可以執行批量操作
    if (!['admin', 'team'].includes(payload.role)) {
      return c.json({
        success: false,
        error: 'Insufficient permissions for batch operations',
        timestamp: new Date().toISOString()
      }, 403);
    }

    await next();
  } catch (error) {
    console.error('Reports batch permission check error:', error);
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
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
        timestamp: new Date().toISOString()
      }, 401);
    }

    // 只有 Admin 和 Team 角色可以管理排程報告
    if (!['admin', 'team'].includes(payload.role)) {
      return c.json({
        success: false,
        error: 'Insufficient permissions to manage scheduled reports',
        timestamp: new Date().toISOString()
      }, 403);
    }

    await next();
  } catch (error) {
    console.error('Scheduled reports permission check error:', error);
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
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
        timestamp: new Date().toISOString()
      }, 401);
    }

    // 檢查報告類型
    const reportType = (c.get('reportParams') as any)?.type || c.req.param('type');

    // 某些報告類型需要特殊權限
    const restrictedReportTypes = ['system_health', 'custom', 'team_analytics'];

    if (restrictedReportTypes.includes(reportType)) {
      if (!['admin', 'team'].includes(payload.role)) {
        return c.json({
          success: false,
          error: `Insufficient permissions for report type: ${reportType}`,
          timestamp: new Date().toISOString()
        }, 403);
      }
    }

    await next();
  } catch (error) {
    console.error('Special report type permission check error:', error);
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

// ======================== 日誌記錄中間件 ========================

/**
 * 記錄報告操作日誌
 */
export async function logReportsOperation(c: Context<{ Bindings: Bindings }>, next: Next) {
  const startTime = Date.now();

  try {
    const payload = c.get('jwtPayload');
    const method = c.req.method;
    const path = c.req.path;

    console.log(`Reports operation started: ${method} ${path} by user ${payload?.userId || 'unknown'}`);

    await next();

    const duration = Date.now() - startTime;
    console.log(`Reports operation completed: ${method} ${path} in ${duration}ms`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Reports operation failed: ${c.req.method} ${c.req.path} after ${duration}ms`, error);
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