/**
 * File Upload Handler
 * 檔案上傳專用處理器
 */

import type { Context } from 'hono';
import type { Bindings } from '@/types';
import type { FileUploadRequest, FileUploadOptions } from '@modules/file-management/types/file-types';

import { FileService } from '@modules/file-management/services/file-service';
import { FileValidationService } from '@modules/file-management/services/validation-service';
import {
  successResponse,
  validationErrorResponse,
  errorResponse,
  handleApiError
} from '@/utils/api-response';
import { getFileExtension, getFileType } from '@modules/file-management/utils/file-helpers';
import { ERROR_CODES, ERROR_MESSAGES } from '@modules/file-management/constants/error-codes';
import { FILE_SIZE_LIMITS } from '@modules/file-management/constants/file-config';

export class UploadHandler {
  private fileService: FileService;
  private validationService: FileValidationService;

  constructor(env: Bindings) {
    this.fileService = new FileService(env);
    this.validationService = new FileValidationService();
  }

  /**
   * 單檔上傳
   */
  uploadSingle = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      // 解析 FormData
      const formData = await c.req.formData();
      const file = formData.get('file') as File;

      if (!file) {
        return validationErrorResponse(c, [
          { field: 'file', message: 'No file provided' }
        ]);
      }

      // 獲取上傳選項
      const options = this.parseUploadOptions(formData);
      const platform = (formData.get('platform') as string) || 'system';

      // 建立上傳請求
      const uploadRequest: FileUploadRequest = {
        file,
        filename: file.name,
        mimeType: file.type,
        platform: platform as any,
        conversationId: formData.get('conversationId') as string,
        messageId: formData.get('messageId') as string,
        uploadedBy: payload?.userId?.toString(),
        options
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
        type: result.file?.type
      }, 'File uploaded successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  /**
   * 多檔上傳
   */
  uploadMultiple = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      // 解析 FormData
      const formData = await c.req.formData();
      const files = formData.getAll('files') as File[];

      if (!files || files.length === 0) {
        return validationErrorResponse(c, [
          { field: 'files', message: 'No files provided' }
        ]);
      }

      // 檢查檔案數量限制
      const maxFiles = 10; // 最多同時上傳10個檔案
      if (files.length > maxFiles) {
        return validationErrorResponse(c, [
          { field: 'files', message: `Maximum ${maxFiles} files allowed` }
        ]);
      }

      // 獲取共同選項
      const options = this.parseUploadOptions(formData);
      const platform = (formData.get('platform') as string) || 'system';
      const conversationId = formData.get('conversationId') as string;
      const messageId = formData.get('messageId') as string;

      const results = [];
      const errors = [];

      // 並行上傳檔案
      const uploadPromises = files.map(async (file, index) => {
        try {
          const uploadRequest: FileUploadRequest = {
            file,
            filename: file.name,
            mimeType: file.type,
            platform: platform as any,
            conversationId,
            messageId,
            uploadedBy: payload?.userId?.toString(),
            options
          };

          const result = await this.fileService.uploadFile(uploadRequest);

          if (result.success) {
            return {
              index,
              success: true,
              data: {
                id: result.file?.id,
                url: result.file?.url,
                publicUrl: result.file?.publicUrl,
                thumbnailUrl: result.thumbnailUrl,
                filename: result.file?.filename,
                size: result.file?.size,
                mimeType: result.file?.mimeType,
                type: result.file?.type
              }
            };
          } else {
            return {
              index,
              success: false,
              error: result.error || 'Upload failed',
              filename: file.name
            };
          }
        } catch (error) {
          return {
            index,
            success: false,
            error: error instanceof Error ? error.message : 'Upload failed',
            filename: file.name
          };
        }
      });

      const uploadResults = await Promise.all(uploadPromises);

      // 分離成功和失敗的結果
      uploadResults.forEach(result => {
        if (result.success) {
          results.push(result.data);
        } else {
          errors.push({
            filename: result.filename,
            error: result.error
          });
        }
      });

      return successResponse(c, {
        successful: results,
        failed: errors,
        summary: {
          total: files.length,
          successful: results.length,
          failed: errors.length
        }
      }, 'Files upload completed');

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  /**
   * 分塊上傳初始化
   */
  initChunkedUpload = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      const body = await c.req.json();

