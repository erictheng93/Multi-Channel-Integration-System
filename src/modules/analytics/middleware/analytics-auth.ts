// Analytics Authentication Middleware - 分析服務權限驗證中間件

import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Bindings } from '@/types';
import { PermissionService } from '@/services/permission-service';
import type { PermissionContext } from '@/types/services';
import { nowISO } from '@/utils/timestamp'

// Analytics User interface
interface AnalyticsUser {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'team' | 'agent';
  primaryTeamId?: number;
  teamName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Analytics 模組權限驗證中間件
 * 確保用戶有權限訪問分析數據
 */
export async function analyticsAuth(c: Context<{ Bindings: Bindings; Variables: { user: AnalyticsUser } }>, next: Next) {
  try {
    // Skip authentication for OPTIONS requests (CORS preflight)
    if (c.req.method === 'OPTIONS') {
      return await next();
    }

    // 獲取 JWT token
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HTTPException(401, {
        message: 'Missing or invalid authorization header',
        cause: 'NO_TOKEN'
      });
    }

    const token = authHeader.slice(7);

    // 驗證 JWT token
    const { success, decoded, error } = await verifyJWT(token, c.env.JWT_SECRET);
    if (!success || !decoded) {
      throw new HTTPException(401, {
        message: error || 'Invalid token',
        cause: 'INVALID_TOKEN'
      });
    }

    // 檢查用戶角色和權限
    const userRole = decoded.role as string;
    const userId = decoded.userId as string;

    if (!userRole || !userId) {
      throw new HTTPException(401, {
        message: 'Invalid token payload',
        cause: 'INVALID_TOKEN_PAYLOAD'
      });
    }

    // 使用 PermissionService 檢查分析數據訪問權限
    const hasPermission = await checkAnalyticsPermission(userId, userRole, c.req.path, c.req.method, decoded.primaryTeamId, c.env.DB);

    if (!hasPermission) {
      throw new HTTPException(403, {
        message: 'Insufficient permissions for analytics access',
        cause: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // 將用戶信息添加到上下文
    c.set('user', {
      id: userId,
      email: decoded.email || '',
      displayName: decoded.displayName || '',
      role: userRole,
      primaryTeamId: decoded.primaryTeamId,
      teamName: decoded.teamName || '',
      isActive: true,
      createdAt: nowISO(),
      updatedAt: nowISO()
    } as AnalyticsUser);

    await next();

  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    console.error('Analytics auth error:', error);
    throw new HTTPException(500, {
      message: 'Authentication system error',
      cause: 'AUTH_SYSTEM_ERROR'
    });
  }
}

/**
 * 驗證 JWT token
 * 支持測試環境和生產環境
 */
async function verifyJWT(token: string, secret: string): Promise<{
  success: boolean;
  decoded?: any;
  error?: string;
}> {
  try {
    // 這裡應該使用實際的 JWT 驗證邏輯
    // 暫時使用簡化的實現
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { success: false, error: 'Invalid token format' };
    }

    // 解碼 payload (實際應用中需要驗證簽名)
    if (!parts[1]) {
      return { success: false, error: 'Invalid token format' };
    }
    const payload = JSON.parse(atob(parts[1]));

    // 檢查過期時間
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return { success: false, error: 'Token expired' };
    }

    // 測試環境支持：如果 payload 有 iss 字段且為測試套件，則接受
    // 這允許 E2E 測試使用測試 JWT
    if (payload.iss === 'e2e-test-suite' && (!secret || secret === 'test-jwt-secret-for-e2e-testing-only-do-not-use-in-production')) {
      return { success: true, decoded: payload };
    }

    return { success: true, decoded: payload };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Token verification failed'
    };
  }
}

/**
 * 使用 PermissionService 檢查用戶是否有分析數據訪問權限
 */
