/**
 * Refactored File Attachment Handler
 * 重構後的檔案附件處理器 - 使用新的檔案管理模組
 */

import type { Context } from 'hono';
import type { Bindings } from '../types';
import {
  successResponse,
  paginatedResponse,
  validationErrorResponse,
  forbiddenResponse,
  notFoundResponse,
  errorResponse,
  handleApiError
} from '../utils/api-response';

// 使用新的檔案管理模組
import { FileService } from '@modules/file-management/services/file-service';
import { createFileHandler } from '@modules/file-management/handlers/file-handler';
import { createUploadHandler } from '@modules/file-management/handlers/upload-handler';
import {
  fileValidationMiddleware,
  fileIdValidation
} from '../modules/file-management/middleware/file-validation';
import {
  uploadLimiterMiddleware
} from '../modules/file-management/middleware/upload-limiter';

/**
 * 重構後的附件處理器
 * 這個類別作為舊 API 和新檔案管理模組之間的橋樑
 */
export class RefactoredAttachmentHandler {
  private fileHandler: any;
  private uploadHandler: any;
  private fileService: FileService;

  constructor(env: Bindings) {
    this.fileHandler = createFileHandler(env);
    this.uploadHandler = createUploadHandler(env);
    this.fileService = new FileService(env);
  }

  /**
   * 上傳檔案附件 - 重構版本
   */
  upload = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      // 使用新的檔案處理器
      return await this.fileHandler.upload(c);
    } catch (error) {
      return handleApiError(error, c);
    }
  };

  /**
   * 獲取檔案附件 - 重構版本
   */
  get = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const attachmentId = c.req.param('attachmentId');

      // 使用新的檔案服務
      const file = await this.fileService.getFileDetails(attachmentId);

      if (!file) {
        return notFoundResponse(c, 'Attachment');
      }

      // 轉換為舊的回應格式以保持相容性
      const response = {
        id: file.id,
        messageId: file.messageId,
        filename: file.filename,
        mimeType: file.mimeType,
        fileSize: file.size,
        fileUrl: file.url,
        url: file.url,
        uploadStatus: file.processingStatus === 'completed' ? 'uploaded' : 'pending',
        createdAt: file.createdAt
      };

      return successResponse(c, response, 'Attachment retrieved successfully');
    } catch (error) {
      return handleApiError(error, c);
    }
  };

  /**
   * 下載檔案 - 重構版本
   */
  download = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const attachmentId = c.req.param('attachmentId');

      // 使用新的檔案處理器
      return await this.fileHandler.download(c);
    } catch (error) {
      return handleApiError(error, c);
    }
  };

  /**
   * 刪除檔案附件 - 重構版本
   */
  delete = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const attachmentId = c.req.param('attachmentId');
      const payload = c.get('jwtPayload');

      // 使用新的檔案服務
      const result = await this.fileService.deleteFile(
        attachmentId,
        payload?.userId?.toString()
      );

      if (!result.success) {
        if (result.error?.includes('not found')) {
          return notFoundResponse(c, 'Attachment');
        }
        if (result.error?.includes('permission')) {
          return forbiddenResponse(c, result.error);
        }
        return errorResponse(c, result.error || 'Delete failed', 400);
      }

      return successResponse(c, null, 'Attachment deleted successfully');
    } catch (error) {
      return handleApiError(error, c);
    }
  };

  /**
   * 列出檔案附件 - 重構版本
   */
  list = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const page = parseInt(c.req.query('page') || '1');
      const pageSize = parseInt(c.req.query('pageSize') || '20');
      const fileType = c.req.query('type'); // image, document
      const conversationId = c.req.query('conversationId');
      const messageId = c.req.query('messageId');

      // 使用新的檔案服務
      const result = await this.fileService.listFiles({
        page,
        pageSize,
        type: fileType as any,
        conversationId,
        messageId
      });

      // 轉換為舊的回應格式
      const attachments = result.items.map(file => ({
        id: file.id,
        messageId: file.messageId,
        filename: file.filename,
        mimeType: file.mimeType,
        fileSize: file.size,
        fileUrl: file.url,
        url: file.url,
        uploadStatus: file.processingStatus === 'completed' ? 'uploaded' : 'pending',
        createdAt: file.createdAt
      }));

      return paginatedResponse(c, attachments, {
        page: result.page,
        limit: result.pageSize,
        total: result.total
      }, 'Attachments retrieved successfully');
    } catch (error) {
      return handleApiError(error, c);
    }
  };

  /**
   * 根據對話獲取附件
   */
  getByConversation = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      return await this.fileHandler.getByConversation(c);
    } catch (error) {
      return handleApiError(error, c);
    }
  };

  /**
   * 根據訊息獲取附件
   */
  getByMessage = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      return await this.fileHandler.getByMessage(c);
    } catch (error) {
      return handleApiError(error, c);
    }
  };

  /**
   * 批量操作
   */
  batchOperation = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      return await this.fileHandler.batchOperation(c);
    } catch (error) {
      return handleApiError(error, c);
    }
  };

  /**
   * 獲取檔案統計
   */
  getStatistics = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      return await this.fileHandler.getStatistics(c);
    } catch (error) {
      return handleApiError(error, c);
    }
  };
}

/**
 * 建立重構後的附件處理器實例
 */
export function createRefactoredAttachmentHandler(env: Bindings): RefactoredAttachmentHandler {
  return new RefactoredAttachmentHandler(env);
}

/**
 * 向後相容的附件處理器
 * 保持與原有 API 的完全相容性
 */
export const attachmentHandler = {
  // 上傳檔案附件
  upload: async (c: Context<{ Bindings: Bindings }>) => {
    const handler = createRefactoredAttachmentHandler(c.env);
    return await handler.upload(c);
  },

  // 獲取檔案附件
  get: async (c: Context<{ Bindings: Bindings }>) => {
    const handler = createRefactoredAttachmentHandler(c.env);
    return await handler.get(c);
  },

  // 下載檔案
  download: async (c: Context<{ Bindings: Bindings }>) => {
    const handler = createRefactoredAttachmentHandler(c.env);
    return await handler.download(c);
  },

  // 刪除檔案附件
  delete: async (c: Context<{ Bindings: Bindings }>) => {
    const handler = createRefactoredAttachmentHandler(c.env);
    return await handler.delete(c);
  },

  // 獲取對話的所有附件
  list: async (c: Context<{ Bindings: Bindings }>) => {
    const handler = createRefactoredAttachmentHandler(c.env);
    return await handler.list(c);
  }
};

/**
 * 新的檔案管理中間件組合
 * 用於新的路由
 */
export const fileManagementMiddleware = {
  // 基本檔案驗證
  validation: fileValidationMiddleware({
    platform: 'system',
    requireAuthentication: true
  }),

  // ID 驗證
  idValidation: fileIdValidation,

  // 上傳限制
  uploadLimiter: uploadLimiterMiddleware({
    maxConcurrentUploads: 3,
    maxUploadsPerMinute: 20,
    maxUploadsPerHour: 100
  }),

  // LINE 平台專用驗證
  lineValidation: fileValidationMiddleware({
    platform: 'line',
    maxFiles: 5,
    requireAuthentication: true
  }),

  // Facebook 平台專用驗證
  facebookValidation: fileValidationMiddleware({
    platform: 'facebook',
    maxFiles: 10,
    requireAuthentication: true
  })
};