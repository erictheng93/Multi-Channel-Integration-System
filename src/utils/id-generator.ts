// ID Generator Utility - ID 生成工具
// Utility for generating unique identifiers

/**
 * 生成唯一識別符
 * Generate a unique identifier
 * @param prefix - Optional prefix for the ID
 */
export function generateId(prefix?: string): string {
  // 使用時間戳和隨機數組合生成 ID
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  const id = `${timestamp}_${randomPart}`;
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * 生成 UUID v4 格式的 ID
 * Generate UUID v4 format identifier
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 生成短 ID（適用於 URL 或簡短識別）
 * Generate short ID for URLs or brief identification
 */
export function generateShortId(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成數字 ID
 * Generate numeric ID
 */
export function generateNumericId(length: number = 10): string {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * Math.pow(10, length - timestamp.length)).toString();
  return (timestamp + random).substring(0, length);
}

/**
 * 生成帶前綴的 ID
 * Generate ID with prefix
 */
export function generatePrefixedId(prefix: string, separator: string = '_'): string {
  return `${prefix}${separator}${generateId()}`;
}

/**
 * 驗證 ID 格式
 * Validate ID format
 */
export function isValidId(id: string): boolean {
  // 基本驗證：非空且長度合理
  return typeof id === 'string' && id.length > 0 && id.length <= 100;
}

/**
 * 驗證 UUID 格式
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}