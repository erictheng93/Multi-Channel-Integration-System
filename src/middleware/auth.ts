import { Context, Next } from 'hono';
import type { Bindings, JWTPayload } from '../types';
import type { DbUser } from '../types';
import { verifyJWT, getUserById, getSession, updateUserActivityDebounced, canAccessTeam, hasTeamRole, TEAM_PERMISSIONS } from '../utils/auth';
import type { TeamRoleInTeam } from '../types';
import { ROLES, type Role } from '../constants/roles';
import { createContextLogger } from '../utils/logger';
import { eq } from 'drizzle-orm';
import { createDbClient } from '../db/drizzle-factory';
import { agentTeams } from '../db/schema';
import { incrementRequestCounter, trackTheoreticalKVSavings } from '@modules/system/handlers/kv-optimization-monitoring';
import type { SystemPermissions, SystemAccessScope } from '@modules/system/middleware/system-auth';
import type { CustomerPermissions, CustomerAccessScope, CreateCustomerData, UpdateCustomerData, CustomerFilters, CustomerTagOperation, CustomerSearchQuery } from '@modules/customer/types/customer-types';
import type { CreateSessionData, UpdateSessionData, SessionListQuery, SessionSearchQuery } from '@modules/session/types/session-types';
import type { RealtimeAuthPayload } from '@modules/realtime/middleware/realtime-auth';
import type { FileValidationResult } from '@modules/file-management/types/validation-types';
import type {
  BatchReportOperation,
  ReportGenerationParams,
  ReportListQuery,
  ScheduledReport
} from '@modules/reports/types/report-types';

// Context logger for auth middleware
const log = createContextLogger('AuthMiddleware');
export const AUTH_COOKIE_NAMES = {
  access: 'mcis_access',
  refresh: 'mcis_refresh',
  csrf: 'mcis_csrf',
} as const;

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(';').reduce<Record<string, string>>((cookies, part) => {
    const [rawName, ...rawValueParts] = part.split('=');
    const name = rawName?.trim();
    if (!name) {
      return cookies;
    }
    cookies[name] = decodeURIComponent(rawValueParts.join('=').trim());
    return cookies;
  }, {});
}

function csrfMatches(cookies: Record<string, string>, csrfHeader: string | undefined): boolean {
  const csrfCookie = cookies[AUTH_COOKIE_NAMES.csrf];
  return Boolean(csrfCookie && csrfHeader && csrfCookie === csrfHeader);
}

/**
 * F15: re-fetch the user's team membership from agent_teams so changes to
 * team assignment (admin removes/adds) take effect within the cache TTL
 * instead of waiting for the access token to expire (up to 2h). Previously
 * jwtAuth trusted the JWT's cached allowedTeamIds/teamRoles, so a demoted
 * agent retained team-data access for the full token lifetime.
 *
 * Result is cached in KV (CACHE binding) under `agent-teams:{userId}` with
 * a 60-second TTL — long enough to absorb burst traffic, short enough that
 * a membership change propagates within a minute. Cache writes are
 * best-effort; failure to write does not block authentication.
 */
type FreshMembership = {
  allowedTeamIds: number[];
  teamRoles: Record<number, TeamRoleInTeam>;
  primaryTeamId: number | null;
};