      const { filename, fileSize, mimeType, platform = 'system' } = body;

      // 驗證輸入
      if (!filename || !fileSize || !mimeType) {
        return validationErrorResponse(c, [
          { field: 'filename', message: 'Filename is required' },
          { field: 'fileSize', message: 'File size is required' },
          { field: 'mimeType', message: 'MIME type is required' }
        ]);
      }

      // 檢查檔案大小限制
      if (fileSize > FILE_SIZE_LIMITS.MAX_FILE_SIZE) {
        return validationErrorResponse(c, [
          { field: 'fileSize', message: 'File size exceeds limit' }
        ]);
      }

      // 快速驗證檔案基本屬性
      const validationResult = this.validationService.validateQuick({
        filename,
        size: fileSize,
        mimeType,
        extension: getFileExtension(filename, mimeType),
        platform,
        userId: payload?.userId?.toString()
      });

      if (!validationResult.valid) {
        return validationErrorResponse(c, validationResult.errors.map(err => ({
          field: err.field || 'file',
          message: err.message
        })));
      }

      // 生成上傳會話ID
      const uploadId = crypto.randomUUID();
      const chunkSize = 1024 * 1024; // 1MB chunks
      const totalChunks = Math.ceil(fileSize / chunkSize);

      // 這裡可以將上傳會話資訊存儲到KV或資料庫
      // 暫時返回基本資訊

      return successResponse(c, {
        uploadId,
        chunkSize,
        totalChunks,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24小時過期
      }, 'Chunked upload initialized');

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  /**
   * 上傳檔案分塊
   */
  uploadChunk = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const uploadId = c.req.param('uploadId');
      const chunkIndex = parseInt(c.req.query('chunkIndex') || '0');

      if (!uploadId) {
        return validationErrorResponse(c, [
          { field: 'uploadId', message: 'Upload ID is required' }
        ]);
      }

      // 獲取分塊資料
      const chunkData = await c.req.arrayBuffer();

      if (!chunkData || chunkData.byteLength === 0) {
        return validationErrorResponse(c, [
          { field: 'chunk', message: 'Chunk data is required' }
        ]);
      }

      // 這裡需要實作分塊儲存邏輯
      // 暫時返回成功回應

      return successResponse(c, {
        uploadId,
        chunkIndex,
        received: chunkData.byteLength
      }, 'Chunk uploaded successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  /**
   * 完成分塊上傳
   */
  completeChunkedUpload = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const uploadId = c.req.param('uploadId');
      const body = await c.req.json();

      if (!uploadId) {
        return validationErrorResponse(c, [
          { field: 'uploadId', message: 'Upload ID is required' }
        ]);
      }

      // 這裡需要實作合併分塊的邏輯
      // 暫時返回成功回應

      return successResponse(c, {
        id: crypto.randomUUID(),
        url: 'https://example.com/file.jpg',
        filename: 'uploaded-file.jpg'
      }, 'Chunked upload completed');

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  /**
   * 取消分塊上傳
   */
  cancelChunkedUpload = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const uploadId = c.req.param('uploadId');

      if (!uploadId) {
        return validationErrorResponse(c, [
          { field: 'uploadId', message: 'Upload ID is required' }
        ]);
      }

      // 這裡需要實作清理分塊的邏輯

      return successResponse(c, null, 'Chunked upload cancelled');

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  /**
   * 解析上傳選項
   */
  private parseUploadOptions(formData: FormData): FileUploadOptions {
    return {
      generateThumbnail: formData.get('generateThumbnail') === 'true',
      compress: formData.get('compress') === 'true',
      maxSize: formData.get('maxSize') ? parseInt(formData.get('maxSize') as string) : undefined,
      quality: formData.get('quality') ? parseInt(formData.get('quality') as string) : undefined,
      maxDimensions: formData.get('maxWidth') && formData.get('maxHeight') ? {
        width: parseInt(formData.get('maxWidth') as string),
        height: parseInt(formData.get('maxHeight') as string)
      } : undefined
    };
  }
}

/**
 * 建立上傳處理器實例
 */
export function createUploadHandler(env: Bindings): UploadHandler {
  return new UploadHandler(env);
}