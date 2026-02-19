/**
 * File Validation Service
 * 檔案驗證服務
 */

import type {
  FileValidationRules,
  FileValidationResult,
  FileValidationError,
  FileValidationMetadata,
  ValidationRuleSetType
} from '../types/validation-types';
import type { PlatformType } from '@modules/file-management/types/file-types';
import { PLATFORMS } from '@/constants/platforms';
import {
  FILE_SIZE_LIMITS,
  PLATFORM_CONFIG,
  SECURITY_CONFIG
} from '../constants/file-config';
import { ERROR_CODES, ERROR_MESSAGES } from '@modules/file-management/constants/error-codes';
import {
  isAllowedMimeType,
  normalizeMimeType,
  validateFileSignature
} from '../utils/mime-type-utils';
import { isValidFilename } from '@modules/file-management/utils/file-helpers';

export class FileValidationService {
  private readonly defaultRules: FileValidationRules = {
    maxSize: FILE_SIZE_LIMITS.MAX_FILE_SIZE,
    minSize: FILE_SIZE_LIMITS.MIN_FILE_SIZE,
    allowedMimeTypes: [...Object.values(PLATFORM_CONFIG.SYSTEM.allowedTypes)],
    prohibitedExtensions: [...SECURITY_CONFIG.BLOCKED_EXTENSIONS]
  };

  /**
   * 驗證檔案
   */
  async validateFile(
    file: File | ArrayBuffer,
    metadata: FileValidationMetadata,
    rules: FileValidationRules = this.defaultRules
  ): Promise<FileValidationResult> {
    const errors: FileValidationError[] = [];
    const warnings: FileValidationError[] = [];

    try {
      // 基本驗證
      this.validateBasicProperties(metadata, rules, errors);

      // 檔案大小驗證
      this.validateFileSize(metadata.size, rules, errors);

      // 檔名驗證
      this.validateFilename(metadata.filename, errors);

      // MIME 類型驗證
      this.validateMimeType(metadata.mimeType, rules, errors);

      // 副檔名驗證
      this.validateExtension(metadata.extension, rules, errors);

      // 如果有檔案內容，進行進階驗證
      if (file instanceof File || file instanceof ArrayBuffer) {
        const data = file instanceof File ? await file.arrayBuffer() : file;
        await this.validateFileContent(data, metadata, rules, errors, warnings);
      }

      // 平台特定驗證
      if (metadata.platform) {
        this.validatePlatformRequirements(metadata, errors);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        metadata: {
          detectedMimeType: metadata.mimeType
        }
      };

    } catch (error) {
      errors.push({
        code: ERROR_CODES.PROCESSING_FAILED,
        message: error instanceof Error ? error.message : 'Validation failed',
        severity: 'error'
      });

      return {
        valid: false,
        errors,
        warnings
      };
    }
  }

  /**
   * 根據平台獲取驗證規則
   */
  getRulesForPlatform(platform: PlatformType): FileValidationRules {
    const platformConfig = PLATFORM_CONFIG[platform.toUpperCase() as keyof typeof PLATFORM_CONFIG];

    if (platformConfig) {
      return {
        ...this.defaultRules,
        maxSize: platformConfig.maxFileSize,
        allowedMimeTypes: [...platformConfig.allowedTypes]
      };
    }

    return this.defaultRules;
  }

  /**
   * 根據驗證規則集獲取規則
   */
  getRulesForRuleSet(ruleSetType: ValidationRuleSetType): FileValidationRules {
    const ruleSets: Record<ValidationRuleSetType, FileValidationRules> = {
      strict_image: {
        maxSize: FILE_SIZE_LIMITS.MAX_IMAGE_SIZE,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        prohibitedExtensions: [...SECURITY_CONFIG.BLOCKED_EXTENSIONS]
      },
      basic_document: {
        maxSize: FILE_SIZE_LIMITS.MAX_DOCUMENT_SIZE,
        allowedMimeTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain'
        ],
        prohibitedExtensions: [...SECURITY_CONFIG.BLOCKED_EXTENSIONS]
      },
      media_content: {
        maxSize: FILE_SIZE_LIMITS.MAX_VIDEO_SIZE,
        allowedMimeTypes: [
          'image/jpeg', 'image/png', 'image/gif',
          'video/mp4', 'video/mpeg',
          'audio/mpeg', 'audio/wav'
        ],
        prohibitedExtensions: [...SECURITY_CONFIG.BLOCKED_EXTENSIONS]
      },
      line_platform: this.getRulesForPlatform(PLATFORMS.LINE),
      facebook_platform: this.getRulesForPlatform(PLATFORMS.FACEBOOK),
      system_admin: {
        maxSize: 50 * 1024 * 1024, // 50MB for admin
        allowedMimeTypes: [], // 允許所有類型
        prohibitedExtensions: [...SECURITY_CONFIG.BLOCKED_EXTENSIONS]
      }
    };

