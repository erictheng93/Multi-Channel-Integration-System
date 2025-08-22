// File storage and handling type definitions

// Base file information
export interface FileMetadata {
  filename: string;
  originalFilename?: string;
  mimeType: string;
  size: number;
  extension: string;
  encoding?: string;
  lastModified?: Date;
}

// Storage-specific interfaces
export interface StorageLocation {
  bucket: string;
  key: string;
  region?: string;
  path: string;
  url: string;
  publicUrl?: string;
}

// File upload types
export interface FileUploadRequest {
  file: File | ArrayBuffer;
  filename: string;
  mimeType: string;
  metadata?: FileMetadata;
  options?: {
    generateThumbnail?: boolean;
    compress?: boolean;
    maxSize?: number;
    allowedTypes?: string[];
  };
}

export interface FileUploadResult {
  success: boolean;
  fileId: string;
  storage: StorageLocation;
  metadata: FileMetadata;
  thumbnailUrl?: string;
  error?: string;
}

// Media processing types
export interface MediaProcessingOptions {
  generateThumbnail?: boolean;
  thumbnailSize?: { width: number; height: number };
  compress?: boolean;
  quality?: number; // 0-100
  format?: 'jpg' | 'png' | 'webp';
  maxDimensions?: { width: number; height: number };
}

export interface ProcessedMediaFile {
  original: MediaFileInfo;
  thumbnail?: MediaFileInfo;
  compressed?: MediaFileInfo;
  metadata: MediaProcessingMetadata;
}

export interface MediaProcessingMetadata {
  originalSize: number;
  processedSize?: number;
  compressionRatio?: number;
  dimensions?: { width: number; height: number };
  duration?: number; // for video/audio files
  bitrate?: number;
  format: string;
  colorSpace?: string;
}

// Enhanced media file interface
export interface MediaFileInfo {
  id: string;
  filename: string;
  originalFilename?: string;
  mimeType: string;
  size: number;
  extension: string;
  url: string;
  publicUrl?: string;
  thumbnailUrl?: string;
  downloadUrl?: string;
  platform: 'line' | 'facebook' | 'system';
  messageId?: string;
  conversationId?: string;
  uploadedBy?: string;
  storage: StorageLocation;
  metadata: FileMetadata;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

// Download and streaming types
export interface FileDownloadOptions {
  includeMetadata?: boolean;
  generateDownloadUrl?: boolean;
  urlExpiresIn?: number; // seconds
  responseType?: 'stream' | 'buffer' | 'url';
}

export interface FileDownloadResult {
  success: boolean;
  data?: ArrayBuffer | ReadableStream;
  url?: string;
  metadata?: FileMetadata;
  contentType?: string;
  contentLength?: number;
  error?: string;
}

// File validation types
export interface FileValidationRules {
  maxSize?: number; // bytes
  minSize?: number; // bytes
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
  prohibitedExtensions?: string[];
  requiresSignedUrl?: boolean;
}

export interface FileValidationResult {
  valid: boolean;
  errors: Array<{
    code: string;
    message: string;
    field?: string;
  }>;
  warnings?: Array<{
    code: string;
    message: string;
  }>;
}

// Storage service interfaces
export interface FileStorageService {
  upload(request: FileUploadRequest): Promise<FileUploadResult>;
  download(fileId: string, options?: FileDownloadOptions): Promise<FileDownloadResult>;
  delete(fileId: string): Promise<{ success: boolean; error?: string }>;
  getMetadata(fileId: string): Promise<MediaFileInfo | null>;
  generateSignedUrl(fileId: string, expiresIn?: number): Promise<string | null>;
  validateFile(file: File | ArrayBuffer, rules: FileValidationRules): FileValidationResult;
}

// Platform-specific file types
export interface LineMediaFile extends MediaFileInfo {
  platform: 'line';
  originalContentUrl?: string;
  previewImageUrl?: string;
  lineMessageId: string;
}

export interface FacebookMediaFile extends MediaFileInfo {
  platform: 'facebook';
  facebookAttachmentId?: string;
  facebookMessageId?: string;
}

// Attachment types for messages
export interface MessageAttachment {
  id: string;
  messageId: string;
  conversationId: string;
  type: 'image' | 'video' | 'audio' | 'file' | 'document';
  file: MediaFileInfo;
  displayName?: string;
  description?: string;
  isInline: boolean;
  order: number;
  createdAt: string;
}

// Batch operations
export interface BatchFileOperation {
  operation: 'upload' | 'download' | 'delete' | 'process';
  fileIds: string[];
  options?: Record<string, unknown>;
}

export interface BatchFileResult {
  successful: string[];
  failed: Array<{
    fileId: string;
    error: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    processingTime: number;
  };
}

// File system utilities
export interface FileSystemStats {
  totalFiles: number;
  totalSize: number;
  averageFileSize: number;
  filesByType: Record<string, number>;
  filesByPlatform: Record<string, number>;
  storageUsage: {
    used: number;
    available: number;
    percentage: number;
  };
  recentActivity: {
    uploaded: number;
    downloaded: number;
    deleted: number;
    period: string; // e.g., "24h", "7d", "30d"
  };
}

// Error types
export interface FileStorageError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  fileId?: string;
  operation?: string;
}

// Configuration types
export interface FileStorageConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  storageProvider: 'r2' | 's3' | 'local';
  bucketName: string;
  region?: string;
  publicBaseUrl?: string;
  generateThumbnails: boolean;
  enableCompression: boolean;
  retentionDays?: number;
  cleanupInterval?: number;
}