/**
 * Presigned URL Service
 * 生成 R2 presigned URLs 用於直接上傳
 *
 * 流程:
 * 1. Frontend 請求 presigned URL
 * 2. Service 生成 URL 並在 DB 創建 pending 記錄
 * 3. Frontend 直接上傳到 R2
 * 4. Frontend 調用 confirm 端點驗證上傳
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq, lt } from 'drizzle-orm';
import { fileAttachments } from '@/db/schema';
import type { Bindings } from '@/types';
import { nowISO, nowMs } from '@/utils/timestamp';
import { getPublicFileUrl } from '@/utils/file-url';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('PresignedUrl');

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface PresignedUrlRequest {
  filename: string;
  mimeType: string;
  size: number;
  conversationId?: string;
  messageId?: string;
  uploadedBy?: string;
}

export interface PresignedUrlResponse {
  presignedUrl: string;
  fileId: string;
  r2Key: string;
  expiresAt: string;
  publicUrl: string;
}

export interface ConfirmUploadRequest {
  fileId: string;
  size: number;
  checksum?: string;
}

export interface ConfirmUploadResponse {
  success: boolean;
  file: {
    id: string;
    filename: string;
    url: string;
    publicUrl: string;
    size: number;
    mimeType: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

const PRESIGNED_URL_EXPIRY = 15 * 60; // 15 minutes in seconds
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ═══════════════════════════════════════════════════════════════════════════
// Service Implementation
// ═══════════════════════════════════════════════════════════════════════════

export class PresignedUrlService {
  private s3Client: S3Client | null = null;
  private db: ReturnType<typeof drizzle>;
  private bucketName: string;
  private isConfigured: boolean = false;

  constructor(private env: Bindings) {
    this.db = drizzle(env.DB);
    this.bucketName = env.R2_BUCKET_NAME || 'mcis-files';

    // 檢查是否配置了 S3 API credentials
    if (env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        },
      });
      this.isConfigured = true;
      log.info('[PresignedUrlService] S3 client initialized successfully');
    } else {
      log.warn('[PresignedUrlService] S3 credentials not configured - presigned URLs will not work');
    }
  }

  /**
   * 檢查服務是否已配置
   */
  isServiceConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * 生成 Presigned URL 用於直接上傳
   */
  async generatePresignedUrl(request: PresignedUrlRequest): Promise<PresignedUrlResponse> {
    if (!this.s3Client) {
      throw new Error('Presigned URL service not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.');
    }

    // 驗證請求
    this.validateRequest(request);

    const fileId = this.generateFileId();
    const timestamp = nowMs();
    const sanitizedFilename = this.sanitizeFilename(request.filename);
    const extension = this.getExtension(request.filename);

    // 生成 R2 key (路徑結構)
    const r2Key = request.conversationId
      ? `attachments/${request.conversationId}/${timestamp}_${fileId}.${extension}`
      : `uploads/${timestamp}_${fileId}.${extension}`;

    // 計算過期時間
    const expiresAt = new Date(Date.now() + PRESIGNED_URL_EXPIRY * 1000).toISOString();

    // 生成 presigned URL
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: r2Key,
      ContentType: request.mimeType,
      ContentLength: request.size,
      Metadata: {
        'original-filename': encodeURIComponent(sanitizedFilename),
        'uploaded-by': request.uploadedBy || 'anonymous',
        'conversation-id': request.conversationId || '',
        'message-id': request.messageId || '',
      },
    });

    const presignedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: PRESIGNED_URL_EXPIRY,
    });

    // 計算公開 URL
    const publicUrl = this.getPublicUrl(r2Key);

    // 保存 pending 記錄到資料庫
    await this.db.insert(fileAttachments).values({
      id: fileId,
      filename: sanitizedFilename,
      mimeType: request.mimeType,
      fileSize: request.size,
      r2Key: r2Key,
      fileUrl: publicUrl,
      messageId: request.messageId || null,
      uploadStatus: 'pending',
      uploadedBy: request.uploadedBy || null,
      createdAt: nowISO(),
    });

    log.info(`[PresignedUrlService] Generated presigned URL for ${fileId}, key: ${r2Key}, expires: ${expiresAt}`);

    return {
      presignedUrl,
      fileId,
      r2Key,
      expiresAt,
      publicUrl,
    };
  }

  /**
   * 確認上傳完成
   */
  async confirmUpload(request: ConfirmUploadRequest): Promise<ConfirmUploadResponse> {
    const { fileId, size } = request;

    // 1. 從資料庫獲取 pending 記錄
    const [pendingFile] = await this.db
      .select()
      .from(fileAttachments)
      .where(eq(fileAttachments.id, fileId))
      .limit(1);

    if (!pendingFile) {
      throw new Error(`File record not found: ${fileId}`);
    }

    if (pendingFile.uploadStatus === 'completed') {
      // 已確認，返回現有記錄
      log.info(`[PresignedUrlService] File ${fileId} already confirmed`);
      return {
        success: true,
        file: {
          id: pendingFile.id,
          filename: pendingFile.filename || '',
          url: pendingFile.fileUrl || '',
          publicUrl: pendingFile.fileUrl || '',
          size: pendingFile.fileSize || 0,
          mimeType: pendingFile.mimeType || '',
        },
      };
    }

    // 2. 驗證檔案存在於 R2 (如果 S3 client 可用)
    if (this.s3Client && pendingFile.r2Key) {
      try {
        const headCommand = new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: pendingFile.r2Key,
        });

        const headResult = await this.s3Client.send(headCommand);

        // 記錄實際檔案大小（R2 可能會有差異）
        if (headResult.ContentLength && headResult.ContentLength !== size) {
          log.warn("Size mismatch", { fileId, expected: size, actual: headResult.ContentLength });
        }
      } catch (error) {
        log.error(`[PresignedUrlService] File verification failed for ${fileId}:`, {}, error instanceof Error ? error : new Error(String(error)));

        // 更新狀態為 failed
        await this.db
          .update(fileAttachments)
          .set({
            uploadStatus: 'failed',
            updatedAt: nowISO(),
          })
          .where(eq(fileAttachments.id, fileId));

        throw new Error('File upload verification failed - file not found in storage');
      }
    }

    // 3. 更新資料庫記錄
    const timestamp = nowISO();
    await this.db
      .update(fileAttachments)
      .set({
        uploadStatus: 'completed',
        fileSize: size,
        updatedAt: timestamp,
      })
      .where(eq(fileAttachments.id, fileId));

    log.info(`[PresignedUrlService] Upload confirmed for ${fileId}`);

    return {
      success: true,
      file: {
        id: pendingFile.id,
        filename: pendingFile.filename || '',
        url: pendingFile.fileUrl || '',
        publicUrl: pendingFile.fileUrl || '',
        size: size,
        mimeType: pendingFile.mimeType || '',
      },
    };
  }

  /**
   * 獲取 pending 狀態的檔案
   */
  async getPendingFile(fileId: string) {
    const [file] = await this.db
      .select()
      .from(fileAttachments)
      .where(eq(fileAttachments.id, fileId))
      .limit(1);

    return file || null;
  }

  /**
   * 清理過期的 pending 記錄 (可由定時任務調用)
   */
  async cleanupExpiredPendingUploads(maxAgeMinutes: number = 30): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();

    const expired = await this.db
      .select({ id: fileAttachments.id })
      .from(fileAttachments)
      .where(and(
        eq(fileAttachments.uploadStatus, 'pending'),
        lt(fileAttachments.createdAt, cutoff)
      ))
      .all();

    if (expired.length === 0) {
      return 0;
    }

    await this.db
      .delete(fileAttachments)
      .where(and(
        eq(fileAttachments.uploadStatus, 'pending'),
        lt(fileAttachments.createdAt, cutoff)
      ));

    log.info(`[PresignedUrlService] Cleaned ${expired.length} expired pending uploads older than ${maxAgeMinutes} minutes`);
    return expired.length;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helper Methods
  // ═══════════════════════════════════════════════════════════════════════════

  private validateRequest(request: PresignedUrlRequest): void {
    if (!request.filename || typeof request.filename !== 'string') {
      throw new Error('Invalid filename');
    }

    if (!request.mimeType || typeof request.mimeType !== 'string') {
      throw new Error('Invalid MIME type');
    }

    if (!request.size || typeof request.size !== 'number' || request.size <= 0) {
      throw new Error('Invalid file size');
    }

    if (request.size > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds limit (max: ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
    }
  }

  private generateFileId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `file_${timestamp}_${random}`;
  }

  private sanitizeFilename(filename: string): string {
    // 移除路徑分隔符和危險字符，保留基本的檔名
    return filename
      .replace(/[/\\:*?"<>|]/g, '')  // 移除 Windows/Unix 路徑特殊字符
      .replace(/\s+/g, '_') // 空格轉底線
      .slice(0, 200); // 限制長度
  }

  private getExtension(filename: string): string {
    const parts = filename.split('.');
    if (parts.length > 1) {
      const ext = parts.pop()!.toLowerCase();
      // 驗證是合理的副檔名
      if (/^[a-z0-9]{1,10}$/.test(ext)) {
        return ext;
      }
    }
    return 'bin';
  }

  private getPublicUrl(r2Key: string): string {
    return getPublicFileUrl(this.env, r2Key);
  }
}

/**
 * 創建 PresignedUrlService 實例
 */
export function createPresignedUrlService(env: Bindings): PresignedUrlService {
  return new PresignedUrlService(env);
}
