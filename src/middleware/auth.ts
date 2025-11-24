import { Context, Next } from 'hono';
import type { Bindings, JWTPayload } from '../types';
import type { DbUser } from '../types';
import { verifyJWT, getUserById, getSession } from '../utils/auth';
import { createDbClient } from '../db/drizzle-factory';
import { agents } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { SystemPermissions, SystemAccessScope } from '@modules/system/middleware/system-auth';
import type { CustomerPermissions, CustomerAccessScope } from '@modules/customer/types/customer-types';

// 擴展 Context 類型以包含用戶信息和其他變數
declare module 'hono' {
  interface ContextVariableMap {
    user: DbUser;
    agent: DbUser; // Added for database.ts authMiddleware compatibility
    session: Record<string, unknown>;
    jwtPayload: JWTPayload;
    // 客戶模組變數
    createCustomerData: any;
    customerId: string;
    updateCustomerData: any;
    // 會話模組變數
    sessionId: string;
    createSessionData: any;
    updateSessionData: any;
    sessionQuery: any;
    sessionSearchQuery: Record<string, unknown>;
    batchOperation: Record<string, unknown>;
    // 系統變數
    requestId: string;
    userId: string;
    // 其他常用變數
    customerFilters: any;
    paginationParams: { page: number; pageSize: number };
    searchQuery: any;
    tagOperation: any;
    // Reports module variables
    reportId: string;
    scheduledReportId: string;
    reportParams: Record<string, unknown>;
    reportQuery: Record<string, unknown>;
    scheduledReportData: Record<string, unknown>;
    previewParams: Record<string, unknown>;
    // QRCode module variables
    qrCode: any;
    canAccess: boolean;
    canModify: boolean;
    validatedData: any;
    validatedQuery: any;
    // Realtime module variables
    realtimeAuth: any;
    connectionValidation: any;
    // File management variables
    fileValidation: any;
    validatedFile: any;
    filesValidation: any;
    validatedFiles: any;
    // System permissions
    systemPermissions: SystemPermissions;
    systemAccessScope: SystemAccessScope;
    customerPermissions: CustomerPermissions;
    customerAccessScope: CustomerAccessScope;
  }
}

/**
 * JWT 認證中間件
 */
export async function jwtAuth(c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> {
  try {
    // 🔥 Skip authentication for OPTIONS requests (CORS preflight)
    if (c.req.method === 'OPTIONS') {
      return await next();
    }

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

    // Fallback: use JWT payload teamId if database teamId is null (for admin users)
    if (!user.teamId && payload.teamId) {
      console.log('[jwtAuth] Using JWT payload teamId as fallback:', payload.teamId);
      user.teamId = payload.teamId;
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
    console.error('JWT authentication error:', error);
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
    console.error('Session authentication error:', error);
    return c.json({ 
      error: 'Session authentication failed',
      message: error instanceof Error ? error.message : 'Authentication failed'
    }, 401);
  }
}

/**
 * 角色權限中間件
 * Simplified from 3-tier to 2-tier role system
 */
export function requireRole(requiredRole: 'admin' | 'agent') {
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
 * Simplified from 3-tier to 2-tier role system
 */
export function requireRoleLevel(requiredRole: 'admin' | 'agent') {
  return async (c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> => {
    // Check for both 'user' and 'agent' in context (different auth middlewares use different keys)
    const user = c.get('user');
    const agent = c.get('agent');
    const actualUser = user || agent;

    console.log('[requireRoleLevel] Debug:', {
      hasUser: !!user,
      hasAgent: !!agent,
      actualUser: actualUser ? { id: actualUser.id, role: actualUser.role, email: actualUser.email } : null,
      requiredRole
    });

    if (!actualUser) {
      console.log('[requireRoleLevel] No user found in context');
      return c.json({
        error: 'Authentication required',
        debug: {
          hasUser: !!user,
          hasAgent: !!agent,
          requiredRole
        }
      }, 401);
    }

    // Import PermissionService dynamically to avoid circular dependency
    const { PermissionService } = await import('../services/permission-service');

    const hasAuthority = PermissionService.hasRoleAuthority(actualUser.role, requiredRole);
    console.log('[requireRoleLevel] Authority check:', {
      userRole: actualUser.role,
      requiredRole,
      hasAuthority
    });

    // 檢查是否有足夠的角色層級
    if (!hasAuthority) {
      return c.json({
        error: 'Insufficient role level',
        required: requiredRole,
        current: actualUser.role,
        debug: {
          hasUser: !!user,
          hasAgent: !!agent,
          userId: actualUser.id,
          userEmail: actualUser.email
        }
      }, 403);
    }

    await next();
  };
}

/**
 * 管理員權限中間件（簡化版）
 * 注意：從 3-tier (admin/team/agent) 簡化為 2-tier (admin/agent) 系統
 * 原本 team 角色的管理權限現在統一由 admin 處理
 */
export function requireManagerOrAdmin() {
  return requireRoleLevel('admin');
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
    if (user.teamId !== teamId) {
      return c.json({ 
        error: 'Access denied to this team',
        userTeam: user.teamId,
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
        console.warn('Optional auth failed:', error);
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

    // 檢查 API Key（這裡可以從資料庫或環境變數檢查）
    const validApiKey = (c.env as Bindings & { API_KEY?: string }).API_KEY || 'your-secret-api-key';
    
    if (apiKey !== validApiKey) {
      return c.json({ error: 'Invalid API key' }, 401);
    }

    await next();
  } catch (error) {
    console.error('API key authentication error:', error);
    return c.json({ 
      error: 'API key authentication failed',
      message: error instanceof Error ? error.message : 'Authentication failed'
    }, 401);
  }
}

/**
 * 速率限制中間件
 */
export function rateLimit(maxRequests: number = 100, windowMs: number = 60 * 1000) {
  return async (c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> => {
    try {
      const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
      const key = `rate_limit:${clientIP}`;
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // 獲取當前計數
      const currentData = await c.env.SESSIONS.get(key);
      let requests: number[] = currentData ? JSON.parse(currentData) : [];
      
      // 清理過期的請求記錄
      requests = requests.filter(timestamp => timestamp > windowStart);
      
      // 檢查是否超過限制
      if (requests.length >= maxRequests && requests[0] !== undefined) {
        return c.json({ 
          error: 'Rate limit exceeded',
          limit: maxRequests,
          window: windowMs,
          retryAfter: Math.ceil((requests[0] + windowMs - now) / 1000)
        }, 429);
      }
      
      // 添加當前請求
      requests.push(now);
      
      // 更新 KV 存儲
      await c.env.SESSIONS.put(key, JSON.stringify(requests), { 
        expirationTtl: Math.ceil(windowMs / 1000) 
      });
      
      await next();
    } catch (error) {
      console.error('Rate limit error:', error);
      // 如果速率限制失敗，繼續處理請求
      await next();
    }
  };
}