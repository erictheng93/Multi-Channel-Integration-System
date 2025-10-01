/**
 * File Validation Middleware
 * 檔案驗證中間件
 */

import type { Context, Next } from 'hono';
import type { Bindings } from '@/types';
import { FileValidationService } from '@modules/file-management/services/validation-service';
import {
  validationErrorResponse,
  errorResponse,
  badRequestResponse
} from '@/utils/api-response';
import { getFileExtension } from '@modules/file-management/utils/file-helpers';
import { ERROR_MESSAGES } from '@modules/file-management/constants/error-codes';
import { FILE_SIZE_LIMITS } from '@modules/file-management/constants/file-config';

export interface FileValidationOptions {
  platform?: string;
  maxFiles?: number;
  requireAuthentication?: boolean;
  customRules?: any;
}

/**
 * 檔案上傳驗證中間件 (升級版)
 */
export function fileValidationMiddleware(options: FileValidationOptions = {}) {
  const validationService = new FileValidationService();

  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    try {
      const {
        platform = 'system',
        maxFiles = 10,
        requireAuthentication = true,
        customRules
      } = options;

      // 檢查認證（如果需要）
      if (requireAuthentication) {
        const payload = c.get('jwtPayload');
        if (!payload || !payload.userId) {
          return errorResponse(c, 'Authentication required', 401);
        }
      }

      // 檢查 Content-Type
      const contentType = c.req.header('Content-Type');
      if (!contentType || !contentType.includes('multipart/form-data')) {
        return badRequestResponse(c, 'Invalid content type for file upload');
      }

      // 解析 FormData
      const formData = await c.req.formData();

      // 檢查單檔上傳
      const singleFile = formData.get('file') as File;
      if (singleFile) {
        const validationResult = await validateSingleFile(
          singleFile,
          platform,
          validationService,
          customRules
        );

        if (!validationResult.valid) {
          return validationErrorResponse(c, validationResult.errors.map(err => ({
            field: err.field || 'file',
            message: err.message
          })));
        }

        // 將驗證結果添加到上下文
        c.set('fileValidation', validationResult);
        c.set('validatedFile', singleFile);
      }

      // 檢查多檔上傳
      const multipleFiles = formData.getAll('files') as File[];
      if (multipleFiles && multipleFiles.length > 0) {
        // 檢查檔案數量限制
        if (multipleFiles.length > maxFiles) {
          return validationErrorResponse(c, [{
            field: 'files',
            message: `Maximum ${maxFiles} files allowed`
          }]);
        }

        const validationResults = [];
        const errors = [];

        for (let i = 0; i < multipleFiles.length; i++) {
          const file = multipleFiles[i];
          const validationResult = await validateSingleFile(
            file,
            platform,
            validationService,
            customRules
          );

          if (validationResult.valid) {
            validationResults.push(validationResult);
          } else {
            errors.push({
              fileIndex: i,
              filename: file.name,
              errors: validationResult.errors
            });
          }
        }

        if (errors.length > 0) {
          return validationErrorResponse(c, [{
            field: 'files',
            message: 'Some files failed validation',
            value: errors
          }]);
        }

        // 將驗證結果添加到上下文
        c.set('filesValidation', validationResults);
        c.set('validatedFiles', multipleFiles);
      }

      // 如果沒有檔案，根據路由決定是否繼續
      if (!singleFile && (!multipleFiles || multipleFiles.length === 0)) {
        const path = c.req.path;
        // 只有上傳相關的路由需要檔案
        if (path.includes('/upload') || path.includes('/files')) {
          return validationErrorResponse(c, [{
            field: 'file',
            message: 'No file provided'
          }]);
        }
      }

      await next();

    } catch (error) {
      console.error('File validation middleware error:', error);
      return errorResponse(c, ERROR_MESSAGES.PROCESSING_FAILED, 500);
    }
  };
}

/**
 * 驗證單個檔案
 */
async function validateSingleFile(
  file: File,
  platform: string,
  validationService: FileValidationService,
  customRules?: any
) {
  const metadata = {
    filename: file.name,
    size: file.size,
    mimeType: file.type,
    extension: getFileExtension(file.name, file.type),
    platform
  };

  const rules = customRules || validationService.getRulesForPlatform(platform as any);

  return await validationService.validateFile(file, metadata, rules);
}

/**
 * 原有的簡單檔案上傳驗證中間件（保持相容性）
 */
