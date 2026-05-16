// File Management 主處理器
// 統一的檔案管理API端點

import { Hono } from 'hono';
import { jwtAuth } from '@/middleware/auth';
import type { Bindings } from '@/types';
import {
  successResponse,
  unauthorizedResponse,
  badRequestResponse,
  handleApiError
} from '@/utils/api-response';
import { PLATFORMS } from '@/constants/platforms';
import { FileService } from '@modules/file-management/services/file-service';
import type {
  FileUploadRequest,
  PlatformType,
  FileDownloadOptions
} from '@modules/file-management/types/file-types';
import { nowISO } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('FileMain');

const fileMainHandler = new Hono<{ Bindings: Bindings }>();

// 檔案管理健康檢查
fileMainHandler.get('/health', async (c) => {
  try {
    return successResponse(c, {
      status: 'healthy',
      module: 'file-management',
      timestamp: nowISO(),
      r2Available: !!c.env.R2_BUCKET,
      dbAvailable: !!c.env.DB
    });
  } catch (error) {
    return handleApiError(error, c);
  }
});

// 獲取檔案資訊
fileMainHandler.get('/info', jwtAuth, async (c) => {
  try {
    return successResponse(c, {
      message: 'File management info endpoint',
      features: [
        'File upload (multipart/form-data)',
        'File download (streaming)',
        'File validation (size, type, platform)',
        'Storage management (R2)',
        'Metadata extraction',
        'Thumbnail generation (images)'
      ],
      limits: {
        maxFileSize: '10MB',
        allowedTypes: ['image/*', 'video/*', 'audio/*', 'application/pdf', 'text/*'],
        platforms: [PLATFORMS.LINE, PLATFORMS.FACEBOOK, PLATFORMS.SYSTEM]
      }
    });
  } catch (error) {
    return handleApiError(error, c);
  }
});

// 檔案統計 (IMPORTANT: 必須在 /:fileId 之前註冊，避免路由攔截)
fileMainHandler.get('/stats/summary', jwtAuth, async (c) => {
  try {
    const payload = c.get('jwtPayload');
    if (!payload) {
      return unauthorizedResponse(c, 'Authentication required');
    }

    const fileService = new FileService(c.env);
    const stats = await fileService.getFileStatistics('30d', {
      uploadedBy: payload.role === 'admin' ? undefined : payload.userId.toString()
    });

    return successResponse(c, stats);

  } catch (error) {
    log.error('File statistics error:', {}, error instanceof Error ? error : new Error(String(error)));
    return handleApiError(error, c);
  }
});

// 檔案上傳
fileMainHandler.post('/', jwtAuth, async (c) => {
  try {
    const payload = c.get('jwtPayload');
    if (!payload || !payload.userId) {
      return unauthorizedResponse(c, 'Authentication required');
    }

    // 解析 multipart/form-data
    const formData = await c.req.formData();
    const file = formData.get('file');
    const platform = (formData.get('platform') as PlatformType) || 'system';
    const conversationId = formData.get('conversationId') as string | undefined;
    const messageId = formData.get('messageId') as string | undefined;

    // 驗證文件
    if (!file || !(file instanceof File)) {
      return badRequestResponse(c, 'File is required');
    }

    // 獲取文件內容
    const fileBuffer = await file.arrayBuffer();

    // 構建上傳請求
    const uploadRequest: FileUploadRequest = {
      file: fileBuffer,
      filename: file.name,
      mimeType: file.type,
      platform,
      conversationId,
      messageId,
      uploadedBy: payload.userId.toString()
    };

    // 執行上傳
    const fileService = new FileService(c.env);
    const result = await fileService.uploadFile(uploadRequest);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error || 'Upload failed',
        errors: result.errors
      }, 400);
    }

    return successResponse(c, {
      fileId: result.file!.id,
      filename: result.file!.filename,
      size: result.file!.size,
      mimeType: result.file!.mimeType,
      url: result.file!.url,
      publicUrl: result.file!.publicUrl,
      thumbnailUrl: result.thumbnailUrl,
      type: result.file!.type,
      createdAt: result.file!.createdAt
    }, 'File uploaded successfully', 201);

  } catch (error) {
    log.error('File upload error:', {}, error instanceof Error ? error : new Error(String(error)));
    return handleApiError(error, c);
  }
});

// 檔案下載
fileMainHandler.get('/:fileId', jwtAuth, async (c) => {
  try {
    const fileId = c.req.param('fileId');

    if (!fileId) {
      return badRequestResponse(c, 'File ID is required');
    }

    // 獲取查詢參數
    const responseType = c.req.query('responseType') as 'stream' | 'buffer' | 'url' | undefined;
    const urlOnly = c.req.query('urlOnly') === 'true';

    const options: FileDownloadOptions = {
      includeMetadata: true,
      responseType: urlOnly ? 'url' : (responseType || 'stream'),
      generateDownloadUrl: urlOnly,
      urlExpiresIn: 3600 // 1 hour
    };

    // 執行下載
    const fileService = new FileService(c.env);
    const result = await fileService.downloadFile(fileId, options);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error || 'Download failed'
      }, 404);
    }

    // 如果只返回 URL
    if (urlOnly || responseType === 'url') {
      return successResponse(c, {
        url: result.url,
        metadata: result.metadata
      });
    }

    // 返回文件流
    if (result.data) {
      return new Response(result.data as ArrayBuffer, {
        status: 200,
        headers: {
          'Content-Type': result.contentType || 'application/octet-stream',
          'Content-Length': result.contentLength?.toString() || '0',
          'Content-Disposition': `attachment; filename="${result.metadata?.filename || 'download'}"`,
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    return badRequestResponse(c, 'No file data available');

  } catch (error) {
    log.error('File download error:', {}, error instanceof Error ? error : new Error(String(error)));
    return handleApiError(error, c);
  }
});

// 獲取文件列表
fileMainHandler.get('/', jwtAuth, async (c) => {
  try {
    const payload = c.get('jwtPayload');
    if (!payload) {
      return unauthorizedResponse(c, 'Authentication required');
    }

    // 解析查詢參數
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const platform = c.req.query('platform') as PlatformType | undefined;
    const conversationId = c.req.query('conversationId');

    const queryOptions = {
      page,
      pageSize,
      platform,
      conversationId,
      uploadedBy: payload.role !== 'admin' ? payload.userId.toString() : undefined
    };

    const fileService = new FileService(c.env);
    const result = await fileService.listFiles(queryOptions);

    return successResponse(c, result);

  } catch (error) {
    log.error('File list error:', {}, error instanceof Error ? error : new Error(String(error)));
    return handleApiError(error, c);
  }
});

// 檔案刪除
fileMainHandler.delete('/:fileId', jwtAuth, async (c) => {
  try {
    const payload = c.get('jwtPayload');
    if (!payload || !payload.userId) {
      return unauthorizedResponse(c, 'Authentication required');
    }

    const fileId = c.req.param('fileId');

    if (!fileId) {
      return badRequestResponse(c, 'File ID is required');
    }

    // 執行刪除
    const fileService = new FileService(c.env);
    const result = await fileService.deleteFile(fileId, payload.userId.toString());

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error || 'Delete failed'
      }, result.error?.includes('not found') ? 404 : 400);
    }

    return successResponse(c, {
      message: 'File deleted successfully',
      fileId
    });

  } catch (error) {
    log.error('File deletion error:', {}, error instanceof Error ? error : new Error(String(error)));
    return handleApiError(error, c);
  }
});

export default fileMainHandler;
