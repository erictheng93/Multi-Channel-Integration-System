// Session 模組權限控制中間件
// Session module authentication and permission middleware

import type { Context, Next } from 'hono';
import type { Bindings } from '@/types';
import { verifyJWT } from '@/utils/auth';

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
    console.error('Session access check error:', error);
    return c.json({
      success: false,
      error: 'Authentication failed',
      timestamp: new Date().toISOString()
    }, 401);
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
        timestamp: new Date().toISOString()
      }, 401);
    }

    // Admin 和 Team 角色可以檢視所有會話，Agent 只能檢視分配的對話
    if (!['admin', 'team', 'agent'].includes(payload.role)) {
      return c.json({
        success: false,
        error: 'Insufficient permissions to view sessions',
        timestamp: new Date().toISOString()
      }, 403);
    }

    await next();
  } catch (error) {
    console.error('Session view permission check error:', error);
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
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
        timestamp: new Date().toISOString()
      }, 401);
    }

    // 所有角色都可以建立會話
    if (!['admin', 'team', 'agent'].includes(payload.role)) {
      return c.json({
        success: false,
        error: 'Insufficient permissions to create sessions',
        timestamp: new Date().toISOString()
      }, 403);
    }

    await next();
  } catch (error) {
    console.error('Session create permission check error:', error);
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
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
        timestamp: new Date().toISOString()
      }, 401);
    }

    // Admin 和 Team 角色可以更新所有會話
    if (['admin', 'team'].includes(payload.role)) {
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
      timestamp: new Date().toISOString()
    }, 403);
  } catch (error) {
    console.error('Session update permission check error:', error);
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
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
        timestamp: new Date().toISOString()
      }, 401);
    }

    // 只有 Admin 角色可以刪除會話
    if (payload.role !== 'admin') {
      return c.json({
        success: false,
        error: 'Only administrators can delete sessions',
        timestamp: new Date().toISOString()
      }, 403);
    }

    await next();
  } catch (error) {
    console.error('Session delete permission check error:', error);
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
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
        timestamp: new Date().toISOString()
      }, 401);
    }

    // Admin 和 Team 角色可以檢視統計
    if (!['admin', 'team'].includes(payload.role)) {
      return c.json({
        success: false,
        error: 'Insufficient permissions to view session statistics',
        timestamp: new Date().toISOString()
      }, 403);
    }

    await next();
  } catch (error) {
    console.error('Session stats permission check error:', error);
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
export async function checkSessionBatchPermission(c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> {
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
    console.error('Session batch permission check error:', error);
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

// ======================== 日誌記錄中間件 ========================

/**
 * 記錄會話操作日誌
 */
export async function logSessionOperation(c: Context<{ Bindings: Bindings }>, next: Next) {
  const startTime = Date.now();

  try {
    const payload = c.get('jwtPayload');
    const method = c.req.method;
    const path = c.req.path;

    console.log(`Session operation started: ${method} ${path} by user ${payload?.userId || 'unknown'}`);

    await next();

    const duration = Date.now() - startTime;
    console.log(`Session operation completed: ${method} ${path} in ${duration}ms`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Session operation failed: ${c.req.method} ${c.req.path} after ${duration}ms`, error);
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