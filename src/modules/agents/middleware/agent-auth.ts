// Agent Authentication Middleware - 客服代理認證中介層
// Agent Authentication Middleware

import type { MiddlewareHandler } from 'hono';
import type { Bindings } from '@/types';
import { verifyJWT } from '@/utils/auth';
import { AgentPermissionError } from '@modules/agents/types/agent-types';
import { nowISO } from '@/utils/timestamp'
import { unauthorizedResponse, forbiddenResponse, internalErrorResponse } from '@/utils/api-response';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('AgentAuth');

// 基本認證中介層
export const agentAuthMiddleware = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next) => {
    try {
      const authHeader = c.req.header('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return unauthorizedResponse(c, 'Missing or invalid authorization header');
      }

      const token = authHeader.split(' ')[1];
      if (!token) {
        return unauthorizedResponse(c, 'Missing token');
      }

      const payload = await verifyJWT(token, c.env.JWT_SECRET);

      if (!payload) {
        return unauthorizedResponse(c, 'Invalid token');
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
      return unauthorizedResponse(c, 'Authentication failed');
    }
  };
};

// 管理員權限檢查中介層
export const requireAdminRole = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next): Promise<Response | void> => {
    try {
      const user = c.get('user');

      if (!user || user.role !== 'admin') {
        return forbiddenResponse(c, 'Admin role required');
      }

      return await next();
    } catch (error) {
      return internalErrorResponse(c, 'Permission check failed');
    }
  };
};

// 團隊領導或管理員權限檢查中介層
export const requireTeamLeaderOrAdmin = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next): Promise<Response | void> => {
    try {
      const user = c.get('user');

      if (!user || !['admin', 'team'].includes(user.role)) {
        return forbiddenResponse(c, 'Team leader or admin role required');
      }

      return await next();
    } catch (error) {
      return internalErrorResponse(c, 'Permission check failed');
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
        return unauthorizedResponse(c, 'Authentication required');
      }

      // 管理員可以操作所有代理
      if (user.role === 'admin') {
        await next();
        return;
      }

      // 代理只能操作自己
      if (user.role === 'agent') {
        if (targetAgentId && targetAgentId !== user.id) {
          return forbiddenResponse(c, 'Cannot access other agents');
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

      return forbiddenResponse(c, 'Insufficient permissions');
    } catch (error) {
      return internalErrorResponse(c, 'Permission check failed');
    }
  };
};

// 檢查團隊內權限的中介層
export const checkTeamAccess = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next) => {
    const user = c.get('user');
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
        return forbiddenResponse(c, error.message);
      }

      // 其他錯誤
      log.error('Agent middleware error', { details: error instanceof Error ? error.message : 'Unknown error' });
      return internalErrorResponse(c, 'Internal server error');
    }
  };
};