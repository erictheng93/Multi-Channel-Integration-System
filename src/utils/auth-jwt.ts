/**
 * JWT token creation, verification, and generation utilities
 *
 * Includes:
 * - Base64 URL encoding/decoding (UTF-8 safe)
 * - JWT signing and verification (HS256)
 * - System/monitoring token generation
 * - Batch token generation
 * - Cryptographic random string generation
 */

import type { JWTPayload } from '../types';

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
