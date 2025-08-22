// 密碼加密解密工具
// 使用 AES-256-GCM 加密算法

const algorithm = 'AES-GCM';

/**
 * 從環境變量獲取加密密鑰
 */
function getEncryptionKey(env: any): ArrayBuffer {
  const keyString = env.ENCRYPTION_KEY || 'dev-encryption-key-32-char-long';
  
  // 確保密鑰長度為32字節 (256位)
  const paddedKey = keyString.padEnd(32, '0').substring(0, 32);
  return new TextEncoder().encode(paddedKey).buffer;
}

/**
 * 加密密碼
 */
export async function encryptPassword(password: string, env: any): Promise<string> {
  try {
    const keyData = getEncryptionKey(env);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: algorithm },
      false,
      ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
    const encoded = new TextEncoder().encode(password);

    const encrypted = await crypto.subtle.encrypt(
      { name: algorithm, iv },
      key,
      encoded
    );

    // 將 IV 和加密數據合併，轉換為 base64
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Password encryption failed:', error);
    throw new Error('Failed to encrypt password');
  }
}

/**
 * 解密密碼
 */
export async function decryptPassword(encryptedData: string, env: any): Promise<string> {
  try {
    const keyData = getEncryptionKey(env);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: algorithm },
      false,
      ['decrypt']
    );

    // 從 base64 解碼並分離 IV 和加密數據
    const combined = new Uint8Array(
      atob(encryptedData).split('').map(char => char.charCodeAt(0))
    );

    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: algorithm, iv },
      key,
      encrypted
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Password decryption failed:', error);
    throw new Error('Failed to decrypt password');
  }
}

/**
 * 驗證加密密碼是否有效
 */
export async function isValidEncryptedPassword(encryptedData: string, env: any): Promise<boolean> {
  try {
    await decryptPassword(encryptedData, env);
    return true;
  } catch {
    return false;
  }
}