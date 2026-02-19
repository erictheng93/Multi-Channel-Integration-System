// Team Authentication Middleware - 團隊認證中介層
// Team Authentication Middleware

import type { MiddlewareHandler } from 'hono';
import type { Bindings } from '@/types';
import { verifyJWT } from '@/utils/auth';
import { TeamPermissionError } from '@modules/teams/types/team-types';
import { HTTP_STATUS } from '@/constants/http-status';
import { nowISO } from '@/utils/timestamp'

// 基本認證中介層
export const teamAuthMiddleware = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next) => {
    try {
      const authHeader = c.req.header('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Missing or invalid authorization header' }, HTTP_STATUS.UNAUTHORIZED);
      }

      const token = authHeader.split(' ')[1];
      if (!token) {
        return c.json({ error: 'Missing token' }, HTTP_STATUS.UNAUTHORIZED);
      }

      const payload = await verifyJWT(token, c.env.JWT_SECRET);

      if (!payload) {
        return c.json({ error: 'Invalid token' }, HTTP_STATUS.UNAUTHORIZED);
      }

      // 設定使用者資訊到 context
      c.set('user', {
        id: payload.userId,
        email: payload.email || '',
        displayName: payload.displayName || payload.username || '',
        role: payload.role,
        primaryTeamId: payload.primaryTeamId,
        teamName: payload.teamName,
        isActive: true,
        createdAt: nowISO(),
        updatedAt: nowISO()
      });

      return await next();
    } catch (error) {
      return c.json({ error: 'Authentication failed' }, HTTP_STATUS.UNAUTHORIZED);
    }
  };
};

// 管理員權限檢查中介層
export const requireAdminRole = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next): Promise<Response | void> => {
    try {
      const user = c.get('user');

      if (!user || user.role !== 'admin') {
        return c.json({ error: 'Admin role required' }, HTTP_STATUS.FORBIDDEN);
      }

      await next();
    } catch (error) {
      return c.json({ error: 'Permission check failed' }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
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
        return c.json({ error: 'Admin role required' }, HTTP_STATUS.FORBIDDEN);
      }

      await next();
    } catch (error) {
      return c.json({ error: 'Permission check failed' }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
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
        return c.json({ error: 'Authentication required' }, HTTP_STATUS.UNAUTHORIZED);
      }

      // 管理員可以操作所有團隊
      if (user.role === 'admin') {
        await next();
        return;
      }

      // 一般代理可以查看自己所屬團隊的資訊
      if (user.role === 'agent') {
        if (targetTeamId && parseInt(targetTeamId) !== user.primaryTeamId) {
          return c.json({ error: 'Cannot access other teams' }, HTTP_STATUS.FORBIDDEN);
        }
        await next();
        return;
      }

      return c.json({ error: 'Insufficient permissions' }, HTTP_STATUS.FORBIDDEN);
    } catch (error) {
      return c.json({ error: 'Permission check failed' }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
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
        return c.json({ error: 'Authentication required' }, HTTP_STATUS.UNAUTHORIZED);
      }

      // 管理員可以管理所有團隊
      if (user.role === 'admin') {
        await next();
        return;
      }

      // 一般代理不能進行團隊管理操作
      return c.json({ error: 'Team management access denied for agents' }, HTTP_STATUS.FORBIDDEN);
    } catch (error) {
      return c.json({ error: 'Permission check failed' }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
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
        return c.json({ error: 'Authentication required' }, HTTP_STATUS.UNAUTHORIZED);
      }

      // 管理員可以存取所有團隊
      if (user.role === 'admin') {
        await next();
        return;
      }

      // 檢查是否為團隊成員
      if (targetTeamId && parseInt(targetTeamId) !== user.primaryTeamId) {
        return c.json({
          error: 'Not a member of this team',
          userTeam: user.primaryTeamId,
          requestedTeam: targetTeamId
        }, HTTP_STATUS.FORBIDDEN);
      }

      return await next();
    } catch (error) {
      return c.json({ error: 'Team membership check failed' }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
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
        return c.json({ error: 'Authentication required' }, HTTP_STATUS.UNAUTHORIZED);
      }

      // 檢查角色權限
      if (requiredRoles.includes(user.role)) {
        await next();
        return;
      }

      // 檢查成員讀取權限
      if (allowMembersRead && user.role === 'agent') {
        if (targetTeamId && parseInt(targetTeamId) === user.primaryTeamId) {
          await next();
          return;
        }
      }

      return c.json({
        error: `Required roles: ${requiredRoles.join(', ')}`,
        currentRole: user.role
      }, HTTP_STATUS.FORBIDDEN);
    } catch (error) {
      return c.json({ error: 'Permission check failed' }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
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
        return c.json({ error: error.message }, HTTP_STATUS.FORBIDDEN);
      }

      // 其他錯誤
      console.error('Team middleware error:', error);
      return c.json({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  };
};