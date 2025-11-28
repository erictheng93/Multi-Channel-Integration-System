/**
 * File Management Routes
 * 檔案管理路由配置
 */

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { jwtAuth } from '@/middleware/auth';

// 導入處理器
import { createFileHandler } from '@modules/file-management/handlers/file-handler';
import { createUploadHandler } from '@modules/file-management/handlers/upload-handler';
import {
  generatePresignedUrl,
  confirmUpload,
  checkPresignedUrlStatus,
  getFileStatus
} from '@modules/file-management/handlers/presigned-handler';

// 導入中間件
import {
  fileValidationMiddleware,
  fileIdValidation,
  fileTypeMiddleware,
  fileSizeMiddleware,
  fileContentMiddleware
} from '../middleware/file-validation';
import {
  uploadLimiterMiddleware,
  fileSizeTotalMiddleware,
  uploadTimeoutMiddleware
} from '../middleware/upload-limiter';

// 導入配置
import { FILE_SIZE_LIMITS, ALLOWED_MIME_TYPES } from '@modules/file-management/constants/file-config';

/**
 * 建立檔案管理路由
 */
export function createFileRoutes() {
  const fileRoutes = new Hono<{ Bindings: Bindings }>();

  // 中間件配置
  const commonMiddleware = [
    jwtAuth, // 所有檔案操作都需要認證
    uploadTimeoutMiddleware(30000) // 30秒超時
  ];

  const uploadMiddleware = [
    ...commonMiddleware,
    uploadLimiterMiddleware({
      maxConcurrentUploads: 3,
      maxUploadsPerMinute: 20,
      maxUploadsPerHour: 100
    }),
    fileValidationMiddleware({
      platform: 'system',
      requireAuthentication: true
    })
  ];

  // === 檔案上傳路由 ===

  // 單檔上傳
  fileRoutes.post('/upload', ...uploadMiddleware, async (c) => {
    const uploadHandler = createUploadHandler(c.env);
    return await uploadHandler.uploadSingle(c);
  });

  // 多檔上傳
  fileRoutes.post('/upload/multiple',
    ...commonMiddleware,
    uploadLimiterMiddleware({
      maxConcurrentUploads: 2,
      maxUploadsPerMinute: 10,
      maxFilesPerRequest: 10
    }),
    fileValidationMiddleware({
      platform: 'system',
      maxFiles: 10,
      requireAuthentication: true
    }),
    async (c) => {
      const uploadHandler = createUploadHandler(c.env);
      return await uploadHandler.uploadMultiple(c);
    }
  );

  // 分塊上傳初始化
  fileRoutes.post('/upload/chunked/init', ...commonMiddleware, async (c) => {
    const uploadHandler = createUploadHandler(c.env);
    return await uploadHandler.initChunkedUpload(c);
  });

  // 上傳分塊
  fileRoutes.put('/upload/chunked/:uploadId/chunk', ...commonMiddleware, async (c) => {
    const uploadHandler = createUploadHandler(c.env);
    return await uploadHandler.uploadChunk(c);
  });

  // 完成分塊上傳
  fileRoutes.post('/upload/chunked/:uploadId/complete', ...commonMiddleware, async (c) => {
    const uploadHandler = createUploadHandler(c.env);
    return await uploadHandler.completeChunkedUpload(c);
  });

  // 取消分塊上傳
  fileRoutes.delete('/upload/chunked/:uploadId', ...commonMiddleware, async (c) => {
    const uploadHandler = createUploadHandler(c.env);
    return await uploadHandler.cancelChunkedUpload(c);
  });

  // === 🆕 Presigned URL 路由 (直接上傳到 R2) ===

  // 檢查 Presigned URL 服務狀態
  fileRoutes.get('/presigned-url/status', jwtAuth, checkPresignedUrlStatus);

  // 生成 Presigned URL
  fileRoutes.post('/presigned-url', jwtAuth, generatePresignedUrl);

  // 確認上傳完成 (需要在 :fileId 路由之前註冊)
  fileRoutes.post('/:fileId/confirm', jwtAuth, confirmUpload);

  // 獲取檔案上傳狀態
  fileRoutes.get('/:fileId/status', jwtAuth, getFileStatus);

  // === 檔案操作路由 ===

  // 獲取檔案列表
  fileRoutes.get('/', ...commonMiddleware, async (c) => {
    const fileHandler = createFileHandler(c.env);
    return await fileHandler.list(c);
  });

  // 搜尋檔案
  fileRoutes.get('/search', ...commonMiddleware, async (c) => {
    const fileHandler = createFileHandler(c.env);
    return await fileHandler.search(c);
  });

  // 獲取檔案統計
  fileRoutes.get('/stats', ...commonMiddleware, async (c) => {
    const fileHandler = createFileHandler(c.env);
    return await fileHandler.getStatistics(c);
  });

  // 獲取檔案詳情
  fileRoutes.get('/:fileId',
    ...commonMiddleware,
    fileIdValidation,
    async (c) => {
      const fileHandler = createFileHandler(c.env);
      return await fileHandler.getDetails(c);
    }
  );

  // 下載檔案
  fileRoutes.get('/:fileId/download',
    ...commonMiddleware,
    fileIdValidation,
    async (c) => {
      const fileHandler = createFileHandler(c.env);
      return await fileHandler.download(c);
    }
  );

  // 獲取下載URL
  fileRoutes.get('/:fileId/download-url',
    ...commonMiddleware,
    fileIdValidation,
    async (c) => {
      const fileHandler = createFileHandler(c.env);
      return await fileHandler.getDownloadUrl(c);
    }
  );

  // 刪除檔案
  fileRoutes.delete('/:fileId',
    ...commonMiddleware,
    fileIdValidation,
    async (c) => {
      const fileHandler = createFileHandler(c.env);
      return await fileHandler.delete(c);
    }
  );

  // === 批量操作路由 ===

  // 批量操作檔案
  fileRoutes.post('/batch', ...commonMiddleware, async (c) => {
    const fileHandler = createFileHandler(c.env);
    return await fileHandler.batchOperation(c);
  });

  // === 平台特定路由 ===

  // LINE 平台檔案上傳
  fileRoutes.post('/upload/line',
    ...commonMiddleware,
    uploadLimiterMiddleware({
      maxConcurrentUploads: 2,
      maxUploadsPerMinute: 15
    }),
    fileValidationMiddleware({
      platform: 'line',
      requireAuthentication: true
    }),
    async (c) => {
      const uploadHandler = createUploadHandler(c.env);
      return await uploadHandler.uploadSingle(c);
    }
  );

  // Facebook 平台檔案上傳
  fileRoutes.post('/upload/facebook',
    ...commonMiddleware,
    uploadLimiterMiddleware({
      maxConcurrentUploads: 3,
      maxUploadsPerMinute: 20
    }),
    fileValidationMiddleware({
      platform: 'facebook',
      requireAuthentication: true
    }),
    async (c) => {
      const uploadHandler = createUploadHandler(c.env);
      return await uploadHandler.uploadSingle(c);
    }
  );

  // === 管理員路由 ===

  // 管理員檔案上傳（更高的限制）
  fileRoutes.post('/admin/upload',
    ...commonMiddleware,
    // 檢查管理員權限的中間件應該在這裡
    uploadLimiterMiddleware({
      maxConcurrentUploads: 5,
      maxUploadsPerMinute: 50,
      maxUploadsPerHour: 500
    }),
    fileValidationMiddleware({
      platform: 'admin',
      maxFiles: 20,
      requireAuthentication: true
    }),
    async (c) => {
      const uploadHandler = createUploadHandler(c.env);
      return await uploadHandler.uploadMultiple(c);
    }
  );

  return fileRoutes;
}

