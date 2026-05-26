// 認證處理器 - 主要實現
import { Hono } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import { globalErrorHandler } from '@/core/error-handler';
import type { Bindings, TeamRoleInTeam } from '@/types';
import {
  signJWT,
  authenticateUser,
  createUser,
  createSession
} from '@/utils/auth';
import {
  jwtAuth,
  sessionAuth,
  requireRole,
} from '@/middleware/auth';
import { loginRateLimiter } from '@/middleware/rate-limiter';
import { ActivityCapture, ActivityService, ACTIVITY_ACTIONS, RESOURCE_TYPES } from '@modules/activities';
import { createDbClient } from '@/db/drizzle-factory';
import { agents, agentTeams } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { createContextLogger } from '@/utils/logger';
// P2-5: Import standard response utilities
import {
  unauthorizedResponse,
  badRequestResponse
} from '@/utils/api-response';
import { nowISO } from '@/utils/timestamp'

const authHandler = new Hono<{ Bindings: Bindings }>();
const authLogger = createContextLogger('Authentication');

function agentState(agent: Record<string, any>) {
  return {
    id: agent.id,
    email: agent.email,
    display_name: agent.displayName,
    role: agent.role,
    is_active: agent.isActive ? 1 : 0,
    password_policy: agent.passwordPolicy ?? null,
    last_active: agent.lastActive ?? null,
    last_login_at: agent.lastLoginAt ?? null,
    created_at: agent.createdAt,
    updated_at: agent.updatedAt,
    deleted_at: agent.deletedAt ?? null
  };
}

type RefreshUserRow = Pick<
  typeof agents.$inferSelect,
  'id' | 'email' | 'displayName' | 'role' | 'isActive'
>;

