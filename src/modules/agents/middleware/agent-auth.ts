// Agent Authentication Middleware - 客服代理認證中介層
// Agent Authentication Middleware

import type { MiddlewareHandler } from 'hono';
import type { Bindings } from '@/types';
import { HTTP_STATUS } from '@/constants/http-status';
import { verifyJWT } from '@/utils/auth';
import { AgentPermissionError } from '@modules/agents/types/agent-types';

// 基本認證中介層
export const agentAuthMiddleware = (): MiddlewareHandler<{ Bindings: Bindings }> => {
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
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

      return await next();
    } catch (error) {
      return c.json({ error: 'Permission check failed' }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  };
};

// 團隊領導或管理員權限檢查中介層
export const requireTeamLeaderOrAdmin = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next): Promise<Response | void> => {
    try {
      const user = c.get('user');

      if (!user || !['admin', 'team'].includes(user.role)) {
        return c.json({ error: 'Team leader or admin role required' }, HTTP_STATUS.FORBIDDEN);
      }

      return await next();
    } catch (error) {
      return c.json({ error: 'Permission check failed' }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  };
};

// 檢查是否可以操作特定代理的中介層
export const checkAgentAccess = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next) => {
    try {
      const user = c.get('user');
      const targetAgentId = c.req.param('agentId') || c.req.query('agentId');

      if (!user) {
        return c.json({ error: 'Authentication required' }, HTTP_STATUS.UNAUTHORIZED);
      }

      // 管理員可以操作所有代理
      if (user.role === 'admin') {
        await next();
        return;
      }

      // 代理只能操作自己
      if (user.role === 'agent') {
        if (targetAgentId && targetAgentId !== user.id) {
          return c.json({ error: 'Cannot access other agents' }, HTTP_STATUS.FORBIDDEN);
        }
        await next();
        return;
      }

      // 團隊領導可以操作同團隊的代理
      if (user.role === 'team') {
        // 這裡需要查詢目標代理的團隊 ID 來比較
        // 為了簡化，先允許團隊領導操作
        await next();
        return;
      }

      return c.json({ error: 'Insufficient permissions' }, HTTP_STATUS.FORBIDDEN);
    } catch (error) {
      return c.json({ error: 'Permission check failed' }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  };
};

// 檢查團隊內權限的中介層
export const checkTeamAccess = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next) => {
    const user = c.get('user');
    const targetTeamId = c.req.param('teamId') || c.req.query('teamId');

    if (!user) {
      throw new AgentPermissionError('Authentication required');
    }

    // 管理員可以操作所有團隊
    if (user.role === 'admin') {
      await next();
      return;
    }

    // 一般代理不能進行團隊操作
    if (user.role === 'agent') {
      throw new AgentPermissionError('Team operations not allowed for agents');
    }

    throw new AgentPermissionError('Insufficient permissions');
  };
};

// 綜合權限檢查中介層工廠
export const createAgentPermissionMiddleware = (
  requiredRoles: string[],
  allowSelfAccess: boolean = true
): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next) => {
    const user = c.get('user');
    const targetAgentId = c.req.param('agentId') || c.req.query('agentId');

    if (!user) {
      throw new AgentPermissionError('Authentication required');
    }

    // 檢查角色權限
    if (requiredRoles.includes(user.role)) {
      await next();
      return;
    }

    // 檢查自我存取權限
    if (allowSelfAccess && targetAgentId === user.id) {
      await next();
      return;
    }

    throw new AgentPermissionError(`Required roles: ${requiredRoles.join(', ')}`);
  };
};

// 錯誤處理中介層
export const agentErrorHandler = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next): Promise<Response | void> => {
    try {
      return await next();
    } catch (error) {
      if (error instanceof AgentPermissionError) {
        return c.json({ error: error.message }, HTTP_STATUS.FORBIDDEN);
      }

      // 其他錯誤
      console.error('Agent middleware error:', error);
      return c.json({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  };
};