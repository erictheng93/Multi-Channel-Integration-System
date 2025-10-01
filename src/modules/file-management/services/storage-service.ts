/**
 * Storage Service - R2 存儲服務（增強版）
 * 包含完整的錯誤處理、重試機制和日誌記錄
 */

import type { StorageService as IStorageService } from '@modules/file-management/types/storage-types';
import type { Bindings } from '../../../types';
import { ErrorHandler, FileManagementError, FileLogger } from '@modules/file-management/utils/error-handler';
import { ERROR_CODES } from '@modules/file-management/constants/error-codes';

export class StorageService {
  private static instance: StorageService;
  private logger: FileLogger;

  private constructor() {
    this.logger = new FileLogger({ operation: 'storage' });
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * 儲存檔案到R2 (帶重試機制)
   */
  async store(key: string, data: ArrayBuffer | ReadableStream): Promise<string> {
    return ErrorHandler.executeWithRetry(
      async () => {
        try {
          this.logger.info('Starting file upload', { key, dataType: typeof data });

          // TODO: 實現R2存儲邏輯
          // const bucket = env.FILE_BUCKET;
          // await bucket.put(key, data);

          throw new FileManagementError(
            ERROR_CODES.STORAGE_ERROR,
            { operation: 'store', metadata: { key } },
            { customMessage: 'R2 storage not yet implemented' }
          );
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

          // TODO: 實現R2獲取邏輯
          // const bucket = env.FILE_BUCKET;
          // const object = await bucket.get(key);
          // if (!object) return null;
          // return object.body;

          throw new FileManagementError(
            ERROR_CODES.STORAGE_ERROR,
            { operation: 'retrieve', metadata: { key } },
            { customMessage: 'R2 storage not yet implemented' }
          );
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

          // TODO: 實現R2刪除邏輯
          // const bucket = env.FILE_BUCKET;
          // await bucket.delete(key);
          // return true;

          throw new FileManagementError(
            ERROR_CODES.STORAGE_ERROR,
            { operation: 'delete', metadata: { key } },
            { customMessage: 'R2 storage not yet implemented' }
          );
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

      // TODO: 實現存在檢查邏輯
      // const bucket = env.FILE_BUCKET;
      // const object = await bucket.head(key);
      // return object !== null;

      throw new FileManagementError(
        ERROR_CODES.STORAGE_ERROR,
        { operation: 'exists', metadata: { key } },
        { customMessage: 'R2 storage not yet implemented' }
      );
    } catch (error) {
      // 存在性檢查失敗時不拋出錯誤，返回 false
      this.logger.warn('File existence check failed', { key });
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
    uploadFile: async (key: string, data: Uint8Array, options?: any) => {
      return ErrorHandler.executeWithRetry(
        async () => {
          try {
            logger.info('Uploading file to R2', { key, size: data.length });

            // TODO: Implement R2 upload
            // const bucket = env.FILE_BUCKET;
            // await bucket.put(key, data, options);

            // 模擬成功（待 R2 整合後移除）
            return {
              success: true,
              key: key,
              url: `https://storage.example.com/${key}`,
              publicUrl: `https://storage.example.com/${key}`
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

            // TODO: Implement R2 download
            // const bucket = env.FILE_BUCKET;
            // const object = await bucket.get(key);
            // if (!object) {
            //   throw new FileManagementError(
            //     ERROR_CODES.FILE_NOT_FOUND,
            //     { operation: 'downloadFile', metadata: { key } }
            //   );
            // }
            // const data = await object.arrayBuffer();

            // 模擬成功（待 R2 整合後移除）
            return {
              success: true,
              data: new ArrayBuffer(0)
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

            // TODO: Implement R2 delete
            // const bucket = env.FILE_BUCKET;
            // await bucket.delete(key);

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
            return true;
          }
          throw error;
        }
      );
    },

    generateSignedUrl: async (key: string, operation: string, expiresIn?: number) => {
      try {
        logger.info('Generating signed URL', { key, operation, expiresIn });

        // TODO: Implement signed URL generation
        // const bucket = env.FILE_BUCKET;
        // return await bucket.createSignedUrl(key, { expiresIn });

        return `https://storage.example.com/${key}?signed=true&expires=${expiresIn}`;
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

        // TODO: Implement file info retrieval
        // const bucket = env.FILE_BUCKET;
        // const object = await bucket.head(key);

        return {
          key: key,
          size: 0,
          lastModified: new Date(),
          etag: 'unknown',
          contentType: 'application/octet-stream'
        };
      } catch (error) {
        logger.error('Get file info failed', error as Error, { key });
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

        // TODO: Implement file listing
        // const bucket = env.FILE_BUCKET;
        // const list = await bucket.list({ prefix, maxKeys });

        return [];
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

            // TODO: Implement file copying
            // const bucket = env.FILE_BUCKET;
            // await bucket.copy(sourceKey, destinationKey);

            return true;
          } catch (error) {
            logger.error('Copy file failed', error as Error, { sourceKey, destinationKey });
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

            // TODO: Implement file moving
            // const bucket = env.FILE_BUCKET;
            // await bucket.copy(sourceKey, destinationKey);
            // await bucket.delete(sourceKey);

            return true;
          } catch (error) {
            logger.error('Move file failed', error as Error, { sourceKey, destinationKey });
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
