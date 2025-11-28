/**
 * Presigned URL Handler
 * 處理 presigned URL 相關的 HTTP 請求
 *
 * Endpoints:
 * - POST /api/files/presigned-url - 生成 presigned URL
 * - POST /api/files/:fileId/confirm - 確認上傳完成
 * - GET /api/files/presigned-url/status - 檢查服務狀態
 */

import type { Context } from 'hono';
import type { Bindings } from '@/types';
import { createPresignedUrlService } from '../services/presigned-url-service';
import {
  successResponse,
  validationErrorResponse,
  errorResponse,
} from '@/utils/api-response';

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

// 允許的 MIME 類型
const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Videos
  'video/mp4',
  'video/quicktime',
  'video/webm',
  // Audio
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Text
  'text/plain',
  'text/csv',
  // Archives
  'application/zip',
  'application/x-rar-compressed',
]);

// 最大檔案大小 (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// ═══════════════════════════════════════════════════════════════════════════
// Handler Class
// ═══════════════════════════════════════════════════════════════════════════

export class PresignedHandler {
  /**
   * 生成 Presigned URL
   * POST /api/files/presigned-url
   *
   * Request Body:
   * {
   *   filename: string,
   *   mimeType: string,
   *   size: number,
   *   conversationId?: string,
   *   messageId?: string
   * }
   */
  static async generatePresignedUrl(c: Context<{ Bindings: Bindings }>) {
    try {
      const payload = c.get('jwtPayload');
      const body = await c.req.json();

      const { filename, mimeType, size, conversationId, messageId } = body;

      // ═══════════════════════════════════════════════════════════════════════
      // Validation
      // ═══════════════════════════════════════════════════════════════════════

      const errors: { field: string; message: string }[] = [];

      // Filename validation
      if (!filename || typeof filename !== 'string') {
        errors.push({ field: 'filename', message: 'Filename is required' });
      } else if (filename.length > 255) {
        errors.push({ field: 'filename', message: 'Filename too long (max 255 characters)' });
      }

      // MIME type validation
      if (!mimeType || typeof mimeType !== 'string') {
        errors.push({ field: 'mimeType', message: 'MIME type is required' });
      } else if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        errors.push({
          field: 'mimeType',
          message: `Unsupported file type: ${mimeType}. Allowed types: images, videos, audio, documents, text, archives.`
        });
      }

      // Size validation
      if (size === undefined || size === null || typeof size !== 'number') {
        errors.push({ field: 'size', message: 'File size is required' });
      } else if (size <= 0) {
        errors.push({ field: 'size', message: 'Invalid file size' });
      } else if (size > MAX_FILE_SIZE) {
        errors.push({
          field: 'size',
          message: `File size exceeds limit (max: ${MAX_FILE_SIZE / 1024 / 1024}MB)`
        });
      }

      if (errors.length > 0) {
        return validationErrorResponse(c, errors);
      }

      // ═══════════════════════════════════════════════════════════════════════
      // Service Check
      // ═══════════════════════════════════════════════════════════════════════

      const service = createPresignedUrlService(c.env);

      if (!service.isServiceConfigured()) {
        return errorResponse(
          c,
          'Presigned URL service not configured. Please contact administrator.',
          503
        );
      }

      // ═══════════════════════════════════════════════════════════════════════
      // Generate Presigned URL
      // ═══════════════════════════════════════════════════════════════════════

      const result = await service.generatePresignedUrl({
        filename,
        mimeType,
        size,
        conversationId,
        messageId,
        uploadedBy: payload?.userId?.toString(),
      });

      return successResponse(c, {
        presignedUrl: result.presignedUrl,
        fileId: result.fileId,
        publicUrl: result.publicUrl,
        expiresAt: result.expiresAt,
        // 提供上傳指引
        uploadInstructions: {
          method: 'PUT',
          headers: {
            'Content-Type': mimeType,
          },
          body: 'File binary data',
          note: 'After upload completes, call POST /api/files/{fileId}/confirm',
        },
      }, 'Presigned URL generated successfully');

    } catch (error) {
      console.error('[PresignedHandler] generatePresignedUrl error:', error);
      return errorResponse(
        c,
        error instanceof Error ? error.message : 'Failed to generate presigned URL',
        500
      );
    }
  }

  /**
   * 確認上傳完成
   * POST /api/files/:fileId/confirm
   *
   * Request Body:
   * {
   *   size: number,
   *   checksum?: string
   * }
   */
  static async confirmUpload(c: Context<{ Bindings: Bindings }>) {
    try {
      const fileId = c.req.param('fileId');
      const body = await c.req.json();

      const { size, checksum } = body;

      // ═══════════════════════════════════════════════════════════════════════
      // Validation
      // ═══════════════════════════════════════════════════════════════════════

      if (!fileId) {
        return validationErrorResponse(c, [
          { field: 'fileId', message: 'File ID is required' }
        ]);
      }

      if (size === undefined || size === null || typeof size !== 'number') {
        return validationErrorResponse(c, [
          { field: 'size', message: 'File size is required for confirmation' }
        ]);
      }

      if (size <= 0) {
        return validationErrorResponse(c, [
          { field: 'size', message: 'Invalid file size' }
        ]);
      }

      // ═══════════════════════════════════════════════════════════════════════
      // Confirm Upload
      // ═══════════════════════════════════════════════════════════════════════

      const service = createPresignedUrlService(c.env);
      const result = await service.confirmUpload({
        fileId,
        size,
        checksum,
      });

      return successResponse(c, {
        ...result.file,
        confirmed: true,
      }, 'Upload confirmed successfully');

    } catch (error) {
      console.error('[PresignedHandler] confirmUpload error:', error);

      // 特殊處理 "not found" 錯誤
      if (error instanceof Error && error.message.includes('not found')) {
        return errorResponse(c, error.message, 404);
      }

      return errorResponse(
        c,
        error instanceof Error ? error.message : 'Failed to confirm upload',
        500
      );
    }
  }

  /**
   * 檢查服務狀態
   * GET /api/files/presigned-url/status
   */
  static async checkStatus(c: Context<{ Bindings: Bindings }>) {
    try {
      const service = createPresignedUrlService(c.env);
      const isConfigured = service.isServiceConfigured();

      return successResponse(c, {
        configured: isConfigured,
        maxFileSize: MAX_FILE_SIZE,
        maxFileSizeMB: MAX_FILE_SIZE / 1024 / 1024,
        allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES),
        urlExpirySeconds: 15 * 60,
        message: isConfigured
          ? 'Presigned URL service is ready'
          : 'Presigned URL service not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.',
      }, isConfigured ? 'Service is ready' : 'Service not configured');

    } catch (error) {
      console.error('[PresignedHandler] checkStatus error:', error);
      return errorResponse(
        c,
        error instanceof Error ? error.message : 'Failed to check status',
        500
      );
    }
  }

  /**
   * 獲取 pending 檔案資訊
   * GET /api/files/:fileId/status
   */
  static async getFileStatus(c: Context<{ Bindings: Bindings }>) {
    try {
      const fileId = c.req.param('fileId');

      if (!fileId) {
        return validationErrorResponse(c, [
          { field: 'fileId', message: 'File ID is required' }
        ]);
      }

      const service = createPresignedUrlService(c.env);
      const file = await service.getPendingFile(fileId);

      if (!file) {
        return errorResponse(c, 'File not found', 404);
      }

      return successResponse(c, {
        id: file.id,
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.fileSize,
        status: file.uploadStatus,
        url: file.fileUrl,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      }, 'File status retrieved');

    } catch (error) {
      console.error('[PresignedHandler] getFileStatus error:', error);
      return errorResponse(
        c,
        error instanceof Error ? error.message : 'Failed to get file status',
        500
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Export handler functions for route registration
// ═══════════════════════════════════════════════════════════════════════════

export const generatePresignedUrl = PresignedHandler.generatePresignedUrl;
export const confirmUpload = PresignedHandler.confirmUpload;
export const checkPresignedUrlStatus = PresignedHandler.checkStatus;
export const getFileStatus = PresignedHandler.getFileStatus;
