// File Management 主處理器
// 統一的檔案管理API端點

import { Hono, type Context } from 'hono';
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
  FileQueryOptions,
  FileType,
  FileUploadRequest,
  PlatformType,
  FileDownloadOptions
} from '@modules/file-management/types/file-types';
import { nowISO } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger';
import { fileContracts } from '@shared/api-contracts';
import { contractJson } from '@/utils/api-contract-response';
import {
  checkPresignedUrlStatus,
  confirmUpload,
  generatePresignedUrl
} from '@modules/file-management/handlers/presigned-handler';

const log = createContextLogger('FileMain');

type FileContext = Context<{ Bindings: Bindings }>;

const fileMainHandler = new Hono<{ Bindings: Bindings }>();

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

function toFileUploadResponse(
  file: NonNullable<Awaited<ReturnType<FileService['uploadFile']>>['file']>,
  thumbnailUrl?: string
) {
  return {
    fileId: file.id,
    filename: file.filename,
    size: file.size,
    mimeType: file.mimeType,
    platform: file.platform,
    url: file.url,
    publicUrl: file.publicUrl,
    thumbnailUrl
  };
}

async function handleFileStats(c: FileContext, period = '30d') {
  const payload = c.get('jwtPayload');
  if (!payload) {
    return unauthorizedResponse(c, 'Authentication required');
  }

  const fileService = new FileService(c.env);
  const stats = await fileService.getFileStatistics(period, {
    uploadedBy: payload.role === 'admin' ? undefined : payload.userId.toString()
  });

  return contractJson(c, fileContracts.stats, {
    success: true,
    data: stats,
    timestamp: nowISO()
  });
}

async function handleFileUpload(c: FileContext) {
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
    return contractJson(c, fileContracts.uploadFile, {
      success: false,
      error: result.error || 'Upload failed',
      metadata: result.errors ? { errors: result.errors } : undefined
    }, 400);
  }

  return contractJson(c, fileContracts.uploadFile, {
    success: true,
    data: toFileUploadResponse(result.file!, result.thumbnailUrl),
    message: 'File uploaded successfully',
    timestamp: nowISO()
  }, 201);
}

async function handleMultipleFileUpload(c: FileContext) {
  const payload = c.get('jwtPayload');
  if (!payload || !payload.userId) {
    return unauthorizedResponse(c, 'Authentication required');
  }

  const formData = await c.req.formData();
  const files = formData.getAll('files');
  const platform = (formData.get('platform') as PlatformType) || 'system';
  const conversationId = formData.get('conversationId') as string | undefined;
  const messageId = formData.get('messageId') as string | undefined;

  if (files.length === 0 || files.some(file => !(file instanceof File))) {
    return badRequestResponse(c, 'At least one file is required');
  }

  const fileService = new FileService(c.env);
  const uploaded = [];

  for (const file of files as File[]) {
    const result = await fileService.uploadFile({
      file: await file.arrayBuffer(),
      filename: file.name,
      mimeType: file.type,
      platform,
      conversationId,
      messageId,
      uploadedBy: payload.userId.toString()
    });

    if (!result.success || !result.file) {
      return contractJson(c, fileContracts.uploadMultipleFiles, {
        success: false,
        error: result.error || `Upload failed for ${file.name}`,
        metadata: result.errors ? { errors: result.errors } : undefined
      }, 400);
    }

    uploaded.push(toFileUploadResponse(result.file, result.thumbnailUrl));
  }

  return contractJson(c, fileContracts.uploadMultipleFiles, {
    success: true,
    data: uploaded,
    message: 'Files uploaded successfully',
    timestamp: nowISO()
  });
}

async function handleFileDownloadUrl(c: FileContext, fileId: string, expiresIn: number) {
  const options: FileDownloadOptions = {
    includeMetadata: true,
    responseType: 'url',
    generateDownloadUrl: true,
    urlExpiresIn: expiresIn
  };

  const fileService = new FileService(c.env);
  const result = await fileService.downloadFile(fileId, options);

  if (!result.success) {
    return contractJson(c, fileContracts.getDownloadUrl, {
      success: false,
      error: result.error || 'Download failed',
      timestamp: nowISO()
    }, 404);
  }

  return contractJson(c, fileContracts.getDownloadUrl, {
    success: true,
    data: {
      url: result.url || '',
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
    },
    timestamp: nowISO()
  });
}

async function handleFileSearch(c: FileContext) {
  const query = c.req.query('q') || '';
  const page = parseInt(c.req.query('page') || '1');
  const pageSize = parseInt(c.req.query('pageSize') || '20');
  const platform = c.req.query('platform');
  const type = c.req.query('type');
  const dateFrom = c.req.query('dateFrom');
  const dateTo = c.req.query('dateTo');

  if (!query) {
    return contractJson(c, fileContracts.search, {
      success: false,
      error: 'Search query is required',
      timestamp: nowISO()
    }, 400);
  }

  const options: FileQueryOptions = {
    page,
    pageSize,
    platform: parsePlatformType(platform),
    type: parseFileType(type),
    dateFrom,
    dateTo
  };

  const fileService = new FileService(c.env);
  const result = await fileService.listFiles(options);
  const filteredItems = result.items.filter(file =>
    file.filename.toLowerCase().includes(query.toLowerCase()) ||
    file.originalFilename?.toLowerCase().includes(query.toLowerCase())
  );

  return contractJson(c, fileContracts.search, {
    success: true,
    data: {
      items: filteredItems,
      total: filteredItems.length,
      page: result.page,
      pageSize: result.pageSize
    },
    timestamp: nowISO()
  });
}

