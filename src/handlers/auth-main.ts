// 認證處理器 - 主要實現
import { Hono } from 'hono';
import type { Bindings } from '../types';
import {
  signJWT,
  authenticateUser,
  createUser,
  createSession
} from '../utils/auth';
import {
  jwtAuth,
  sessionAuth,
  requireRole,
  rateLimit
} from '../middleware/auth';
import { ActivityService, ACTIVITY_ACTIONS, RESOURCE_TYPES } from '../services/activity-service';
import { drizzle } from 'drizzle-orm/d1';
import { agents } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { createContextLogger } from '../utils/logger';
import { isOriginAllowed, createCorsPreflightResponse } from '@/config/cors';

const authHandler = new Hono<{ Bindings: Bindings }>();
const authLogger = createContextLogger('Authentication');

// 🔥 CORS middleware: 為所有響應添加 CORS headers - 使用統一配置
authHandler.use('*', async (c, next) => {
  const origin = c.req.header('Origin');

  await next();

  // 添加CORS headers到響應
  if (origin && isOriginAllowed(origin)) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
  }
});

// 🔥 CORS修復: 處理所有 OPTIONS preflight 請求並設置正確的 CORS headers - 使用統一配置
authHandler.options('*', (c) => {
  const origin = c.req.header('Origin');
  const allowed = origin && isOriginAllowed(origin);

  console.log(`🔧 [Auth OPTIONS] Origin: ${origin}, Allowed: ${allowed}`);

  return createCorsPreflightResponse(origin);
});

