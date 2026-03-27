import { eq, and } from 'drizzle-orm';
import { createDbClient } from '../db/drizzle-factory';
import { agents, teams, agentTeams } from '../db/schema';
import { convertAgent } from './drizzle-converters';
import type { DbUser, JWTPayload, TeamRoleInTeam } from '../types';
import { nowISO, nowMs } from '@/utils/timestamp'

/**
 * JWT 認證工具函數
 */

/**
 * UTF-8 安全的 Base64 URL 編碼
 * 使用 TextEncoder 支持所有 Unicode 字符（包括中文、emoji 等）
 * 符合 RFC 7519 (JWT) 標準
 */
function base64UrlEncode(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  // 將 Uint8Array 轉為二進制字符串
  const binaryString = String.fromCharCode(...data);
  // Base64 編碼並轉換為 URL 安全格式
  return btoa(binaryString)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * UTF-8 安全的 Base64 URL 解碼
 * 使用 TextDecoder 支持所有 Unicode 字符
 */
function base64UrlDecode(str: string): string {
  // 將 URL 安全格式轉回標準 Base64
  const base64 = str
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(str.length + (4 - str.length % 4) % 4, '=');

  // Base64 解碼為二進制字符串
  const binaryString = atob(base64);

  // 轉為 Uint8Array
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // UTF-8 解碼
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

// JWT 簽名和驗證
export async function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>, secret: string, expiresIn: number = 24 * 60 * 60): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn
  };

  // 使用 UTF-8 安全的編碼函數
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(jwtPayload));

  const data = `${headerB64}.${payloadB64}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));

  // 使用安全的二進制數據編碼
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${data}.${signatureB64}`;
}

