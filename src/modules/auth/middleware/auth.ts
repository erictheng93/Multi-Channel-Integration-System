import { Context, Next } from 'hono';
import type { Bindings, DbUser } from '@/types';
import { verifyJWT, getUserById, getSession } from '@modules/auth/services/auth';
import { createDbClient } from '@/db/drizzle-factory';
import { agents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createContextLogger } from '@/utils/logger';

// Context logger for module auth middleware
const log = createContextLogger('ModuleAuth');

// Note: ContextVariableMap is declared in src/middleware/auth.ts
// This module uses the same context variables without redeclaring them

/**
 * JWT 認證中間件
 */
export async function jwtAuth(c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid authorization header' }, 401);
    }

    const token = authHeader.substring(7); // 移除 "Bearer " 前綴
    
    // 驗證 JWT
    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    
    // 獲取用戶信息
    const user = await getUserById(c.env.DB, payload.userId);
    
    if (!user.isActive) {
      return c.json({ error: 'User account is inactive' }, 401);
    }

    // 將用戶信息和 JWT payload 添加到 context
    c.set('user', user);
    c.set('jwtPayload', payload);
    
    // 更新用戶的最後活動時間（非阻塞）
    try {
      if (typeof user.id === 'string') {
        // agents 表使用字符串 ID - migrated to Drizzle ORM
        const db = createDbClient(c.env.DB);
        await db.update(agents)
          .set({ lastActive: new Date().toISOString() })
          .where(eq(agents.id, user.id))
          .run();
      }
    } catch (error) {
      // 靜默失敗，不影響請求處理
    }
    
    await next();
  } catch (error) {
    log.error('JWT authentication failed', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      error: 'Invalid or expired token',
      message: error instanceof Error ? error.message : 'Authentication failed'
    }, 401);
  }
}

/**
 * 會話認證中間件（使用 KV 存儲）
 */
export async function sessionAuth(c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> {
  try {
    const sessionId = c.req.header('X-Session-ID') || c.req.query('sessionId');
    
    if (!sessionId) {
      return c.json({ error: 'Missing session ID' }, 401);
    }

    // 從 KV 獲取會話信息
    const sessionData = await getSession(c.env.SESSIONS, sessionId);
    
    if (!sessionData) {
      return c.json({ error: 'Invalid or expired session' }, 401);
    }

    // 獲取用戶信息
    const user = await getUserById(c.env.DB, sessionData.userId as number);
    
    if (!user.isActive) {
      return c.json({ error: 'User account is inactive' }, 401);
    }

    // 將用戶和會話信息添加到 context
    c.set('user', user);
    c.set('session', sessionData);
    
    await next();
  } catch (error) {
    log.error('Session authentication failed', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      error: 'Session authentication failed',
      message: error instanceof Error ? error.message : 'Authentication failed'
    }, 401);
  }
}

/**
 * 角色權限中間件
 */
export function requireRole(requiredRole: 'admin' | 'team' | 'agent') {
  return async (c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> => {
    const user = c.get('user');
    
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    // admin 有所有權限
    if (user.role === 'admin') {
      await next();
      return;
    }

    // 檢查角色權限
    if (user.role !== requiredRole) {
      return c.json({ 
        error: 'Insufficient permissions',
        required: requiredRole,
        current: user.role
      }, 403);
    }

    await next();
  };
}

/**
 * 角色層級權限中間件 - 檢查用戶是否有足夠的角色層級
 */
export function requireRoleLevel(requiredRole: 'admin' | 'team' | 'agent') {
  return async (c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> => {
    const user = c.get('user');
    
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    // Import PermissionService dynamically to avoid circular dependency
    const { PermissionService } = await import('../../../shared/services/permission-service');
    
    // 檢查是否有足夠的角色層級
    if (!PermissionService.hasRoleAuthority(user.role, requiredRole)) {
      return c.json({ 
        error: 'Insufficient role level',
        required: requiredRole,
        current: user.role
      }, 403);
    }

    await next();
  };
}

/**
 * 管理員或團隊負責人權限中間件
 */
export function requireManagerOrAdmin() {
  return requireRoleLevel('team');
}

/**
 * 僅管理員權限中間件
 */
export function requireAdmin() {
  return requireRoleLevel('admin');
}

/**
 * 團隊權限中間件
 */
export function requireTeamAccess(teamIdParam: string = 'teamId') {
  return async (c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> => {
    const user = c.get('user');
    
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    // admin 可以訪問所有團隊
    if (user.role === 'admin') {
      await next();
      return;
    }

    const teamId = parseInt(c.req.param(teamIdParam));
    
    if (isNaN(teamId)) {
      return c.json({ error: 'Invalid team ID' }, 400);
    }

    // 檢查用戶是否屬於該團隊
    if (user.primaryTeamId !== teamId) {
      return c.json({
        error: 'Access denied to this team',
        userTeam: user.primaryTeamId,
        requestedTeam: teamId
      }, 403);
    }

    await next();
  };
}

/**
 * 可選認證中間件（不強制要求認證）
 */
export async function optionalAuth(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const payload = await verifyJWT(token, c.env.JWT_SECRET);
        const user = await getUserById(c.env.DB, payload.userId);
        
        if (user.isActive) {
          c.set('user', user);
        }
      } catch (error) {
        // 忽略認證錯誤，繼續處理請求
        log.debug('Optional auth failed (non-blocking)', { error: error instanceof Error ? error.message : String(error) });
      }
    }
    
    await next();
  } catch (error) {
    // 忽略所有錯誤，繼續處理請求
    await next();
  }
}

