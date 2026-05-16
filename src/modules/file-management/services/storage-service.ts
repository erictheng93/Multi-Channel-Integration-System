/**
 * Storage Service - R2 存儲服務（增強版）
 * 包含完整的錯誤處理、重試機制和日誌記錄
 */

import type { StorageMetadata, StorageService as IStorageService } from '@modules/file-management/types/storage-types';
import type { Bindings } from '@/types';
import { ErrorHandler, FileManagementError, FileLogger } from '@modules/file-management/utils/error-handler';
import { ERROR_CODES } from '@modules/file-management/constants/error-codes';
import { getPublicFileUrl } from '@/utils/file-url';

export class StorageService {
  private static instances: Map<string, StorageService> = new Map();
  private logger: FileLogger;
  private bucket: R2Bucket;

  private constructor(bucket: R2Bucket) {
    this.bucket = bucket;
    this.logger = new FileLogger({ operation: 'storage' });
  }

  public static getInstance(env: Bindings): StorageService {
    const envKey = env.ENVIRONMENT || 'production';

    if (!StorageService.instances.has(envKey)) {
      const bucket = env.R2_BUCKET;
      if (!bucket) {
        throw new FileManagementError(
          ERROR_CODES.STORAGE_UNAVAILABLE,
          { operation: 'getInstance', metadata: { environment: envKey } },
          { customMessage: 'R2_BUCKET binding not found' }
        );
      }
      StorageService.instances.set(envKey, new StorageService(bucket));
    }

    return StorageService.instances.get(envKey)!;
  }

  /**
   * 儲存檔案到R2 (帶重試機制)
   */
  async store(key: string, data: ArrayBuffer | ReadableStream): Promise<string> {
    return ErrorHandler.executeWithRetry(
      async () => {
        try {
          this.logger.info('Starting file upload', { key, dataType: typeof data });

          // 執行 R2 上傳
          await this.bucket.put(key, data);

          this.logger.info('File uploaded successfully', { key });
          return key;
        } catch (error) {
          this.logger.error('File upload failed', error as Error, { key });

          if (error instanceof FileManagementError) {
            throw error;
          }

          throw new FileManagementError(
            ERROR_CODES.STORAGE_WRITE_ERROR,
            { operation: 'store', metadata: { key } },
            { originalError: error as Error }
          );
        }
      },
      { operation: 'store', metadata: { key } },
      { maxRetries: 3, retryDelay: 1000 }
    );
  }

  /**
   * 從R2獲取檔案 (帶重試機制)
   */
  async retrieve(key: string): Promise<ReadableStream | null> {
    return ErrorHandler.executeWithRetry(
      async () => {
        try {
          this.logger.info('Starting file retrieval', { key });

          // 從 R2 獲取檔案
          const object = await this.bucket.get(key);

          if (!object) {
            this.logger.warn('File not found in R2', { key });
            throw new FileManagementError(
              ERROR_CODES.FILE_NOT_FOUND,
              { operation: 'retrieve', metadata: { key } },
              { customMessage: `File not found: ${key}` }
            );
          }

          this.logger.info('File retrieved successfully', { key });
          return object.body;
        } catch (error) {
          this.logger.error('File retrieval failed', error as Error, { key });

          if (error instanceof FileManagementError) {
            throw error;
          }

          throw new FileManagementError(
            ERROR_CODES.STORAGE_READ_ERROR,
            { operation: 'retrieve', metadata: { key } },
            { originalError: error as Error }
          );
        }
      },
      { operation: 'retrieve', metadata: { key } },
      { maxRetries: 3, retryDelay: 1000 }
    );
  }

