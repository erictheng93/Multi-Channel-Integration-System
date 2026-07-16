// Phase 2 認證管理 API Handler
// 專門處理 Phase 2 監控系統的認證令牌管理

import { Hono } from 'hono';
import { globalErrorHandler } from '@/core/error-handler';
import type { Bindings } from '@/types';
import { jwtAuth, requireAdmin } from '@/middleware/auth';
import {
  generateSystemToken,
  generateMonitoringToken,
  generateTokenBatch,
  getUserById
} from '@/utils/auth';
import { successResponse, forbiddenResponse, badRequestResponse } from '@/utils/api-response';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('Phase2AuthManagement');

const phase2AuthHandler = new Hono<{ Bindings: Bindings }>();

// =================== 令牌生成 API ===================

// 生成系統監控令牌 (僅管理員)
phase2AuthHandler.post('/monitoring-token', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    // 只有管理員可以生成監控令牌
    if (user.role !== 'admin') {
      return forbiddenResponse(c, 'Only administrators can generate monitoring tokens');
    }

    const expiresIn = parseInt(c.req.query('expiresIn') || '604800'); // 默認7天

    // 驗證過期時間範圍 (1小時 - 30天)
    if (expiresIn < 3600 || expiresIn > 30 * 24 * 60 * 60) {
      return badRequestResponse(c, 'Expiration time must be between 1 hour and 30 days');
    }

    const token = await generateMonitoringToken(c.env.JWT_SECRET, expiresIn);

    return successResponse(c, {
      token,
      type: 'monitoring',
      expiresIn,
      expiresAt: new Date((Math.floor(Date.now() / 1000) + expiresIn) * 1000).toISOString(),
      generatedBy: user.id
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// 生成用戶系統令牌 (管理員和團隊成員)
phase2AuthHandler.post('/user-token', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const { targetUserId, expiresIn = 3600 } = await c.req.json();

    // SECURITY: Admin-only access (2-tier role system)
    if (user.role !== 'admin') {
      return forbiddenResponse(c, 'Only administrators can generate user tokens');
    }

    if (!targetUserId) {
      return badRequestResponse(c, 'targetUserId is required');
    }

    // 驗證過期時間範圍 (5分鐘 - 24小時)
    if (expiresIn < 300 || expiresIn > 24 * 60 * 60) {
      return badRequestResponse(c, 'Expiration time must be between 5 minutes and 24 hours');
    }

    // 獲取目標用戶信息
    const targetUser = await getUserById(c.env.DB, targetUserId);

    const token = await generateSystemToken(
      targetUser.id.toString(),
      targetUser.role,
      targetUser.displayName,
      targetUser.primaryTeamId || 1,
      c.env.JWT_SECRET,
      expiresIn
    );

    return successResponse(c, {
      token,
      type: 'user',
      targetUser: {
        id: targetUser.id,
        displayName: targetUser.displayName,
        role: targetUser.role,
        primaryTeamId: targetUser.primaryTeamId
      },
      expiresIn,
      expiresAt: new Date((Math.floor(Date.now() / 1000) + expiresIn) * 1000).toISOString(),
      generatedBy: user.id
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// 批量生成測試令牌 (僅管理員，開發環境)
phase2AuthHandler.post('/batch-tokens', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    // 只有管理員可以批量生成令牌
    if (user.role !== 'admin') {
      return forbiddenResponse(c, 'Only administrators can generate batch tokens');
    }

    // 開發環境限制
    const environment = c.env.ENVIRONMENT || 'production';
    if (environment === 'production') {
      return forbiddenResponse(c, 'Batch token generation is only available in development');
    }

    const { users, expiresIn = 3600 } = await c.req.json();

    if (!Array.isArray(users) || users.length === 0) {
      return badRequestResponse(c, 'Users array is required and must not be empty');
    }

    // 限制批量生成數量
    if (users.length > 10) {
      return badRequestResponse(c, 'Maximum 10 users per batch');
    }

    const tokens = await generateTokenBatch(users, c.env.JWT_SECRET, expiresIn);

    return successResponse(c, {
      tokens,
      count: tokens.length,
      expiresIn,
      generatedBy: user.id,
      warning: 'These are development tokens - do not use in production'
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// =================== 令牌驗證和管理 API ===================

// 驗證令牌狀態
phase2AuthHandler.post('/verify-token', async (c) => {
  try {
    const { token } = await c.req.json();

    if (!token) {
      return badRequestResponse(c, 'Token is required');
    }

    // 動態導入以避免循環依賴
    const { verifyJWT } = await import('@/utils/auth');
    const payload = await verifyJWT(token, c.env.JWT_SECRET);

    // 檢查令牌是否即將過期 (剩餘時間少於1小時)
    const now = Math.floor(Date.now() / 1000);
    const timeRemaining = payload.exp - now;
    const isExpiringSoon = timeRemaining < 3600;

    return successResponse(c, {
      valid: true,
      payload: {
        userId: payload.userId,
        displayName: payload.displayName,
        role: payload.role,
        primaryTeamId: payload.primaryTeamId,
        isSystemToken: payload.isSystemToken || false
      },
      expiresAt: new Date(payload.exp * 1000).toISOString(),
      timeRemaining,
      isExpiringSoon
    });

  } catch (error) {
    log.warn('Token verification failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    return successResponse(c, {
      valid: false,
      error: error instanceof Error ? error.message : 'Token validation failed'
    });
  }
});

// 刷新即將過期的令牌
phase2AuthHandler.post('/refresh-token', jwtAuth, requireAdmin(), async (c) => {
  try {
    const { token } = await c.req.json();

    if (!token) {
      return badRequestResponse(c, 'Token is required');
    }

    // 動態導入以避免循環依賴
    const { verifyJWT } = await import('@/utils/auth');

    let payload;
    try {
      payload = await verifyJWT(token, c.env.JWT_SECRET);
    } catch (_error) {
      return badRequestResponse(c, 'Cannot refresh invalid or expired token');
    }

    if (payload.type === 'refresh' || payload.type === 'temp_password_change') {
      return badRequestResponse(c, 'Only access or system monitoring tokens can be refreshed here');
    }

    if (payload.jti) {
      let isRevoked: string | null;
      try {
        isRevoked = await c.env.CACHE.get(`revoked:${payload.jti}`);
      } catch (error) {
        log.error('Refresh token revocation check failed', {
          jti: payload.jti,
          error: error instanceof Error ? error.message : String(error)
        });
        return c.json({ success: false, error: 'Service temporarily unavailable' }, 503);
      }
      if (isRevoked) {
        return badRequestResponse(c, 'Cannot refresh revoked token');
      }
    }

    // 檢查是否為系統令牌
    if (payload.isSystemToken) {
      const newToken = await generateMonitoringToken(c.env.JWT_SECRET);
      return successResponse(c, {
        newToken,
        type: 'monitoring'
      }, 'Monitoring token refreshed');
    }

    const currentUser = await getUserById(c.env.DB, payload.userId);
    if (!currentUser.isActive) {
      return forbiddenResponse(c, 'Cannot refresh token for inactive user');
    }

    // 刷新用戶令牌
    const newToken = await generateSystemToken(
      String(currentUser.id),
      currentUser.role as 'admin' | 'agent',
      currentUser.displayName,
      currentUser.primaryTeamId || 0,
      c.env.JWT_SECRET
    );

    return successResponse(c, {
      newToken,
      type: 'user'
    }, 'User token refreshed');

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// =================== 認證狀態 API ===================

// 獲取當前認證狀態
phase2AuthHandler.get('/status', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    return successResponse(c, {
      authenticated: true,
      user: {
        id: user.id,
        displayName: user.displayName,
        role: user.role,
        primaryTeamId: user.primaryTeamId,
        teamName: user.teamName
      },
      permissions: {
        canGenerateMonitoringToken: user.role === 'admin',
        canGenerateUserToken: user.role === 'admin',
        canAccessAnalytics: user.role === 'admin',
        canTriggerAlerts: user.role === 'admin'
      }
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

export default phase2AuthHandler;