// 用戶登入
authHandler.post('/login', rateLimit(10, 60 * 1000), async (c) => {
  try {
    const { email, password } = await c.req.json();
    
    // 清理輸入數據 - 移除前後空格
    const cleanEmail = email?.trim();
    const cleanPassword = password?.trim();
    
    if (!cleanEmail || !cleanPassword) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    // ✅ 優化：使用單次查詢進行完整認證
    const authResult = await authenticateUser(c.env.DB, cleanEmail, cleanPassword);
    const { user, passwordPolicy, accountStatus } = authResult;
    
    // 根據認證結果設定錯誤訊息
    if (accountStatus !== 'success') {
      let errorMessage = '';
      switch (accountStatus) {
        case 'not_found':
          errorMessage = 'User not found';
          break;
        case 'disabled':
          errorMessage = 'Account disabled';
          break;
        case 'wrong_password':
          errorMessage = 'Wrong password';
          break;
        default:
          errorMessage = 'Authentication failed';
      }
      return c.json({ error: errorMessage }, 401);
    }

    if (!user) {
      return c.json({ error: 'Authentication failed' }, 401);
    }

    // ✅ 優化：使用統一獲取的密碼政策
    if (passwordPolicy === 'must_change') {
      // Password change required
      
      // 生成臨時token用於密碼更改
      const tempToken = await signJWT(
        { 
          userId: user.id,
          displayName: user.displayName,
          email: user.email,
          role: user.role,
          teamId: user.teamId || undefined,
          type: 'temp_password_change'
        },
        c.env.JWT_SECRET,
        30 * 60 // 30 分鐘
      );

      return c.json({
        success: true,
        data: {
          mustChangePassword: true,
          tempToken,
          agent: {
            id: user.id.toString(),
            email: user.email,
            name: user.displayName,
            displayName: user.displayName,
            role: user.role,
            isActive: user.isActive,
            createdAt: new Date(user.createdAt).getTime()
          }
        },
        message: 'Password must be changed before login',
        timestamp: new Date().toISOString()
      });
    }

    // 更新用戶的最後活動時間
    try {
      const drizzleDb = drizzle(c.env.DB);
      await drizzleDb
        .update(agents)
        .set({ 
          lastLoginAt: new Date().toISOString() 
        })
        .where(eq(agents.id, String(user.id)));
    } catch (error) {
      authLogger.warn('Failed to update last login timestamp', { userId: user.id, error: error instanceof Error ? error.message : String(error) });
      // 不影響登入流程
    }

    // 生成 Access Token (短期，2小時)
    const token = await signJWT(
      { 
        userId: user.id, // 保持原始 ID 格式
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        teamId: user.teamId || undefined,
        type: 'access'
      },
      c.env.JWT_SECRET,
      2 * 60 * 60 // 2 小時
    );

    // 生成 Refresh Token (長期，7天)
    const refreshToken = await signJWT(
      { 
        userId: user.id, // 保持原始 ID 格式
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        teamId: user.teamId || undefined,
        type: 'refresh'
      },
      c.env.JWT_SECRET,
      7 * 24 * 60 * 60 // 7 天
    );

    // 創建會話（存儲在 KV）
    const sessionId = await createSession(
      c.env.SESSIONS,
      typeof user.id === 'string' ? parseInt(user.id, 10) : user.id,
      {
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        teamId: user.teamId || undefined,
        loginAt: new Date().toISOString()
      }
    );

    // 記錄登入活動
    const activityService = new ActivityService(c.env.DB);
    await activityService.logActivity({
      userId: user.id.toString(),
      userName: user.displayName,
      userRole: user.role,
      action: ACTIVITY_ACTIONS.USER_LOGIN,
      resourceType: RESOURCE_TYPES.USER,
      resourceId: user.id.toString(),
      details: {
        loginMethod: 'email',
        sessionId
      },
      ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      userAgent: c.req.header('User-Agent')
    });

    return c.json({
      success: true,
      data: {
        token,
        refreshToken,
        agent: {
          id: user.id.toString(),
          email: user.email,
          name: user.displayName,
          displayName: user.displayName,
          role: user.role,
          isActive: user.isActive,
          createdAt: new Date(user.createdAt).getTime()
        },
        sessionId,
        expiresIn: 2 * 60 * 60 // 2 小時
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    authLogger.error('User login failed', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Login failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 用戶註冊（僅 admin 可以創建新用戶）
authHandler.post('/register', jwtAuth, requireRole('admin'), async (c) => {
  try {
    const { email, password, displayName, role, teamId } = await c.req.json();
    
    if (!email || !password || !displayName || !role) {
      return c.json({ error: 'All fields are required' }, 400);
    }

    if (!['admin', 'team', 'agent'].includes(role)) {
      return c.json({ error: 'Invalid role' }, 400);
    }

    // 檢查 email 是否已存在
    const drizzleDb = drizzle(c.env.DB);
    const existingUser = await drizzleDb
      .select({ id: agents.id })
      .from(agents)
      .where(eq(agents.email, email))
      .get();

    if (existingUser) {
      return c.json({ error: 'Email already exists' }, 409);
    }

    // 創建用戶
    const newUser = await createUser(c.env.DB, {
      email,
      password,
      displayName,
      role,
      teamId: teamId || null
    });

    // 記錄用戶創建活動
    const currentUser = c.get('user');
    const activityService = new ActivityService(c.env.DB);
    await activityService.logActivity({
      userId: currentUser.id.toString(),
      userName: currentUser.displayName,
      userRole: currentUser.role,
      action: ACTIVITY_ACTIONS.USER_CREATE,
      resourceType: RESOURCE_TYPES.USER,
      resourceId: newUser.id.toString(),
      details: {
        createdUser: {
          email: newUser.email,
          displayName: newUser.displayName,
          role: newUser.role,
          teamId: newUser.teamId
        }
      },
      ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      userAgent: c.req.header('User-Agent')
    });

    return c.json({
      success: true,
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          displayName: newUser.displayName,
          role: newUser.role,
          teamId: newUser.teamId,
          teamName: newUser.teamName
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    authLogger.error('User registration failed', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 用戶登出
authHandler.post('/logout', sessionAuth, async (c) => {
  try {
    const sessionId = c.req.header('X-Session-ID');
    const user = c.get('user');
    
    if (sessionId) {
      await c.env.SESSIONS.delete(`session:${sessionId}`);
    }

    // 記錄登出活動
    if (user) {
      const activityService = new ActivityService(c.env.DB);
      await activityService.logActivity({
        userId: user.id.toString(),
        userName: user.displayName,
        userRole: user.role,
        action: ACTIVITY_ACTIONS.USER_LOGOUT,
        resourceType: RESOURCE_TYPES.USER,
        resourceId: user.id.toString(),
        details: {
          sessionId
        },
        ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
        userAgent: c.req.header('User-Agent')
      });
    }

    return c.json({
      success: true,
      message: 'Logged out successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    authLogger.error('User logout failed', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Logout failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 獲取用戶資料
authHandler.get('/profile', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    
    return c.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          teamId: user.teamId || undefined,
          teamName: user.teamName,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    authLogger.error('Profile update failed', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get profile',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 獲取當前用戶資料 (別名端點，與前端 API 調用匹配)
authHandler.get('/me', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    
    return c.json({
      success: true,
      data: {
        id: user.id.toString(),
        email: user.email,
        name: user.displayName,
        displayName: user.displayName,
        role: user.role,
        isActive: user.isActive,
        createdAt: new Date(user.createdAt).getTime()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    authLogger.error('Current user information retrieval failed', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get user info',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 刷新 Token
authHandler.post('/refresh', async (c) => {
  try {
    const { refreshToken } = await c.req.json();
    
    if (!refreshToken) {
      return c.json({
        success: false,
        error: 'Refresh token is required',
        timestamp: new Date().toISOString()
      }, 400);
    }

    // 驗證 refresh token
    const jwt = await import('jsonwebtoken');
    let payload;
    
    try {
      payload = jwt.verify(refreshToken, c.env.JWT_SECRET) as any;
    } catch (error) {
      return c.json({
        success: false,
        error: 'Invalid refresh token',
        timestamp: new Date().toISOString()
      }, 401);
    }

    // 檢查 token 類型
    if (payload.type !== 'refresh') {
      return c.json({
        success: false,
        error: 'Invalid token type',
        timestamp: new Date().toISOString()
      }, 401);
    }

    // 驗證用戶是否仍然存在且活躍
    const drizzleDb = drizzle(c.env.DB);
    
    // 首先嘗試 agents 表（新的用戶表）
    let userRow = await drizzleDb
      .select()
      .from(agents)
      .where(and(
        eq(agents.id, payload.userId),
        eq(agents.isActive, true)
      ))
      .get();
    
    // 如果在 agents 表中沒找到，使用 Drizzle ORM 查詢 users 表（舊的用戶表）
    if (!userRow) {
      try {
        // 嘗試查詢舊的 users 表
        const fallbackResult = await drizzleDb.all(
          sql`SELECT * FROM users WHERE id = ${payload.userId} AND is_active = 1`
        );
        userRow = (fallbackResult && fallbackResult.length > 0) ? fallbackResult[0] as any : undefined;
      } catch (error) {
        authLogger.warn('Legacy users table query failed', { error: error instanceof Error ? error.message : String(error) });
        userRow = undefined;
      }
    }

    if (!userRow) {
      return c.json({
        success: false,
        error: 'User not found or inactive',
        timestamp: new Date().toISOString()
      }, 401);
    }

    // 生成新的 access token
    const newToken = await signJWT(
      { 
        userId: payload.userId,
        displayName: payload.displayName || userRow.displayName || userRow.displayName,
        email: payload.email || userRow.email,
        role: payload.role,
        teamId: payload.teamId,
        type: 'access'
      },
      c.env.JWT_SECRET,
      2 * 60 * 60 // 2 小時
    );

    // 生成新的 refresh token (滾動刷新)
    const newRefreshToken = await signJWT(
      { 
        userId: payload.userId,
        displayName: payload.displayName || userRow.displayName || userRow.displayName,
        email: payload.email || userRow.email,
        role: payload.role,
        teamId: payload.teamId,
        type: 'refresh'
      },
      c.env.JWT_SECRET,
      7 * 24 * 60 * 60 // 7 天
    );

    return c.json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    authLogger.error('Token refresh failed', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Token refresh failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

export default authHandler;