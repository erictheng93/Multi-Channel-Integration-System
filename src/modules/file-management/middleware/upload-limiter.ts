/**
 * Upload Rate Limiting Middleware
 * 上傳限制中間件
 */

import type { Context, Next } from 'hono';
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('UploadLimiter')

import type { Bindings } from '@/types';
import {
  errorResponse,
  validationErrorResponse
} from '@/utils/api-response';
import { ERROR_MESSAGES } from '@modules/file-management/constants/error-codes';
import { UPLOAD_CONFIG } from '@modules/file-management/constants/file-config';
import { nowMs } from '@/utils/timestamp'

interface UploadLimitOptions {
  maxConcurrentUploads?: number;
  maxUploadsPerMinute?: number;
  maxUploadsPerHour?: number;
  maxTotalSizePerHour?: number; // bytes
  maxFilesPerRequest?: number;
  enableRateLimiting?: boolean;
}

interface UserUploadState {
  concurrentUploads: number;
  uploadsThisMinute: number;
  uploadsThisHour: number;
  totalSizeThisHour: number;
  lastMinute: number;
  lastHour: number;
}

// 記憶體中的上傳狀態快取（在生產環境中應該使用 Redis 或 KV）
const uploadStates = new Map<string, UserUploadState>();

/**
 * 上傳限制中間件
 */
export function uploadLimiterMiddleware(options: UploadLimitOptions = {}) {
  const {
    maxConcurrentUploads = UPLOAD_CONFIG.MAX_CONCURRENT_UPLOADS,
    maxUploadsPerMinute = 20,
    maxUploadsPerHour = 100,
    maxTotalSizePerHour = 100 * 1024 * 1024, // 100MB per hour
    maxFilesPerRequest = 10,
    enableRateLimiting = true
  } = options;

  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    if (!enableRateLimiting) {
      await next();
      return;
    }

    try {
      const payload = c.get('jwtPayload');
      const userId = payload?.userId?.toString() || 'anonymous';
      const now = nowMs();
      const currentMinute = Math.floor(now / 60000);
      const currentHour = Math.floor(now / 3600000);

      // 獲取或初始化用戶上傳狀態
      let userState = uploadStates.get(userId);
      if (!userState) {
        userState = {
          concurrentUploads: 0,
          uploadsThisMinute: 0,
          uploadsThisHour: 0,
          totalSizeThisHour: 0,
          lastMinute: currentMinute,
          lastHour: currentHour
        };
        uploadStates.set(userId, userState);
      }

      // 重置計數器（如果時間週期已經改變）
      if (userState.lastMinute !== currentMinute) {
        userState.uploadsThisMinute = 0;
        userState.lastMinute = currentMinute;
      }

      if (userState.lastHour !== currentHour) {
        userState.uploadsThisHour = 0;
        userState.totalSizeThisHour = 0;
        userState.lastHour = currentHour;
      }

      // 檢查同時上傳限制
      if (userState.concurrentUploads >= maxConcurrentUploads) {
        return errorResponse(c,
          `Too many concurrent uploads. Maximum ${maxConcurrentUploads} allowed.`,
          429
        );
      }

      // 檢查每分鐘上傳限制
      if (userState.uploadsThisMinute >= maxUploadsPerMinute) {
        return errorResponse(c,
          `Upload rate limit exceeded. Maximum ${maxUploadsPerMinute} uploads per minute.`,
          429
        );
      }

      // 檢查每小時上傳限制
      if (userState.uploadsThisHour >= maxUploadsPerHour) {
        return errorResponse(c,
          `Hourly upload limit exceeded. Maximum ${maxUploadsPerHour} uploads per hour.`,
          429
        );
      }

      // 解析檔案並檢查大小限制
      try {
        const formData = await c.req.formData();
        const files: File[] = [];

        // 收集所有檔案
        const singleFile = formData.get('file') as File;
        if (singleFile) {
          files.push(singleFile);
        }

        const multipleFiles = formData.getAll('files') as File[];
        if (multipleFiles && multipleFiles.length > 0) {
          files.push(...multipleFiles);
        }

        // 檢查單次請求檔案數量限制
        if (files.length > maxFilesPerRequest) {
          return validationErrorResponse(c, [{
            field: 'files',
            message: `Too many files in single request. Maximum ${maxFilesPerRequest} allowed.`
          }]);
        }

        // 計算總檔案大小
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);

        // 檢查每小時總大小限制
        if (userState.totalSizeThisHour + totalSize > maxTotalSizePerHour) {
          const remainingMB = Math.max(0, maxTotalSizePerHour - userState.totalSizeThisHour) / 1024 / 1024;
          return errorResponse(c,
            `Hourly upload size limit exceeded. Remaining: ${remainingMB.toFixed(2)}MB`,
            429
          );
        }

        // 更新狀態
        userState.concurrentUploads++;
        userState.uploadsThisMinute++;
        userState.uploadsThisHour++;
        userState.totalSizeThisHour += totalSize;

        // 設定清理函數
        const cleanup = () => {
          const state = uploadStates.get(userId);
          if (state) {
            state.concurrentUploads = Math.max(0, state.concurrentUploads - 1);
          }
        };

        // 在回應完成後清理
        c.res.headers.set('X-Upload-Cleanup', 'true');

        // 使用 Promise.finally 確保清理
        const originalNext = next;
        const wrappedNext = async () => {
          try {
            await originalNext();
          } finally {
            cleanup();
          }
        };

        return await wrappedNext();

      } catch (error) {
        // 如果解析失敗，仍然更新基本計數器
        userState.concurrentUploads++;
        userState.uploadsThisMinute++;
        userState.uploadsThisHour++;

        // 立即清理
        setTimeout(() => {
          const state = uploadStates.get(userId);
          if (state) {
            state.concurrentUploads = Math.max(0, state.concurrentUploads - 1);
          }
        }, 0);

        throw error;
      }

    } catch (error) {
      log.error('Upload limiter middleware error', {}, error as Error);
      return errorResponse(c, ERROR_MESSAGES.PROCESSING_FAILED, 500);
    }
  };
}