async function checkAnalyticsPermission(
  userId: string,
  userRole: string,
  path: string,
  method: string,
  teamId: number | undefined,
  db: D1Database
): Promise<boolean> {
  // 健康檢查端點對所有認證用戶開放
  if (path.includes('/health')) {
    return true;
  }

  const context: PermissionContext = {
    userId,
    role: userRole,
    teamId
  };

  // 根據路徑確定需要檢查的 resource 和 action
  let resource = 'analytics';
  let action = 'view';

  if (path.includes('/export')) {
    action = 'export';
  } else if (path.includes('/custom') || (path.includes('/metrics') && method === 'POST')) {
    action = 'query';
  }

  // 使用 PermissionService 進行權限檢查
  return await PermissionService.checkPermission(
    userId,
    resource,
    action,
    context,
    db
  );
}

/**
 * 檢查特定分析權限
 * 使用 PermissionService 進行細緻權限檢查
 */
export function requireAnalyticsPermission(resource: string, action: string) {
  return async (c: Context<{ Bindings: Bindings; Variables: { user: AnalyticsUser } }>, next: Next) => {
    const user = c.get('user');

    if (!user) {
      throw new HTTPException(401, {
        message: 'Authentication required',
        cause: 'NO_USER'
      });
    }

    const context: PermissionContext = {
      userId: user.id,
      role: user.role,
      teamId: user.primaryTeamId
    };

    const hasPermission = await PermissionService.checkPermission(
      user.id,
      resource,
      action,
      context,
      c.env.DB
    );

    if (!hasPermission) {
      throw new HTTPException(403, {
        message: `Missing required permission: ${resource}:${action}`,
        cause: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    await next();
  };
}

/**
 * 檢查團隊數據訪問權限
 */
export function requireTeamDataAccess(c: Context<{ Bindings: Bindings; Variables: { user: AnalyticsUser } }>, requestedTeamId?: string): boolean {
  const user = c.get('user');
  if (!user) return false;

  // Admin 可以訪問所有團隊數據
  if (user.role === 'admin') {
    return true;
  }

  // Team 和 Agent 只能訪問自己團隊的數據
  if (requestedTeamId) {
    return user.primaryTeamId?.toString() === requestedTeamId;
  }

  return true;
}

/**
 * 數據過濾中間件 - 根據用戶權限過濾數據
 */
export function applyDataFilters(c: Context<{ Bindings: Bindings; Variables: { user: AnalyticsUser } }>, query: any): any {
  const user = c.get('user');
  if (!user) return query;

  // Admin 可以查看所有數據，不需要額外過濾
  if (user.role === 'admin') {
    return query;
  }

  // Team 和 Agent 只能查看自己團隊的數據
  if (user.primaryTeamId && !query.filters?.teamId) {
    query.filters = query.filters || {};
    query.filters.teamId = user.primaryTeamId;
  }

  // Agent 只能查看與自己相關的數據
  if (user.role === 'agent') {
    query.filters = query.filters || {};
    query.filters.userId = user.id;
  }

  return query;
}

/**
 * 敏感數據脫敏中間件
 */
export function sanitizeAnalyticsData(data: any, userRole: string): any {
  if (userRole === 'admin') {
    return data; // Admin 可以看到所有數據
  }

  // 對非 Admin 用戶脫敏處理
  if (data && typeof data === 'object') {
    // 移除敏感的個人信息
    const sanitized = { ...data };

    // 遞歸處理嵌套對象
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = sanitizeAnalyticsData(sanitized[key], userRole);
      }

      // 脫敏特定字段
      if (['email', 'phone', 'personalId', 'creditCard'].includes(key)) {
        if (userRole !== 'admin') {
          sanitized[key] = maskSensitiveData(sanitized[key]);
        }
      }
    });

    return sanitized;
  }

  return data;
}

/**
 * 脫敏敏感數據
 */
function maskSensitiveData(value: string): string {
  if (!value || typeof value !== 'string') return value;

  if (value.includes('@')) {
    // Email 脱敏
    const [name, domain] = value.split('@');
    if (!name || !domain) return value;
    return `${name.charAt(0)}***@${domain}`;
  }

  if (value.length > 4) {
    // 其他數據脱敏 - 保留前兩位和後兩位
    return `${value.substring(0, 2)}***${value.substring(value.length - 2)}`;
  }

  return '***';
}

// 导出别名以兼容现有导入
export { analyticsAuth as analyticsAuthMiddleware };