/**
 * API Key 認證中間件（用於系統間調用）
 */
export async function apiKeyAuth(c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> {
  try {
    const apiKey = c.req.header('X-API-Key');
    
    if (!apiKey) {
      return c.json({ error: 'Missing API key' }, 401);
    }

    // 檢查 API Key（從環境變數檢查 - fail-closed if not configured）
    const validApiKey = (c.env as Bindings & { API_KEY?: string }).API_KEY;

    if (!validApiKey) {
      console.error('❌ [apiKeyAuth] API_KEY environment variable not configured');
      return c.json({ error: 'API key authentication not configured' }, 500);
    }

    if (apiKey !== validApiKey) {
      return c.json({ error: 'Invalid API key' }, 401);
    }

    await next();
  } catch (error) {
    log.error('API key authentication failed', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      error: 'API key authentication failed',
      message: error instanceof Error ? error.message : 'Authentication failed'
    }, 401);
  }
}

/**
 * 速率限制中間件 (DO-Based Implementation)
 * 使用 Durable Objects 取代 KV，減少 95%+ 的 KV 寫入操作
 */
export function rateLimit(maxRequests: number = 100, windowMs: number = 60 * 1000) {
  return async (c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> => {
    try {
      // Check if DO binding is available
      const rateLimiterNamespace = c.env.RATE_LIMITER;
      if (!rateLimiterNamespace) {
        // DO not available - fail open
        log.warn('RATE_LIMITER DO binding not available, allowing request');
        await next();
        return;
      }

      const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';

      // Extract IP prefix for sharding
      const ipParts = clientIP.split('.');
      const ipPrefix = ipParts.length === 4 ? ipParts.slice(0, 3).join('.') : clientIP;

      // Generate DO ID
      const doId = `ratelimit:auth:${ipPrefix}`;
      const stub = rateLimiterNamespace.get(
        rateLimiterNamespace.idFromName(doId)
      );

      // Call the DO to check rate limit
      const response = await stub.fetch('https://rate-limiter.internal/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check',
          clientId: clientIP,
          config: { maxRequests, windowMs },
        }),
      });

      const result = await response.json() as { allowed: boolean; limit: number; remaining: number; reset: number; retryAfter?: number };

      // Set rate limit headers
      c.header('X-RateLimit-Limit', result.limit.toString());
      c.header('X-RateLimit-Remaining', result.remaining.toString());
      c.header('X-RateLimit-Reset', result.reset.toString());

      if (!result.allowed) {
        const retryAfter = result.retryAfter || 1;
        c.header('Retry-After', retryAfter.toString());
        return c.json({
          error: 'Rate limit exceeded',
          limit: maxRequests,
          window: windowMs,
          retryAfter
        }, 429);
      }

      await next();
    } catch (error) {
      log.warn('Rate limit check failed (non-blocking)', { error: error instanceof Error ? error.message : String(error) });
      // 如果速率限制失敗，繼續處理請求
      await next();
    }
  };
}