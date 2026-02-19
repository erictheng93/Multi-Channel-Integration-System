/**
 * File Management Helper Utilities
 * 檔案管理工具函數
 */

import { MIME_TO_EXTENSION, FILE_EXTENSIONS, ALLOWED_MIME_TYPES } from '@modules/file-management/constants/file-config';
import type { FileType } from '@modules/file-management/types/file-types';
import type { KeyGenerationOptions } from '@modules/file-management/types/storage-types';

/**
 * 從檔名或 MIME 類型獲取副檔名
 */
export function getFileExtension(filename: string, mimeType?: string): string {
  // 首先嘗試從檔名獲取副檔名
  if (filename && filename.includes('.')) {
    const parts = filename.split('.');
    const extension = `.${parts[parts.length - 1].toLowerCase()}`;
    if (extension.length > 1) {
      return extension;
    }
  }

  // 如果檔名沒有副檔名，從 MIME 類型推斷
  if (mimeType && mimeType in MIME_TO_EXTENSION) {
    return MIME_TO_EXTENSION[mimeType as keyof typeof MIME_TO_EXTENSION];
  }

  // 預設副檔名
  return '.bin';
}

/**
 * 根據 MIME 類型或副檔名判斷檔案類型
 */
export function getFileType(mimeType: string, extension?: string): FileType {
  // 根據 MIME 類型判斷
  if (ALLOWED_MIME_TYPES.IMAGE.includes(mimeType as any)) {
    return 'image';
  }
  if (ALLOWED_MIME_TYPES.VIDEO.includes(mimeType as any)) {
    return 'video';
  }
  if (ALLOWED_MIME_TYPES.AUDIO.includes(mimeType as any)) {
    return 'audio';
  }
  if (ALLOWED_MIME_TYPES.DOCUMENT.includes(mimeType as any)) {
    return 'document';
  }
  if (ALLOWED_MIME_TYPES.ARCHIVE.includes(mimeType as any)) {
    return 'archive';
  }

  // 根據副檔名判斷
  if (extension) {
    const ext = extension.toLowerCase();
    if (FILE_EXTENSIONS.IMAGE.includes(ext as any)) {
      return 'image';
    }
    if (FILE_EXTENSIONS.VIDEO.includes(ext as any)) {
      return 'video';
    }
    if (FILE_EXTENSIONS.AUDIO.includes(ext as any)) {
      return 'audio';
    }
    if (FILE_EXTENSIONS.DOCUMENT.includes(ext as any)) {
      return 'document';
    }
    if (FILE_EXTENSIONS.ARCHIVE.includes(ext as any)) {
      return 'archive';
    }
  }

  return 'other';
}

/**
 * 生成儲存金鑰
 */
export function generateStorageKey(
  filename: string,
  options: KeyGenerationOptions = {}
): string {
  const {
    prefix = 'files',
    platform = 'system',
    fileType,
    dateStructure = true,
    preserveFilename = false,
    includeUserId = false,
    includeConversationId = false
  } = options;

  const parts: string[] = [];

  // 添加前綴
  if (prefix) {
    parts.push(prefix);
  }

  // 添加平台
  if (platform) {
    parts.push(platform);
  }

  // 添加檔案類型
  if (fileType) {
    parts.push(fileType);
  }

  // 添加日期結構
  if (dateStructure) {
    const now = new Date();
    parts.push(
      now.getFullYear().toString(),
      (now.getMonth() + 1).toString().padStart(2, '0'),
      now.getDate().toString().padStart(2, '0')
    );
  }

  // 添加對話 ID
  if (includeConversationId && options.conversationId) {
    parts.push(options.conversationId);
  }

  // 添加使用者 ID
  if (includeUserId && options.userId) {
    parts.push(options.userId);
  }

  // 生成檔案名
  let finalFilename: string;
  if (preserveFilename) {
    // 清理檔名中的不安全字符
    finalFilename = sanitizeFilename(filename);
  } else {
    // 生成唯一檔名
    const fileId = crypto.randomUUID();
    const extension = getFileExtension(filename);
    finalFilename = `${fileId}${extension}`;
  }

  parts.push(finalFilename);

  return parts.join('/');
}

/**
 * 清理檔名中的不安全字符
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_') // 替換不安全字符
    .replace(/\s+/g, '_') // 替換空白字符
    .replace(/_{2,}/g, '_') // 合併多個底線
    .replace(/^_+|_+$/g, '') // 移除開頭和結尾的底線
    .toLowerCase();
}

/**
 * 格式化檔案大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 檢查檔案是否為圖片
 */
export function isImageFile(mimeType: string, extension?: string): boolean {
  return getFileType(mimeType, extension) === 'image';
}

/**
 * 檢查檔案是否為影片
 */
export function isVideoFile(mimeType: string, extension?: string): boolean {
  return getFileType(mimeType, extension) === 'video';
}

/**
 * 檢查檔案是否為音訊
 */
export function isAudioFile(mimeType: string, extension?: string): boolean {
  return getFileType(mimeType, extension) === 'audio';
}

/**
 * 檢查檔案是否為文件
 */
export function isDocumentFile(mimeType: string, extension?: string): boolean {
  return getFileType(mimeType, extension) === 'document';
}

/**
 * 從完整路徑提取檔名
 */
export function extractFilename(path: string): string {
  return path.split('/').pop() || path;
}

/**
 * 從完整路徑提取目錄
 */
export function extractDirectory(path: string): string {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/');
}

/**
 * 生成縮圖檔名
 */
export function generateThumbnailKey(originalKey: string, size: string = 'thumb'): string {
  const extension = getFileExtension(originalKey);
  const nameWithoutExt = originalKey.replace(extension, '');
  return `${nameWithoutExt}_${size}${extension}`;
}

/**
 * 生成唯一檔案 ID
 */
export function generateFileId(): string {
  return crypto.randomUUID();
}

/**
 * 檢查檔名是否有效
 */
export function isValidFilename(filename: string): boolean {
  if (!filename || filename.length === 0) {
    return false;
  }

  // 檢查長度限制（通常為 255 字符）
  if (filename.length > 255) {
    return false;
  }

  // 檢查不允許的字符
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (invalidChars.test(filename)) {
    return false;
  }

  // 檢查保留名稱（Windows）
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
  if (reservedNames.test(filename)) {
    return false;
  }

  return true;
}

/**
 * 計算檔案雜湊值（如果支援）
 */
export async function calculateFileHash(data: ArrayBuffer): Promise<string | null> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (error) {
    console.warn('Failed to calculate file hash:', error);
  }
  return null;
}

/**
 * 檢查兩個檔案是否相同（基於雜湊值）
 */
export async function compareFiles(data1: ArrayBuffer, data2: ArrayBuffer): Promise<boolean> {
  try {
    const hash1 = await calculateFileHash(data1);
    const hash2 = await calculateFileHash(data2);
    return hash1 !== null && hash2 !== null && hash1 === hash2;
  } catch (error) {
    console.warn('Failed to compare files:', error);
    return false;
  }
}

/**
 * 從 URL 提取檔名
 */
export function extractFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    return extractFilename(pathname) || 'download';
  } catch (error) {
    return 'download';
  }
}

/**
 * 建立檔案下載回應標頭
 */
export function createDownloadHeaders(
  filename: string,
  mimeType: string,
  size?: number,
  inline = false
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': mimeType,
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}"`
  };

  if (size !== undefined) {
    headers['Content-Length'] = size.toString();
  }

  return headers;
}