/**
 * 檔案大小總計限制中間件
 */
export function fileSizeTotalMiddleware(maxTotalSize: number) {
  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    try {
      const formData = await c.req.formData();
      const files: File[] = [];

      // 收集所有檔案
      const singleFile = formData.get('file') as File;
      if (singleFile) {
        files.push(singleFile);
      }

      const multipleFiles = formData.getAll('files') as File[];
      if (multipleFiles && multipleFiles.length > 0) {
        files.push(...multipleFiles);
      }

      // 計算總大小
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);

      if (totalSize > maxTotalSize) {
        return validationErrorResponse(c, [{
          field: 'files',
          message: `Total file size ${(totalSize / 1024 / 1024).toFixed(2)}MB exceeds limit ${(maxTotalSize / 1024 / 1024).toFixed(2)}MB`
        }]);
      }

      return await next();
    } catch (error) {
      log.error('File size total middleware error', {}, error as Error);
      return errorResponse(c, ERROR_MESSAGES.PROCESSING_FAILED, 500);
    }
  };
}

/**
 * 上傳逾時中間件
 */
export function uploadTimeoutMiddleware(timeoutMs: number = UPLOAD_CONFIG.TIMEOUT) {
  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    try {
      const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Upload timeout')), timeoutMs);
      });

      return await Promise.race([next(), timeout]);
    } catch (error) {
      if (error instanceof Error && error.message === 'Upload timeout') {
        return errorResponse(c, 'Upload timeout', 408);
      }
      log.error('Upload timeout middleware error', {}, error as Error);
      return errorResponse(c, ERROR_MESSAGES.PROCESSING_FAILED, 500);
    }
  };
}

/**
 * 清理過期的上傳狀態
 */
export function cleanupUploadStates() {
  const now = nowMs();
  const oneHourAgo = Math.floor((now - 3600000) / 3600000);

  for (const [userId, state] of uploadStates.entries()) {
    // 如果狀態超過1小時沒有更新，就刪除它
    if (state.lastHour < oneHourAgo) {
      uploadStates.delete(userId);
    }
  }
}

/**
 * 獲取用戶上傳統計
 */
export function getUserUploadStats(userId: string): UserUploadState | null {
  return uploadStates.get(userId) || null;
}

/**
 * 重置用戶上傳限制（管理員功能）
 */
export function resetUserUploadLimits(userId: string): boolean {
  const state = uploadStates.get(userId);
  if (state) {
    const now = nowMs();
    state.concurrentUploads = 0;
    state.uploadsThisMinute = 0;
    state.uploadsThisHour = 0;
    state.totalSizeThisHour = 0;
    state.lastMinute = Math.floor(now / 60000);
    state.lastHour = Math.floor(now / 3600000);
    return true;
  }
  return false;
}

// 定期清理過期狀態（每30分鐘）
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupUploadStates, 30 * 60 * 1000);
}