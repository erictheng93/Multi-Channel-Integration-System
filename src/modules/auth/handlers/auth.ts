// 認證處理器
import type { Context } from 'hono';
import type { Bindings } from '@/types';
import type { AuthRequest, LoginResponse } from '@modules/auth/types/auth-types';
import { signJWT } from '@modules/auth/services/auth';
import { createDbClient } from '../../../db/drizzle-factory';
import { eq, and } from 'drizzle-orm';
import { agents } from '@/db/schema';
import {
  successResponse,
  validationErrorResponse,
  unauthorizedResponse,
  notFoundResponse,
  handleApiError
} from '@shared/utils/api-response';

export const authHandler = {
  // 用戶登入
  login: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const { email, password }: AuthRequest = await c.req.json();
      
      if (!email || !password) {
        return validationErrorResponse(c, [
          { field: 'email', message: 'Email is required' },
          { field: 'password', message: 'Password is required' }
        ]);
      }

      // 驗證用戶（從 agents 表查找）
      const db = createDbClient(c.env.DB);
      const agentRow = await db.select().from(agents)
        .where(and(eq(agents.email, email), eq(agents.isActive, true)))
        .get();
      
      if (!agentRow) {
        return unauthorizedResponse(c, 'Invalid email or password');
      }

      // 驗證密碼
      const bcrypt = await import('bcryptjs');
      const isValidPassword = await bcrypt.compare(password, agentRow.passwordHash);
      
      if (!isValidPassword) {
        return unauthorizedResponse(c, 'Invalid email or password');
      }

      // 檢查密碼政策
      const passwordPolicy = agentRow.passwordPolicy || 'changeable';
      const mustChangePassword = passwordPolicy === 'must_change';
      
      // Password policy evaluated

      // 使用數據庫返回的原始資料（Agent 類型來自 schema）
      const agent = {
        id: agentRow.id,
        email: agentRow.email,
        displayName: agentRow.displayName,
        role: agentRow.role,
        isActive: agentRow.isActive,
        createdAt: agentRow.createdAt,
        updatedAt: agentRow.updatedAt,
        passwordHash: agentRow.passwordHash,
        teamId: agentRow.teamId,
        passwordPolicy: agentRow.passwordPolicy,
        lastActive: agentRow.lastActive,
        lastLoginAt: agentRow.lastLoginAt
      };

      // 如果必須更改密碼，返回特殊響應
      if (mustChangePassword) {
        // 生成臨時token用於密碼更改
        const tempToken = await signJWT(
          {
            userId: agentRow.id,
            username: agentRow.email,
            displayName: agentRow.displayName,
            email: agentRow.email,
            role: agentRow.role as 'admin' | 'agent',
            type: 'temp_password_change'
          },
          c.env.JWT_SECRET,
          30 * 60 // 30 分鐘
        );

        return successResponse(c, {
          mustChangePassword: true,
          tempToken,
          agent
        }, 'Password must be changed before login');
      }

      // 生成 Access Token (短期，2小時)
      const token = await signJWT(
        {
          userId: agentRow.id,
          username: agentRow.email,
          displayName: agentRow.displayName,
          email: agentRow.email,
          role: agentRow.role as 'admin' | 'agent',
          type: 'access'
        },
        c.env.JWT_SECRET,
        2 * 60 * 60 // 2 小時
      );

      // 生成 Refresh Token (長期，7天)
      const refreshToken = await signJWT(
        {
          userId: agentRow.id,
          username: agentRow.email,
          displayName: agentRow.displayName,
          email: agentRow.email,
          role: agentRow.role as 'admin' | 'agent',
          type: 'refresh'
        },
        c.env.JWT_SECRET,
        7 * 24 * 60 * 60 // 7 天
      );

      const response: LoginResponse = {
        token,
        refreshToken,
        agent
      };

      return successResponse(c, response, 'Login successful');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取當前用戶資訊
  me: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      // 從 JWT 中獲取用戶資訊
      const payload = c.get('jwtPayload');
      
      if (!payload) {
        return unauthorizedResponse(c, 'JWT payload not found');
      }

      // 從資料庫獲取最新的用戶資訊
      const db = createDbClient(c.env.DB);
      const agentRow = await db.select().from(agents)
        .where(and(eq(agents.id, payload.userId.toString()), eq(agents.isActive, true)))
        .get();

      if (!agentRow) {
        return notFoundResponse(c, 'Agent');
      }

      // 使用數據庫返回的原始資料（Agent 類型來自 schema）
      const agent = {
        id: agentRow.id,
        email: agentRow.email,
        displayName: agentRow.displayName,
        role: agentRow.role,
        isActive: agentRow.isActive,
        createdAt: agentRow.createdAt,
        updatedAt: agentRow.updatedAt,
        passwordHash: agentRow.passwordHash,
        teamId: agentRow.teamId,
        passwordPolicy: agentRow.passwordPolicy,
        lastActive: agentRow.lastActive,
        lastLoginAt: agentRow.lastLoginAt
      };

      return successResponse(c, agent, 'User information retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 刷新 Token
  refresh: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const { refreshToken } = await c.req.json();
      
      if (!refreshToken) {
        return validationErrorResponse(c, [
          { field: 'refreshToken', message: 'Refresh token is required' }
        ]);
      }

      // 驗證 refresh token
      const jwt = await import('jsonwebtoken');
      let payload;
      
      try {
        payload = jwt.verify(refreshToken, c.env.JWT_SECRET) as any;
      } catch (error) {
        return unauthorizedResponse(c, 'Invalid refresh token');
      }

      // 檢查 token 類型
      if (payload.type !== 'refresh') {
        return unauthorizedResponse(c, 'Invalid token type');
      }

      // 驗證用戶是否仍然存在且活躍
      const db = createDbClient(c.env.DB);
      const agentRow = await db.select().from(agents)
        .where(and(eq(agents.id, payload.userId), eq(agents.isActive, true)))
        .get();

      if (!agentRow) {
        return unauthorizedResponse(c, 'User not found or inactive');
      }

      // 生成新的 access token
      const newToken = await signJWT(
        {
          userId: payload.userId,
          username: payload.email,
          displayName: payload.displayName,
          email: payload.email,
          role: payload.role,
          type: 'access'
        },
        c.env.JWT_SECRET,
        2 * 60 * 60 // 2 小時
      );

      // 可選：生成新的 refresh token (滾動刷新)
      const newRefreshToken = await signJWT(
        {
          userId: payload.userId,
          username: payload.email,
          displayName: payload.displayName,
          email: payload.email,
          role: payload.role,
          type: 'refresh'
        },
        c.env.JWT_SECRET,
        7 * 24 * 60 * 60 // 7 天
      );

      return successResponse(c, {
        token: newToken,
        refreshToken: newRefreshToken
      }, 'Token refreshed successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 登出
  logout: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      // 在實際應用中，你可能想要將 refresh token 加入黑名單
      // 這裡我們只是返回成功響應
      return successResponse(c, null, 'Logout successful');
    } catch (error) {
      return handleApiError(error, c);
    }
  }
};