interface RefreshTokenPayload {
  type?: string;
  userId: string;
  displayName?: string;
  email?: string;
  role?: string;
  primaryTeamId?: number;
  allowedTeamIds?: number[];
  teamRoles?: Record<number, TeamRoleInTeam>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRefreshTokenPayload(value: unknown): value is RefreshTokenPayload {
  return (
    isRecord(value) &&
    typeof value.userId === 'string' &&
    (value.type === undefined || typeof value.type === 'string') &&
    (value.displayName === undefined || typeof value.displayName === 'string') &&
    (value.email === undefined || typeof value.email === 'string') &&
    (value.role === undefined || typeof value.role === 'string') &&
    (value.primaryTeamId === undefined || typeof value.primaryTeamId === 'number') &&
    (value.allowedTeamIds === undefined || (
      Array.isArray(value.allowedTeamIds) &&
      value.allowedTeamIds.every(teamId => typeof teamId === 'number')
    )) &&
    (value.teamRoles === undefined || isRecord(value.teamRoles))
  );
}

function mapLegacyRefreshUser(row: unknown): RefreshUserRow | undefined {
  if (!isRecord(row) || typeof row.id !== 'string' || typeof row.email !== 'string') {
    return undefined;
  }

  return {
    id: row.id,
    email: row.email,
    displayName: typeof row.display_name === 'string'
      ? row.display_name
      : typeof row.displayName === 'string'
        ? row.displayName
        : '',
    role: typeof row.role === 'string' ? row.role : 'agent',
    isActive: Boolean(row.is_active ?? row.isActive)
  };
}

// CORS 處理已移至 src/index.ts 統一管理
// 不再需要 handler 級別的 CORS middleware

// 用戶登入
authHandler.post('/login', loginRateLimiter, async (c) => {
  try {
    const { email, password } = await c.req.json();

    // 清理輸入數據 - 移除前後空格
    const cleanEmail = email?.trim();
    const cleanPassword = password?.trim();

    if (!cleanEmail || !cleanPassword) {
      return badRequestResponse(c, 'Email and password are required');
    }

    // 優化：使用單次查詢進行完整認證
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
      return unauthorizedResponse(c, errorMessage);
    }

    if (!user) {
      return unauthorizedResponse(c, 'Authentication failed');
    }

    // 優化：使用統一獲取的密碼政策
    if (passwordPolicy === 'must_change') {
      // Password change required

      // 生成臨時token用於密碼更改
      const tempToken = await signJWT(
        {
          userId: user.id,
          displayName: user.displayName,
          email: user.email,
          role: user.role,
          primaryTeamId: user.primaryTeamId || undefined,
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
        timestamp: nowISO()
      });
    }

    // 更新用戶的最後活動時間
    try {
      const drizzleDb = createDbClient(c.env.DB);
      await drizzleDb
        .update(agents)
        .set({
          lastLoginAt: nowISO()
        })
        .where(eq(agents.id, String(user.id)));
    } catch (error) {
      authLogger.warn('Failed to update last login timestamp', { userId: user.id, error: error instanceof Error ? error.message : String(error) });
      // 不影響登入流程
    }

    // 生成 Access Token (短期，2小時)
    // Phase 1 Optimization: Include multi-team data in JWT
    const token = await signJWT(
      {
        userId: user.id, // 保持原始 ID 格式
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        primaryTeamId: user.primaryTeamId || undefined,
        type: 'access',
        // Multi-team support (Phase 1 optimization)
        allowedTeamIds: user.allowedTeamIds || [],
        teamRoles: user.teamRoles || {}
      },
      c.env.JWT_SECRET,
      2 * 60 * 60 // 2 小時
    );

    // 生成 Refresh Token (長期，7天)
    // Phase 1 Optimization: Include multi-team data in JWT
    const refreshToken = await signJWT(
      {
        userId: user.id, // 保持原始 ID 格式
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        primaryTeamId: user.primaryTeamId || undefined,
        type: 'refresh',
        // Multi-team support (Phase 1 optimization)
        allowedTeamIds: user.allowedTeamIds || [],
        teamRoles: user.teamRoles || {}
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
        primaryTeamId: user.primaryTeamId || undefined,
        loginAt: nowISO()
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
      timestamp: nowISO()
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// 用戶註冊（僅 admin 可以創建新用戶）
authHandler.post('/register', jwtAuth, requireRole('admin'), async (c) => {
  try {
    const { email, password, displayName, role, teamId } = await c.req.json();

    if (!email || !password || !displayName || !role) {
      return c.json({ error: 'All fields are required' }, HTTP_STATUS.BAD_REQUEST);
    }

    // SECURITY: Only allow 2-tier role system (admin/agent)
    if (!['admin', 'agent'].includes(role)) {
      return c.json({ error: 'Invalid role. Allowed roles: admin, agent' }, HTTP_STATUS.BAD_REQUEST);
    }

    // 檢查 email 是否已存在
    const drizzleDb = createDbClient(c.env.DB);
    const existingUser = await drizzleDb
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.email, email), sql`${agents.deletedAt} IS NULL`))
      .get();

    if (existingUser) {
      return c.json({ error: 'Email already exists' }, HTTP_STATUS.CONFLICT);
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
    const capture = new ActivityCapture(c.env.DB);
    await capture.logOnly(
      capture.buildReversibleLog({
        request: {
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
              teamId: newUser.primaryTeamId
            }
          },
          ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
          userAgent: c.req.header('User-Agent')
        },
        restoreHandler: 'agent.create',
        previousState: {
          id: newUser.id,
          deleted_at: null
        },
        newState: agentState(newUser)
      })
    );

    return c.json({
      success: true,
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          displayName: newUser.displayName,
          role: newUser.role,
          teamId: newUser.primaryTeamId,
          teamName: newUser.teamName
        }
      },
      timestamp: nowISO()
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
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
      timestamp: nowISO()
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
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
          primaryTeamId: user.primaryTeamId || undefined,
          teamName: user.teamName,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      },
      timestamp: nowISO()
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
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
      timestamp: nowISO()
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// 客服自助修改個人資料 (僅允許 displayName + email，嚴格白名單防止越權)
authHandler.put('/me', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const userId = String(user.id);
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;

    // 白名單：客服自助僅能改 displayName
    // Email 與角色由管理員透過 /api/teams/members/... 管理
    const updates: { displayName?: string } = {};

    if (typeof body.displayName === 'string') {
      const trimmed = body.displayName.trim();
      if (trimmed.length < 1 || trimmed.length > 50) {
        return badRequestResponse(c, 'displayName must be 1-50 characters');
      }
      updates.displayName = trimmed;
    }

    if (Object.keys(updates).length === 0) {
      return badRequestResponse(c, 'No updatable fields provided (allowed: displayName)');
    }

    const db = createDbClient(c.env.DB);

    // 取當前資料 (用於 audit log 的 before / 比對是否真的有變更)
    const [current] = await db
      .select({
        id: agents.id,
        displayName: agents.displayName,
        email: agents.email,
        updatedAt: agents.updatedAt,
      })
      .from(agents)
      .where(eq(agents.id, userId))
      .limit(1);

    if (!current) {
      return c.json({ success: false, error: 'User not found' }, HTTP_STATUS.NOT_FOUND);
    }

    // 計算實際變動欄位 (相同值不寫入、不記錄)
    const actualChanges: Array<{ field: string; old: string; new: string }> = [];
    const setPayload: { displayName?: string; updatedAt: string } = {
      updatedAt: nowISO(),
    };

    if (updates.displayName !== undefined && updates.displayName !== current.displayName) {
      setPayload.displayName = updates.displayName;
      actualChanges.push({ field: 'displayName', old: current.displayName, new: updates.displayName });
    }

    // 沒有真正的變動，直接回傳
    if (actualChanges.length === 0) {
      return c.json({
        success: true,
        data: {
          id: userId,
          email: current.email,
          name: current.displayName,
          displayName: current.displayName,
          role: user.role,
          isActive: user.isActive,
          createdAt: new Date(user.createdAt).getTime(),
        },
        message: 'No changes',
        timestamp: nowISO(),
      });
    }

    const [updated] = await db
      .update(agents)
      .set(setPayload)
      .where(eq(agents.id, userId))
      .returning();

    if (!updated) {
      return c.json({ success: false, error: 'Update failed' }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    const capture = new ActivityCapture(c.env.DB);
    await capture.logOnly(
      capture.buildReversibleLog({
        request: {
          userId,
          userName: updated.displayName,
          userRole: user.role,
          action: ACTIVITY_ACTIONS.USER_UPDATE,
          resourceType: RESOURCE_TYPES.USER,
          resourceId: userId,
          details: {
            selfService: true,
            changes: actualChanges,
          },
          ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
          userAgent: c.req.header('User-Agent'),
        },
        restoreHandler: 'agent.update',
        previousState: {
          id: userId,
          display_name: current.displayName,
          updated_at: current.updatedAt
        },
        newState: {
          id: userId,
          display_name: updated.displayName,
          updated_at: updated.updatedAt
        }
      })
    );

    return c.json({
      success: true,
      data: {
        id: updated.id,
        email: updated.email,
        name: updated.displayName,
        displayName: updated.displayName,
        role: updated.role,
        isActive: updated.isActive,
        createdAt: updated.createdAt ? new Date(updated.createdAt).getTime() : Date.now(),
      },
      message: 'Profile updated successfully',
      timestamp: nowISO(),
    });

  } catch (error) {
    authLogger.error('Self-service profile update failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return globalErrorHandler.handleError(c, error);
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
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 驗證 refresh token
    const jwt = await import('jsonwebtoken');
    let payload: RefreshTokenPayload;

    try {
      const verified = jwt.verify(refreshToken, c.env.JWT_SECRET) as unknown;
      if (!isRefreshTokenPayload(verified)) {
        return c.json({
          success: false,
          error: 'Invalid refresh token payload',
          timestamp: nowISO()
        }, HTTP_STATUS.UNAUTHORIZED);
      }
      payload = verified;
    } catch (error) {
      return c.json({
        success: false,
        error: 'Invalid refresh token',
        timestamp: nowISO()
      }, HTTP_STATUS.UNAUTHORIZED);
    }

    // 檢查 token 類型
    if (payload.type !== 'refresh') {
      return c.json({
        success: false,
        error: 'Invalid token type',
        timestamp: nowISO()
      }, HTTP_STATUS.UNAUTHORIZED);
    }

    // 驗證用戶是否仍然存在且活躍
    const drizzleDb = createDbClient(c.env.DB);

    // 首先嘗試 agents 表（新的用戶表）
    let userRow: RefreshUserRow | undefined = await drizzleDb
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
        userRow = fallbackResult && fallbackResult.length > 0
          ? mapLegacyRefreshUser(fallbackResult[0])
          : undefined;
      } catch (error) {
        authLogger.warn('Legacy users table query failed', { error: error instanceof Error ? error.message : String(error) });
        userRow = undefined;
      }
    }

    if (!userRow) {
      return c.json({
        success: false,
        error: 'User not found or inactive',
        timestamp: nowISO()
      }, HTTP_STATUS.UNAUTHORIZED);
    }

    // Re-query fresh team data from DB instead of carrying over stale JWT claims
    let freshAllowedTeamIds: number[] = payload.allowedTeamIds || [];
    let freshTeamRoles: Record<number, TeamRoleInTeam> = payload.teamRoles || {};

    try {
      const teamMemberships = await drizzleDb
        .select({
          teamId: agentTeams.teamId,
          role: agentTeams.roleInTeam,
          isPrimary: agentTeams.isPrimary
        })
        .from(agentTeams)
        .where(eq(agentTeams.agentId, String(payload.userId)));

      if (teamMemberships.length > 0) {
        freshAllowedTeamIds = teamMemberships.map(m => m.teamId);
        freshTeamRoles = {};
        for (const m of teamMemberships) {
          if (m.role) {
            freshTeamRoles[m.teamId] = m.role as TeamRoleInTeam;
          }
        }
        authLogger.info('Refreshed team data from DB', {
          userId: payload.userId,
          teamCount: teamMemberships.length
        });
      }
    } catch (teamError) {
      // Fall back to JWT data if DB query fails
      authLogger.warn('Failed to refresh team data from DB, using JWT data', {
        error: teamError instanceof Error ? teamError.message : String(teamError)
      });
    }

    const refreshedRole = payload.role === 'admin' ? 'admin' : 'agent';

    // 生成新的 access token
    // Phase 1 Optimization: Re-query multi-team data from DB on refresh
    const newToken = await signJWT(
      {
        userId: payload.userId,
        displayName: payload.displayName || userRow.displayName || userRow.displayName,
        email: payload.email || userRow.email,
        role: refreshedRole,
        primaryTeamId: payload.primaryTeamId,
        type: 'access',
        // Multi-team support - freshly queried from DB
        allowedTeamIds: freshAllowedTeamIds,
        teamRoles: freshTeamRoles
      },
      c.env.JWT_SECRET,
      2 * 60 * 60 // 2 小時
    );

    // 生成新的 refresh token (滾動刷新)
    // Phase 1 Optimization: Re-query multi-team data from DB on refresh
    const newRefreshToken = await signJWT(
      {
        userId: payload.userId,
        displayName: payload.displayName || userRow.displayName || userRow.displayName,
        email: payload.email || userRow.email,
        role: refreshedRole,
        primaryTeamId: payload.primaryTeamId,
        type: 'refresh',
        // Multi-team support - freshly queried from DB
        allowedTeamIds: freshAllowedTeamIds,
        teamRoles: freshTeamRoles
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
      timestamp: nowISO()
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

export default authHandler;
