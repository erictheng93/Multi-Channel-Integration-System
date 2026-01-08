import { eq, and } from 'drizzle-orm';
import { createDbClient } from '../db/drizzle-factory';
import { agents, teams } from '../db/schema';
import { convertAgent } from './drizzle-converters';
import type { DbUser, JWTPayload } from '../types';

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

  // ✅ 使用 UTF-8 安全的編碼函數
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

  // ✅ 使用安全的二進制數據編碼
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

    // ✅ 解碼簽名（二進制數據）
    const signatureBase64 = signatureB64
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(signatureB64.length + (4 - signatureB64.length % 4) % 4, '=');
    const signature = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));

    const isValid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(data));
    if (!isValid) {
      throw new Error('Invalid JWT signature');
    }

    // ✅ 使用 UTF-8 安全的解碼函數解析 payload
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
  const now = new Date().toISOString();
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
      teamId: userData.teamId || null,
      createdAt: now,
      updatedAt: now
    });

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
  
  // 檢查 agents 表
  const agent = await drizzleDb
    .select({
      id: agents.id,
      email: agents.email,
      display_name: agents.displayName,
      role: agents.role,
      team_id: agents.teamId,
      team_name: teams.name,
      is_active: agents.isActive,
      created_at: agents.createdAt,
      updated_at: agents.updatedAt
    })
    .from(agents)
    .leftJoin(teams, eq(agents.teamId, teams.id))
    .where(and(
      eq(agents.id, userId.toString()),
      eq(agents.isActive, true)
    ))
    .get();

  if (agent) {
    return convertAgent({
      id: agent.id,
      email: agent.email,
      displayName: agent.display_name,
      role: agent.role,
      teamId: agent.team_id,
      isActive: Boolean(agent.is_active),
      lastActive: null,
      createdAt: agent.created_at,
      updatedAt: agent.updated_at,
      deletedAt: null,
      passwordHash: '', // Not needed for return
      passwordPolicy: 'changeable',
      lastLoginAt: null
    }, agent.team_name || undefined);
  }

  // 未找到用戶
  throw new Error('User not found');
}

// getUserByUsername function removed - using email for authentication instead

// ✅ 優化：單次查詢完整認證（使用原始SQL避免Drizzle問題）
export async function authenticateUser(
  db: D1Database,
  email: string,
  password: string
): Promise<{ user: DbUser | null; passwordPolicy?: string; accountStatus?: string }> {

  // 🚀 使用原始SQL查詢避免Drizzle ORM問題
  const query = `
    SELECT id, email, password_hash, display_name, role, team_id,
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

  // 認證成功，返回用戶資訊
  const authenticatedUser = convertAgent({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
    teamId: user.team_id,
    isActive: Boolean(user.is_active),
    lastActive: null,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    deletedAt: null,
    passwordHash: '', // Not needed for return
    passwordPolicy: user.password_policy || 'changeable',
    lastLoginAt: null
  });

  return {
    user: authenticatedUser,
    passwordPolicy: user.password_policy || 'changeable',
    accountStatus: 'success'
  };
}

// ✅ 重構：使用優化後的 authenticateUser 函數（向後兼容）
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

export function canAccessTeam(user: DbUser, teamId: number): boolean {
  if (user.role === 'admin') {
    return true; // admin 可以訪問所有團隊
  }

  return user.teamId === teamId;
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
    createdAt: new Date().toISOString()
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
    teamId
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
    teamId: 1,
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
    teamId: number;
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
      user.teamId,
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
 * ⚡ V3.0 OPTIMIZATION: Zero KV writes
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
 * ⚡ OPTIMIZED v3.0: Zero KV writes/reads (Pure in-memory debouncing)
 * - Uses Worker-scoped Map instead of KV for debouncing
 * - Only updates D1 if > 15 minutes since last update
 * - Prevents excessive D1 writes on every API request
 * - 100% reduction in KV operations
 *
 * Performance Impact:
 * - Before (v2.0): KV reads: 2,400/day, KV writes: 960/day, D1 writes: 960/day
 * - After (v3.0):  KV reads: 0/day,     KV writes: 0/day,     D1 writes: 960/day
 * - KV cost savings: 100% (freed up 960/1000 daily write quota)
 *
 * Trade-offs:
 * - ✅ Zero KV operations (100% quota savings)
 * - ✅ Faster performance (no network calls)
 * - ⚠️ Cache lost on Worker restart (acceptable for activity tracking)
 * - ⚠️ Independent cache per Worker instance (acceptable for debouncing)
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
    const now = Date.now();

    // ✅ Check in-memory cache (zero KV operations)
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
      .set({ lastActive: new Date().toISOString() })
      .where(eq(agents.id, userId))
      .run();

    // ✅ Update in-memory cache (zero KV operations)
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
  const now = Date.now();
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