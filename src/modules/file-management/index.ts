/**
 * File Management Module
 * 檔案管理模組 - 統一的檔案生命週期管理
 */

// Types (excluding conflicting StorageService interface)
export * from './types/file-types';
export type { StorageService as IStorageService } from './types/storage-types';

// Services
export * from './services/file-service';
export { StorageService, createStorageService } from './services/storage-service';
export * from './services/validation-service';
export * from './services/metadata-service';

// Handlers
export * from './handlers/file-handler';
export * from './handlers/upload-handler';

// Middleware
export * from './middleware/file-validation';
export * from './middleware/upload-limiter';

// Routes
export * from './routes/file-routes';

// Utils
export * from './utils/file-helpers';
export * from './utils/mime-type-utils';

// Constants
export * from './constants/file-config';
export * from './constants/error-codes';

// Re-export commonly used items
export { FileService } from './services/file-service';
export { FileValidationService } from './services/validation-service';
export { MetadataService } from './services/metadata-service';
export { createFileHandler } from './handlers/file-handler';
export { createUploadHandler } from './handlers/upload-handler';
export {
  createFileRoutes,
  createConversationFileRoutes,
  createMessageFileRoutes,
  createSpecialFileRoutes
} from './routes/file-routes';