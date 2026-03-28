// Session 模組權限控制中間件
// Session module authentication and permission middleware

import type { Context, Next } from 'hono';
import type { Bindings } from '@/types';
import { verifyJWT } from '@/utils/auth';
import { HTTP_STATUS } from '@/constants/http-status';
import { nowISO, nowMs } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('SessionAuth');


// ======================== 基礎權限檢查 ========================

/**
 * 檢查基本系統存取權限
 */
export async function checkSessionAccess(c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> {
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
    await next();
  } catch (error) {
    log.error('Session access check error', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: 'Authentication failed',
      timestamp: nowISO()
    }, HTTP_STATUS.UNAUTHORIZED);
  }
}

// ======================== 具體權限檢查 ========================

/**
 * 檢查會話檢視權限
 */
export async function checkSessionViewPermission(c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> {
  try {
    const payload = c.get('jwtPayload');

    if (!payload) {
      return c.json({
        success: false,
        error: 'Authentication required',
        timestamp: nowISO()
      }, HTTP_STATUS.UNAUTHORIZED);
    }

    // SECURITY: Admin can view all sessions, Agent can view assigned only (2-tier system)
    if (!['admin', 'agent'].includes(payload.role)) {
      return c.json({
        success: false,
        error: 'Insufficient permissions to view sessions',
        timestamp: nowISO()
      }, HTTP_STATUS.FORBIDDEN);
    }

    await next();
  } catch (error) {
    log.error('Session view permission check error', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

/**
 * 檢查會話建立權限
 */
export async function checkSessionCreatePermission(c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> {
  try {
    const payload = c.get('jwtPayload');

    if (!payload) {
      return c.json({
        success: false,
        error: 'Authentication required',
        timestamp: nowISO()
      }, HTTP_STATUS.UNAUTHORIZED);
    }

    // SECURITY: All valid roles can create sessions (2-tier system)
    if (!['admin', 'agent'].includes(payload.role)) {
      return c.json({
        success: false,
        error: 'Insufficient permissions to create sessions',
        timestamp: nowISO()
      }, HTTP_STATUS.FORBIDDEN);
    }

    await next();
  } catch (error) {
    log.error('Session create permission check error', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

/**
 * 檢查會話更新權限
 */
export async function checkSessionUpdatePermission(c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> {
  try {
    const payload = c.get('jwtPayload');

    if (!payload) {
      return c.json({
        success: false,
        error: 'Authentication required',
        timestamp: nowISO()
      }, HTTP_STATUS.UNAUTHORIZED);
    }

    // SECURITY: Admin can update all sessions (2-tier role system)
    if (payload.role === 'admin') {
      await next();
      return;
    }

    // Agent 角色需要檢查是否有權限訪問特定對話
    if (payload.role === 'agent') {
      // TODO: 實現對話存取權限檢查
      await next();
      return;
    }

    return c.json({
      success: false,
      error: 'Insufficient permissions to update sessions',
      timestamp: nowISO()
    }, HTTP_STATUS.FORBIDDEN);
  } catch (error) {
    log.error('Session update permission check error', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

/**
 * 檢查會話刪除權限
 */
export async function checkSessionDeletePermission(c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> {
  try {
    const payload = c.get('jwtPayload');

    if (!payload) {
      return c.json({
        success: false,
        error: 'Authentication required',
        timestamp: nowISO()
      }, HTTP_STATUS.UNAUTHORIZED);
    }

    // 只有 Admin 角色可以刪除會話
    if (payload.role !== 'admin') {
      return c.json({
        success: false,
        error: 'Only administrators can delete sessions',
        timestamp: nowISO()
      }, HTTP_STATUS.FORBIDDEN);
    }

    await next();
  } catch (error) {
    log.error('Session delete permission check error', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

/**
 * 檢查統計檢視權限
 */
export async function checkSessionStatsPermission(c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> {
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
        error: 'Insufficient permissions to view session statistics',
        timestamp: nowISO()
      }, HTTP_STATUS.FORBIDDEN);
    }

    await next();
  } catch (error) {
    log.error('Session stats permission check error', {}, error instanceof Error ? error : new Error(String(error)));
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
export async function checkSessionBatchPermission(c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> {
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

    await next();
  } catch (error) {
    log.error('Session batch permission check error', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// ======================== 日誌記錄中間件 ========================

/**
 * 記錄會話操作日誌
 */
export async function logSessionOperation(c: Context<{ Bindings: Bindings }>, next: Next) {
  const startTime = nowMs();

  try {
    const payload = c.get('jwtPayload');
    const method = c.req.method;
    const path = c.req.path;

    log.info('Session operation started', { method, path, userId: payload?.userId || 'unknown' });

    await next();

    const duration = Date.now() - startTime;
    log.info('Session operation completed', { method, path, durationMs: duration });
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error('Session operation failed', { method: c.req.method, path: c.req.path, durationMs: duration }, error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

// ======================== 類型定義 ========================

export interface SessionPermissions {
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canViewStats: boolean;
  canBatchOperate: boolean;
}

export type SessionAccessScope = 'all' | 'team' | 'assigned' | 'none';