export async function verifyJWT(token: string, secret: string): Promise<JWTPayload> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    if (!headerB64 || !payloadB64 || !signatureB64) {
      throw new Error('Invalid JWT format - missing parts');
    }

    // 驗證簽名
    const encoder = new TextEncoder();
    const data = `${headerB64}.${payloadB64}`;
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // 解碼簽名（二進制數據）
    const signatureBase64 = signatureB64
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(signatureB64.length + (4 - signatureB64.length % 4) % 4, '=');
    const signature = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));

    const isValid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(data));
    if (!isValid) {
      throw new Error('Invalid JWT signature');
    }

    // 使用 UTF-8 安全的解碼函數解析 payload
    const payload = JSON.parse(base64UrlDecode(payloadB64));

    // 檢查過期時間
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error('JWT token expired');
    }

    return payload;
  } catch (error) {
    throw new Error(`JWT verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// 密碼哈希 - 統一使用 bcrypt
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // 檢查是否為 bcrypt 哈希 (以 $2a$, $2b$, $2x$, $2y$ 開頭)
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2x$') || hash.startsWith('$2y$')) {
    // 使用 bcrypt 驗證
    try {
      // 在 Cloudflare Workers 中，我們需要使用動態導入
      const bcrypt = await import('bcryptjs');
      return await bcrypt.compare(password, hash);
    } catch (error) {
      console.error('Bcrypt verification error:', error);
      return false;
    }
  }

  // 處理 PBKDF2 哈希 (Web Installer MigrationRunner 產生的格式)
  if (hash.startsWith('pbkdf2:')) {
    try {
      const base64Data = hash.substring(7); // 移除 'pbkdf2:' 前綴
      // 解碼 base64 → Uint8Array (salt 16 bytes + hash 32 bytes)
      const binaryString = atob(base64Data);
      const combined = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        combined[i] = binaryString.charCodeAt(i);
      }

      // 提取 salt (前16字節) 和 storedHash (後32字節)
      const salt = combined.slice(0, 16);
      const storedHash = combined.slice(16);

      // 使用相同參數重新派生: PBKDF2-SHA256, 100000 iterations, 256 bits
      const encoder = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
      );

      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        256
      );

      // 逐字節比較派生的哈希與存儲的哈希
      const derivedHash = new Uint8Array(derivedBits);
      if (derivedHash.length !== storedHash.length) return false;
      let match = true;
      for (let i = 0; i < derivedHash.length; i++) {
        if (derivedHash[i] !== storedHash[i]) match = false; // constant-time-ish comparison
      }
      return match;
    } catch (error) {
      console.error('PBKDF2 verification error:', error);
      return false;
    }
  }

  // 處理舊格式的hash (如SHA256) - 先檢查是否為SHA256格式
  if (hash.startsWith('sha256$')) {
    const actualHash = hash.substring(7); // 移除 'sha256$' 前綴
    // 對於舊的 SHA256 哈希，我們需要使用舊的方法驗證
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const passwordHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return passwordHash === actualHash;
  }

  // 檢查純SHA256 hash (舊格式)
  if (hash.length === 64 && /^[a-f0-9]+$/.test(hash)) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const passwordHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return passwordHash === hash;
  }

  // 如果都不匹配，嘗試 bcrypt（可能是新格式但沒有正確前綴）
  try {
    const bcrypt = await import('bcryptjs');
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error('Password verification failed for hash:', hash.substring(0, 10) + '...');
    return false;
  }
}

// 生成隨機字符串 - 使用加密安全的隨機數生成器 (CSPRNG)
export function generateRandomString(length: number = 32): string {
  // 使用 crypto.getRandomValues() 生成加密安全的隨機字節
  // 每個字符需要 ~6 bits (log2(62) ≈ 5.95)，但我們使用字節 (8 bits) 來確保均勻分布
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charsLength = chars.length; // 62

  // 生成足夠的隨機字節（每個字符至少需要 1 字節）
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);

  let result = '';
  for (let i = 0; i < length; i++) {
    // 使用模運算將字節映射到字符集，確保均勻分布
    result += chars.charAt(randomBytes[i] % charsLength);
  }

  return result;
}

// 用戶認證相關的資料庫操作
export async function createUser(
  db: D1Database,
  userData: {
    email: string;
    password: string;
    displayName: string;
    role: 'admin' | 'agent'; // 2-tier role system
    teamId?: number;
  }
): Promise<DbUser> {
  const hashedPassword = await hashPassword(userData.password);
  const now = nowISO();
  const userId = crypto.randomUUID();
  const drizzleDb = createDbClient(db);

  await drizzleDb
    .insert(agents)
    .values({
      id: userId,
      email: userData.email,
      passwordHash: hashedPassword,
      displayName: userData.displayName,
      role: userData.role,
      createdAt: now,
      updatedAt: now
    });

  // If teamId provided, create agent_teams membership (isPrimary=true)
  if (userData.teamId) {
    await drizzleDb.insert(agentTeams).values({
      agentId: userId,
      teamId: userData.teamId,
      roleInTeam: 'member',
      isPrimary: true,
      joinedAt: now
    });
  }

  // Fetch the created user
  const createdUser = await drizzleDb
    .select()
    .from(agents)
    .where(eq(agents.id, userId))
    .get();
  
  if (!createdUser) {
    throw new Error('Failed to retrieve created user');
  }
  
  return getUserById(db, createdUser.id);
}

export async function getUserById(db: D1Database, userId: number | string): Promise<DbUser> {
  const drizzleDb = createDbClient(db);
  const userIdStr = userId.toString();

  // Query 1: 檢查 agents 表 (with primary team via agent_teams)
  const agent = await drizzleDb
    .select({
      id: agents.id,
      email: agents.email,
      display_name: agents.displayName,
      role: agents.role,
      team_id: agentTeams.teamId,
      team_name: teams.name,
      is_active: agents.isActive,
      created_at: agents.createdAt,
      updated_at: agents.updatedAt
    })
    .from(agents)
    .leftJoin(agentTeams, and(eq(agentTeams.agentId, agents.id), eq(agentTeams.isPrimary, true)))
    .leftJoin(teams, eq(agentTeams.teamId, teams.id))
    .where(and(
      eq(agents.id, userIdStr),
      eq(agents.isActive, true)
    ))
    .get();

  if (!agent) {
    throw new Error('User not found');
  }

  // Query 2: 獲取所有團隊成員資格 (agent_teams is single source of truth)
  const teamMemberships = await drizzleDb
    .select({
      teamId: agentTeams.teamId,
      roleInTeam: agentTeams.roleInTeam
    })
    .from(agentTeams)
    .where(eq(agentTeams.agentId, userIdStr))
    .all();

  // 構建 allowedTeamIds 和 teamRoles (exclusively from agent_teams)
  const allowedTeamIds: number[] = [];
  const teamRoles: Record<number, TeamRoleInTeam> = {};

  for (const membership of teamMemberships) {
    allowedTeamIds.push(membership.teamId);
    teamRoles[membership.teamId] = (membership.roleInTeam as TeamRoleInTeam) || 'member';
  }

  // 構建並返回增強的 DbUser
  const baseUser = convertAgent({
    id: agent.id,
    email: agent.email,
    displayName: agent.display_name,
    role: agent.role,
    isActive: Boolean(agent.is_active),
    lastActive: null,
    createdAt: agent.created_at,
    updatedAt: agent.updated_at,
    deletedAt: null,
    passwordHash: '', // Not needed for return
    passwordPolicy: 'changeable',
    lastLoginAt: null
  } as any, agent.team_name || undefined, agent.team_id);

  // 返回帶有多團隊資料的 DbUser
  return {
    ...baseUser,
    allowedTeamIds,
    teamRoles
  };
}

// getUserByUsername function removed - using email for authentication instead

// 優化：單次查詢完整認證（使用原始SQL避免Drizzle問題）
// FIX: 現在也查詢 agent_teams 以填充 allowedTeamIds 和 teamRoles
export async function authenticateUser(
  db: D1Database,
  email: string,
  password: string
): Promise<{ user: DbUser | null; passwordPolicy?: string; accountStatus?: string }> {

  // 使用原始SQL查詢避免Drizzle ORM問題
  const query = `
    SELECT id, email, password_hash, display_name, role,
           is_active, password_policy, created_at, updated_at
    FROM agents
    WHERE email = ?
  `;

  const result = await db.prepare(query).bind(email).first();
  const user = result as any;

  // 用戶不存在
  if (!user) {
    return { user: null, accountStatus: 'not_found' };
  }

  // 帳戶未激活
  if (!user.is_active) {
    return { user: null, accountStatus: 'disabled', passwordPolicy: user.password_policy || 'changeable' };
  }

  // 驗證密碼
  const isValidPassword = await verifyPassword(password, user.password_hash);
  if (!isValidPassword) {
    return { user: null, accountStatus: 'wrong_password', passwordPolicy: user.password_policy || 'changeable' };
  }

  // Query agent_teams for multi-team membership (single source of truth)
  const teamMembershipsQuery = `
    SELECT team_id, role_in_team, is_primary
    FROM agent_teams
    WHERE agent_id = ?
  `;
  const teamMembershipsResult = await db.prepare(teamMembershipsQuery).bind(user.id).all();
  const teamMemberships = (teamMembershipsResult.results || []) as Array<{ team_id: number; role_in_team: string; is_primary: number }>;

  // Build allowedTeamIds and teamRoles exclusively from agent_teams
  const allowedTeamIds: number[] = [];
  const teamRoles: Record<number, TeamRoleInTeam> = {};
  let primaryTeamId: number | null = null;

  for (const membership of teamMemberships) {
    allowedTeamIds.push(membership.team_id);
    teamRoles[membership.team_id] = (membership.role_in_team as TeamRoleInTeam) || 'member';
    if (membership.is_primary) {
      primaryTeamId = membership.team_id;
    }
  }

  // 認證成功，返回用戶資訊（agent_teams 為唯一來源）
  const authenticatedUser = convertAgent({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
    isActive: Boolean(user.is_active),
    lastActive: null,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    deletedAt: null,
    passwordHash: '', // Not needed for return
    passwordPolicy: user.password_policy || 'changeable',
    lastLoginAt: null
  } as any, undefined, primaryTeamId);

  return {
    user: {
      ...authenticatedUser,
      allowedTeamIds,
      teamRoles
    },
    passwordPolicy: user.password_policy || 'changeable',
    accountStatus: 'success'
  };
}

// 重構：使用優化後的 authenticateUser 函數（向後兼容）
export async function authenticateUserByEmail(
  db: D1Database,
  email: string,
  password: string
): Promise<DbUser | null> {
  const result = await authenticateUser(db, email, password);
  return result.user;
}

// 權限檢查 (2-tier role system: admin/agent)
export function hasPermission(user: DbUser, requiredRole: 'admin' | 'agent'): boolean {
  if (user.role === 'admin') {
    return true; // admin 有所有權限
  }

  return user.role === requiredRole;
}

/**
 * 檢查用戶是否可以訪問指定團隊
 *
 * v3.0 OPTIMIZED MULTI-TEAM SUPPORT (Phase 1):
 * - Priority 1: Admin 用戶可以訪問所有團隊 (instant)
 * - Priority 2: 檢查緩存的 allowedTeamIds (instant, no DB query)
 * - Priority 3: 檢查主團隊 teamId (backward compat)
 * - Priority 4: 回退到 DB 查詢 (僅用於舊 token)
 *
 * @param user 當前用戶 (應包含 allowedTeamIds 從 getUserById)
 * @param teamId 要檢查的團隊 ID
 * @param db 可選的 D1 資料庫實例 (僅用於回退查詢)
 * @returns 是否有權限訪問該團隊
 */
export async function canAccessTeam(
  user: DbUser,
  teamId: number,
  db?: D1Database
): Promise<boolean> {
  // Priority 1: Admin 可以訪問所有團隊
  if (user.role === 'admin') {
    return true;
  }

  // Priority 2:  OPTIMIZED - 使用緩存的 allowedTeamIds (無 DB 查詢)
  if (user.allowedTeamIds && user.allowedTeamIds.length > 0) {
    return user.allowedTeamIds.includes(teamId);
  }

  // Priority 3: 回退到 DB 查詢 (僅用於沒有 allowedTeamIds 的舊 token)
  if (!db) {
    return false;
  }

  // 查詢 agent_teams 表檢查次要團隊成員資格
  try {
    const drizzleDb = createDbClient(db);
    const membership = await drizzleDb
      .select({ id: agentTeams.id })
      .from(agentTeams)
      .where(and(
        eq(agentTeams.agentId, String(user.id)),
        eq(agentTeams.teamId, teamId)
      ))
      .get();

    return membership !== undefined;
  } catch (error) {
    console.error('[canAccessTeam] Fallback DB query failed:', error);
    return false;
  }
}

/**
 * 獲取用戶在指定團隊中的角色
 *
 * @param user 當前用戶 (應包含 teamRoles 從 getUserById)
 * @param teamId 要查詢的團隊 ID
 * @returns 團隊角色，如果用戶不是該團隊成員則返回 undefined
 */
export function getUserTeamRole(user: DbUser, teamId: number): TeamRoleInTeam | undefined {
  if (!user.teamRoles) {
    return undefined;
  }
  return user.teamRoles[teamId];
}

// ============================================================================
// Phase 2: Team RBAC (Role-Based Access Control)
// ============================================================================

/**
 * Team role hierarchy (higher number = more permissions)
 * - member: 1 (基本成員，只能查看)
 * - lead: 2 (組長，可以管理成員)
 * - supervisor: 3 (主管，可以管理團隊設定)
 */
export const TEAM_ROLE_HIERARCHY: Record<TeamRoleInTeam, number> = {
  'member': 1,
  'lead': 2,
  'supervisor': 3
};

/**
 * 檢查用戶在團隊中是否有足夠的角色權限
 *
 * @param user 當前用戶
 * @param teamId 團隊 ID
 * @param requiredRole 所需的最低角色
 * @returns true 如果用戶有足夠權限
 *
 * @example
 * // 檢查用戶是否是 lead 或更高
 * hasTeamRole(user, 1, 'lead') // true if user is lead or supervisor
 */
export function hasTeamRole(
  user: DbUser,
  teamId: number,
  requiredRole: TeamRoleInTeam
): boolean {
  // Admin bypasses all team role checks
  if (user.role === 'admin') {
    return true;
  }

  const userRole = getUserTeamRole(user, teamId);
  if (!userRole) {
    return false;
  }

  const userLevel = TEAM_ROLE_HIERARCHY[userRole];
  const requiredLevel = TEAM_ROLE_HIERARCHY[requiredRole];

  return userLevel >= requiredLevel;
}

/**
 * 團隊操作權限矩陣
 *
 * 定義不同操作所需的最低團隊角色
 */
export const TEAM_PERMISSIONS = {
  // 查看操作 - member 即可
  VIEW_TEAM: 'member' as TeamRoleInTeam,
  VIEW_MEMBERS: 'member' as TeamRoleInTeam,
  VIEW_STATS: 'member' as TeamRoleInTeam,

  // 成員管理 - lead 或以上
  ADD_MEMBER: 'lead' as TeamRoleInTeam,
  UPDATE_MEMBER: 'lead' as TeamRoleInTeam,
  REMOVE_MEMBER: 'lead' as TeamRoleInTeam,

  // 團隊設定 - supervisor 或以上
  UPDATE_TEAM: 'supervisor' as TeamRoleInTeam,
  DELETE_TEAM: 'supervisor' as TeamRoleInTeam,
  MANAGE_QR_CODES: 'supervisor' as TeamRoleInTeam,
  TRANSFER_MEMBERS: 'supervisor' as TeamRoleInTeam
} as const;

/**
 * 檢查用戶是否有執行特定團隊操作的權限
 *
 * @param user 當前用戶
 * @param teamId 團隊 ID
 * @param operation 要執行的操作
 * @returns true 如果有權限
 *
 * @example
 * canPerformTeamOperation(user, 1, 'ADD_MEMBER')
 */
export function canPerformTeamOperation(
  user: DbUser,
  teamId: number,
  operation: keyof typeof TEAM_PERMISSIONS
): boolean {
  const requiredRole = TEAM_PERMISSIONS[operation];
  return hasTeamRole(user, teamId, requiredRole);
}

// 會話管理
export async function createSession(
  kv: KVNamespace,
  userId: string | number,
  sessionData: Record<string, unknown>,
  expirationTtl: number = 24 * 60 * 60 // 24 小時
): Promise<string> {
  const sessionId = generateRandomString(32);
  const sessionKey = `session:${sessionId}`;

  await kv.put(sessionKey, JSON.stringify({
    userId,
    ...sessionData,
    createdAt: nowISO()
  }), { expirationTtl });

  return sessionId;
}

// Phase 2 監控系統 JWT 令牌管理
export async function generateSystemToken(
  userId: string,
  role: 'admin' | 'agent',
  displayName: string,
  teamId: number,
  secret: string,
  expiresIn: number = 3600 // 1 小時默認
): Promise<string> {
  const payload = {
    userId,
    username: userId, // Use userId as username for system tokens
    displayName,
    role,
    primaryTeamId: teamId
  };

  return await signJWT(payload, secret, expiresIn);
}

// 生成長期監控系統令牌 (用於內部 API 調用)
export async function generateMonitoringToken(
  secret: string,
  _expiresIn: number = 7 * 24 * 60 * 60 // 7 天
): Promise<string> {
  const payload = {
    userId: 'system-monitoring',
    username: 'system-monitoring',
    displayName: 'System Monitoring',
    role: 'admin' as const,
    primaryTeamId: 1,
    isSystemToken: true
  };

  return await signJWT(payload, secret, _expiresIn);
}

// 批量令牌生成（用於測試和部署）
export async function generateTokenBatch(
  users: Array<{
    userId: string;
    role: 'admin' | 'agent';
    displayName: string;
    primaryTeamId?: number;
  }>,
  secret: string,
  expiresIn: number = 3600
): Promise<Array<{ userId: string; token: string; expiresAt: string }>> {
  const tokens = [];

  for (const user of users) {
    const token = await generateSystemToken(
      user.userId,
      user.role,
      user.displayName,
      user.primaryTeamId || 0,
      secret,
      expiresIn
    );

    tokens.push({
      userId: user.userId,
      token,
      expiresAt: new Date((Math.floor(Date.now() / 1000) + expiresIn) * 1000).toISOString()
    });
  }

  return tokens;
}

export async function getSession(kv: KVNamespace, sessionId: string): Promise<Record<string, unknown> | null> {
  const sessionKey = `session:${sessionId}`;
  const sessionData = await kv.get(sessionKey);

  if (!sessionData) {
    return null;
  }

  try {
    return JSON.parse(sessionData);
  } catch (error) {
    console.error('Failed to parse session data:', error);
    return null;
  }
}

export async function deleteSession(kv: KVNamespace, sessionId: string): Promise<void> {
  const sessionKey = `session:${sessionId}`;
  await kv.delete(sessionKey);
}

/**
 * In-memory cache for last activity tracking
 *
 * V3.0 OPTIMIZATION: Zero KV writes
 * - Worker-scoped Map for debouncing
 * - Survives for Worker lifecycle (typically hours)
 * - Cleared on Worker restart (acceptable for non-critical tracking)
 *
 * Memory footprint: ~16 bytes per user
 * - 10,000 users = ~160 KB (negligible)
 */
const lastActivityCache = new Map<string, number>();

/**
 * Update user's lastActive timestamp with debouncing
 *
 * OPTIMIZED v3.0: Zero KV writes/reads (Pure in-memory debouncing)
 * - Uses Worker-scoped Map instead of KV for debouncing
 * - Only updates D1 if > 15 minutes since last update
 * - Prevents excessive D1 writes on every API request
 * - 100% reduction in KV operations
 *
 * Performance Impact:
 * - Before (v2.0): KV reads: 2,400/day, KV writes: 960/day, D1 writes: 960/day
 * - After (v3.0):  KV reads: 0/day, KV writes: 0/day, D1 writes: 960/day
 * - KV cost savings: 100% (freed up 960/1000 daily write quota)
 *
 * Trade-offs:
 * -  Zero KV operations (100% quota savings)
 * -  Faster performance (no network calls)
 * -  Cache lost on Worker restart (acceptable for activity tracking)
 * -  Independent cache per Worker instance (acceptable for debouncing)
 *
 * @param userId User ID to update
 * @param db D1 database instance
 * @param _kv KV namespace (unused, kept for backward compatibility)
 * @param minInterval Minimum interval between updates in milliseconds (default: 15 minutes)
 */
export async function updateUserActivityDebounced(
  userId: string,
  db: D1Database,
  _kv: KVNamespace, // Unused - kept for backward compatibility
  minInterval: number = 15 * 60 * 1000 // 15 minutes
): Promise<boolean> {
  try {
    const now = nowMs();

    // Check in-memory cache (zero KV operations)
    const lastUpdate = lastActivityCache.get(userId);

    if (lastUpdate) {
      const timeSinceLastUpdate = now - lastUpdate;

      // Skip update if within debounce interval
      if (timeSinceLastUpdate < minInterval) {
        return false; // Skipped - too soon
      }
    }

    // Update D1 database
    const drizzleDb = createDbClient(db);
    await drizzleDb
      .update(agents)
      .set({ lastActive: nowISO() })
      .where(eq(agents.id, userId))
      .run();

    // Update in-memory cache (zero KV operations)
    lastActivityCache.set(userId, now);

    return true; // Updated successfully
  } catch (error) {
    console.error(`[Auth] Failed to update lastActive for user ${userId}:`, error);
    return false; // Failed - but non-blocking
  }
}

/**
 * Get in-memory cache statistics (for monitoring)
 *
 * @returns Cache size and estimated memory usage
 */
export function getActivityCacheStats(): {
  size: number;
  estimatedMemoryKB: number;
  entries: Array<{ userId: string; lastUpdate: number; ageMinutes: number }>;
} {
  const now = nowMs();
  const entries = Array.from(lastActivityCache.entries()).map(([userId, timestamp]) => ({
    userId,
    lastUpdate: timestamp,
    ageMinutes: Math.floor((now - timestamp) / (60 * 1000))
  }));

  return {
    size: lastActivityCache.size,
    estimatedMemoryKB: (lastActivityCache.size * 16) / 1024, // 16 bytes per entry
    entries: entries.sort((a, b) => b.lastUpdate - a.lastUpdate) // Most recent first
  };
}

/**
 * Clear activity cache (for testing or maintenance)
 */
export function clearActivityCache(): void {
  lastActivityCache.clear();
  console.log('[Auth] Activity cache cleared');
}