async function refreshTeamMembership(
  db: D1Database,
  cache: KVNamespace,
  userId: string | number
): Promise<FreshMembership> {
  const cacheKey = `agent-teams:${userId}`;

  try {
    const cached = await cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as FreshMembership;
    }
  } catch (err) {
    log.warn('agent-teams cache read failed; falling back to DB', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const drizzleDb = createDbClient(db);
  const rows = await drizzleDb
    .select({
      teamId: agentTeams.teamId,
      roleInTeam: agentTeams.roleInTeam,
      isPrimary: agentTeams.isPrimary,
    })
    .from(agentTeams)
    .where(eq(agentTeams.agentId, String(userId)));

  const allowedTeamIds: number[] = [];
  const teamRoles: Record<number, TeamRoleInTeam> = {};
  let primaryTeamId: number | null = null;

  for (const row of rows) {
    allowedTeamIds.push(row.teamId);
    teamRoles[row.teamId] = (row.roleInTeam || 'member') as TeamRoleInTeam;
    if (row.isPrimary) {
      primaryTeamId = row.teamId;
    }
  }

  const result: FreshMembership = { allowedTeamIds, teamRoles, primaryTeamId };

  // Best-effort cache write; failure here doesn't break auth.
  try {
    await cache.put(cacheKey, JSON.stringify(result), { expirationTtl: 60 });
  } catch (err) {
    log.warn('agent-teams cache write failed', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return result;
}

// ======================== Context 變數類型定義 ========================
// P2-6: Improved type safety while maintaining backward compatibility
// Using union types to allow flexibility for different use cases

// 擴展 Context 類型以包含用戶信息和其他變數
declare module 'hono' {
  interface ContextVariableMap {
    user: DbUser;
    agent: DbUser; // Added for database.ts authMiddleware compatibility
    session: Record<string, unknown>;
    jwtPayload: JWTPayload;
    websocketToken: string;
    // 客戶模組變數 (P2-6: Type-safe customer data)
    createCustomerData: CreateCustomerData;
    customerId: string;
    updateCustomerData: UpdateCustomerData;
    // 會話模組變數 (P2-6: Type-safe session data)
    sessionId: string;
    createSessionData: CreateSessionData;
    updateSessionData: UpdateSessionData;
    sessionQuery: SessionListQuery;
    sessionSearchQuery: SessionSearchQuery | Record<string, unknown>;
    batchOperation: BatchReportOperation | Record<string, unknown>; // Flexible for different batch operations
    // 系統變數
    requestId: string;
    userId: string;
    // 其他常用變數 (P2-6: Improved type hints with union types)
    customerFilters: CustomerFilters;
    teamFilters: { teamId: string };
    paginationParams: { page: number; pageSize: number };
    searchQuery: CustomerSearchQuery | Record<string, unknown>; // Union for various search types
    tagOperation: CustomerTagOperation;
    // Reports module variables
    reportId: string;
    scheduledReportId: string;
    reportParams: ReportGenerationParams;
    reportQuery: ReportListQuery;
    scheduledReportData:
      | Omit<ScheduledReport, 'id' | 'createdAt' | 'nextRun'>
      | Partial<ScheduledReport>;
    previewParams: ReportGenerationParams;
    canAccess: boolean;
    canModify: boolean;
    validatedData: Record<string, unknown>; // Flexible validated data
    validatedQuery: Record<string, unknown>; // Flexible query params
    // Realtime module variables (P2-6: Type-safe realtime auth)
    realtimeAuth: RealtimeAuthPayload;
    connectionValidation: Record<string, unknown>; // Flexible connection data
    // File management variables (P2-6: Union types for file validation)
    fileValidation: FileValidationResult | Record<string, unknown>;
    validatedFile: File | FileValidationResult;
    filesValidation: Array<FileValidationResult | Record<string, unknown>>;
    validatedFiles: Array<File | FileValidationResult>;
    // System permissions
    systemPermissions: SystemPermissions;
    systemAccessScope: SystemAccessScope;
    customerPermissions: CustomerPermissions;
    customerAccessScope: CustomerAccessScope;
    // Multi-team context (Phase 1 optimization)
    contextTeamId: number | null;  // Current team context from X-Context-Team-ID header
  }
}

/**
 * JWT 認證中間件
 */
export async function jwtAuth(c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> {
  try {
    // Skip authentication for OPTIONS requests (CORS preflight)
    if (c.req.method === 'OPTIONS') {
      return await next();
    }

    const cookies = parseCookieHeader(c.req.header('Cookie'));
    const cookieToken = cookies[AUTH_COOKIE_NAMES.access] || null;

    if (!cookieToken) {
      return c.json({ error: 'Missing or invalid auth cookie' }, 401);
    }

    if (
      UNSAFE_METHODS.has(c.req.method.toUpperCase()) &&
      !csrfMatches(cookies, c.req.header('X-CSRF-Token'))
    ) {
      return c.json({ error: 'Invalid CSRF token' }, 403);
    }

    // 驗證 JWT
    const payload = await verifyJWT(cookieToken, c.env.JWT_SECRET);

    // F12/F14 fix: reject non-access tokens used as access tokens. Login mints
    // access, refresh, and forced-password-change temp JWTs with the same
    // JWT_SECRET. Refresh tokens and temp password-change tokens must not be
    // accepted by the general protected API middleware.
    if (payload.type === 'refresh') {
      return c.json({ error: 'Refresh token cannot be used to access this resource' }, 401);
    }
    if (payload.type === 'temp_password_change') {
      return c.json({ error: 'Temporary password-change token cannot be used to access this resource' }, 401);
    }

    // F13: check the per-token revocation list before trusting the JWT.
    // /logout writes `revoked:{jti}` in CACHE with TTL = remaining token
    // life; a stolen token is invalidated within one KV-read of the user
    // calling logout. Tokens minted before F13 have no jti and skip this
    // check — the residual exposure is bounded by their natural exp.
    //
    // F13 hardening: fail-closed on KV outage for jti-bearing tokens.
    // Previously we fell through and accepted the request on KV error,
    // which means a sufficiently long KV brownout effectively disables
    // logout-based revocation. We now return 503 so monitoring catches
    // the outage and ops can intervene; the alternative — silently
    // honouring potentially-revoked tokens — was the wrong tradeoff for
    // a security-critical check. Tokens without a jti retain the
    // legacy behaviour (no revocation check possible).
    if (payload.jti) {
      let isRevoked: string | null;
      try {
        isRevoked = await c.env.CACHE.get(`revoked:${payload.jti}`);
      } catch (err) {
        log.error('Revocation KV read failed; denying request for safety', {
          jti: payload.jti,
          error: err instanceof Error ? err.message : String(err),
        });
        return c.json(
          { error: 'Service temporarily unavailable', code: 'REVOCATION_CHECK_FAILED' },
          503,
        );
      }
      if (isRevoked) {
        return c.json({ error: 'Token has been revoked' }, 401);
      }
    }

    // 獲取用戶信息
    const user = await getUserById(c.env.DB, payload.userId);

    if (!user.isActive) {
      return c.json({ error: 'User account is inactive' }, 401);
    }

    // F15: refresh team membership from DB (KV-cached 60s) so admin
    // demotions / additions take effect within a minute instead of
    // waiting for the access token to expire. Replaces the previous
    // pattern of trusting whatever allowedTeamIds was cached in the JWT
    // at signing time.
    const fresh = await refreshTeamMembership(c.env.DB, c.env.CACHE, user.id);
    user.allowedTeamIds = fresh.allowedTeamIds;
    user.teamRoles = fresh.teamRoles;
    if (fresh.primaryTeamId !== null) {
      user.primaryTeamId = fresh.primaryTeamId;
    } else if (!user.primaryTeamId && payload.primaryTeamId) {
      // Last-resort fallback only when DB has no team rows AND the JWT
      // carried a primaryTeamId (admin users may be teamless in DB).
      log.debug('Using JWT payload teamId as fallback', { teamId: payload.primaryTeamId });
      user.primaryTeamId = payload.primaryTeamId;
    }

    // Phase 1 Optimization: Parse and validate X-Context-Team-ID header
    const contextTeamHeader = c.req.header('X-Context-Team-ID');
    let contextTeamId: number | null = null;

    if (contextTeamHeader) {
      const parsedTeamId = parseInt(contextTeamHeader, 10);
      if (!isNaN(parsedTeamId)) {
        // Validate: user must have access to this team
        const hasAccess = user.role === 'admin' ||
          (user.allowedTeamIds && user.allowedTeamIds.includes(parsedTeamId));

        if (hasAccess) {
          contextTeamId = parsedTeamId;
        } else {
          log.warn('Invalid X-Context-Team-ID: user lacks access', {
            userId: user.id,
            requestedTeam: parsedTeamId,
            allowedTeams: user.allowedTeamIds
          });
          // Don't fail the request, just ignore invalid team context
        }
      }
    }

    // Default to primary team if no context header provided
    if (contextTeamId === null && user.primaryTeamId) {
      contextTeamId = user.primaryTeamId;
    }

    // 將用戶信息和 JWT payload 添加到 context
    c.set('user', user);
    c.set('jwtPayload', payload);
    c.set('contextTeamId', contextTeamId);

    // OPTIMIZED v3.0: 更新用戶的最後活動時間（純記憶體去重，15分鐘間隔）
    // - Zero KV operations (100% quota savings)
    // - Faster performance (no network calls)
    // - Tracks theoretical KV savings for monitoring
    // agents 表使用字符串 ID
    if (typeof user.id === 'string') {
      // P0 Monitoring: Track request frequency
      incrementRequestCounter(user.id);

      // Update activity with pure in-memory debouncing
      updateUserActivityDebounced(user.id, c.env.DB, c.env.SESSIONS).then((wasUpdated) => {
        // P0 Monitoring: Track theoretical KV savings
        trackTheoreticalKVSavings(!wasUpdated);
      }).catch(() => {
        // 靜默失敗，不影響請求處理
      });
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
 * Simplified from 3-tier to 2-tier role system
 */
export function requireRole(requiredRole: Role) {
  return async (c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> => {
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    // admin 有所有權限
    if (user.role === ROLES.ADMIN) {
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
export function requireRoleLevel(requiredRole: Role) {
  return async (c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> => {
    // Check for both 'user' and 'agent' in context (different auth middlewares use different keys)
    const user = c.get('user');
    const agent = c.get('agent');
    const actualUser = user || agent;

    log.debug('Role level check', {
      hasUser: !!user,
      hasAgent: !!agent,
      actualUser: actualUser ? { id: actualUser.id, role: actualUser.role, email: actualUser.email } : null,
      requiredRole
    });

    if (!actualUser) {
      log.warn('No user found in context');
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
    log.debug('Authority check result', {
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
  return requireRoleLevel(ROLES.ADMIN);
}

/**
 * 僅管理員權限中間件
 */
export function requireAdmin() {
  return requireRoleLevel(ROLES.ADMIN);
}

/**
 * 團隊權限中間件
 *
 * v2.0 MULTI-TEAM SUPPORT:
 * - 支援多團隊成員資格檢查
 * - 首先檢查主團隊 (agent_teams WHERE isPrimary=true)
 * - 如果不匹配，查詢 agent_teams 表檢查次要團隊成員資格
 * - Admin 用戶可以訪問所有團隊
 */
export function requireTeamAccess(teamIdParam: string = 'teamId') {
  return async (c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> => {
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    // admin 可以訪問所有團隊 (快速路徑)
    if (user.role === ROLES.ADMIN) {
      await next();
      return;
    }

    const teamId = parseInt(c.req.param(teamIdParam)!);

    if (isNaN(teamId)) {
      return c.json({ error: 'Invalid team ID' }, 400);
    }

    // v2.0: 使用 canAccessTeam() 支援多團隊檢查
    // 傳入 DB 以支援 agent_teams 表查詢
    const hasAccess = await canAccessTeam(user, teamId, c.env.DB);

    if (!hasAccess) {
      log.debug('Team access denied', {
        userId: user.id,
        userPrimaryTeam: user.primaryTeamId,
        requestedTeam: teamId
      });
      return c.json({
        error: 'Access denied to this team',
        userTeam: user.primaryTeamId,
        requestedTeam: teamId
      }, 403);
    }

    await next();
  };
}

// ============================================================================
// Phase 2: Team Role-Based Access Control Middleware
// ============================================================================

/**
 * 團隊角色權限中間件
 *
 * 檢查用戶在指定團隊中是否有足夠的角色權限。
 * 必須在 jwtAuth 之後使用。
 *
 * @param requiredRole 所需的最低團隊角色 ('member' | 'lead' | 'supervisor')
 * @param teamIdParam URL 參數名稱，用於提取團隊 ID (默認 'id')
 *
 * @example
 * // 需要 lead 或更高角色才能訪問
 * app.put('/:id/members/:agentId', jwtAuth, requireTeamRole('lead'), async (c) => {...})
 *
 * // 需要 supervisor 角色才能修改團隊設定
 * app.put('/:teamId', jwtAuth, requireTeamRole('supervisor', 'teamId'), async (c) => {...})
 */
export function requireTeamRole(requiredRole: TeamRoleInTeam, teamIdParam: string = 'id') {
  return async (c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> => {
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    // Admin bypasses all team role checks
    if (user.role === ROLES.ADMIN) {
      await next();
      return;
    }

    const teamId = parseInt(c.req.param(teamIdParam)!);

    if (isNaN(teamId)) {
      return c.json({ error: 'Invalid team ID' }, 400);
    }

    // Check if user has the required role in the team
    const hasRequiredRole = hasTeamRole(user, teamId, requiredRole);

    if (!hasRequiredRole) {
      const userRole = user.teamRoles?.[teamId] || 'none';
      log.debug('Team role check failed', {
        userId: user.id,
        teamId,
        userRole,
        requiredRole
      });

      return c.json({
        error: 'Insufficient team permissions',
        message: `This operation requires ${requiredRole} role or higher in the team`,
        details: {
          teamId,
          requiredRole,
          currentRole: userRole
        }
      }, 403);
    }

    await next();
  };
}

/**
 * 團隊操作權限中間件
 *
 * 基於操作類型檢查權限，使用預定義的權限矩陣。
 *
 * @param operation 要執行的操作 (來自 TEAM_PERMISSIONS)
 * @param teamIdParam URL 參數名稱
 *
 * @example
 * app.post('/:id/members', jwtAuth, requireTeamPermission('ADD_MEMBER'), async (c) => {...})
 */
export function requireTeamPermission(
  operation: keyof typeof TEAM_PERMISSIONS,
  teamIdParam: string = 'id'
) {
  const requiredRole = TEAM_PERMISSIONS[operation];
  return requireTeamRole(requiredRole, teamIdParam);
}

/**
 * 可選認證中間件（不強制要求認證）
 */
export async function optionalAuth(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const cookies = parseCookieHeader(c.req.header('Cookie'));
    const token = cookies[AUTH_COOKIE_NAMES.access];
    
    if (
      token &&
      (
        !UNSAFE_METHODS.has(c.req.method.toUpperCase()) ||
        csrfMatches(cookies, c.req.header('X-CSRF-Token'))
      )
    ) {
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
      console.error('[apiKeyAuth] API_KEY environment variable not configured');
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
