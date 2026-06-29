/**
 * File Management API Handler
 * 檔案管理API處理器
 */

import type { Context } from 'hono';
import type { Bindings } from '@/types';
import type {
  FileUploadRequest,
  FileQueryOptions,
  BatchFileOperation,
  FileType,
  PlatformType
} from '../types/file-types';

import { FileService } from '@modules/file-management/services/file-service';
import {
  successResponse,
  paginatedResponse,
  validationErrorResponse,
  forbiddenResponse,
  notFoundResponse,
  errorResponse,
  handleApiError
} from '@/utils/api-response';

import { ERROR_MESSAGES } from '@modules/file-management/constants/error-codes';

function parsePlatformType(value: unknown): PlatformType | undefined {
  switch (value) {
    case 'line':
    case 'facebook':
    case 'system':
    case 'admin':
      return value;
    default:
      return undefined;
  }
}

function parseFileType(value: unknown): FileType | undefined {
  switch (value) {
    case 'image':
    case 'video':
    case 'audio':
    case 'document':
    case 'archive':
    case 'other':
      return value;
    default:
      return undefined;
  }
}

function parseFileSortBy(value: unknown): FileQueryOptions['sortBy'] {
  switch (value) {
    case 'createdAt':
    case 'filename':
    case 'size':
      return value;
    default:
      return 'createdAt';
  }
}

function parseSortOrder(value: unknown): FileQueryOptions['sortOrder'] {
  return value === 'asc' ? 'asc' : 'desc';
}

export class FileHandler {
  private fileService: FileService;

  constructor(env: Bindings) {
    this.fileService = new FileService(env);
  }

  /**
   * 上傳檔案
   */
  upload = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      // 解析 FormData
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      const platform = formData.get('platform');
      const conversationId = formData.get('conversationId') as string;
      const messageId = formData.get('messageId') as string;

      if (!file) {
        return validationErrorResponse(c, [
          { field: 'file', message: 'No file provided' }
        ]);
      }

      // 建立上傳請求
      const uploadRequest: FileUploadRequest = {
        file,
        filename: file.name,
        mimeType: file.type,
        platform: parsePlatformType(platform) ?? 'system',
        conversationId,
        messageId,
        uploadedBy: payload?.userId?.toString(),
        options: {
          generateThumbnail: true,
          compress: true
        }
      };

      // 執行上傳
      const result = await this.fileService.uploadFile(uploadRequest);

      if (!result.success) {
        if (result.errors) {
          return validationErrorResponse(c, result.errors.map(err => ({
            field: err.field || 'file',
            message: err.message
          })));
        }
        return errorResponse(c, result.error || ERROR_MESSAGES.UPLOAD_FAILED, 400);
      }