  /**
   * 從R2刪除檔案 (帶錯誤處理)
   */
  async delete(key: string): Promise<boolean> {
    return ErrorHandler.executeWithRecovery(
      async () => {
        try {
          this.logger.info('Starting file deletion', { key });

          // 執行 R2 刪除
          await this.bucket.delete(key);

          this.logger.info('File deleted successfully', { key });
          return true;
        } catch (error) {
          this.logger.error('File deletion failed', error as Error, { key });

          if (error instanceof FileManagementError) {
            throw error;
          }

          throw new FileManagementError(
            ERROR_CODES.STORAGE_DELETE_ERROR,
            { operation: 'delete', metadata: { key } },
            { originalError: error as Error }
          );
        }
      },
      { operation: 'delete', metadata: { key } },
      async (error) => {
        // 刪除失敗的恢復邏輯：如果檔案不存在，視為成功
        if (error.code === ERROR_CODES.FILE_NOT_FOUND) {
          this.logger.warn('File already deleted or does not exist', { key });
          return true;
        }
        throw error;
      }
    );
  }

  /**
   * 檢查檔案是否存在
   */
  async exists(key: string): Promise<boolean> {
    try {
      this.logger.debug('Checking file existence', { key });

      // 使用 head 檢查檔案是否存在
      const object = await this.bucket.head(key);
      const exists = object !== null;

      this.logger.debug('File existence check completed', { key, exists });
      return exists;
    } catch (error) {
      // 存在性檢查失敗時不拋出錯誤，返回 false
      this.logger.warn('File existence check failed', { key, error: (error as Error).message });
      return false;
    }
  }
}

/**
 * Create storage service instance (帶增強錯誤處理)
 */
