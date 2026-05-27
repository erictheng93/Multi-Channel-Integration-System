/**
 * Password hashing and verification utilities
 *
 * Supports multiple hash formats:
 * - bcrypt ($2a$, $2b$, $2x$, $2y$ prefixes)
 * - PBKDF2 (pbkdf2: prefix, from Web Installer MigrationRunner)
 * - SHA256 (sha256$ prefix or raw 64-char hex) — DEPRECATED, see F3 below
 *
 * F3 mitigation: unsalted single-iteration SHA-256 is trivially crackable.
 * We keep the verification path for backward compatibility but (a) compare
 * in constant time and (b) callers should auto-upgrade matched legacy hashes
 * to bcrypt on next login using `isLegacySha256Hash` + `hashPassword`.
 *
 * CRITICAL: There is a dual verifyPassword in src/modules/auth/services/auth.ts
 * that must stay in sync with this one. Any logic changes here must be mirrored there.
 */

// 密碼哈希 - 統一使用 bcrypt
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.hash(password, 12);
}

/**
 * Constant-time string equality. Both inputs must be the same length to
 * avoid leaking length via early return; we length-check up front, then
 * accumulate XOR diffs over the full length so timing depends only on the
 * common length, not the position of the first mismatch.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Returns true if `hash` is an unsalted SHA-256 hash (either the `sha256$`
 * prefixed form or a bare 64-char hex string). Callers should use this after
 * a successful verifyPassword to detect accounts that need upgrade to bcrypt.
 */
export function isLegacySha256Hash(hash: string): boolean {
  if (hash.startsWith('sha256$')) return true;
  if (hash.length === 64 && /^[a-f0-9]+$/.test(hash)) return true;
  return false;
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
  // F3: constant-time compare; legacy hash is kept verifiable but
  // authenticateUser auto-upgrades the row to bcrypt on success.
  if (hash.startsWith('sha256$')) {
    const actualHash = hash.substring(7); // 移除 'sha256$' 前綴
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const passwordHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return constantTimeEqual(passwordHash, actualHash);
  }

  // 檢查純SHA256 hash (舊格式) — same constant-time treatment
  if (hash.length === 64 && /^[a-f0-9]+$/.test(hash)) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const passwordHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return constantTimeEqual(passwordHash, hash);
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