      return successResponse(c, {
        id: result.file?.id,
        url: result.file?.url,
        publicUrl: result.file?.publicUrl,
        thumbnailUrl: result.thumbnailUrl,
        filename: result.file?.filename,
        size: result.file?.size,
        mimeType: result.file?.mimeType,
        type: result.file?.type,
        metadata: result.file?.metadata
      }, 'File uploaded successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  /**
   * 獲取檔案詳情
   */
  getDetails = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      if (!payload || !payload.userId) {
        return forbiddenResponse(c, 'Authentication required');
      }

      const fileId = c.req.param('fileId');

      if (!fileId) {
        return validationErrorResponse(c, [
          { field: 'fileId', message: 'File ID is required' }
        ]);
      }

      const file = await this.fileService.getFileDetails(fileId, {
        uploadedBy: payload.role === 'admin' ? undefined : payload.userId.toString()
      });

      if (!file) {
        return notFoundResponse(c, 'File');
      }

      return successResponse(c, file, 'File details retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  /**
   * 下載檔案
   */
  download = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      if (!payload || !payload.userId) {
        return forbiddenResponse(c, 'Authentication required');
      }

      const fileId = c.req.param('fileId');
      const inline = c.req.query('inline') === 'true';

      if (!fileId) {
        return validationErrorResponse(c, [
          { field: 'fileId', message: 'File ID is required' }
        ]);
      }

      const result = await this.fileService.downloadFile(fileId, {
        responseType: 'buffer',
        includeMetadata: true,
        uploadedBy: payload.role === 'admin' ? undefined : payload.userId.toString()
      });

      if (!result.success) {
        return errorResponse(c, result.error || ERROR_MESSAGES.DOWNLOAD_FAILED, 404);
      }

      if (!result.data || !result.metadata) {
        return errorResponse(c, ERROR_MESSAGES.FILE_NOT_FOUND, 404);
      }

      // 設定回應標頭
      const headers: Record<string, string> = {
        'Content-Type': result.contentType || 'application/octet-stream',
        'Content-Length': result.contentLength?.toString() || '0'
      };

      if (result.metadata.filename) {
        const disposition = inline ? 'inline' : 'attachment';
        headers['Content-Disposition'] = `${disposition}; filename="${result.metadata.filename}"`;
      }

      return new Response(result.data, { headers });

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  /**
   * 獲取檔案下載URL
   */
  getDownloadUrl = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      if (!payload || !payload.userId) {
        return forbiddenResponse(c, 'Authentication required');
      }

      const fileId = c.req.param('fileId');
      const expiresIn = parseInt(c.req.query('expiresIn') || '3600');

      if (!fileId) {
        return validationErrorResponse(c, [
          { field: 'fileId', message: 'File ID is required' }
        ]);
      }

      const result = await this.fileService.downloadFile(fileId, {
        responseType: 'url',
        generateDownloadUrl: true,
        urlExpiresIn: expiresIn,
        uploadedBy: payload.role === 'admin' ? undefined : payload.userId.toString()
      });

      if (!result.success) {
        return errorResponse(c, result.error || ERROR_MESSAGES.DOWNLOAD_FAILED, 404);
      }

      return successResponse(c, {
        url: result.url,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
      }, 'Download URL generated successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  /**
   * 刪除檔案
   */
  delete = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const fileId = c.req.param('fileId');
      const payload = c.get('jwtPayload');

      if (!fileId) {
        return validationErrorResponse(c, [
          { field: 'fileId', message: 'File ID is required' }
        ]);
      }

      const result = await this.fileService.deleteFile(
        fileId,
        payload?.userId?.toString()
      );

      if (!result.success) {
        return errorResponse(c, result.error || 'Delete failed', 400);
      }

      return successResponse(c, null, 'File deleted successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  /**
   * 列出檔案
   */
  list = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      if (!payload || !payload.userId) {
        return forbiddenResponse(c, 'Authentication required');
      }

      const page = parseInt(c.req.query('page') || '1');
      const pageSize = parseInt(c.req.query('pageSize') || '20');
      const platform = c.req.query('platform');
      const type = c.req.query('type');
      const conversationId = c.req.query('conversationId');
      const messageId = c.req.query('messageId');
      const requestedUploadedBy = c.req.query('uploadedBy');
      const uploadedBy = payload.role === 'admin' ? requestedUploadedBy : payload.userId.toString();
      const dateFrom = c.req.query('dateFrom');
      const dateTo = c.req.query('dateTo');
      const sortBy = c.req.query('sortBy') || 'createdAt';
      const sortOrder = c.req.query('sortOrder') || 'desc';

      const options: FileQueryOptions = {
        page,
        pageSize,
        platform: parsePlatformType(platform),
        type: parseFileType(type),
        conversationId,
        messageId,
        uploadedBy,
        dateFrom,
        dateTo,
        sortBy: parseFileSortBy(sortBy),
        sortOrder: parseSortOrder(sortOrder)
      };

      const result = await this.fileService.listFiles(options);

      return paginatedResponse(c, result.items, {
        page: result.page,
        limit: result.pageSize,
        total: result.total
      }, 'Files retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  /**
   * 獲取檔案統計
   */
  getStatistics = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      if (!payload || !payload.userId) {
        return forbiddenResponse(c, 'Authentication required');
      }

      const period = c.req.query('period') || '30d';

      const stats = await this.fileService.getFileStatistics(period, {
        uploadedBy: payload.role === 'admin' ? undefined : payload.userId.toString()
      });

      return successResponse(c, stats, 'File statistics retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  /**
   * 批量操作檔案
   */
  batchOperation = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      const body = await c.req.json() as BatchFileOperation;

      // 驗證輸入
      if (!body.operation) {
        return validationErrorResponse(c, [
          { field: 'operation', message: 'Operation is required' }
        ]);
      }

      if (!body.fileIds || !Array.isArray(body.fileIds) || body.fileIds.length === 0) {
        return validationErrorResponse(c, [
          { field: 'fileIds', message: 'File IDs array is required' }
        ]);
      }

      // 權限檢查
      if (!payload || !payload.userId) {
        return forbiddenResponse(c, 'Authentication required for batch operations');
      }

      const result = await this.fileService.batchOperation(body);

      return successResponse(c, result, 'Batch operation completed');

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  /**
   * 搜尋檔案
   */
  search = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      if (!payload || !payload.userId) {
        return forbiddenResponse(c, 'Authentication required');
      }

      const query = c.req.query('q') || '';
      const page = parseInt(c.req.query('page') || '1');
      const pageSize = parseInt(c.req.query('pageSize') || '20');
      const platform = c.req.query('platform');
      const type = c.req.query('type');
      const dateFrom = c.req.query('dateFrom');
      const dateTo = c.req.query('dateTo');

      if (!query) {
        return validationErrorResponse(c, [
          { field: 'q', message: 'Search query is required' }
        ]);
      }

      // 基本的檔名搜尋實作
      const options: FileQueryOptions = {
        page,
        pageSize,
        platform: parsePlatformType(platform),
        type: parseFileType(type),
        dateFrom,
        dateTo,
        uploadedBy: payload.role === 'admin' ? undefined : payload.userId.toString()
      };

      const result = await this.fileService.listFiles(options);

      // 過濾包含搜尋關鍵字的檔案
      const filteredItems = result.items.filter(file =>
        file.filename.toLowerCase().includes(query.toLowerCase()) ||
        file.originalFilename?.toLowerCase().includes(query.toLowerCase())
      );

      return paginatedResponse(c, filteredItems, {
        page: result.page,
        limit: result.pageSize,
        total: filteredItems.length
      }, 'Search results retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  /**
   * 根據對話ID獲取檔案
   */
  getByConversation = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      if (!payload || !payload.userId) {
        return forbiddenResponse(c, 'Authentication required');
      }

      const conversationId = c.req.param('conversationId');
      const page = parseInt(c.req.query('page') || '1');
      const pageSize = parseInt(c.req.query('pageSize') || '20');
      const type = c.req.query('type');

      if (!conversationId) {
        return validationErrorResponse(c, [
          { field: 'conversationId', message: 'Conversation ID is required' }
        ]);
      }

      const options: FileQueryOptions = {
        page,
        pageSize,
        conversationId,
        type: parseFileType(type),
        uploadedBy: payload.role === 'admin' ? undefined : payload.userId.toString()
      };

      const result = await this.fileService.listFiles(options);

      return paginatedResponse(c, result.items, {
        page: result.page,
        limit: result.pageSize,
        total: result.total
      }, 'Conversation files retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  /**
   * 根據訊息ID獲取檔案
   */
  getByMessage = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      if (!payload || !payload.userId) {
        return forbiddenResponse(c, 'Authentication required');
      }

      const messageId = c.req.param('messageId');

      if (!messageId) {
        return validationErrorResponse(c, [
          { field: 'messageId', message: 'Message ID is required' }
        ]);
      }

      const result = await this.fileService.listFiles({
        messageId,
        uploadedBy: payload.role === 'admin' ? undefined : payload.userId.toString(),
        pageSize: 100 // 假設一個訊息不會有超過100個檔案
      });

      return successResponse(c, result.items, 'Message files retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  };
}

/**
 * 建立檔案處理器實例
 */
export function createFileHandler(env: Bindings): FileHandler {
  return new FileHandler(env);
}
