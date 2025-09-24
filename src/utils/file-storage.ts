// R2 檔案存儲工具
import type { Bindings } from '../types';
import type {
  MediaFileInfo
} from '../types/file-storage';
import { createContextLogger } from './logger';

// Legacy interface for backward compatibility
export interface MediaFile {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
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
      storageLogger.info('Downloading file', { originalUrl });
      
      // 設置授權標頭（如果是 LINE API）
      const headers: Record<string, string> = {
        'User-Agent': 'Multi-Channel-Platform-Bot/1.0'
      };
      
      if (platform === 'line' && originalUrl.includes('api.line.me')) {
        headers['Authorization'] = `Bearer ${this.env.LINE_CHANNEL_ACCESS_TOKEN}`;
      }

      // 下載檔案
      const response = await fetch(originalUrl, { headers });
      
      if (!response.ok) {
        storageLogger.error('Failed to download file', { status: response.status, statusText: response.statusText, url: originalUrl });
        return null;
      }

      const fileBuffer = await response.arrayBuffer();
      const contentLength = fileBuffer.byteLength;
      
      // 檢查檔案大小限制（10MB）
      if (contentLength > 10 * 1024 * 1024) {
        storageLogger.error('File too large', { contentLength, maxSize: 10 * 1024 * 1024 });
        return null;
      }

      // 生成唯一檔案名
      const fileId = crypto.randomUUID();
      const extension = this.getFileExtension(filename, mimeType);
      const storageKey = `media/${platform}/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${fileId}${extension}`;

      // 上傳到 R2
      if (!this.env.R2_BUCKET) {
        throw new Error('R2_BUCKET is not configured');
      }
      
      await this.env.R2_BUCKET.put(storageKey, fileBuffer, {
        httpMetadata: {
          contentType: mimeType,
          contentDisposition: `inline; filename="${filename}"`
        },
        customMetadata: {
          originalUrl,
          platform,
          messageId: messageId || '',
          uploadedAt: new Date().toISOString()
        }
      });

      storageLogger.info('File uploaded to R2', { storageKey, size: contentLength });

      const mediaFile: MediaFile = {
        id: fileId,
        filename: filename || `file_${fileId}${extension}`,
        mimeType,
        size: contentLength,
        url: this.generatePublicUrl(storageKey),
        originalUrl,
        platform,
        messageId: messageId || ''
      };

      return mediaFile;
    } catch (error) {
      const storageLogger = createContextLogger('FileStorage');
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
        createdAt: object.uploaded?.toISOString() || new Date().toISOString(),
        updatedAt: object.uploaded?.toISOString() || new Date().toISOString()
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
  generatePublicUrl(storageKey: string): string {
    // 優先使用 R2_PUBLIC_URL 環境變數
    if (this.env.R2_PUBLIC_URL) {
      return `${this.env.R2_PUBLIC_URL}/${storageKey}`;
    }
    
    // 回退到自定義域名或預設 R2 URL
    return `https://${this.env.R2_CUSTOM_DOMAIN || `${this.env.R2_BUCKET_NAME}.${this.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`}/${storageKey}`;
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
  
  const originalUrl = `https://api.line.me/v2/bot/message/${messageId}/content`;
  const mimeTypeMap: Record<string, string> = {
    'image': 'image/jpeg',
    'video': 'video/mp4', 
    'audio': 'audio/mp3',
    'file': 'application/octet-stream'
  };
  
  const mimeType = mimeTypeMap[messageType] || 'application/octet-stream';
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