/**
 * 建立對話相關的檔案路由
 */
export function createConversationFileRoutes() {
  const conversationFileRoutes = new Hono<{ Bindings: Bindings }>();

  const commonMiddleware = [jwtAuth];

  // 獲取對話的檔案
  conversationFileRoutes.get('/:conversationId/files', ...commonMiddleware, async (c) => {
    const fileHandler = createFileHandler(c.env);
    return await fileHandler.getByConversation(c);
  });

  // 上傳檔案到對話
  conversationFileRoutes.post('/:conversationId/files/upload',
    ...commonMiddleware,
    uploadLimiterMiddleware(),
    fileValidationMiddleware({
      platform: 'system',
      requireAuthentication: true
    }),
    async (c) => {
      const uploadHandler = createUploadHandler(c.env);
      return await uploadHandler.uploadSingle(c);
    }
  );

  return conversationFileRoutes;
}

/**
 * 建立訊息相關的檔案路由
 */
export function createMessageFileRoutes() {
  const messageFileRoutes = new Hono<{ Bindings: Bindings }>();

  const commonMiddleware = [jwtAuth];

  // 獲取訊息的檔案
  messageFileRoutes.get('/:messageId/files', ...commonMiddleware, async (c) => {
    const fileHandler = createFileHandler(c.env);
    return await fileHandler.getByMessage(c);
  });

  // 上傳檔案到訊息
  messageFileRoutes.post('/:messageId/files/upload',
    ...commonMiddleware,
    uploadLimiterMiddleware(),
    fileValidationMiddleware({
      platform: 'system',
      requireAuthentication: true
    }),
    async (c) => {
      const uploadHandler = createUploadHandler(c.env);
      return await uploadHandler.uploadSingle(c);
    }
  );

  return messageFileRoutes;
}

/**
 * 特殊檔案類型的路由
 */
export function createSpecialFileRoutes() {
  const specialRoutes = new Hono<{ Bindings: Bindings }>();

  const commonMiddleware = [jwtAuth];

  // 僅限圖片上傳
  specialRoutes.post('/images/upload',
    ...commonMiddleware,
    uploadLimiterMiddleware(),
    fileTypeMiddleware([...ALLOWED_MIME_TYPES.IMAGE]),
    fileSizeMiddleware(FILE_SIZE_LIMITS.MAX_IMAGE_SIZE),
    fileContentMiddleware(),
    async (c) => {
      const uploadHandler = createUploadHandler(c.env);
      return await uploadHandler.uploadSingle(c);
    }
  );

  // 僅限文件上傳
  specialRoutes.post('/documents/upload',
    ...commonMiddleware,
    uploadLimiterMiddleware(),
    fileTypeMiddleware([...ALLOWED_MIME_TYPES.DOCUMENT]),
    fileSizeMiddleware(FILE_SIZE_LIMITS.MAX_DOCUMENT_SIZE),
    async (c) => {
      const uploadHandler = createUploadHandler(c.env);
      return await uploadHandler.uploadSingle(c);
    }
  );

  return specialRoutes;
}