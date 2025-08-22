// 檔案附件處理器
// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/src/handlers/attachment.ts
// Created by: Backend Developer

import type { Context } from 'hono';
import type { Bindings } from '../types';
import { 
  successResponse, 
  paginatedResponse,
  validationErrorResponse, 
  forbiddenResponse,
  notFoundResponse,
  handleApiError 
} from '../utils/api-response';

/*
interface FileUploadRequest {
  file: File;
  messageType: 'image' | 'file';
}
*/

interface FileAttachment {
  id: string;
  messageId: string;
  conversationId: string;
  originalFilename: string;
  storedFilename: string;
  fileSize: number;
  mimeType: string;
  fileExtension: string;
  storagePath: string;
  storageUrl: string;
  uploadStatus: 'pending' | 'uploaded' | 'failed' | 'deleted';
  uploadedBy: string;
  createdAt: number;
  updatedAt: number;
}

// 支援的檔案類型
const ALLOWED_MIME_TYPES = {
  image: [
    'image/jpeg',
    'image/png', 
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const attachmentHandler = {
  // 上傳檔案附件
  upload: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const conversationId = c.req.param('id');
      const payload = c.get('jwtPayload');
      
      if (!conversationId) {
        return validationErrorResponse(c, [
          { field: 'conversationId', message: 'Conversation ID is required' }
        ]);
      }

      // 檢查對話是否存在
      const conversation = await c.env.DB.prepare(`
        SELECT id FROM conversations WHERE id = ?
      `).bind(conversationId).first();

      if (!conversation) {
        return notFoundResponse(c, 'Conversation');
      }

      // 解析 FormData
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      const messageType = formData.get('messageType') as string;

      if (!file) {
        return validationErrorResponse(c, [
          { field: 'file', message: 'No file provided' }
        ]);
      }

      // 驗證檔案大小
      if (file.size > MAX_FILE_SIZE) {
        return validationErrorResponse(c, [
          { field: 'file', message: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`, value: file.size }
        ]);
      }

      // 驗證檔案類型
      const isValidType = messageType === 'image' 
        ? ALLOWED_MIME_TYPES.image.includes(file.type)
        : ALLOWED_MIME_TYPES.document.includes(file.type);

      if (!isValidType) {
        return validationErrorResponse(c, [
          { field: 'file', message: 'File type not supported', value: file.type }
        ]);
      }

      // 生成檔案 ID 和存儲路徑
      const attachmentId = crypto.randomUUID();
      const fileExtension = file.name.split('.').pop() || '';
      const storedFilename = `${attachmentId}.${fileExtension}`;
      const storagePath = `attachments/${conversationId}/${storedFilename}`;

      // 讀取檔案內容
      const fileBuffer = await file.arrayBuffer();
      const fileContent = new Uint8Array(fileBuffer);

      // 存儲檔案到 Cloudflare R2 (如果配置了)
      let storageUrl = '';
      let uploadStatus: 'uploaded' | 'failed' = 'uploaded';

      try {
        if (c.env.R2_BUCKET) {
          // 上傳到 R2
          await c.env.R2_BUCKET.put(storagePath, fileContent, {
            httpMetadata: {
              contentType: file.type,
              contentDisposition: `attachment; filename="${file.name}"`
            }
          });
          
          // 生成存取 URL
          storageUrl = `${c.env.R2_PUBLIC_URL}/${storagePath}`;
        } else {
          // 如果沒有配置 R2，暫時存儲在記憶體中（僅用於開發）
          console.warn('R2_BUCKET not configured, file stored in memory only');
          storageUrl = `data:${file.type};base64,${btoa(String.fromCharCode(...fileContent))}`;
        }
      } catch (error) {
        console.error('File upload error:', error);
        uploadStatus = 'failed';
      }

      // 儲存檔案記錄到資料庫
      const now = Date.now();
      await c.env.DB.prepare(`
        INSERT INTO file_attachments (
          id, message_id, conversation_id, original_filename, stored_filename,
          file_size, mime_type, file_extension, storage_path, storage_url,
          upload_status, uploaded_by, created_at, updated_at
        ) VALUES (?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        attachmentId,
        conversationId,
        file.name,
        storedFilename,
        file.size,
        file.type,
        fileExtension,
        storagePath,
        storageUrl,
        uploadStatus,
        payload.userId,
        now,
        now
      ).run();

      // 如果是圖片，生成元數據
      if (messageType === 'image' && uploadStatus === 'uploaded') {
        try {
          // 這裡可以添加圖片尺寸檢測邏輯
          await c.env.DB.prepare(`
            INSERT INTO file_metadata (
              id, attachment_id, created_at
            ) VALUES (?, ?, ?)
          `).bind(
            crypto.randomUUID(),
            attachmentId,
            now
          ).run();
        } catch (error) {
          console.error('Failed to create file metadata:', error);
        }
      }

      const attachment: FileAttachment = {
        id: attachmentId,
        messageId: '', // 將在發送訊息時更新
        conversationId,
        originalFilename: file.name,
        storedFilename,
        fileSize: file.size,
        mimeType: file.type,
        fileExtension,
        storagePath,
        storageUrl,
        uploadStatus,
        uploadedBy: payload.userId,
        createdAt: now,
        updatedAt: now
      };

      return successResponse(c, {
        id: attachmentId,
        url: storageUrl,
        filename: file.name,
        size: file.size,
        type: file.type,
        attachment
      }, 'File uploaded successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取檔案附件
  get: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const conversationId = c.req.param('id');
      const attachmentId = c.req.param('attachmentId');

      const attachment = await c.env.DB.prepare(`
        SELECT * FROM file_attachments 
        WHERE id = ? AND conversation_id = ?
      `).bind(attachmentId, conversationId).first();

      if (!attachment) {
        return notFoundResponse(c, 'Attachment');
      }

      // 記錄存取日誌
      const payload = c.get('jwtPayload');
      await c.env.DB.prepare(`
        INSERT INTO file_access_logs (
          id, attachment_id, accessed_by, access_type, created_at
        ) VALUES (?, ?, ?, 'view', ?)
      `).bind(
        crypto.randomUUID(),
        attachmentId,
        payload?.userId || 'anonymous',
        Date.now()
      ).run();

      return successResponse(c, attachment, 'Attachment retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 下載檔案
  download: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const conversationId = c.req.param('id');
      const attachmentId = c.req.param('attachmentId');

      const attachment = await c.env.DB.prepare(`
        SELECT * FROM file_attachments 
        WHERE id = ? AND conversation_id = ? AND upload_status = 'uploaded'
      `).bind(attachmentId, conversationId).first();

      if (!attachment) {
        return notFoundResponse(c, 'Attachment');
      }

      // 記錄下載日誌
      const payload = c.get('jwtPayload');
      await c.env.DB.prepare(`
        INSERT INTO file_access_logs (
          id, attachment_id, accessed_by, access_type, created_at
        ) VALUES (?, ?, ?, 'download', ?)
      `).bind(
        crypto.randomUUID(),
        attachmentId,
        payload?.userId || 'anonymous',
        Date.now()
      ).run();

      // 從 R2 獲取檔案
      if (c.env.R2_BUCKET) {
        const object = await c.env.R2_BUCKET.get(attachment.storage_path as string);
        
        if (!object) {
          return notFoundResponse(c, 'File in storage');
        }

        return new Response(object.body, {
          headers: {
            'Content-Type': attachment.mime_type as string,
            'Content-Disposition': `attachment; filename="${attachment.original_filename}"`,
            'Content-Length': (attachment.file_size as number).toString()
          }
        });
      } else {
        // 如果沒有 R2，重定向到存儲 URL
        return c.redirect(attachment.storage_url as string);
      }

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 刪除檔案附件
  delete: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const conversationId = c.req.param('id');
      const attachmentId = c.req.param('attachmentId');
      const payload = c.get('jwtPayload');

      const attachment = await c.env.DB.prepare(`
        SELECT * FROM file_attachments 
        WHERE id = ? AND conversation_id = ?
      `).bind(attachmentId, conversationId).first();

      if (!attachment) {
        return notFoundResponse(c, 'Attachment');
      }

      // 檢查權限（只有上傳者或管理員可以刪除）
      if (attachment.uploaded_by !== payload.userId && payload.role !== 'admin') {
        return forbiddenResponse(c, 'Permission denied to delete this attachment');
      }

      // 從 R2 刪除檔案
      if (c.env.R2_BUCKET) {
        try {
          await c.env.R2_BUCKET.delete(attachment.storage_path as string);
        } catch (error) {
          console.error('Failed to delete file from R2:', error);
        }
      }

      // 更新資料庫狀態
      await c.env.DB.prepare(`
        UPDATE file_attachments 
        SET upload_status = 'deleted', updated_at = ?
        WHERE id = ?
      `).bind(Date.now(), attachmentId).run();

      return successResponse(c, null, 'Attachment deleted successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取對話的所有附件
  list: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const conversationId = c.req.param('id');
      const page = parseInt(c.req.query('page') || '1');
      const pageSize = parseInt(c.req.query('pageSize') || '20');
      const fileType = c.req.query('type'); // image, document

      const offset = (page - 1) * pageSize;

      let whereClause = 'WHERE conversation_id = ? AND upload_status = "uploaded"';
      const params: any[] = [conversationId];

      if (fileType === 'image') {
        whereClause += ' AND mime_type LIKE "image/%"';
      } else if (fileType === 'document') {
        whereClause += ' AND mime_type NOT LIKE "image/%"';
      }

      const attachments = await c.env.DB.prepare(`
        SELECT fa.*, fm.width, fm.height, fm.thumbnail_url
        FROM file_attachments fa
        LEFT JOIN file_metadata fm ON fa.id = fm.attachment_id
        ${whereClause}
        ORDER BY fa.created_at DESC
        LIMIT ? OFFSET ?
      `).bind(...params, pageSize, offset).all();

      const totalResult = await c.env.DB.prepare(`
        SELECT COUNT(*) as total FROM file_attachments ${whereClause}
      `).bind(...params).first();

      const total = Number(totalResult?.total) || 0;

      return paginatedResponse(c, attachments.results, {
        page,
        limit: pageSize,
        total
      }, 'Attachments retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  }
};