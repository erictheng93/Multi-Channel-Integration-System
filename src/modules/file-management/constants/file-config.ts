/**
 * File Management Configuration Constants
 * 檔案管理配置常數
 */

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_VIDEO_SIZE: 20 * 1024 * 1024, // 20MB
  MAX_AUDIO_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_DOCUMENT_SIZE: 10 * 1024 * 1024, // 10MB
  MIN_FILE_SIZE: 1 // 1 byte
} as const;

// Allowed MIME types by category
export const ALLOWED_MIME_TYPES = {
  IMAGE: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/tiff'
  ],
  VIDEO: [
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    'video/ogg',
    'video/x-m4v',
    'video/x-matroska',
    'video/x-flv',
    'video/x-ms-wmv',
    'video/3gpp'
  ],
  AUDIO: [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/aac',
    'audio/m4a',
    'audio/flac'
  ],
  DOCUMENT: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/rtf'
  ],
  ARCHIVE: [
    'application/zip',
    'application/x-rar-compressed',
    'application/x-tar',
    'application/gzip',
    'application/x-7z-compressed'
  ]
} as const;

// File extensions mapping
export const FILE_EXTENSIONS = {
  IMAGE: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff'],
  VIDEO: ['.mp4', '.mpeg', '.mov', '.avi', '.webm', '.ogg', '.m4v', '.mkv', '.flv', '.wmv', '.3gp'],
  AUDIO: ['.mp3', '.wav', '.ogg', '.aac', '.m4a', '.flac'],
  DOCUMENT: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.rtf'],
  ARCHIVE: ['.zip', '.rar', '.tar', '.gz', '.7z']
} as const;

// MIME type to extension mapping
export const MIME_TO_EXTENSION = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/bmp': '.bmp',
  'image/tiff': '.tiff',
  'video/mp4': '.mp4',
  'video/mpeg': '.mpeg',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi',
  'video/webm': '.webm',
  'video/ogg': '.ogg',
  'video/x-m4v': '.m4v',
  'video/x-matroska': '.mkv',
  'video/x-flv': '.flv',
  'video/x-ms-wmv': '.wmv',
  'video/3gpp': '.3gp',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/aac': '.aac',
  'audio/m4a': '.m4a',
  'audio/flac': '.flac',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/rtf': '.rtf',
  'application/zip': '.zip',
  'application/x-rar-compressed': '.rar',
  'application/x-tar': '.tar',
  'application/gzip': '.gz',
  'application/x-7z-compressed': '.7z'
} as const;

// Platform-specific configurations
export const PLATFORM_CONFIG = {
  LINE: {
    maxFileSize: FILE_SIZE_LIMITS.MAX_FILE_SIZE,
    allowedTypes: [
      ...ALLOWED_MIME_TYPES.IMAGE,
      ...ALLOWED_MIME_TYPES.VIDEO,
      ...ALLOWED_MIME_TYPES.AUDIO
    ],
    supportedFeatures: ['thumbnails', 'preview']
  },
  FACEBOOK: {
    maxFileSize: FILE_SIZE_LIMITS.MAX_FILE_SIZE,
    allowedTypes: [
      ...ALLOWED_MIME_TYPES.IMAGE,
      ...ALLOWED_MIME_TYPES.VIDEO,
      ...ALLOWED_MIME_TYPES.AUDIO,
      ...ALLOWED_MIME_TYPES.DOCUMENT
    ],
    supportedFeatures: ['thumbnails', 'preview', 'metadata']
  },
  SYSTEM: {
    maxFileSize: FILE_SIZE_LIMITS.MAX_FILE_SIZE,
    allowedTypes: [
      ...ALLOWED_MIME_TYPES.IMAGE,
      ...ALLOWED_MIME_TYPES.VIDEO,
      ...ALLOWED_MIME_TYPES.AUDIO,
      ...ALLOWED_MIME_TYPES.DOCUMENT,
      ...ALLOWED_MIME_TYPES.ARCHIVE
    ],
    supportedFeatures: ['thumbnails', 'preview', 'metadata', 'virus_scan']
  },
  ADMIN: {
    maxFileSize: 50 * 1024 * 1024, // 50MB for admin uploads
    allowedTypes: Object.values(ALLOWED_MIME_TYPES).flat(),
    supportedFeatures: ['thumbnails', 'preview', 'metadata', 'virus_scan', 'batch_operations']
  }
} as const;

// Storage path patterns
export const STORAGE_PATHS = {
  ATTACHMENTS: 'attachments',
  MEDIA: 'media',
  DOCUMENTS: 'documents',
  THUMBNAILS: 'thumbnails',
  TEMP: 'temp'
} as const;

// File processing options
export const PROCESSING_OPTIONS = {
  THUMBNAIL: {
    enabled: true,
    maxWidth: 200,
    maxHeight: 200,
    quality: 80,
    format: 'jpg'
  },
  COMPRESSION: {
    enabled: true,
    quality: 85,
    maxDimensions: { width: 1920, height: 1080 }
  },
  METADATA_EXTRACTION: {
    enabled: true,
    includeExif: false, // 移除 EXIF 資料以保護隱私
    includeDimensions: true,
    includeDuration: true
  }
} as const;

// Cache configuration
export const CACHE_CONFIG = {
  METADATA_TTL: 3600, // 1 hour
  URL_TTL: 1800, // 30 minutes
  THUMBNAIL_TTL: 86400 * 7, // 7 days
  MAX_CACHE_SIZE: 100 * 1024 * 1024 // 100MB
} as const;

// Upload configuration
export const UPLOAD_CONFIG = {
  CHUNK_SIZE: 1024 * 1024, // 1MB chunks for large files
  MAX_CONCURRENT_UPLOADS: 3,
  RETRY_ATTEMPTS: 3,
  TIMEOUT: 30000, // 30 seconds
  PROGRESS_INTERVAL: 1000 // 1 second
} as const;

// Security configuration
export const SECURITY_CONFIG = {
  VIRUS_SCAN_ENABLED: false, // Enable when virus scanner is available
  MAX_SCAN_SIZE: 10 * 1024 * 1024, // 10MB
  QUARANTINE_SUSPICIOUS: true,
  ALLOWED_EXECUTABLES: [], // No executables allowed by default
  BLOCKED_EXTENSIONS: ['.exe', '.bat', '.cmd', '.scr', '.com', '.pif', '.vbs', '.js']
} as const;