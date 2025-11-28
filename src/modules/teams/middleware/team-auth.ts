// Team Authentication Middleware - 團隊認證中介層
// Team Authentication Middleware

import type { MiddlewareHandler } from 'hono';
import type { Bindings } from '@/types';
import { verifyJWT } from '@/utils/auth';
import { TeamPermissionError } from '@modules/teams/types/team-types';

// 基本認證中介層
export const teamAuthMiddleware = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next) => {
    try {
      const authHeader = c.req.header('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Missing or invalid authorization header' }, 401);
      }

      const token = authHeader.split(' ')[1];
      if (!token) {
        return c.json({ error: 'Missing token' }, 401);
      }

      const payload = await verifyJWT(token, c.env.JWT_SECRET);

      if (!payload) {
        return c.json({ error: 'Invalid token' }, 401);
      }

      // 設定使用者資訊到 context
      c.set('user', {
        id: payload.userId,
        email: payload.email || '',
        displayName: payload.displayName || payload.username || '',
        role: payload.role,
        teamId: payload.teamId,
        teamName: payload.teamName,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      return await next();
    } catch (error) {
      return c.json({ error: 'Authentication failed' }, 401);
    }
  };
};

// 管理員權限檢查中介層
export const requireAdminRole = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next): Promise<Response | void> => {
    try {
      const user = c.get('user');

      if (!user || user.role !== 'admin') {
        return c.json({ error: 'Admin role required' }, 403);
      }

      await next();
    } catch (error) {
      return c.json({ error: 'Permission check failed' }, 500);
    }
  };
};

// Admin role required middleware (2-tier role system: admin/agent)
export const requireTeamLeaderOrAdmin = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next): Promise<Response | void> => {
    try {
      const user = c.get('user');

      // SECURITY: Admin-only access (2-tier role system)
      if (!user || user.role !== 'admin') {
        return c.json({ error: 'Admin role required' }, 403);
      }

      await next();
    } catch (error) {
      return c.json({ error: 'Permission check failed' }, 500);
    }
  };
};

// 檢查團隊存取權限的中介層
export const checkTeamAccess = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next) => {
    try {
      const user = c.get('user');
      const targetTeamId = c.req.param('teamId') || c.req.query('teamId');

      if (!user) {
        return c.json({ error: 'Authentication required' }, 401);
      }

      // 管理員可以操作所有團隊
      if (user.role === 'admin') {
        await next();
        return;
      }

      // 一般代理可以查看自己所屬團隊的資訊
      if (user.role === 'agent') {
        if (targetTeamId && parseInt(targetTeamId) !== user.teamId) {
          return c.json({ error: 'Cannot access other teams' }, 403);
        }
        await next();
        return;
      }

      return c.json({ error: 'Insufficient permissions' }, 403);
    } catch (error) {
      return c.json({ error: 'Permission check failed' }, 500);
    }
  };
};

// 檢查團隊管理權限的中介層（僅團隊領導和管理員）
export const checkTeamManagementAccess = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next) => {
    try {
      const user = c.get('user');
      const targetTeamId = c.req.param('teamId') || c.req.query('teamId');

      if (!user) {
        return c.json({ error: 'Authentication required' }, 401);
      }

      // 管理員可以管理所有團隊
      if (user.role === 'admin') {
        await next();
        return;
      }

      // 一般代理不能進行團隊管理操作
      return c.json({ error: 'Team management access denied for agents' }, 403);
    } catch (error) {
      return c.json({ error: 'Permission check failed' }, 500);
    }
  };
};

// 檢查是否為團隊成員的中介層
export const checkTeamMembership = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next) => {
    try {
      const user = c.get('user');
      const targetTeamId = c.req.param('teamId') || c.req.query('teamId');

      if (!user) {
        return c.json({ error: 'Authentication required' }, 401);
      }

      // 管理員可以存取所有團隊
      if (user.role === 'admin') {
        await next();
        return;
      }

      // 檢查是否為團隊成員
      if (targetTeamId && parseInt(targetTeamId) !== user.teamId) {
        return c.json({
          error: 'Not a member of this team',
          userTeam: user.teamId,
          requestedTeam: targetTeamId
        }, 403);
      }

      return await next();
    } catch (error) {
      return c.json({ error: 'Team membership check failed' }, 500);
    }
  };
};

// 綜合團隊權限檢查中介層工廠
export const createTeamPermissionMiddleware = (
  requiredRoles: string[],
  allowMembersRead: boolean = false
): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next) => {
    try {
      const user = c.get('user');
      const targetTeamId = c.req.param('teamId') || c.req.query('teamId');

      if (!user) {
        return c.json({ error: 'Authentication required' }, 401);
      }

      // 檢查角色權限
      if (requiredRoles.includes(user.role)) {
        await next();
        return;
      }

      // 檢查成員讀取權限
      if (allowMembersRead && user.role === 'agent') {
        if (targetTeamId && parseInt(targetTeamId) === user.teamId) {
          await next();
          return;
        }
      }

      return c.json({
        error: `Required roles: ${requiredRoles.join(', ')}`,
        currentRole: user.role
      }, 403);
    } catch (error) {
      return c.json({ error: 'Permission check failed' }, 500);
    }
  };
};

// 錯誤處理中介層
export const teamErrorHandler = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next): Promise<Response | void> => {
    try {
      await next();
    } catch (error) {
      if (error instanceof TeamPermissionError) {
        return c.json({ error: error.message }, 403);
      }

      // 其他錯誤
      console.error('Team middleware error:', error);
      return c.json({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  };
};