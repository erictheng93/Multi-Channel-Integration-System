// 認證處理器
import type { Context } from 'hono';
import type { Bindings, LoginRequest, LoginResponse, Agent } from '../types';
import { signJWT } from '../utils/auth';
import { 
  successResponse, 
  // errorResponse, // 暫時未使用 
  validationErrorResponse, 
  unauthorizedResponse,
  notFoundResponse,
  handleApiError 
} from '../utils/api-response';

export const authHandler = {
  // 用戶登入
  login: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const { email, password }: LoginRequest = await c.req.json();
      
      if (!email || !password) {
        return validationErrorResponse(c, [
          { field: 'email', message: 'Email is required' },
          { field: 'password', message: 'Password is required' }
        ]);
      }

      // 驗證用戶（從 agents 表查找）
      const agentRow = await c.env.DB.prepare(
        'SELECT * FROM agents WHERE email = ? AND is_active = 1'
      ).bind(email).first();
      
      if (!agentRow) {
        return unauthorizedResponse(c, 'Invalid email or password');
      }

      // 驗證密碼
      const bcrypt = await import('bcryptjs');
      const isValidPassword = await bcrypt.compare(password, agentRow.password_hash as string);
      
      if (!isValidPassword) {
        return unauthorizedResponse(c, 'Invalid email or password');
      }

      // 檢查密碼政策
      const passwordPolicy = agentRow.password_policy as string || 'changeable';
      const mustChangePassword = passwordPolicy === 'must_change';
      
      console.log(`🔐 Auth Debug - User: ${email}, Policy: ${passwordPolicy}, Must Change: ${mustChangePassword}`);

      // 轉換為 Agent 格式
      const agent: Agent = {
        id: agentRow.id as string,
        email: agentRow.email as string,
        name: agentRow.display_name as string,
        role: agentRow.role as 'admin' | 'agent',
        isActive: Boolean(agentRow.is_active),
        createdAt: agentRow.created_at as number
      };

      // 如果必須更改密碼，返回特殊響應
      if (mustChangePassword) {
        // 生成臨時token用於密碼更改
        const tempToken = await signJWT(
          { 
            userId: typeof agentRow.id === 'string' ? parseInt(agentRow.id, 10) : Number(agentRow.id),
            displayName: agentRow.display_name as string,
            email: agentRow.email as string, 
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
          userId: typeof agentRow.id === 'string' ? parseInt(agentRow.id, 10) : Number(agentRow.id),
          displayName: agentRow.display_name as string,
          email: agentRow.email as string, 
          role: agentRow.role as 'admin' | 'agent',
          type: 'access'
        },
        c.env.JWT_SECRET,
        2 * 60 * 60 // 2 小時
      );

      // 生成 Refresh Token (長期，7天)
      const refreshToken = await signJWT(
        { 
          userId: typeof agentRow.id === 'string' ? parseInt(agentRow.id, 10) : Number(agentRow.id),
          displayName: agentRow.display_name as string,
          email: agentRow.email as string, 
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
      const agentRow = await c.env.DB.prepare(
        'SELECT * FROM agents WHERE id = ? AND is_active = 1'
      ).bind(payload.userId).first();

      if (!agentRow) {
        return notFoundResponse(c, 'Agent');
      }

      const agent: Agent = {
        id: agentRow.id as string,
        email: agentRow.email as string,
        name: agentRow.name as string,
        role: agentRow.role as 'admin' | 'agent',
        isActive: Boolean(agentRow.is_active),
        createdAt: agentRow.created_at as number
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
      const agentRow = await c.env.DB.prepare(
        'SELECT * FROM agents WHERE id = ? AND is_active = 1'
      ).bind(payload.userId).first();

      if (!agentRow) {
        return unauthorizedResponse(c, 'User not found or inactive');
      }

      // 生成新的 access token
      const newToken = await signJWT(
        { 
          userId: payload.userId,
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