export function createStorageService(env: Bindings): IStorageService {
  const logger = new FileLogger({ operation: 'storage-factory' });

  return {
    uploadFile: async (key: string, data: ArrayBuffer | Uint8Array, metadata: StorageMetadata) => {
      return ErrorHandler.executeWithRetry(
        async () => {
          try {
            logger.info('Uploading file to R2', { key, size: data.byteLength });

            const bucket = env.R2_BUCKET;
            if (!bucket) {
              throw new FileManagementError(
                ERROR_CODES.STORAGE_UNAVAILABLE,
                { operation: 'uploadFile', metadata: { key } },
                { customMessage: 'R2_BUCKET binding not found' }
              );
            }

            const putOptions: R2PutOptions = {
              httpMetadata: {
                contentType: metadata.contentType,
                contentDisposition: metadata.contentDisposition,
                contentEncoding: metadata.contentEncoding,
                cacheControl: metadata.cacheControl,
                cacheExpiry: metadata.expires
              },
              customMetadata: metadata.customMetadata
            };

            // 執行 R2 上傳
            await bucket.put(key, data, putOptions);

            logger.info('File uploaded successfully to R2', { key });

            // 生成 R2 公開 URL
            const publicUrl = getPublicFileUrl(env, key);

            return {
              success: true,
              key: key,
              url: publicUrl,
              publicUrl: publicUrl
            };
          } catch (error) {
            logger.error('Upload failed', error as Error, { key });
            throw new FileManagementError(
              ERROR_CODES.UPLOAD_FAILED,
              { operation: 'uploadFile', metadata: { key } },
              { originalError: error as Error }
            );
          }
        },
        { operation: 'uploadFile', metadata: { key } },
        { maxRetries: 3, retryDelay: 1000 }
      );
    },

    downloadFile: async (key: string) => {
      return ErrorHandler.executeWithRetry(
        async () => {
          try {
            logger.info('Downloading file from R2', { key });

            const bucket = env.R2_BUCKET;
            if (!bucket) {
              throw new FileManagementError(
                ERROR_CODES.STORAGE_UNAVAILABLE,
                { operation: 'downloadFile', metadata: { key } },
                { customMessage: 'R2_BUCKET binding not found' }
              );
            }

            // 從 R2 獲取檔案
            const object = await bucket.get(key);
            if (!object) {
              throw new FileManagementError(
                ERROR_CODES.FILE_NOT_FOUND,
                { operation: 'downloadFile', metadata: { key } },
                { customMessage: `File not found: ${key}` }
              );
            }

            // 轉換為 ArrayBuffer
            const data = await object.arrayBuffer();

            logger.info('File downloaded successfully from R2', { key, size: data.byteLength });

            return {
              success: true,
              data: data
            };
          } catch (error) {
            logger.error('Download failed', error as Error, { key });

            if (error instanceof FileManagementError) {
              return { success: false, error: error.message };
            }

            throw new FileManagementError(
              ERROR_CODES.DOWNLOAD_FAILED,
              { operation: 'downloadFile', metadata: { key } },
              { originalError: error as Error }
            );
          }
        },
        { operation: 'downloadFile', metadata: { key } },
        { maxRetries: 3, retryDelay: 1000 }
      );
    },

    deleteFile: async (key: string) => {
      return ErrorHandler.executeWithRecovery(
        async () => {
          try {
            logger.info('Deleting file from R2', { key });

            const bucket = env.R2_BUCKET;
            if (!bucket) {
              throw new FileManagementError(
                ERROR_CODES.STORAGE_UNAVAILABLE,
                { operation: 'deleteFile', metadata: { key } },
                { customMessage: 'R2_BUCKET binding not found' }
              );
            }

            // 執行 R2 刪除
            await bucket.delete(key);

            logger.info('File deleted successfully from R2', { key });
            return true;
          } catch (error) {
            logger.error('Delete failed', error as Error, { key });
            throw new FileManagementError(
              ERROR_CODES.STORAGE_DELETE_ERROR,
              { operation: 'deleteFile', metadata: { key } },
              { originalError: error as Error }
            );
          }
        },
        { operation: 'deleteFile', metadata: { key } },
        async (error) => {
          // 如果檔案不存在，視為成功
          if (error.code === ERROR_CODES.FILE_NOT_FOUND) {
            logger.warn('File already deleted or does not exist', { key });
            return true;
          }
          throw error;
        }
      );
    },

    generateSignedUrl: async (key: string, _operation: string, _expiresIn?: number) => {
      try {
        logger.info('Generating signed URL', { key });
        return getPublicFileUrl(env, key);
      } catch (error) {
        logger.error('Signed URL generation failed', error as Error, { key });
        throw new FileManagementError(
          ERROR_CODES.STORAGE_ERROR,
          { operation: 'generateSignedUrl', metadata: { key } },
          { originalError: error as Error }
        );
      }
    },

    getFileInfo: async (key: string) => {
      try {
        logger.debug('Getting file info', { key });

        const bucket = env.R2_BUCKET;
        if (!bucket) {
          throw new FileManagementError(
            ERROR_CODES.STORAGE_UNAVAILABLE,
            { operation: 'getFileInfo', metadata: { key } },
            { customMessage: 'R2_BUCKET binding not found' }
          );
        }

        // 使用 head 獲取檔案元數據
        const object = await bucket.head(key);
        if (!object) {
          throw new FileManagementError(
            ERROR_CODES.FILE_NOT_FOUND,
            { operation: 'getFileInfo', metadata: { key } },
            { customMessage: `File not found: ${key}` }
          );
        }

        return {
          key: key,
          size: object.size,
          lastModified: object.uploaded,
          etag: object.etag,
          contentType: object.httpMetadata?.contentType || 'application/octet-stream'
        };
      } catch (error) {
        logger.error('Get file info failed', error as Error, { key });

        if (error instanceof FileManagementError) {
          throw error;
        }

        throw new FileManagementError(
          ERROR_CODES.STORAGE_READ_ERROR,
          { operation: 'getFileInfo', metadata: { key } },
          { originalError: error as Error }
        );
      }
    },

    listFiles: async (prefix?: string, maxKeys?: number) => {
      try {
        logger.debug('Listing files', { prefix, maxKeys });

        const bucket = env.R2_BUCKET;
        if (!bucket) {
          throw new FileManagementError(
            ERROR_CODES.STORAGE_UNAVAILABLE,
            { operation: 'listFiles', metadata: { prefix } },
            { customMessage: 'R2_BUCKET binding not found' }
          );
        }

        // 列出 R2 bucket 中的檔案
        const options: R2ListOptions = {};
        if (prefix) options.prefix = prefix;
        if (maxKeys) options.limit = maxKeys;

        const list = await bucket.list(options);

        // 轉換為標準格式
        return list.objects.map(obj => ({
          key: obj.key,
          size: obj.size,
          lastModified: obj.uploaded,
          etag: obj.etag
        }));
      } catch (error) {
        logger.error('List files failed', error as Error, { prefix });
        throw new FileManagementError(
          ERROR_CODES.STORAGE_ERROR,
          { operation: 'listFiles', metadata: { prefix } },
          { originalError: error as Error }
        );
      }
    },

    copyFile: async (sourceKey: string, destinationKey: string) => {
      return ErrorHandler.executeWithRetry(
        async () => {
          try {
            logger.info('Copying file', { sourceKey, destinationKey });

            const bucket = env.R2_BUCKET;
            if (!bucket) {
              throw new FileManagementError(
                ERROR_CODES.STORAGE_UNAVAILABLE,
                { operation: 'copyFile', metadata: { sourceKey, destinationKey } },
                { customMessage: 'R2_BUCKET binding not found' }
              );
            }

            // R2 不支持原生 copy，需要先下載再上傳
            const sourceObject = await bucket.get(sourceKey);
            if (!sourceObject) {
              throw new FileManagementError(
                ERROR_CODES.FILE_NOT_FOUND,
                { operation: 'copyFile', metadata: { sourceKey } },
                { customMessage: `Source file not found: ${sourceKey}` }
              );
            }

            // 複製檔案
            await bucket.put(destinationKey, sourceObject.body, {
              httpMetadata: sourceObject.httpMetadata,
              customMetadata: sourceObject.customMetadata
            });

            logger.info('File copied successfully', { sourceKey, destinationKey });
            return true;
          } catch (error) {
            logger.error('Copy file failed', error as Error, { sourceKey, destinationKey });

            if (error instanceof FileManagementError) {
              throw error;
            }

            throw new FileManagementError(
              ERROR_CODES.STORAGE_COPY_ERROR,
              { operation: 'copyFile', metadata: { sourceKey, destinationKey } },
              { originalError: error as Error }
            );
          }
        },
        { operation: 'copyFile', metadata: { sourceKey, destinationKey } },
        { maxRetries: 2, retryDelay: 1000 }
      );
    },

    moveFile: async (sourceKey: string, destinationKey: string) => {
      return ErrorHandler.executeWithRetry(
        async () => {
          try {
            logger.info('Moving file', { sourceKey, destinationKey });

            const bucket = env.R2_BUCKET;
            if (!bucket) {
              throw new FileManagementError(
                ERROR_CODES.STORAGE_UNAVAILABLE,
                { operation: 'moveFile', metadata: { sourceKey, destinationKey } },
                { customMessage: 'R2_BUCKET binding not found' }
              );
            }

            // R2 不支持原生 move，需要先複製再刪除
            const sourceObject = await bucket.get(sourceKey);
            if (!sourceObject) {
              throw new FileManagementError(
                ERROR_CODES.FILE_NOT_FOUND,
                { operation: 'moveFile', metadata: { sourceKey } },
                { customMessage: `Source file not found: ${sourceKey}` }
              );
            }

            // 先複製到目標位置
            await bucket.put(destinationKey, sourceObject.body, {
              httpMetadata: sourceObject.httpMetadata,
              customMetadata: sourceObject.customMetadata
            });

            // 再刪除源檔案
            await bucket.delete(sourceKey);

            logger.info('File moved successfully', { sourceKey, destinationKey });
            return true;
          } catch (error) {
            logger.error('Move file failed', error as Error, { sourceKey, destinationKey });

            if (error instanceof FileManagementError) {
              throw error;
            }

            throw new FileManagementError(
              ERROR_CODES.STORAGE_MOVE_ERROR,
              { operation: 'moveFile', metadata: { sourceKey, destinationKey } },
              { originalError: error as Error }
            );
          }
        },
        { operation: 'moveFile', metadata: { sourceKey, destinationKey } },
        { maxRetries: 2, retryDelay: 1000 }
      );
    }
  };
}