    return ruleSets[ruleSetType] || this.defaultRules;
  }

  /**
   * 驗證基本屬性
   */
  private validateBasicProperties(
    metadata: FileValidationMetadata,
    _rules: FileValidationRules,
    errors: FileValidationError[]
  ): void {
    if (!metadata.filename) {
      errors.push({
        code: ERROR_CODES.MISSING_FILE,
        message: ERROR_MESSAGES.MISSING_FILE,
        field: 'filename',
        severity: 'error'
      });
    }

    if (!metadata.mimeType) {
      errors.push({
        code: ERROR_CODES.INVALID_MIME_TYPE,
        message: ERROR_MESSAGES.INVALID_MIME_TYPE,
        field: 'mimeType',
        severity: 'error'
      });
    }
  }

  /**
   * 驗證檔案大小
   */
  private validateFileSize(
    size: number,
    rules: FileValidationRules,
    errors: FileValidationError[]
  ): void {
    if (rules.maxSize && size > rules.maxSize) {
      errors.push({
        code: ERROR_CODES.FILE_TOO_LARGE,
        message: ERROR_MESSAGES.FILE_TOO_LARGE,
        field: 'size',
        value: size,
        severity: 'error'
      });
    }

    if (rules.minSize && size < rules.minSize) {
      errors.push({
        code: ERROR_CODES.FILE_TOO_SMALL,
        message: ERROR_MESSAGES.FILE_TOO_SMALL,
        field: 'size',
        value: size,
        severity: 'error'
      });
    }
  }

  /**
   * 驗證檔名
   */
  private validateFilename(filename: string, errors: FileValidationError[]): void {
    if (!isValidFilename(filename)) {
      errors.push({
        code: ERROR_CODES.INVALID_FILENAME,
        message: ERROR_MESSAGES.INVALID_FILENAME,
        field: 'filename',
        value: filename,
        severity: 'error'
      });
    }
  }

  /**
   * 驗證 MIME 類型
   */
  private validateMimeType(
    mimeType: string,
    rules: FileValidationRules,
    errors: FileValidationError[]
  ): void {
    const normalizedMimeType = normalizeMimeType(mimeType);

    // 檢查禁止的 MIME 類型
    if (rules.prohibitedMimeTypes?.includes(normalizedMimeType)) {
      errors.push({
        code: ERROR_CODES.PROHIBITED_FILE_TYPE,
        message: ERROR_MESSAGES.PROHIBITED_FILE_TYPE,
        field: 'mimeType',
        value: mimeType,
        severity: 'error'
      });
      return;
    }

    // 檢查允許的 MIME 類型
    if (rules.allowedMimeTypes && rules.allowedMimeTypes.length > 0) {
      if (!rules.allowedMimeTypes.includes(normalizedMimeType)) {
        errors.push({
          code: ERROR_CODES.INVALID_MIME_TYPE,
          message: ERROR_MESSAGES.INVALID_MIME_TYPE,
          field: 'mimeType',
          value: mimeType,
          severity: 'error'
        });
      }
    } else {
      // 如果沒有特定允許列表，使用預設檢查
      if (!isAllowedMimeType(normalizedMimeType)) {
        errors.push({
          code: ERROR_CODES.INVALID_MIME_TYPE,
          message: ERROR_MESSAGES.INVALID_MIME_TYPE,
          field: 'mimeType',
          value: mimeType,
          severity: 'error'
        });
      }
    }
  }

  /**
   * 驗證副檔名
   */
  private validateExtension(
    extension: string,
    rules: FileValidationRules,
    errors: FileValidationError[]
  ): void {
    const normalizedExtension = extension.toLowerCase();

    // 檢查禁止的副檔名
    if (rules.prohibitedExtensions?.includes(normalizedExtension)) {
      errors.push({
        code: ERROR_CODES.PROHIBITED_FILE_TYPE,
        message: ERROR_MESSAGES.PROHIBITED_FILE_TYPE,
        field: 'extension',
        value: extension,
        severity: 'error'
      });
    }

    // 檢查允許的副檔名
    if (rules.allowedExtensions && rules.allowedExtensions.length > 0) {
      if (!rules.allowedExtensions.includes(normalizedExtension)) {
        errors.push({
          code: ERROR_CODES.INVALID_EXTENSION,
          message: ERROR_MESSAGES.INVALID_EXTENSION,
          field: 'extension',
          value: extension,
          severity: 'error'
        });
      }
    }
  }

  /**
   * 驗證檔案內容
   */
  private async validateFileContent(
    data: ArrayBuffer,
    metadata: FileValidationMetadata,
    _rules: FileValidationRules,
    errors: FileValidationError[],
    warnings: FileValidationError[]
  ): Promise<void> {
    // 檔案簽章驗證
    const signatureResult = validateFileSignature(data, metadata.mimeType);
    if (!signatureResult.valid && signatureResult.detectedMimeType) {
      warnings.push({
        code: ERROR_CODES.INVALID_FILE_SIGNATURE,
        message: `檔案簽章與 MIME 類型不符，偵測到: ${signatureResult.detectedMimeType}`,
        field: 'content',
        severity: 'warning'
      });
    }

    // 檢查檔案是否損壞（基本檢查）
    if (data.byteLength !== metadata.size) {
      errors.push({
        code: ERROR_CODES.CORRUPTED_FILE,
        message: ERROR_MESSAGES.CORRUPTED_FILE,
        field: 'content',
        severity: 'error'
      });
    }

    // 安全檢查
    if (SECURITY_CONFIG.VIRUS_SCAN_ENABLED && metadata.size <= SECURITY_CONFIG.MAX_SCAN_SIZE) {
      // 這裡可以整合病毒掃描服務
      // await this.scanForVirus(data, errors);
    }
  }

  /**
   * 驗證平台特定要求
   */
  private validatePlatformRequirements(
    metadata: FileValidationMetadata,
    errors: FileValidationError[]
  ): void {
    const platform = metadata.platform?.toUpperCase() as keyof typeof PLATFORM_CONFIG;
    const platformConfig = PLATFORM_CONFIG[platform];

    if (!platformConfig) {
      return;
    }

    // 檢查平台特定的檔案大小限制
    if (metadata.size > platformConfig.maxFileSize) {
      errors.push({
        code: ERROR_CODES.FILE_TOO_LARGE,
        message: `檔案大小超過 ${metadata.platform} 平台限制`,
        field: 'size',
        value: metadata.size,
        severity: 'error'
      });
    }

    // 檢查平台支援的檔案類型
    if (!platformConfig.allowedTypes.includes(metadata.mimeType as any)) {
      errors.push({
        code: ERROR_CODES.INVALID_FILE_TYPE,
        message: `${metadata.platform} 平台不支援此檔案類型`,
        field: 'mimeType',
        value: metadata.mimeType,
        severity: 'error'
      });
    }
  }

  /**
   * 批量驗證檔案
   */
  async validateFiles(
    files: Array<{ file: File | ArrayBuffer; metadata: FileValidationMetadata }>,
    rules: FileValidationRules = this.defaultRules
  ): Promise<FileValidationResult[]> {
    const results = await Promise.all(
      files.map(({ file, metadata }) => this.validateFile(file, metadata, rules))
    );

    return results;
  }

  /**
   * 快速驗證（只檢查基本屬性，不讀取檔案內容）
   */
  validateQuick(
    metadata: FileValidationMetadata,
    rules: FileValidationRules = this.defaultRules
  ): FileValidationResult {
    const errors: FileValidationError[] = [];

    this.validateBasicProperties(metadata, rules, errors);
    this.validateFileSize(metadata.size, rules, errors);
    this.validateFilename(metadata.filename, errors);
    this.validateMimeType(metadata.mimeType, rules, errors);
    this.validateExtension(metadata.extension, rules, errors);

    if (metadata.platform) {
      this.validatePlatformRequirements(metadata, errors);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}