// 認證處理器 - 主要實現
import { Hono } from 'hono';
import type { Bindings } from '../types';
import { 
  signJWT, 
  authenticateUser, 
  authenticateUserByEmail,
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

const authHandler = new Hono<{ Bindings: Bindings }>();

// 用戶登入
authHandler.post('/login', rateLimit(10, 60 * 1000), async (c) => {
  try {
    const { email, username, password } = await c.req.json();
    
    // 清理輸入數據 - 移除前後空格
    const cleanEmail = email?.trim();
    const cleanUsername = username?.trim();
    const cleanPassword = password?.trim();
    
    // 支援 email 或 username 登入
    const loginField = cleanEmail || cleanUsername;
    
    if (!loginField || !cleanPassword) {
      return c.json({ error: 'Email/Username and password are required' }, 400);
    }

    // 驗證用戶 - 優先使用 email，如果沒有則使用 username
    let user = null;
    let userRow = null;
    let errorMessage = '';
    
    if (cleanEmail) {
      // 檢查用戶是否存在，同時獲取 password_policy
      userRow = await c.env.DB.prepare(`
        SELECT id, email, is_active, password_policy FROM agents WHERE email = ?
      `).bind(cleanEmail).first();
      
      if (!userRow) {
        errorMessage = 'User not found';
      } else if (!userRow.is_active) {
        errorMessage = 'Account disabled';
      } else {
        // 用戶存在且活躍，檢查密碼
        user = await authenticateUserByEmail(c.env.DB, cleanEmail, cleanPassword);
        if (!user) {
          errorMessage = 'Wrong password';
        }
      }
    } else {
      // 使用 username 登入
      const existingUser = await c.env.DB.prepare(`
        SELECT username, is_active FROM app_users WHERE username = ?
      `).bind(cleanUsername).first();
      
      if (!existingUser) {
        errorMessage = 'User not found';
      } else if (!existingUser.is_active) {
        errorMessage = 'Account disabled';
      } else {
        // 用戶存在且活躍，檢查密碼
        user = await authenticateUser(c.env.DB, cleanUsername, cleanPassword);
        if (!user) {
          errorMessage = 'Wrong password';
        }
      }
    }
    
    if (!user) {
      return c.json({ error: errorMessage || 'Invalid email/username or password' }, 401);
    }

    // 檢查密碼政策
    if (userRow && userRow.password_policy === 'must_change') {
      console.log(`🔐 Password policy check - User: ${cleanEmail}, Policy: must_change, redirecting to change password`);
      
      // 生成臨時token用於密碼更改
      const tempToken = await signJWT(
        { 
          userId: user.id,
          username: user.username || user.email,
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
      await c.env.DB.prepare(`
        UPDATE agents SET last_login_at = ? WHERE id = ?
      `).bind(new Date().toISOString(), user.id).run();
    } catch (error) {
      console.warn('Failed to update last_login_at:', error);
      // 不影響登入流程
    }

    // 生成 Access Token (短期，2小時)
    const token = await signJWT(
      { 
        userId: user.id, // 保持原始 ID 格式
        username: user.username || user.email, // 使用 username 或 email 作為備用
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
        username: user.username || user.email, // 使用 username 或 email 作為備用
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
        username: user.username,
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
        loginMethod: email ? 'email' : 'username',
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
    console.error('Login error:', error);
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
    const { username, email, password, displayName, role, teamId } = await c.req.json();
    
    if (!username || !email || !password || !displayName || !role) {
      return c.json({ error: 'All fields are required' }, 400);
    }

    if (!['admin', 'manager', 'agent'].includes(role)) {
      return c.json({ error: 'Invalid role' }, 400);
    }

    // 檢查用戶名是否已存在
    const existingUser = await c.env.DB.prepare(
      'SELECT id FROM users WHERE username = ? OR email = ?'
    ).bind(username, email).first();

    if (existingUser) {
      return c.json({ error: 'Username or email already exists' }, 409);
    }

    // 創建用戶
    const newUser = await createUser(c.env.DB, {
      username,
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
      userName: currentUser.displayName || currentUser.username,
      userRole: currentUser.role,
      action: ACTIVITY_ACTIONS.USER_CREATE,
      resourceType: RESOURCE_TYPES.USER,
      resourceId: newUser.id.toString(),
      details: {
        createdUser: {
          username: newUser.username,
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
          username: newUser.username,
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
    console.error('Registration error:', error);
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
        userName: user.displayName || user.username,
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
    console.error('Logout error:', error);
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
          username: user.username,
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
    console.error('Profile error:', error);
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
        role: user.role,
        isActive: user.isActive,
        createdAt: new Date(user.createdAt).getTime()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Me endpoint error:', error);
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
    // 首先嘗試 agents 表（新的用戶表）
    let userRow = await c.env.DB.prepare(
      'SELECT * FROM agents WHERE id = ? AND is_active = 1'
    ).bind(payload.userId).first();
    
    // 如果在 agents 表中沒找到，嘗試 users 表（舊的用戶表）
    if (!userRow) {
      userRow = await c.env.DB.prepare(
        'SELECT * FROM users WHERE id = ? AND is_active = 1'
      ).bind(payload.userId).first();
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
        username: payload.username,
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
        username: payload.username,
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
    console.error('Token refresh error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Token refresh failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

export default authHandler;