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
  errorResponse,
  handleApiError 
} from '../utils/api-response';
import { drizzle } from 'drizzle-orm/d1';
import { sql, eq, and, desc } from 'drizzle-orm';
import { fileAttachments, conversations } from '../db/schema';

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
const MAX_FILENAME_LENGTH = 255; // Maximum filename length

/**
 * Sanitize filename for Content-Disposition header to prevent injection attacks
 * Removes dangerous characters and ensures proper encoding
 *
 * @param filename - Original filename from user upload
 * @returns Sanitized filename safe for Content-Disposition header
 */
function sanitizeFilename(filename: string): string {
  if (!filename) {
    return 'download';
  }

  // Remove path separators and null bytes
  let sanitized = filename.replace(/[\/\\:\0]/g, '_');

  // Remove control characters and quotes that could break the header
  sanitized = sanitized.replace(/[\x00-\x1F\x7F"';]/g, '_');

  // Limit length to prevent buffer overflow or excessive header size
  if (sanitized.length > MAX_FILENAME_LENGTH) {
    const extension = sanitized.split('.').pop() || '';
    const nameWithoutExt = sanitized.substring(0, sanitized.lastIndexOf('.'));
    const maxNameLength = MAX_FILENAME_LENGTH - extension.length - 1;
    sanitized = nameWithoutExt.substring(0, maxNameLength) + '.' + extension;
  }

  // Fallback if sanitization results in empty string
  if (!sanitized || sanitized.trim() === '') {
    return 'download';
  }

  return sanitized;
}

/**
 * Generate RFC 5987 encoded Content-Disposition header
 * Supports international characters while preventing injection
 *
 * @param filename - Sanitized filename
 * @returns Properly formatted Content-Disposition value
 */
function generateContentDisposition(filename: string): string {
  const sanitized = sanitizeFilename(filename);

  // Use RFC 5987 encoding for UTF-8 filenames
  // Format: attachment; filename="ascii-fallback"; filename*=UTF-8''encoded-name
  const asciiFilename = sanitized.replace(/[^\x20-\x7E]/g, '_'); // ASCII-safe fallback
  const encodedFilename = encodeURIComponent(sanitized);

  return `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`;
}

export const attachmentHandler = {
  // 上傳檔案附件
  upload: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      
      // 解析 FormData
      const formData = await c.req.formData();
      const conversationId = formData.get('conversationId') as string;
      
      if (!conversationId) {
        return validationErrorResponse(c, [
          { field: 'conversationId', message: 'Conversation ID is required' }
        ]);
      }

      // 檢查對話是否存在
      const drizzleDb = drizzle(c.env.DB);
      const conversation = await drizzleDb.select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .get();

      if (!conversation) {
        return notFoundResponse(c, 'Conversation');
      }

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
          // 上傳到 R2 with sanitized filename to prevent Content-Disposition injection
          await c.env.R2_BUCKET.put(storagePath, fileContent, {
            httpMetadata: {
              contentType: file.type,
              contentDisposition: generateContentDisposition(file.name)
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
      await drizzleDb.insert(fileAttachments).values({
        id: attachmentId,
        messageId: null, // Will be updated when message is sent
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
        fileUrl: storageUrl,
        r2Key: storagePath,
        url: storageUrl
      });

      // 如果是圖片，生成元數據
      if (messageType === 'image' && uploadStatus === 'uploaded') {
        try {
          // 這裡可以添加圖片尺寸檢測邏輯
          // Note: file_metadata table doesn't exist, metadata is stored in fileAttachments.metadata field
          console.log('Image metadata would be processed here for:', attachmentId);
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
        uploadedBy: typeof payload.userId === 'string' ? payload.userId : payload.userId.toString(),
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
      const attachmentId = c.req.param('attachmentId');
      const drizzleDb = drizzle(c.env.DB);

      const attachment = await drizzleDb
        .select()
        .from(fileAttachments)
        .where(eq(fileAttachments.id, attachmentId))
        .get();

      if (!attachment) {
        return notFoundResponse(c, 'Attachment');
      }

      // 記錄存取日誌
      const payload = c.get('jwtPayload');
      // Note: file_access_logs table doesn't exist - access logging would be implemented here
      console.log('File access logged:', {
        attachmentId,
        accessedBy: payload?.userId || 'anonymous',
        accessType: 'view',
        timestamp: Date.now()
      });

      return successResponse(c, attachment, 'Attachment retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 下載檔案
  download: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const attachmentId = c.req.param('attachmentId');
      const drizzleDb = drizzle(c.env.DB);

      const attachment = await drizzleDb
        .select()
        .from(fileAttachments)
        .where(eq(fileAttachments.id, attachmentId))
        .get();

      if (!attachment) {
        return notFoundResponse(c, 'Attachment');
      }

      // 記錄下載日誌
      const payload = c.get('jwtPayload');
      // Note: file_access_logs table doesn't exist - download logging would be implemented here
      console.log('File download logged:', {
        attachmentId,
        accessedBy: payload?.userId || 'anonymous',
        accessType: 'download',
        timestamp: Date.now()
      });

      // 從 R2 獲取檔案
      if (c.env.R2_BUCKET) {
        const object = await c.env.R2_BUCKET.get(attachment.r2Key);
        
        if (!object) {
          return notFoundResponse(c, 'File in storage');
        }

        return new Response(object.body, {
          headers: {
            'Content-Type': attachment.mimeType,
            'Content-Disposition': generateContentDisposition(attachment.filename),
            'Content-Length': attachment.fileSize.toString()
          }
        });
      } else {
        // 如果沒有 R2，重定向到存儲 URL
        const redirectUrl = (attachment as any).url || (attachment as any).fileUrl || (attachment as any).file_url;
        if (!redirectUrl) {
          return errorResponse(c, 'File URL not available', 404);
        }
        return c.redirect(redirectUrl);
      }

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 刪除檔案附件
  delete: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const attachmentId = c.req.param('attachmentId');
      const payload = c.get('jwtPayload');
      const drizzleDb = drizzle(c.env.DB);

      const attachment = await drizzleDb.get(sql`
        SELECT * FROM file_attachments 
        WHERE id = ${attachmentId}
      `) as any;

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

      // 刪除資料庫記錄 (since we don't have uploadStatus field)
      await drizzleDb
        .delete(fileAttachments)
        .where(eq(fileAttachments.id, attachmentId));

      return successResponse(c, null, 'Attachment deleted successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取對話的所有附件
  list: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const page = parseInt(c.req.query('page') || '1');
      const pageSize = parseInt(c.req.query('pageSize') || '20');
      const fileType = c.req.query('type'); // image, document

      const offset = (page - 1) * pageSize;

      const drizzleDb = drizzle(c.env.DB);
      
      // Build where conditions (simplified since conversationId and uploadStatus don't exist in schema)
      let whereConditions = [];

      if (fileType === 'image') {
        whereConditions.push(sql`${fileAttachments.mimeType} LIKE 'image/%'`);
      } else if (fileType === 'document') {
        whereConditions.push(sql`${fileAttachments.mimeType} NOT LIKE 'image/%'`);
      }

      const baseQuery = whereConditions.length > 0 ? 
        and(...whereConditions) : undefined;

      // Get attachments with pagination
      const attachments = await drizzleDb
        .select()
        .from(fileAttachments)
        .where(baseQuery)
        .orderBy(desc(fileAttachments.createdAt))
        .limit(pageSize)
        .offset(offset);

      // Get total count
      const totalResult = await drizzleDb
        .select({ count: sql<number>`COUNT(*)`.as('total') })
        .from(fileAttachments)
        .where(baseQuery)
        .get();

      const total = Number(totalResult?.count) || 0;

      return paginatedResponse(c, attachments || [], {
        page,
        limit: pageSize,
        total
      }, 'Attachments retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  }
};