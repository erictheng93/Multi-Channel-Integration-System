/**
 * MIME Type Utility Functions
 * MIME 類型工具函數
 */

import { ALLOWED_MIME_TYPES, MIME_TO_EXTENSION } from '@modules/file-management/constants/file-config';

/**
 * 檢查 MIME 類型是否被允許
 */
export function isAllowedMimeType(mimeType: string): boolean {
  const allAllowedTypes = Object.values(ALLOWED_MIME_TYPES).flat();
  return allAllowedTypes.includes(mimeType as any);
}

/**
 * 根據檔案類別檢查 MIME 類型
 */
export function isAllowedMimeTypeByCategory(
  mimeType: string,
  category: keyof typeof ALLOWED_MIME_TYPES
): boolean {
  const allowedTypes = ALLOWED_MIME_TYPES[category] as readonly string[];
  return allowedTypes.includes(mimeType);
}

/**
 * 正規化 MIME 類型（處理常見的變體）
 */
export function normalizeMimeType(mimeType: string): string {
  const normalized = mimeType.toLowerCase().trim();

  // 處理常見的 MIME 類型變體
  const mimeTypeMap: Record<string, string> = {
    'image/jpg': 'image/jpeg',
    'audio/mp3': 'audio/mpeg',
    'application/x-pdf': 'application/pdf',
    'text/csv': 'text/csv',
    'application/vnd.ms-word': 'application/msword'
  };

  return mimeTypeMap[normalized] || normalized;
}

/**
 * 從檔案副檔名推斷 MIME 類型
 */
export function getMimeTypeFromExtension(extension: string): string {
  const ext = extension.toLowerCase();

  // 建立副檔名到 MIME 類型的映射
  const extensionToMime: Record<string, string> = {};

  for (const [mimeType, fileExtension] of Object.entries(MIME_TO_EXTENSION)) {
    extensionToMime[fileExtension] = mimeType;
  }

  return extensionToMime[ext] || 'application/octet-stream';
}

/**
 * 檢查檔案簽章與 MIME 類型是否一致
 */
