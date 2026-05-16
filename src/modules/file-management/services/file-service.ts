/**
 * Core File Management Service
 * 核心檔案管理服務
 */

import type {
  ManagedFile,
  FileUploadRequest,
  FileUploadResult,
  FileDownloadOptions,
  FileDownloadResult,
  FileQueryOptions,
  FileListResponse,
  FileStatistics,
  BatchFileOperation,
  BatchFileResult
} from '../types/file-types';
import type { StorageService } from '@modules/file-management/types/storage-types';
import type { Bindings } from '@/types';
import { createDbClient, type Database } from '@/db/drizzle-factory';
import { eq, and, desc, sql, like, gte, lte } from 'drizzle-orm';
import { fileAttachments } from '@/db/schema';

import { FileValidationService } from '@modules/file-management/services/validation-service';
import { MetadataService } from '@modules/file-management/services/metadata-service';
import { createStorageService } from '@modules/file-management/services/storage-service';
import {
  generateFileId,
  generateStorageKey,
  getFileType,
  getFileExtension
} from '../utils/file-helpers';
import { ERROR_MESSAGES } from '@modules/file-management/constants/error-codes';
import { nowISO, nowMs } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('FileService');

type FileAttachmentRow = typeof fileAttachments.$inferSelect;

export class FileService {
  private readonly db: Database;
  private readonly validationService: FileValidationService;
  private readonly metadataService: MetadataService;
  private readonly storageService: StorageService;

  constructor(env: Bindings) {
    this.db = createDbClient(env.DB);
    this.validationService = new FileValidationService();
    this.metadataService = new MetadataService();
    this.storageService = createStorageService(env);
  }

  /**
   * 上傳檔案
   */
  async uploadFile(request: FileUploadRequest): Promise<FileUploadResult> {
    try {
      // 生成檔案 ID
      const fileId = generateFileId();

      // 生成元數據
      const metadata = await this.metadataService.generateMetadata(
        request.file,
        request.filename,
        request.mimeType
      );

      // 驗證檔案
      const validationRules = request.platform
        ? this.validationService.getRulesForPlatform(request.platform)
        : undefined;

      const validationResult = await this.validationService.validateFile(
        request.file,
        {
          filename: request.filename,
          size: metadata.size,
          mimeType: request.mimeType,
          extension: metadata.extension,
          platform: request.platform,
          userId: request.uploadedBy,
          conversationId: request.conversationId
        },
        validationRules
      );

      if (!validationResult.valid) {
        return {
          success: false,
          errors: validationResult.errors
        };
      }

      // 生成儲存金鑰
      const storageKey = generateStorageKey(request.filename, {
        platform: request.platform,
        fileType: getFileType(request.mimeType, metadata.extension),
        dateStructure: true,
        includeConversationId: !!request.conversationId,
        conversationId: request.conversationId,
        userId: request.uploadedBy
      });

      // 準備檔案資料
      const fileData = request.file instanceof File
        ? await request.file.arrayBuffer()
        : request.file;

      // 上傳到儲存服務
      const uploadResult = await this.storageService.uploadFile(
        storageKey,
        new Uint8Array(fileData),
        {
          contentType: request.mimeType,
          contentDisposition: `attachment; filename="${request.filename}"`,
          customMetadata: {
            fileId,
            platform: request.platform || 'system',
            uploadedBy: request.uploadedBy || '',
            conversationId: request.conversationId || '',
            messageId: request.messageId || ''
          }
        }
      );

      if (!uploadResult.success) {
        return {
          success: false,
          error: uploadResult.error || ERROR_MESSAGES.UPLOAD_FAILED
        };
      }

      // 建立檔案記錄
      const managedFile: ManagedFile = {
        id: fileId,
        filename: request.filename,
        originalFilename: metadata.originalFilename,
        mimeType: request.mimeType,
        size: metadata.size,
        extension: metadata.extension,
        type: getFileType(request.mimeType, metadata.extension),
        url: uploadResult.url,
        publicUrl: uploadResult.publicUrl,
        platform: request.platform || 'system',
        messageId: request.messageId,
        conversationId: request.conversationId,
        uploadedBy: request.uploadedBy,
        metadata,
        processingStatus: 'completed',
        createdAt: nowISO(),
        updatedAt: nowISO()
      };

      // 儲存到資料庫
      await this.db.insert(fileAttachments).values({
        id: fileId,
        messageId: request.messageId || null,
        conversationId: request.conversationId || null,
        filename: request.filename,
        mimeType: request.mimeType,
        fileSize: metadata.size,
        fileUrl: uploadResult.url,
        r2Key: storageKey,
        uploadedBy: request.uploadedBy || null,
        createdAt: managedFile.createdAt,
        updatedAt: managedFile.updatedAt
      });

      // 檢查是否需要產生縮圖
      let thumbnailUrl: string | undefined;
      if (this.metadataService.shouldGenerateThumbnail(metadata)) {
        try {
          thumbnailUrl = await this.generateThumbnail(managedFile, storageKey);
        } catch (error) {
          log.warn('Failed to generate thumbnail:', { error });
        }
      }

      return {
        success: true,
        file: {
          ...managedFile,
          thumbnailUrl
        },
        thumbnailUrl
      };

    } catch (error) {
      log.error('File upload failed:', {}, error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UPLOAD_FAILED
      };
    }
  }

