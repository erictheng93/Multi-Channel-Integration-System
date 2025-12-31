// Phase 2 認證管理 API Handler
// 專門處理 Phase 2 監控系統的認證令牌管理

import { Hono } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import type { Bindings } from '../types';
import { jwtAuth } from '../middleware/auth';
import {
  generateSystemToken,
  generateMonitoringToken,
  generateTokenBatch,
  getUserById
} from '../utils/auth';

const phase2AuthHandler = new Hono<{ Bindings: Bindings }>();

// =================== 令牌生成 API ===================

// 生成系統監控令牌 (僅管理員)
phase2AuthHandler.post('/monitoring-token', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    // 只有管理員可以生成監控令牌
    if (user.role !== 'admin') {
      return c.json({
        error: 'Admin access required',
        message: 'Only administrators can generate monitoring tokens'
      }, HTTP_STATUS.FORBIDDEN);
    }

    const expiresIn = parseInt(c.req.query('expiresIn') || '604800'); // 默認7天

    // 驗證過期時間範圍 (1小時 - 30天)
    if (expiresIn < 3600 || expiresIn > 30 * 24 * 60 * 60) {
      return c.json({
        error: 'Invalid expiration time',
        message: 'Expiration time must be between 1 hour and 30 days'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const token = await generateMonitoringToken(c.env.JWT_SECRET, expiresIn);

    return c.json({
      success: true,
      token,
      type: 'monitoring',
      expiresIn,
      expiresAt: new Date((Math.floor(Date.now() / 1000) + expiresIn) * 1000).toISOString(),
      generatedBy: user.id,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [Auth] Monitoring token generation failed:', error);
    return c.json({
      error: 'Token generation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// 生成用戶系統令牌 (管理員和團隊成員)
phase2AuthHandler.post('/user-token', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const { targetUserId, expiresIn = 3600 } = await c.req.json();

    // SECURITY: Admin-only access (2-tier role system)
    if (user.role !== 'admin') {
      return c.json({
        error: 'Insufficient permissions',
        message: 'Only administrators can generate user tokens'
      }, HTTP_STATUS.FORBIDDEN);
    }

    if (!targetUserId) {
      return c.json({
        error: 'Missing target user ID',
        message: 'targetUserId is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 驗證過期時間範圍 (5分鐘 - 24小時)
    if (expiresIn < 300 || expiresIn > 24 * 60 * 60) {
      return c.json({
        error: 'Invalid expiration time',
        message: 'Expiration time must be between 5 minutes and 24 hours'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 獲取目標用戶信息
    const targetUser = await getUserById(c.env.DB, targetUserId);

    const token = await generateSystemToken(
      targetUser.id.toString(),
      targetUser.role,
      targetUser.displayName,
      targetUser.teamId || 1,
      c.env.JWT_SECRET,
      expiresIn
    );

    return c.json({
      success: true,
      token,
      type: 'user',
      targetUser: {
        id: targetUser.id,
        displayName: targetUser.displayName,
        role: targetUser.role,
        teamId: targetUser.teamId
      },
      expiresIn,
      expiresAt: new Date((Math.floor(Date.now() / 1000) + expiresIn) * 1000).toISOString(),
      generatedBy: user.id,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [Auth] User token generation failed:', error);
    return c.json({
      error: 'Token generation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// 批量生成測試令牌 (僅管理員，開發環境)
phase2AuthHandler.post('/batch-tokens', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    // 只有管理員可以批量生成令牌
    if (user.role !== 'admin') {
      return c.json({
        error: 'Admin access required',
        message: 'Only administrators can generate batch tokens'
      }, HTTP_STATUS.FORBIDDEN);
    }

    // 開發環境限制
    const environment = c.env.ENVIRONMENT || 'production';
    if (environment === 'production') {
      return c.json({
        error: 'Not available in production',
        message: 'Batch token generation is only available in development'
      }, HTTP_STATUS.FORBIDDEN);
    }

    const { users, expiresIn = 3600 } = await c.req.json();

    if (!Array.isArray(users) || users.length === 0) {
      return c.json({
        error: 'Invalid user list',
        message: 'Users array is required and must not be empty'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 限制批量生成數量
    if (users.length > 10) {
      return c.json({
        error: 'Too many users',
        message: 'Maximum 10 users per batch'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const tokens = await generateTokenBatch(users, c.env.JWT_SECRET, expiresIn);

    return c.json({
      success: true,
      tokens,
      count: tokens.length,
      expiresIn,
      generatedBy: user.id,
      timestamp: Date.now(),
      warning: 'These are development tokens - do not use in production'
    });

  } catch (error) {
    console.error('❌ [Auth] Batch token generation failed:', error);
    return c.json({
      error: 'Batch token generation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// =================== 令牌驗證和管理 API ===================

// 驗證令牌狀態
phase2AuthHandler.post('/verify-token', async (c) => {
  try {
    const { token } = await c.req.json();

    if (!token) {
      return c.json({
        error: 'Missing token',
        message: 'Token is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 動態導入以避免循環依賴
    const { verifyJWT } = await import('../utils/auth');
    const payload = await verifyJWT(token, c.env.JWT_SECRET);

    // 檢查令牌是否即將過期 (剩餘時間少於1小時)
    const now = Math.floor(Date.now() / 1000);
    const timeRemaining = payload.exp - now;
    const isExpiringSoon = timeRemaining < 3600;

    return c.json({
      success: true,
      valid: true,
      payload: {
        userId: payload.userId,
        displayName: payload.displayName,
        role: payload.role,
        teamId: payload.teamId,
        isSystemToken: payload.isSystemToken || false
      },
      expiresAt: new Date(payload.exp * 1000).toISOString(),
      timeRemaining,
      isExpiringSoon,
      timestamp: Date.now()
    });

  } catch (error) {
    return c.json({
      success: true,
      valid: false,
      error: error instanceof Error ? error.message : 'Token validation failed',
      timestamp: Date.now()
    });
  }
});

// 刷新即將過期的令牌
phase2AuthHandler.post('/refresh-token', async (c) => {
  try {
    const { token } = await c.req.json();

    if (!token) {
      return c.json({
        error: 'Missing token',
        message: 'Token is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 動態導入以避免循環依賴
    const { verifyJWT } = await import('../utils/auth');

    let payload;
    try {
      payload = await verifyJWT(token, c.env.JWT_SECRET);
    } catch (error) {
      return c.json({
        error: 'Invalid token',
        message: 'Cannot refresh invalid or expired token'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 檢查是否為系統令牌
    if (payload.isSystemToken) {
      const newToken = await generateMonitoringToken(c.env.JWT_SECRET);
      return c.json({
        success: true,
        newToken,
        type: 'monitoring',
        message: 'Monitoring token refreshed',
        timestamp: Date.now()
      });
    }

    // 刷新用戶令牌
    const newToken = await generateSystemToken(
      String(payload.userId),
      payload.role as 'admin' | 'agent',
      payload.displayName,
      payload.teamId || 0,
      c.env.JWT_SECRET
    );

    return c.json({
      success: true,
      newToken,
      type: 'user',
      message: 'User token refreshed',
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [Auth] Token refresh failed:', error);
    return c.json({
      error: 'Token refresh failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// =================== 認證狀態 API ===================

// 獲取當前認證狀態
phase2AuthHandler.get('/status', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    return c.json({
      success: true,
      authenticated: true,
      user: {
        id: user.id,
        displayName: user.displayName,
        role: user.role,
        teamId: user.teamId,
        teamName: user.teamName
      },
      permissions: {
        canGenerateMonitoringToken: user.role === 'admin',
        canGenerateUserToken: user.role === 'admin',
        canAccessAnalytics: user.role === 'admin',
        canTriggerAlerts: user.role === 'admin'
      },
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [Auth] Status check failed:', error);
    return c.json({
      error: 'Status check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

export default phase2AuthHandler;