async function handleDeleteMultiple(c: FileContext) {
  const payload = c.get('jwtPayload');
  if (!payload || !payload.userId) {
    return unauthorizedResponse(c, 'Authentication required');
  }

  const body = await c.req.json().catch(() => ({}));
  const fileIds = Array.isArray(body.fileIds) ? body.fileIds.filter((id: unknown) => typeof id === 'string') : [];

  if (fileIds.length === 0) {
    return contractJson(c, fileContracts.deleteMultiple, {
      success: false,
      error: 'fileIds must contain at least one file ID',
      timestamp: nowISO()
    }, 400);
  }

  const fileService = new FileService(c.env);
  const successful: string[] = [];
  const failed: string[] = [];

  for (const fileId of fileIds) {
    const result = await fileService.deleteFile(fileId, payload.userId.toString());
    if (result.success) {
      successful.push(fileId);
    } else {
      failed.push(fileId);
    }
  }

  return contractJson(c, fileContracts.deleteMultiple, {
    success: true,
    data: { successful, failed },
    timestamp: nowISO()
  });
}

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

// Shared contract routes: Presigned/direct upload support
fileMainHandler.get('/presigned-url/status', jwtAuth, checkPresignedUrlStatus);
fileMainHandler.post('/presigned-url', jwtAuth, generatePresignedUrl);

// 檔案統計 (IMPORTANT: 必須在 /:fileId 之前註冊，避免路由攔截)
fileMainHandler.get('/stats/summary', jwtAuth, async (c) => {
  try {
    return handleFileStats(c, c.req.query('period') || '30d');

  } catch (error) {
    log.error('File statistics error:', {}, error instanceof Error ? error : new Error(String(error)));
    return handleApiError(error, c);
  }
});

// Shared contract route: GET /api/files/stats?period=...
fileMainHandler.get('/stats', jwtAuth, async (c) => {
  try {
    return handleFileStats(c, c.req.query('period') || '30d');
  } catch (error) {
    log.error('File statistics error:', {}, error instanceof Error ? error : new Error(String(error)));
    return handleApiError(error, c);
  }
});

// 檔案上傳
fileMainHandler.post('/upload', jwtAuth, async (c) => {
  try {
    return handleFileUpload(c);

  } catch (error) {
    log.error('File upload error:', {}, error instanceof Error ? error : new Error(String(error)));
    return handleApiError(error, c);
  }
});

// Shared contract route: POST /api/files/upload-multiple
fileMainHandler.post('/upload-multiple', jwtAuth, async (c) => {
  try {
    return handleMultipleFileUpload(c);

  } catch (error) {
    log.error('Multiple file upload error:', {}, error instanceof Error ? error : new Error(String(error)));
    return handleApiError(error, c);
  }
});

// Legacy upload route kept for backwards compatibility.
fileMainHandler.post('/', jwtAuth, async (c) => {
  try {
    return handleFileUpload(c);

  } catch (error) {
    log.error('File upload error:', {}, error instanceof Error ? error : new Error(String(error)));
    return handleApiError(error, c);
  }
});

// Shared contract route: POST /api/files/:fileId/confirm
fileMainHandler.post('/:fileId/confirm', jwtAuth, confirmUpload);

// Shared contract route: GET /api/files/search
fileMainHandler.get('/search', jwtAuth, async (c) => {
  try {
    return handleFileSearch(c);

  } catch (error) {
    log.error('File search error:', {}, error instanceof Error ? error : new Error(String(error)));
    return handleApiError(error, c);
  }
});

// Shared contract route: GET /api/files/:fileId/download-url
fileMainHandler.get('/:fileId/download-url', jwtAuth, async (c) => {
  try {
    const fileId = c.req.param('fileId');

    if (!fileId) {
      return badRequestResponse(c, 'File ID is required');
    }

    const expiresIn = parseInt(c.req.query('expiresIn') || '3600');
    return handleFileDownloadUrl(c, fileId, Number.isFinite(expiresIn) ? expiresIn : 3600);

  } catch (error) {
    log.error('File download URL error:', {}, error instanceof Error ? error : new Error(String(error)));
    return handleApiError(error, c);
  }
});

// Shared contract route: POST /api/files/delete-multiple
fileMainHandler.post('/delete-multiple', jwtAuth, async (c) => {
  try {
    return handleDeleteMultiple(c);

  } catch (error) {
    log.error('Multiple file deletion error:', {}, error instanceof Error ? error : new Error(String(error)));
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

    if (urlOnly || responseType === 'url') {
      return handleFileDownloadUrl(c, fileId, 3600);
    }

    if (!responseType) {
      const fileService = new FileService(c.env);
      const file = await fileService.getFileDetails(fileId);

      if (!file) {
        return contractJson(c, fileContracts.getDetails, {
          success: false,
          error: 'File not found',
          timestamp: nowISO()
        }, 404);
      }

      return contractJson(c, fileContracts.getDetails, {
        success: true,
        data: file,
        timestamp: nowISO()
      });
    }

    const options: FileDownloadOptions = {
      includeMetadata: true,
      responseType: responseType || 'stream',
      generateDownloadUrl: false,
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
      return contractJson(c, fileContracts.delete, {
        success: false,
        error: result.error || 'Delete failed'
      }, result.error?.includes('not found') ? 404 : 400);
    }

    return contractJson(c, fileContracts.delete, {
      success: true,
      data: { success: true },
      message: 'File deleted successfully',
      timestamp: nowISO()
    });

  } catch (error) {
    log.error('File deletion error:', {}, error instanceof Error ? error : new Error(String(error)));
    return handleApiError(error, c);
  }
});

export default fileMainHandler;
