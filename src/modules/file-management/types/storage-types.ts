/**
 * Storage Service Types
 * 儲存服務型別定義
 */

// Storage location
export interface StorageLocation {
  bucket: string;
  key: string;
  region?: string;
  path: string;
  url: string;
  publicUrl?: string;
  signedUrl?: string;
}

// Storage configuration
export interface StorageConfig {
  provider: 'r2' | 's3' | 'local';
  bucketName: string;
  region?: string;
  publicBaseUrl?: string;
  customDomain?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
}

// Storage service interface
export interface StorageService {
  uploadFile(
    key: string,
    data: ArrayBuffer | Uint8Array,
    metadata: StorageMetadata
  ): Promise<StorageUploadResult>;

  downloadFile(key: string): Promise<StorageDownloadResult>;

  deleteFile(key: string): Promise<boolean>;

  getFileInfo(key: string): Promise<StorageFileInfo | null>;

  generateSignedUrl(
    key: string,
    operation: 'read' | 'write',
    expiresIn?: number
  ): Promise<string>;

  listFiles(
    prefix?: string,
    maxKeys?: number
  ): Promise<StorageFileInfo[]>;

  copyFile(
    sourceKey: string,
    destinationKey: string
  ): Promise<boolean>;

  moveFile(
    sourceKey: string,
    destinationKey: string
  ): Promise<boolean>;
}

// Storage metadata
export interface StorageMetadata {
  contentType?: string;
  contentLength?: number;
  contentDisposition?: string;
  contentEncoding?: string;
  cacheControl?: string;
  expires?: Date;
  customMetadata?: Record<string, string>;
}

// Storage upload result
export interface StorageUploadResult {
  success: boolean;
  key: string;
  url: string;
  publicUrl?: string;
  size?: number;
  etag?: string;
  error?: string;
}

// Storage download result
export interface StorageDownloadResult {
  success: boolean;
  data?: ArrayBuffer;
  stream?: ReadableStream;
  metadata?: StorageMetadata;
  contentType?: string;
  contentLength?: number;
  lastModified?: Date;
  etag?: string;
  error?: string;
}

// Storage file info
export interface StorageFileInfo {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

// Storage statistics
export interface StorageStatistics {
  totalObjects: number;
  totalSize: number;
  bucketName: string;
  region?: string;
  lastModified: Date;
}

// Storage error
export interface StorageError {
  code: string;
  message: string;
  statusCode?: number;
  key?: string;
  operation?: string;
  details?: Record<string, unknown>;
}

// Key generation options
export interface KeyGenerationOptions {
  prefix?: string;
  platform?: string;
  fileType?: string;
  dateStructure?: boolean; // e.g., 2024/01/15/
  preserveFilename?: boolean;
  includeUserId?: boolean;
  includeConversationId?: boolean;
  conversationId?: string;
  userId?: string;
}

// URL generation options
export interface URLGenerationOptions {
  expiresIn?: number; // seconds
  responseContentType?: string;
  responseContentDisposition?: string;
  publicAccess?: boolean;
}