export function validateFileSignature(
  data: ArrayBuffer,
  expectedMimeType: string
): { valid: boolean; detectedMimeType?: string } {
  const bytes = new Uint8Array(data.slice(0, 12));

  // 常見檔案簽章
  const signatures: Array<{
    mimeType: string;
    signature: number[];
    offset?: number;
  }> = [
    // 圖片格式
    { mimeType: 'image/jpeg', signature: [0xFF, 0xD8, 0xFF] },
    { mimeType: 'image/png', signature: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
    { mimeType: 'image/gif', signature: [0x47, 0x49, 0x46, 0x38] },
    { mimeType: 'image/webp', signature: [0x52, 0x49, 0x46, 0x46], offset: 0 },
    { mimeType: 'image/bmp', signature: [0x42, 0x4D] },

    // 影片格式
    { mimeType: 'video/mp4', signature: [0x66, 0x74, 0x79, 0x70], offset: 4 },
    { mimeType: 'video/avi', signature: [0x52, 0x49, 0x46, 0x46] },

    // 音訊格式
    { mimeType: 'audio/mpeg', signature: [0xFF, 0xFB] },
    { mimeType: 'audio/mpeg', signature: [0x49, 0x44, 0x33] }, // ID3 tag

    // 文件格式
    { mimeType: 'application/pdf', signature: [0x25, 0x50, 0x44, 0x46] },
    { mimeType: 'application/zip', signature: [0x50, 0x4B, 0x03, 0x04] },
    { mimeType: 'application/zip', signature: [0x50, 0x4B, 0x05, 0x06] },
    { mimeType: 'application/zip', signature: [0x50, 0x4B, 0x07, 0x08] }
  ];

  for (const { mimeType, signature, offset = 0 } of signatures) {
    const matches = signature.every((byte, index) =>
      bytes[offset + index] === byte
    );

    if (matches) {
      return {
        valid: normalizeMimeType(mimeType) === normalizeMimeType(expectedMimeType),
        detectedMimeType: mimeType
      };
    }
  }

  // 沒有找到已知的簽章
  return { valid: false };
}

/**
 * 檢測檔案的 MIME 類型（基於檔案簽章）
 */
export function detectMimeType(data: ArrayBuffer): string | null {
  const result = validateFileSignature(data, '');
  return result.detectedMimeType || null;
}

/**
 * 檢查 MIME 類型是否為圖片
 */
export function isImageMimeType(mimeType: string): boolean {
  return isAllowedMimeTypeByCategory(mimeType, 'IMAGE');
}

/**
 * 檢查 MIME 類型是否為影片
 */
export function isVideoMimeType(mimeType: string): boolean {
  return isAllowedMimeTypeByCategory(mimeType, 'VIDEO');
}

/**
 * 檢查 MIME 類型是否為音訊
 */
export function isAudioMimeType(mimeType: string): boolean {
  return isAllowedMimeTypeByCategory(mimeType, 'AUDIO');
}

/**
 * 檢查 MIME 類型是否為文件
 */
export function isDocumentMimeType(mimeType: string): boolean {
  return isAllowedMimeTypeByCategory(mimeType, 'DOCUMENT');
}

/**
 * 檢查 MIME 類型是否為壓縮檔
 */
export function isArchiveMimeType(mimeType: string): boolean {
  return isAllowedMimeTypeByCategory(mimeType, 'ARCHIVE');
}

/**
 * 根據 MIME 類型獲取適當的 Content-Type 標頭
 */
export function getContentTypeHeader(mimeType: string): string {
  const normalized = normalizeMimeType(mimeType);

  // 添加字符編碼（如果需要）
  if (normalized.startsWith('text/')) {
    return `${normalized}; charset=utf-8`;
  }

  return normalized;
}

/**
 * 檢查 MIME 類型是否需要特殊處理
 */
export function requiresSpecialHandling(mimeType: string): boolean {
  const specialTypes = [
    'application/javascript',
    'text/html',
    'application/x-httpd-php',
    'application/x-python',
    'application/x-sh'
  ];

  return specialTypes.includes(normalizeMimeType(mimeType));
}

/**
 * 獲取 MIME 類型的友善顯示名稱
 */
export function getFriendlyMimeTypeName(mimeType: string): string {
  const friendlyNames: Record<string, string> = {
    'image/jpeg': 'JPEG 圖片',
    'image/png': 'PNG 圖片',
    'image/gif': 'GIF 圖片',
    'image/webp': 'WebP 圖片',
    'image/svg+xml': 'SVG 圖片',
    'video/mp4': 'MP4 影片',
    'video/mpeg': 'MPEG 影片',
    'video/quicktime': 'QuickTime 影片',
    'audio/mpeg': 'MP3 音訊',
    'audio/wav': 'WAV 音訊',
    'audio/ogg': 'OGG 音訊',
    'application/pdf': 'PDF 文件',
    'application/msword': 'Word 文件',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word 文件 (DOCX)',
    'application/vnd.ms-excel': 'Excel 試算表',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel 試算表 (XLSX)',
    'text/plain': '純文字檔案',
    'application/zip': 'ZIP 壓縮檔',
    'application/x-rar-compressed': 'RAR 壓縮檔'
  };

  return friendlyNames[normalizeMimeType(mimeType)] || mimeType;
}

/**
 * 檢查 MIME 類型是否為可預覽的類型
 */
export function isPreviewableMimeType(mimeType: string): boolean {
  const previewableTypes = [
    ...ALLOWED_MIME_TYPES.IMAGE,
    'application/pdf',
    'text/plain',
    'text/csv'
  ];

  return previewableTypes.includes(normalizeMimeType(mimeType));
}

/**
 * 獲取縮圖支援的 MIME 類型
 */
export function supportsThumbnail(mimeType: string): boolean {
  const thumbnailSupportedTypes = [
    ...ALLOWED_MIME_TYPES.IMAGE,
    ...ALLOWED_MIME_TYPES.VIDEO,
    'application/pdf'
  ];

  return thumbnailSupportedTypes.includes(normalizeMimeType(mimeType));
}