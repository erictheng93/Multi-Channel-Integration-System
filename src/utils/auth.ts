import { eq, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { agents, teams } from '../db/schema';
import { convertAgent } from './drizzle-converters';
import type { DbUser, JWTPayload } from '../types';

/**
 * JWT 認證工具函數
 */

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

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(jwtPayload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const data = `${headerB64}.${payloadB64}`;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
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

    const signature = Uint8Array.from(
      atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/').padEnd(signatureB64.length + (4 - signatureB64.length % 4) % 4, '=')),
      c => c.charCodeAt(0)
    );

    const isValid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(data));
    if (!isValid) {
      throw new Error('Invalid JWT signature');
    }

    // 解析 payload
    const payload = JSON.parse(
      atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/').padEnd(payloadB64.length + (4 - payloadB64.length % 4) % 4, '='))
    );

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
export async function createUser(
  db: D1Database,
  userData: {
    email: string;
    password: string;
    displayName: string;
    role: 'admin' | 'team' | 'agent';
    teamId?: number;
  }
): Promise<DbUser> {
  const hashedPassword = await hashPassword(userData.password);
  const now = new Date().toISOString();
  const userId = crypto.randomUUID();
  const drizzleDb = drizzle(db);

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
  const drizzleDb = drizzle(db);
  
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
      createdAt: agent.created_at,
      updatedAt: agent.updated_at,
      passwordHash: '', // Not needed for return
      passwordPolicy: 'changeable',
      lastLoginAt: null
    }, agent.team_name || undefined);
  }

  // 未找到用戶
  throw new Error('User not found');
}

// getUserByUsername function removed - using email for authentication instead

export async function authenticateUser(
  db: D1Database,
  email: string,
  password: string
): Promise<DbUser | null> {
  const drizzleDb = drizzle(db);
  
  const user = await drizzleDb
    .select({
      id: agents.id,
      email: agents.email,
      password_hash: agents.passwordHash,
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
      eq(agents.email, email),
      eq(agents.isActive, true)
    ))
    .get();

  if (!user) {
    return null;
  }

  const isValidPassword = await verifyPassword(password, user.password_hash);
  if (!isValidPassword) {
    return null;
  }

  return convertAgent({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
    teamId: user.team_id,
    isActive: Boolean(user.is_active),
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    passwordHash: '', // Not needed for return
    passwordPolicy: 'changeable',
    lastLoginAt: null
  }, user.team_name || undefined);
}

export async function authenticateUserByEmail(
  db: D1Database,
  email: string,
  password: string
): Promise<DbUser | null> {
  const drizzleDb = drizzle(db);
  
  // 檢查 agents 表
  const agent = await drizzleDb
    .select({
      id: agents.id,
      email: agents.email,
      password_hash: agents.passwordHash,
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
      eq(agents.email, email),
      eq(agents.isActive, true)
    ))
    .get();

  if (agent) {
    const isValidPassword = await verifyPassword(password, agent.password_hash);
    if (isValidPassword) {
      return convertAgent({
        id: agent.id,
        email: agent.email,
        displayName: agent.display_name,
        role: agent.role,
        teamId: agent.team_id,
        isActive: Boolean(agent.is_active),
        createdAt: agent.created_at,
        updatedAt: agent.updated_at,
        passwordHash: '', // Not needed for return
        passwordPolicy: 'changeable',
        lastLoginAt: null
      }, agent.team_name || undefined);
    }
  }

  // 未找到用戶
  return null;
}

// 權限檢查
export function hasPermission(user: DbUser, requiredRole: 'admin' | 'team' | 'agent'): boolean {
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