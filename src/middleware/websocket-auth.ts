// WebSocket Authentication Middleware
// Handles JWT authentication for WebSocket connections via HttpOnly auth cookies.

import type { Context, Next } from 'hono';
import type { Bindings, JWTPayload } from '../types';
import { verifyJWT } from '../utils/auth';
import { WebSocketAuthService } from '../services/websocket-auth-service';
import { nowISO, nowMs } from '@/utils/timestamp'
import { AUTH_COOKIE_NAMES, parseCookieHeader } from './auth';
import { isOriginAllowed } from '@/config/cors';

export interface WebSocketUser {
  id: number | string;
  email: string;
  displayName: string;
  role: 'admin' | 'agent';
  teamId?: number | null;
  teamName?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const websocketAuth = async (c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> => {
  const startTime = nowMs();
  const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
  const userAgent = c.req.header('User-Agent') || 'unknown';

  try {
    const url = new URL(c.req.url);
    const cookies = parseCookieHeader(c.req.header('Cookie'));
    const token = cookies[AUTH_COOKIE_NAMES.access];
    const conversationId = url.searchParams.get('conversationId');
    const deviceId = url.searchParams.get('deviceId');
    const origin = c.req.header('Origin');

    // 詳細日誌記錄 - 連接嘗試
    console.log(`[WebSocket Auth] Connection attempt from IP: ${clientIP}, ConversationID: ${conversationId || 'none'}, DeviceID: ${deviceId || 'none'}, Token: ${token ? 'present' : 'missing'}`);

    if (origin && !isOriginAllowed(origin, c.env)) {
      console.log(`[WebSocket Auth] Disallowed Origin from ${clientIP}: ${origin}`);
      return new Response(JSON.stringify({
        error: 'Origin not allowed',
        code: 4408,
        message: 'WebSocket Origin is not allowed',
        timestamp: nowMs()
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'X-Error-Code': 'ORIGIN_NOT_ALLOWED',
          'X-WebSocket-Close-Code': '4408'
        }
      });
    }

    // 檢查 1: cookie access token 是否存在
    if (!token) {
      console.log(`[WebSocket Auth] No auth cookie provided from ${clientIP}`);
      return new Response(JSON.stringify({
        error: 'Authentication cookie required',
        code: 4401, // 自定義 WebSocket 關閉代碼
        message: 'WebSocket connections require a valid auth cookie',
        timestamp: nowMs(),
        suggestedAction: 'restore_session'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'X-Error-Code': 'NO_TOKEN',
          'X-WebSocket-Close-Code': '4401'
        }
      });
    }

    // 檢查 2: 令牌格式驗證
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      console.log(`[WebSocket Auth] Invalid token format from ${clientIP}: expected 3 parts, got ${tokenParts.length}`);
      return new Response(JSON.stringify({
        error: 'Invalid token format',
        code: 4402,
        message: 'JWT token must have 3 parts separated by dots',
        timestamp: nowMs(),
        suggestedAction: 'refresh_token'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'X-Error-Code': 'INVALID_TOKEN_FORMAT',
          'X-WebSocket-Close-Code': '4402'
        }
      });
    }

    // 檢查 3: JWT 驗證
    console.log(`[WebSocket Auth] Verifying JWT token for ${clientIP}...`);
    const payload = await verifyJWT(token, c.env.JWT_SECRET) as JWTPayload | null;

    if (!payload) {
      console.log(`[WebSocket Auth] Invalid or expired token from ${clientIP}`);
      return new Response(JSON.stringify({
        error: 'Invalid token',
        code: 4403,
        message: 'The provided JWT token is invalid or expired',
        timestamp: nowMs(),
        suggestedAction: 'refresh_token'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'X-Error-Code': 'INVALID_TOKEN',
          'X-WebSocket-Close-Code': '4403'
        }
      });
    }

    // 檢查 4: 令牌過期檢查
    // FIX: Reduced expiry buffer from 5 minutes to 30 seconds
    // Rationale: 5-minute buffer was too aggressive and blocked valid connections
    // The client has auto-reconnection and token refresh logic to handle expiring tokens
    const currentTime = Math.floor(Date.now() / 1000);
    const expiryBuffer = 30; // 30 seconds - only block if token expires very soon

    if (payload.exp && payload.exp <= currentTime) {
      console.log(`[WebSocket Auth] Token already expired from ${clientIP}. Expired at: ${new Date(payload.exp * 1000).toISOString()}, Current: ${nowISO()}`);
      return new Response(JSON.stringify({
        error: 'Token expired',
        code: 4404,
        message: 'The JWT token has expired',
        expiresAt: payload.exp,
        currentTime: currentTime,
        timestamp: nowMs(),
        suggestedAction: 'refresh_token'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'X-Error-Code': 'TOKEN_EXPIRED',
          'X-WebSocket-Close-Code': '4404'
        }
      });
    }

    // FIX: Changed from blocking to warning for tokens expiring soon
    // Only block if token expires in less than 30 seconds (to prevent immediate disconnection)
    // Log warning for tokens expiring in 1-5 minutes but allow connection
    if (payload.exp && payload.exp <= (currentTime + expiryBuffer)) {
      console.log(`[WebSocket Auth] Token expires too soon from ${clientIP}. Expires at: ${new Date(payload.exp * 1000).toISOString()}, Time remaining: ${payload.exp - currentTime} seconds`);
      return new Response(JSON.stringify({
        error: 'Token expiring too soon',
        code: 4405,
        message: 'Token expires in less than 30 seconds, please refresh first',
        expiresAt: payload.exp,
        currentTime: currentTime,
        timeRemaining: payload.exp - currentTime,
        timestamp: nowMs(),
        suggestedAction: 'refresh_token'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'X-Error-Code': 'TOKEN_EXPIRING_SOON',
          'X-WebSocket-Close-Code': '4405'
        }
      });
    }

    // Log warning for tokens expiring in 1-5 minutes but ALLOW connection
    const warningBuffer = 300; // 5 minutes
    if (payload.exp && payload.exp <= (currentTime + warningBuffer)) {
      const timeRemaining = payload.exp - currentTime;
      console.log(`[WebSocket Auth] Token will expire in ${timeRemaining} seconds from ${clientIP}. Connection allowed but client should refresh token soon.`);
    }

    // 檢查 5: 使用者資料提取和驗證
    const userId = payload.userId?.toString() || String(payload.userId) || '0';
    const email = payload.email || `${userId}@example.com`;
    const displayName = payload.displayName || payload.email?.split('@')[0] || userId;
    const role = (payload.role as 'admin' | 'agent') || 'agent';

    // 驗證關鍵欄位
    if (!userId || userId === '0') {
      console.log(`[WebSocket Auth] Invalid userId in token from ${clientIP}: ${userId}`);
      return new Response(JSON.stringify({
        error: 'Invalid user data',
        code: 4406,
        message: 'Token contains invalid user identification',
        timestamp: nowMs(),
        suggestedAction: 'refresh_token'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'X-Error-Code': 'INVALID_USER_DATA',
          'X-WebSocket-Close-Code': '4406'
        }
      });
    }

    // 檢查角色有效性
    if (!['admin', 'agent'].includes(role)) {
      console.log(`[WebSocket Auth] Invalid role in token from ${clientIP}: ${role}`);
      return new Response(JSON.stringify({
        error: 'Invalid role',
        code: 4407,
        message: 'Token contains invalid user role',
        providedRole: role,
        validRoles: ['admin', 'agent'],
        timestamp: nowMs(),
        suggestedAction: 'refresh_token'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'X-Error-Code': 'INVALID_ROLE',
          'X-WebSocket-Close-Code': '4407'
        }
      });
    }

    const user: WebSocketUser = {
      id: userId,
      email: email,
      displayName: displayName,
      role: role,
      teamId: payload.primaryTeamId || null,
      teamName: payload.teamName || null,
      isActive: true,
      createdAt: nowISO(),
      updatedAt: nowISO()
    };

    // Store user in context for handler access
    c.set('user', user);
    c.set('websocketToken', token);
    // F14: expose the verified JWT payload so /connect can forward
    // tokenExp / jti to the Durable Object that owns the socket.
    c.set('jwtPayload', payload);

    // P2-3: Check conversation access permissions for agents
    if (conversationId && role === 'agent') {
      const authService = new WebSocketAuthService(c.env, c.env.DB, c.env.CACHE);
      const hasAccess = await authService.authorizeConversationAccess(
        userId,
        role,
        conversationId,
        user.teamId || undefined
      );

      if (!hasAccess) {
        console.log(`[WebSocket Auth] Agent ${userId} denied access to conversation ${conversationId}`);
        return new Response(JSON.stringify({
          error: 'Access denied',
          code: 4403,
          message: 'You do not have permission to access this conversation',
          conversationId,
          timestamp: nowMs(),
          suggestedAction: 'contact_admin'
        }), {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'X-Error-Code': 'CONVERSATION_ACCESS_DENIED',
            'X-WebSocket-Close-Code': '4403'
          }
        });
      }

      console.log(`[WebSocket Auth] Agent ${userId} authorized for conversation ${conversationId}`);
    }

    const authDuration = Date.now() - startTime;
    console.log(`[WebSocket Auth] User authenticated successfully: ${user.id} (${user.role}) from ${clientIP}, Duration: ${authDuration}ms, TeamID: ${user.teamId || 'none'}`);

    // Phase 2: 記錄成功的認證事件到分析服務
    try {
      const { createAnalyticsService } = await import('../monitoring/websocket-analytics-service');
      const analyticsService = createAnalyticsService(c.env);

      await analyticsService.recordConnectionQuality({
        timestamp: nowMs(),
        userId: user.id.toString(),
        connectionId: `auth_${nowMs()}_${Math.random().toString(36).substring(2, 8)}`,
        latency: authDuration,
        connectionTime: authDuration,
        messagesPerSecond: 0,
        errorRate: 0,
        isStable: true
      });
    } catch (analyticsError) {
      // 分析記錄失敗不影響主要功能
      console.warn('[WebSocket Auth] Failed to record analytics:', analyticsError);
    }

    return await next();
  } catch (error) {
    const authDuration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown authentication error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error(`[WebSocket Auth] Authentication failed from ${clientIP}:`, {
      error: errorMessage,
      duration: `${authDuration}ms`,
      userAgent,
      stack: errorStack,
      timestamp: nowISO()
    });

    // Phase 2: 記錄認證錯誤到分析服務
    try {
      const { createAnalyticsService } = await import('../monitoring/websocket-analytics-service');
      const analyticsService = createAnalyticsService(c.env);

      await analyticsService.recordError({
        timestamp: nowMs(),
        errorCode: 4500,
        errorType: 'AUTH_SYSTEM_ERROR',
        message: errorMessage,
        clientIP,
        userAgent,
        duration: authDuration
      });
    } catch (analyticsError) {
      console.warn('[WebSocket Auth] Failed to record error analytics:', analyticsError);
    }

    return new Response(JSON.stringify({
      error: 'Authentication failed',
      code: 4500,
      message: errorMessage,
      timestamp: nowMs(),
      duration: authDuration,
      suggestedAction: 'retry_with_new_token'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-Error-Code': 'AUTH_SYSTEM_ERROR',
        'X-WebSocket-Close-Code': '4500'
      }
    });
  }
};