export async function fileUploadValidation(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const contentType = c.req.header('Content-Type');

    if (!contentType || !contentType.includes('multipart/form-data')) {
      return badRequestResponse(c, 'Invalid content type for file upload');
    }

    // 檢查檔案大小限制（從 Content-Length header）
    const contentLength = c.req.header('Content-Length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      const maxSize = FILE_SIZE_LIMITS.MAX_FILE_SIZE;

      if (size > maxSize) {
        return badRequestResponse(c, `File size exceeds maximum limit (${maxSize / 1024 / 1024}MB)`);
      }
    }

    await next();

  } catch (error) {
    console.error('File upload validation error:', error);
    return badRequestResponse(c, 'File validation failed');
  }
}

/**
 * 檔案 ID 驗證中間件
 */
export async function fileIdValidation(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const fileId = c.req.param('fileId');

    if (!fileId) {
      return badRequestResponse(c, 'File ID is required');
    }

    // UUID 格式驗證（支援 UUID v4）
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const simpleIdRegex = /^[a-zA-Z0-9_-]+$/;

    if (!uuidRegex.test(fileId) && !simpleIdRegex.test(fileId)) {
      return badRequestResponse(c, 'Invalid file ID format');
    }

    await next();

  } catch (error) {
    console.error('File ID validation error:', error);
    return badRequestResponse(c, 'File ID validation failed');
  }
}

/**
 * 檔案類型限制中間件
 */
export function fileTypeMiddleware(allowedTypes: string[]) {
  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    try {
      const formData = await c.req.formData();
      const file = formData.get('file') as File;

      if (file && !allowedTypes.includes(file.type)) {
        return validationErrorResponse(c, [{
          field: 'file',
          message: `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`
        }]);
      }

      await next();
    } catch (error) {
      console.error('File type middleware error:', error);
      return errorResponse(c, ERROR_MESSAGES.PROCESSING_FAILED, 500);
    }
  };
}

/**
 * 檔案大小限制中間件
 */
export function fileSizeMiddleware(maxSize: number) {
  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    try {
      const formData = await c.req.formData();
      const file = formData.get('file') as File;

      if (file && file.size > maxSize) {
        return validationErrorResponse(c, [{
          field: 'file',
          message: `File size ${file.size} bytes exceeds maximum allowed size ${maxSize} bytes`
        }]);
      }

      await next();
    } catch (error) {
      console.error('File size middleware error:', error);
      return errorResponse(c, ERROR_MESSAGES.PROCESSING_FAILED, 500);
    }
  };
}

/**
 * 檔案內容檢查中間件
 */
export function fileContentMiddleware() {
  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    try {
      const formData = await c.req.formData();
      const file = formData.get('file') as File;

      if (file) {
        // 檢查檔案是否為空
        if (file.size === 0) {
          return validationErrorResponse(c, [{
            field: 'file',
            message: 'File is empty'
          }]);
        }

        // 檢查檔案內容與副檔名是否一致
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer.slice(0, 4));

        // 簡單的檔案簽章檢查
        const isValidContent = validateFileContent(bytes, file.type);
        if (!isValidContent) {
          return validationErrorResponse(c, [{
            field: 'file',
            message: 'File content does not match file type'
          }]);
        }
      }

      await next();
    } catch (error) {
      console.error('File content middleware error:', error);
      return errorResponse(c, ERROR_MESSAGES.PROCESSING_FAILED, 500);
    }
  };
}

/**
 * 簡單的檔案內容驗證
 */
function validateFileContent(bytes: Uint8Array, mimeType: string): boolean {
  // JPEG
  if (mimeType === 'image/jpeg' && bytes[0] === 0xFF && bytes[1] === 0xD8) {
    return true;
  }

  // PNG
  if (mimeType === 'image/png' &&
      bytes[0] === 0x89 && bytes[1] === 0x50 &&
      bytes[2] === 0x4E && bytes[3] === 0x47) {
    return true;
  }

  // GIF
  if (mimeType === 'image/gif' &&
      bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return true;
  }

  // PDF
  if (mimeType === 'application/pdf' &&
      bytes[0] === 0x25 && bytes[1] === 0x50 &&
      bytes[2] === 0x44 && bytes[3] === 0x46) {
    return true;
  }

  // 對於其他檔案類型，暫時允許通過
  return true;
}