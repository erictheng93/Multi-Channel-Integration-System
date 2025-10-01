/**
 * File Management Core Types
 * 檔案管理核心型別定義
 */

// Base file information
export interface FileMetadata {
  filename: string;
  originalFilename?: string;
  mimeType: string;
  size: number;
  extension: string;
  encoding?: string;
  lastModified?: Date;
  dimensions?: { width: number; height: number };
  duration?: number; // for video/audio files
  bitrate?: number;
  colorSpace?: string;
}

// File processing status
export type FileProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

// File types
export type FileType = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';

// Platform types
export type PlatformType = 'line' | 'facebook' | 'system' | 'admin';

// Core file interface
export interface ManagedFile {
  id: string;
  filename: string;
  originalFilename?: string;
  mimeType: string;
  size: number;
  extension: string;
  type: FileType;
  url: string;
  publicUrl?: string;
  thumbnailUrl?: string;
  downloadUrl?: string;
  platform: PlatformType;
  messageId?: string;
  conversationId?: string;
  uploadedBy?: string;
  metadata: FileMetadata;
  processingStatus: FileProcessingStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

// File upload request
export interface FileUploadRequest {
  file: File | ArrayBuffer;
  filename: string;
  mimeType: string;
  platform: PlatformType;
  conversationId?: string;
  messageId?: string;
  uploadedBy?: string;
  metadata?: Partial<FileMetadata>;
  options?: FileUploadOptions;
}

// File upload options
export interface FileUploadOptions {
  generateThumbnail?: boolean;
  compress?: boolean;
  maxSize?: number;
  allowedTypes?: string[];
  quality?: number; // 0-100
  maxDimensions?: { width: number; height: number };
}

// File upload result
export interface FileUploadResult {
  success: boolean;
  file?: ManagedFile;
  thumbnailUrl?: string;
  error?: string;
  errors?: Array<{
    code: string;
    message: string;
    field?: string;
  }>;
}

// File download options
export interface FileDownloadOptions {
  includeMetadata?: boolean;
  generateDownloadUrl?: boolean;
  urlExpiresIn?: number; // seconds
  responseType?: 'stream' | 'buffer' | 'url';
}

// File download result
export interface FileDownloadResult {
  success: boolean;
  data?: ArrayBuffer | ReadableStream;
  url?: string;
  metadata?: FileMetadata;
  contentType?: string;
  contentLength?: number;
  error?: string;
}

// File query options
export interface FileQueryOptions {
  page?: number;
  pageSize?: number;
  platform?: PlatformType;
  type?: FileType;
  conversationId?: string;
  messageId?: string;
  uploadedBy?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'createdAt' | 'size' | 'filename';
  sortOrder?: 'asc' | 'desc';
}

// File list response
export interface FileListResponse {
  items: ManagedFile[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// File statistics
export interface FileStatistics {
  totalFiles: number;
  totalSize: number;
  averageFileSize: number;
  filesByType: Record<FileType, number>;
  filesByPlatform: Record<PlatformType, number>;
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

// Batch file operations
export interface BatchFileOperation {
  operation: 'delete' | 'process' | 'move';
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

// File search
export interface FileSearchOptions extends FileQueryOptions {
  query: string;
  searchIn?: ('filename' | 'metadata' | 'content')[];
}

// Message attachment
export interface MessageAttachment {
  id: string;
  messageId: string;
  conversationId: string;
  type: FileType;
  file: ManagedFile;
  displayName?: string;
  description?: string;
  isInline: boolean;
  order: number;
  createdAt: string;
}
