/**
 * File Validation Types
 * 檔案驗證型別定義
 */

// File validation rules
export interface FileValidationRules {
  maxSize?: number; // bytes
  minSize?: number; // bytes
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
  prohibitedExtensions?: string[];
  prohibitedMimeTypes?: string[];
  requiresSignedUrl?: boolean;
  customValidators?: FileValidator[];
}

// File validation result
export interface FileValidationResult {
  valid: boolean;
  errors: FileValidationError[];
  warnings?: FileValidationWarning[];
  metadata?: {
    detectedMimeType?: string;
    detectedExtension?: string;
    estimatedType?: string;
  };
}

// File validation error
export interface FileValidationError {
  code: string;
  message: string;
  field?: string;
  value?: unknown;
  severity: 'error' | 'warning';
}

// File validation warning
export interface FileValidationWarning {
  code: string;
  message: string;
  field?: string;
  value?: unknown;
}

// Custom file validator
export interface FileValidator {
  name: string;
  validate: (file: File | ArrayBuffer, metadata: FileValidationMetadata) => Promise<FileValidationResult>;
}

// File validation metadata
export interface FileValidationMetadata {
  filename: string;
  size: number;
  mimeType: string;
  extension: string;
  platform?: string;
  userId?: string;
  conversationId?: string;
}

// Security validation options
export interface SecurityValidationOptions {
  scanForMalware?: boolean;
  checkFileSignature?: boolean;
  validateImageIntegrity?: boolean;
  scanForEmbeddedScripts?: boolean;
  maxComplexity?: number; // for documents
}

// Content validation options
export interface ContentValidationOptions {
  validateImageDimensions?: boolean;
  maxImageDimensions?: { width: number; height: number };
  minImageDimensions?: { width: number; height: number };
  validateVideoDuration?: boolean;
  maxVideoDuration?: number; // seconds
  validateAudioQuality?: boolean;
  requiresMetadata?: string[]; // required metadata fields
}

// Validation rule sets
export interface ValidationRuleSet {
  name: string;
  description: string;
  rules: FileValidationRules;
  securityOptions?: SecurityValidationOptions;
  contentOptions?: ContentValidationOptions;
  platforms?: string[];
  fileTypes?: string[];
}

// Pre-defined validation rule sets
export const VALIDATION_RULE_SETS = {
  STRICT_IMAGE: 'strict_image',
  BASIC_DOCUMENT: 'basic_document',
  MEDIA_CONTENT: 'media_content',
  LINE_PLATFORM: 'line_platform',
  FACEBOOK_PLATFORM: 'facebook_platform',
  SYSTEM_ADMIN: 'system_admin'
} as const;

export type ValidationRuleSetType = typeof VALIDATION_RULE_SETS[keyof typeof VALIDATION_RULE_SETS];

// File type detection
export interface FileTypeDetectionResult {
  detectedMimeType: string;
  detectedExtension: string;
  confidence: number; // 0-1
  category: 'image' | 'video' | 'audio' | 'document' | 'archive' | 'executable' | 'unknown';
  potentialThreats?: string[];
}

// Virus scan result
export interface VirusScanResult {
  clean: boolean;
  threats?: Array<{
    name: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  scanEngine?: string;
  scanTime: number;
}

// File signature validation
export interface FileSignatureValidation {
  valid: boolean;
  expectedSignature: string;
  actualSignature: string;
  mimeTypeMismatch: boolean;
  extensionMismatch: boolean;
}