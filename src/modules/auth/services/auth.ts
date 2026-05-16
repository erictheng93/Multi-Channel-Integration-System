import { eq, and } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { agents, teams, agentTeams } from '@/db/schema';
import type { TeamRoleInTeam } from '@/types';
import { convertAgent } from '@/utils/drizzle-converters';
import type { JWTPayload } from '@/types';
import type { DbUser } from '@/types';
import { nowISO } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('AuthService')

type AgentRow = typeof agents.$inferSelect;

interface AuthSqlUser {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  role: string;
  is_active: number | boolean | null;
  password_policy?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

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
      log.error('Bcrypt verification error', {}, error as Error);
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
      log.error('PBKDF2 verification error', {}, error as Error);
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
    log.error('Password verification failed', { hashPrefix: hash.substring(0, 10) });
    return false;
  }
}

// 生成隨機字符串
export function generateRandomString(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 用戶認證相關的資料庫操作
// Simplified from 3-tier to 2-tier role system
export async function createUser(
  db: D1Database,
  userData: {
    email: string;
    password: string;
    displayName: string;
    role: 'admin' | 'agent';
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
  
  // 檢查 agents 表 (with primary team via agent_teams)
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
      eq(agents.id, userId.toString()),
      eq(agents.isActive, true)
    ))
    .get();

  if (!agent) {
    throw new Error('User not found');
  }

  // Query agent_teams for multi-team support
  const teamMemberships = await drizzleDb
    .select({ teamId: agentTeams.teamId, roleInTeam: agentTeams.roleInTeam })
    .from(agentTeams)
    .where(eq(agentTeams.agentId, userId.toString()));

  const allowedTeamIds: number[] = teamMemberships.map(m => m.teamId);
  const teamRoles: Record<number, TeamRoleInTeam> = {};
  for (const membership of teamMemberships) {
    teamRoles[membership.teamId] = (membership.roleInTeam as TeamRoleInTeam) || 'member';
  }

  const agentRow: AgentRow = {
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
  };
  const baseUser = convertAgent(agentRow, agent.team_name || undefined, agent.team_id);

  return {
    ...baseUser,
    allowedTeamIds,
    teamRoles
  };
}

// getUserByUsername function removed - using email for authentication instead

// 優化：單次查詢完整認證（使用原始SQL避免Drizzle問題）
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

  const user = await db.prepare(query).bind(email).first<AuthSqlUser>();

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

  // Query agent_teams for primary team and multi-team membership
  const teamMembershipsQuery = `
    SELECT team_id, role_in_team, is_primary
    FROM agent_teams
    WHERE agent_id = ?
  `;
  const teamMembershipsResult = await db.prepare(teamMembershipsQuery).bind(user.id).all();
  const teamMemberships = (teamMembershipsResult.results || []) as Array<{ team_id: number; role_in_team: string; is_primary: number }>;

  const allowedTeamIds: number[] = [];
  const teamRoles: Record<number, TeamRoleInTeam> = {};
  let primaryTeamId: number | null = null;

  for (const membership of teamMemberships) {
    allowedTeamIds.push(membership.team_id);
    teamRoles[membership.team_id] = (membership.role_in_team || 'member') as TeamRoleInTeam;
    if (membership.is_primary) {
      primaryTeamId = membership.team_id;
    }
  }

  // 認證成功，返回用戶資訊（agent_teams 為唯一來源）
  const authenticatedAgent: AgentRow = {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
    isActive: Boolean(user.is_active),
    lastActive: null,
    createdAt: user.created_at ?? null,
    updatedAt: user.updated_at ?? null,
    deletedAt: null,
    passwordHash: '', // Not needed for return
    passwordPolicy: user.password_policy || 'changeable',
    lastLoginAt: null
  };
  const authenticatedUser = convertAgent(authenticatedAgent, undefined, primaryTeamId);

  return {
    user: {
      ...authenticatedUser,
      allowedTeamIds,
      teamRoles: teamRoles as Record<number, import('@/types').TeamRoleInTeam>
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

// 權限檢查
// Simplified from 3-tier to 2-tier role system
export function hasPermission(user: DbUser, requiredRole: 'admin' | 'agent'): boolean {
  if (user.role === 'admin') {
    return true; // admin 有所有權限
  }

  return user.role === requiredRole;
}

/**
 * 檢查用戶是否可以訪問指定團隊
 *
 * v2.0 MULTI-TEAM SUPPORT:
 * - 首先檢查 allowedTeamIds (from agent_teams)
 * - 如果不匹配，查詢 agent_teams 表檢查次要團隊成員資格
 * - Admin 用戶可以訪問所有團隊
 *
 * @param user 當前用戶
 * @param teamId 要檢查的團隊 ID
 * @param db 可選的 D1 資料庫實例 (用於查詢 agent_teams)
 * @returns 是否有權限訪問該團隊
 */
export async function canAccessTeam(
  user: DbUser,
  teamId: number,
  db?: D1Database
): Promise<boolean> {
  // Admin 可以訪問所有團隊
  if (user.role === 'admin') {
    return true;
  }

  // Check allowedTeamIds (cached from agent_teams — no DB query needed)
  if (user.allowedTeamIds && user.allowedTeamIds.length > 0) {
    return user.allowedTeamIds.includes(teamId);
  }

  // Check primaryTeamId as fallback
  if (user.primaryTeamId === teamId) {
    return true;
  }

  // 如果沒有提供 DB，無法查詢次要團隊，返回 false
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
    log.error('Failed to check team membership', {}, error as Error);
    return false;
  }
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
    log.error('Failed to parse session data', {}, error as Error);
    return null;
  }
}

export async function deleteSession(kv: KVNamespace, sessionId: string): Promise<void> {
  const sessionKey = `session:${sessionId}`;
  await kv.delete(sessionKey);
}
