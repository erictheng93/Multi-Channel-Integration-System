// R2 檔案存儲工具
import type { Bindings } from '../types';
import type {
  MediaFileInfo
} from '../types/file-storage';
import { createContextLogger } from './logger';
import { PLATFORMS } from '../constants/platforms';
import { nowISO } from '@/utils/timestamp'
import { getPublicFileUrl } from '@/utils/file-url'

// Legacy interface for backward compatibility
export interface MediaFile {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  r2Key: string;
  originalUrl?: string;
  platform: string;
  messageId?: string;
}

export class FileStorageService {
  constructor(private env: Bindings) {}

  /**
   * 從 URL 下載檔案並存儲到 R2
   */
  async downloadAndStore(
    originalUrl: string,
    filename: string,
    mimeType: string,
    platform: string,
    messageId?: string
  ): Promise<MediaFile | null> {
    try {
      const storageLogger = createContextLogger('FileStorage');
      console.log(`[FileStorage] downloadAndStore called:`, {
        originalUrl,
        filename,
        mimeType,
        platform,
        messageId
      });
      storageLogger.info('Downloading file', { originalUrl });

      // 設置授權標頭（如果是 LINE API）
      const headers: Record<string, string> = {
        'User-Agent': 'Multi-Channel-Platform-Bot/1.0'
      };

      if (platform === PLATFORMS.LINE && (originalUrl.includes('api.line.me') || originalUrl.includes('api-data.line.me'))) {
        const hasToken = !!this.env.LINE_CHANNEL_ACCESS_TOKEN;
        const tokenPrefix = hasToken ? this.env.LINE_CHANNEL_ACCESS_TOKEN.substring(0, 10) + '...' : 'MISSING';
        console.log(`[FileStorage] LINE auth token status:`, { hasToken, tokenPrefix });
        headers['Authorization'] = `Bearer ${this.env.LINE_CHANNEL_ACCESS_TOKEN}`;
      }

      // 下載檔案
      console.log(`[FileStorage] Fetching from LINE API...`);
      const response = await fetch(originalUrl, { headers });

      console.log(`[FileStorage] LINE API response:`, {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length')
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Could not read error body');
        console.error(`[FileStorage] LINE API download failed:`, {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorBody.substring(0, 500)
        });
        storageLogger.error('Failed to download file', { status: response.status, statusText: response.statusText, url: originalUrl });
        return null;
      }

      const fileBuffer = await response.arrayBuffer();
      const contentLength = fileBuffer.byteLength;
      console.log(`[FileStorage] Downloaded ${contentLength} bytes from LINE API`);
      
      // 檢查檔案大小限制（10MB）
      if (contentLength > 10 * 1024 * 1024) {
        storageLogger.error('File too large', { contentLength, maxSize: 10 * 1024 * 1024 });
        return null;
      }

      // 生成唯一檔案名
      const fileId = crypto.randomUUID();
      const extension = this.getFileExtension(filename, mimeType);
      const storageKey = `media/${platform}/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${fileId}${extension}`;
      console.log(`[FileStorage] Generated storage key:`, { fileId, extension, storageKey });

      // 上傳到 R2
      if (!this.env.R2_BUCKET) {
        console.error(`[FileStorage] R2_BUCKET is not configured!`);
        throw new Error('R2_BUCKET is not configured');
      }

      console.log(`[FileStorage] Uploading to R2...`);
      await this.env.R2_BUCKET.put(storageKey, fileBuffer, {
        httpMetadata: {
          contentType: mimeType,
          contentDisposition: `inline; filename="${filename}"`,
          cacheControl: 'public, max-age=604800'
        },
        customMetadata: {
          originalUrl,
          platform,
          messageId: messageId || '',
          uploadedAt: nowISO()
        }
      });
      console.log(`[FileStorage] Successfully uploaded to R2: ${storageKey}`);

      storageLogger.info('File uploaded to R2', { storageKey, size: contentLength });

      const publicUrl = this.generatePublicUrl(storageKey);
      console.log(`[FileStorage] Generated public URL: ${publicUrl}`);

      const mediaFile: MediaFile = {
        id: fileId,
        filename: filename || `file_${fileId}${extension}`,
        mimeType,
        size: contentLength,
        url: publicUrl,
        r2Key: storageKey,
        originalUrl,
        platform,
        messageId: messageId || ''
      };

      console.log(`[FileStorage] Returning mediaFile:`, mediaFile);
      return mediaFile;
    } catch (error) {
      const storageLogger = createContextLogger('FileStorage');
      console.error(`[FileStorage] Exception during download/store:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        originalUrl
      });
      storageLogger.error('Error downloading and storing file', { originalUrl }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * 從 R2 獲取檔案
   */
  async getFile(storageKey: string): Promise<ArrayBuffer | null> {
    try {
      if (!this.env.R2_BUCKET) {
        throw new Error('R2_BUCKET is not configured');
      }
      
      const object = await this.env.R2_BUCKET.get(storageKey);
      if (!object) {
        return null;
      }
      return await object.arrayBuffer();
    } catch (error) {
      const storageLogger = createContextLogger('FileStorage');
      storageLogger.error('Error getting file from R2', { storageKey }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * 刪除 R2 檔案
   */
  async deleteFile(storageKey: string): Promise<boolean> {
    try {
      if (!this.env.R2_BUCKET) {
        throw new Error('R2_BUCKET is not configured');
      }
      
      await this.env.R2_BUCKET.delete(storageKey);
      const storageLogger = createContextLogger('FileStorage');
      storageLogger.info('File deleted from R2', { storageKey });
      return true;
    } catch (error) {
      const storageLogger = createContextLogger('FileStorage');
      storageLogger.error('Error deleting file from R2', { storageKey }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * 獲取檔案資訊
   */
  async getFileInfo(storageKey: string): Promise<MediaFileInfo | null> {
    try {
      if (!this.env.R2_BUCKET) {
        throw new Error('R2_BUCKET is not configured');
      }
      
      const object = await this.env.R2_BUCKET.head(storageKey);
      if (!object) return null;
      
      return {
        id: storageKey,
        filename: storageKey.split('/').pop() || storageKey,
        mimeType: object.httpMetadata?.contentType || 'application/octet-stream',
        extension: storageKey.split('.').pop() || '',
        size: object.size,
        url: this.generatePublicUrl(storageKey),
        platform: 'system' as const,
        messageId: '',
        storage: {
          bucket: 'r2',
          key: storageKey,
          path: storageKey,
          url: this.generatePublicUrl(storageKey)
        },
        metadata: {
          filename: storageKey.split('/').pop() || storageKey,
          mimeType: object.httpMetadata?.contentType || 'application/octet-stream',
          size: object.size,
          extension: storageKey.split('.').pop() || ''
        },
        processingStatus: 'completed' as const,
        createdAt: object.uploaded?.toISOString() || nowISO(),
        updatedAt: object.uploaded?.toISOString() || nowISO()
      };
    } catch (error) {
      const storageLogger = createContextLogger('FileStorage');
      storageLogger.error('Error getting file info from R2', { storageKey }, error instanceof Error ? error : String(error));
      return null;
    }
  }

  /**
   * 生成檔案的公開 URL
   */
  generatePublicUrl(storageKey: string, _apiHost?: string): string {
    return getPublicFileUrl(this.env, storageKey);
  }

  /**
   * 根據檔案名和 MIME 類型獲取副檔名
   */
  private getFileExtension(filename: string, mimeType: string): string {
    if (filename && filename.includes('.')) {
      const parts = filename.split('.');
      return `.${parts[parts.length - 1]}`;
    }
    
    // 根據 MIME 類型推斷副檔名
    const mimeMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/quicktime': '.mov',
      'video/x-msvideo': '.avi',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
      'audio/ogg': '.ogg',
      'audio/aac': '.aac',
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'text/plain': '.txt'
    };
    
    return mimeMap[mimeType] || '.bin';
  }
}

/**
 * 處理 LINE 媒體訊息下載和存儲
 */
export async function processLineMediaMessage(
  env: Bindings,
  messageId: string,
  messageType: string,
  fileName?: string
): Promise<MediaFile | null> {
  const fileStorage = new FileStorageService(env);

  // FIX: Use api-data.line.me instead of api.line.me for content download
  // According to LINE API documentation, content download should use the data subdomain
  // See: https://developers.line.biz/en/reference/messaging-api/#get-content
  const originalUrl = `https://api-data.line.me/v2/bot/message/${messageId}/content`;

  // For 'file' type, infer mimeType from filename extension instead of hardcoding
  // application/octet-stream. This allows FileAttachmentCard to detect file types
  // (e.g., PDF, Word, Excel) via mimeType matching, not just extension fallback.
  let mimeType: string;
  if (messageType === 'file' && fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const extMimeMap: Record<string, string> = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'csv': 'text/csv',
      'txt': 'text/plain',
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed',
      '7z': 'application/x-7z-compressed',
    };
    mimeType = extMimeMap[ext] || 'application/octet-stream';
  } else {
    const mimeTypeMap: Record<string, string> = {
      'image': 'image/jpeg',
      'video': 'video/mp4',
      'audio': 'audio/mp3',
    };
    mimeType = mimeTypeMap[messageType] || 'application/octet-stream';
  }

  const defaultFilename = `${messageType}_${messageId}`;

  return await fileStorage.downloadAndStore(
    originalUrl,
    fileName || defaultFilename,
    mimeType,
    'line',
    messageId
  );
}

/**
 * 處理 Facebook 媒體訊息下載和存儲
 */
export async function processFacebookMediaMessage(
  env: Bindings,
  mediaUrl: string,
  messageType: string,
  messageId: string,
  fileName?: string
): Promise<MediaFile | null> {
  const fileStorage = new FileStorageService(env);
  
  const mimeTypeMap: Record<string, string> = {
    'image': 'image/jpeg',
    'video': 'video/mp4',
    'audio': 'audio/mp3', 
    'file': 'application/octet-stream'
  };
  
  const mimeType = mimeTypeMap[messageType] || 'application/octet-stream';
  const defaultFilename = fileName || `${messageType}_${messageId}`;
  
  return await fileStorage.downloadAndStore(
    mediaUrl,
    defaultFilename,
    mimeType,
    'facebook',
    messageId
  );
}