  /**
   * 下載檔案
   */
  async downloadFile(
    fileId: string,
    options: FileDownloadOptions = {}
  ): Promise<FileDownloadResult> {
    try {
      // 獲取檔案記錄
      const fileRecord = await this.db
        .select()
        .from(fileAttachments)
        .where(eq(fileAttachments.id, fileId))
        .get();

      if (!fileRecord) {
        return {
          success: false,
          error: ERROR_MESSAGES.FILE_NOT_FOUND
        };
      }

      // 如果只需要 URL
      if (options.responseType === 'url') {
        const url = options.generateDownloadUrl
          ? await this.storageService.generateSignedUrl(
              fileRecord.r2Key,
              'read',
              options.urlExpiresIn
            )
          : fileRecord.fileUrl;

        return {
          success: true,
          url: url ?? undefined,
          metadata: options.includeMetadata
            ? {
                filename: fileRecord.filename,
                mimeType: fileRecord.mimeType,
                size: fileRecord.fileSize,
                extension: getFileExtension(fileRecord.filename, fileRecord.mimeType)
              }
            : undefined
        };
      }

      // 從儲存服務下載檔案
      const downloadResult = await this.storageService.downloadFile(fileRecord.r2Key);

      if (!downloadResult.success) {
        return {
          success: false,
          error: downloadResult.error || ERROR_MESSAGES.DOWNLOAD_FAILED
        };
      }

      return {
        success: true,
        data: downloadResult.data,
        contentType: fileRecord.mimeType,
        contentLength: fileRecord.fileSize,
        metadata: options.includeMetadata
          ? {
              filename: fileRecord.filename,
              mimeType: fileRecord.mimeType,
              size: fileRecord.fileSize,
              extension: getFileExtension(fileRecord.filename, fileRecord.mimeType)
            }
          : undefined
      };

    } catch (error) {
      log.error('File download failed:', {}, error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.DOWNLOAD_FAILED
      };
    }
  }

  /**
   * 刪除檔案
   */
  async deleteFile(fileId: string, _userId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // 獲取檔案記錄
      const fileRecord = await this.db
        .select()
        .from(fileAttachments)
        .where(eq(fileAttachments.id, fileId))
        .get();

      if (!fileRecord) {
        return {
          success: false,
          error: ERROR_MESSAGES.FILE_NOT_FOUND
        };
      }

      // 權限檢查（如果提供了使用者 ID）
      // 這裡可以添加更複雜的權限邏輯

      // 從儲存服務刪除檔案
      const deleteSuccess = await this.storageService.deleteFile(fileRecord.r2Key);

      if (!deleteSuccess) {
        log.warn('Failed to delete file from storage, continuing with database deletion');
      }

      // 從資料庫刪除記錄
      await this.db
        .delete(fileAttachments)
        .where(eq(fileAttachments.id, fileId));

      return { success: true };

    } catch (error) {
      log.error('File deletion failed:', {}, error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Deletion failed'
      };
    }
  }

  /**
   * 獲取檔案詳情
   */
  async getFileDetails(fileId: string): Promise<ManagedFile | null> {
    try {
      const fileRecord = await this.db
        .select()
        .from(fileAttachments)
        .where(eq(fileAttachments.id, fileId))
        .get();

      if (!fileRecord) {
        return null;
      }

      return this.convertToManagedFile(fileRecord);

    } catch (error) {
      log.error('Failed to get file details:', {}, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * 列出檔案
   */
  async listFiles(options: FileQueryOptions = {}): Promise<FileListResponse> {
    try {
      const {
        page = 1,
        pageSize = 20,
        type,
        conversationId,
        messageId,
        dateFrom,
        dateTo,
      } = options;

      const offset = (page - 1) * pageSize;

      // 建構查詢條件
      const conditions = [];

      if (conversationId) {
        // 注意：當前 schema 中沒有 conversationId 欄位
        // 這需要在資料庫 schema 中添加
      }

      if (messageId) {
        conditions.push(eq(fileAttachments.messageId, messageId));
      }

      if (type) {
        // 根據檔案類型過濾 MIME 類型
        const typePatterns = {
          image: 'image/%',
          video: 'video/%',
          audio: 'audio/%',
          document: 'application/%'
        };

        if (type in typePatterns) {
          conditions.push(like(fileAttachments.mimeType, typePatterns[type as keyof typeof typePatterns]));
        }
      }

      if (dateFrom) {
        conditions.push(gte(fileAttachments.createdAt, dateFrom));
      }

      if (dateTo) {
        conditions.push(lte(fileAttachments.createdAt, dateTo));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // 執行查詢
      const files = await this.db
        .select()
        .from(fileAttachments)
        .where(whereClause)
        .orderBy(desc(fileAttachments.createdAt))
        .limit(pageSize)
        .offset(offset);

      // 獲取總數
      const totalResult = await this.db
        .select({ count: sql<number>`COUNT(*)`.as('total') })
        .from(fileAttachments)
        .where(whereClause)
        .get();

      const total = Number(totalResult?.count) || 0;

      const items = files.map(file => this.convertToManagedFile(file));

      return {
        items,
        total,
        page,
        pageSize,
        hasNext: offset + pageSize < total,
        hasPrev: page > 1
      };

    } catch (error) {
      log.error('Failed to list files:', {}, error instanceof Error ? error : new Error(String(error)));
      return {
        items: [],
        total: 0,
        page: options.page || 1,
        pageSize: options.pageSize || 20,
        hasNext: false,
        hasPrev: false
      };
    }
  }

  /**
   * 獲取檔案統計
   */
  async getFileStatistics(period = '30d', filters: { uploadedBy?: string } = {}): Promise<FileStatistics> {
    try {
      // 計算日期範圍
      const now = new Date();
      const daysMap = { '24h': 1, '7d': 7, '30d': 30 };
      const days = daysMap[period as keyof typeof daysMap] || 30;
      const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const baseConditions = filters.uploadedBy
        ? [eq(fileAttachments.uploadedBy, filters.uploadedBy)]
        : [];
      const baseWhere = baseConditions.length > 0 ? and(...baseConditions) : undefined;
      const recentWhere = and(
        ...(baseWhere ? [baseWhere] : []),
        gte(fileAttachments.createdAt, fromDate.toISOString())
      );

      // 獲取總檔案數和大小
      const totalQuery = this.db
        .select({
          count: sql<number>`COUNT(*)`.as('count'),
          totalSize: sql<number>`SUM(file_size)`.as('totalSize')
        })
        .from(fileAttachments);
      const totalStats = baseWhere
        ? await totalQuery.where(baseWhere).get()
        : await totalQuery.get();

      const totalFiles = Number(totalStats?.count) || 0;
      const totalSize = Number(totalStats?.totalSize) || 0;

      // 獲取最近活動
      const recentActivity = await this.db
        .select({ count: sql<number>`COUNT(*)`.as('count') })
        .from(fileAttachments)
        .where(recentWhere)
        .get();

      const uploaded = Number(recentActivity?.count) || 0;
      const filesQuery = this.db
        .select({
          mimeType: fileAttachments.mimeType,
          filename: fileAttachments.filename,
          r2Key: fileAttachments.r2Key,
          fileSize: fileAttachments.fileSize
        })
        .from(fileAttachments);
      const files = baseWhere
        ? await filesQuery.where(baseWhere).all()
        : await filesQuery.all();

      const filesByType: FileStatistics['filesByType'] = {
        image: 0,
        video: 0,
        audio: 0,
        document: 0,
        archive: 0,
        other: 0
      };
      const filesByPlatform: FileStatistics['filesByPlatform'] = {
        line: 0,
        facebook: 0,
        system: 0,
        admin: 0
      };

      for (const file of files) {
        const extension = getFileExtension(file.filename, file.mimeType);
        const fileType = getFileType(file.mimeType, extension);
        filesByType[fileType] += 1;

        const platform = this.extractPlatformFromStorageKey(file.r2Key);
        filesByPlatform[platform] += 1;
      }

      return {
        totalFiles,
        totalSize,
        averageFileSize: totalFiles > 0 ? Math.round(totalSize / totalFiles) : 0,
        filesByType,
        filesByPlatform,
        storageUsage: {
          used: totalSize,
          available: -1, // 需要從儲存服務獲取
          percentage: -1
        },
        recentActivity: {
          uploaded,
          downloaded: 0, // 需要實作下載記錄
          deleted: 0, // 需要實作刪除記錄
          period
        }
      };

    } catch (error) {
      log.error('Failed to get file statistics:', {}, error instanceof Error ? error : new Error(String(error)));
      return {
        totalFiles: 0,
        totalSize: 0,
        averageFileSize: 0,
        filesByType: { image: 0, video: 0, audio: 0, document: 0, archive: 0, other: 0 },
        filesByPlatform: { line: 0, facebook: 0, system: 0, admin: 0 },
        storageUsage: { used: 0, available: 0, percentage: 0 },
        recentActivity: { uploaded: 0, downloaded: 0, deleted: 0, period }
      };
    }
  }

  /**
   * 批量操作檔案
   */
  async batchOperation(operation: BatchFileOperation): Promise<BatchFileResult> {
    const startTime = nowMs();
    const successful: string[] = [];
    const failed: Array<{ fileId: string; error: string }> = [];

    for (const fileId of operation.fileIds) {
      try {
        switch (operation.operation) {
          case 'delete':
            const deleteResult = await this.deleteFile(fileId);
            if (deleteResult.success) {
              successful.push(fileId);
            } else {
              failed.push({ fileId, error: deleteResult.error || 'Delete failed' });
            }
            break;

          default:
            failed.push({ fileId, error: `Unsupported operation: ${operation.operation}` });
        }
      } catch (error) {
        failed.push({
          fileId,
          error: error instanceof Error ? error.message : 'Operation failed'
        });
      }
    }

    return {
      successful,
      failed,
      summary: {
        total: operation.fileIds.length,
        successful: successful.length,
        failed: failed.length,
        processingTime: Date.now() - startTime
      }
    };
  }

  /**
   * 產生縮圖
   */
  private async generateThumbnail(file: ManagedFile, _originalKey: string): Promise<string | undefined> {
    if (file.type !== 'image') {
      return undefined;
    }

    return file.publicUrl || file.url;
  }

  private extractPlatformFromStorageKey(r2Key: string): keyof FileStatistics['filesByPlatform'] {
    const platform = r2Key.split('/')[1];
    if (platform === 'line' || platform === 'facebook' || platform === 'admin') {
      return platform;
    }
    return 'system';
  }

  /**
   * 轉換資料庫記錄為 ManagedFile
   */
  private convertToManagedFile(record: FileAttachmentRow): ManagedFile {
    const filename = record.filename;
    const mimeType = record.mimeType;
    const extension = filename.split('.').pop() || '';

    return {
      id: record.id,
      filename,
      mimeType,
      size: record.fileSize,
      extension,
      type: getFileType(mimeType),
      url: record.fileUrl || '',
      platform: 'system', // 需要從記錄中獲取
      metadata: {
        filename,
        mimeType,
        size: record.fileSize,
        extension
      },
      processingStatus: 'completed',
      createdAt: record.createdAt || nowISO(),
      updatedAt: record.updatedAt || nowISO()
    };
  }
}
