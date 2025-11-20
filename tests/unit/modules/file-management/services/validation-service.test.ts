/**
 * File Validation Service Unit Tests
 * 檔案驗證服務單元測試
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FileValidationService } from '@modules/file-management/services/validation-service';
import { ERROR_CODES } from '@modules/file-management/constants/error-codes';
import { FILE_SIZE_LIMITS } from '@modules/file-management/constants/file-config';
import type { FileValidationMetadatimport { MockFactory } from '@helpers/mockFactory';
a } from '@modules/file-management/types/validation-types';

describe('FileValidationService', () => {
  let validationService: FileValidationService;

  beforeEach(() => {
    vi.clearAllMocks();
    validationService = new FileValidationService();
  });


  afterEach(() => {
    vi.restoreAllMocks();
  });
  describe('validateFile', () => {
    describe('Basic validation', () => {
      test('should accept valid file', async () => {
        const metadata: FileValidationMetadata = {
          filename: 'test.jpg',
          size: 100000, // 100KB
          mimeType: 'image/jpeg',
          extension: 'jpg'
        };

        const result = await validationService.validateFile(
          new ArrayBuffer(100000),
          metadata
        );

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      test('should reject file without filename', async () => {
        const metadata: FileValidationMetadata = {
          filename: '',
          size: 100000,
          mimeType: 'image/jpeg',
          extension: 'jpg'
        };

        const result = await validationService.validateFile(
          new ArrayBuffer(100000),
          metadata
        );

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: ERROR_CODES.MISSING_FILE,
            field: 'filename'
          })
        );
      });

      test('should reject file without mime type', async () => {
        const metadata: FileValidationMetadata = {
          filename: 'test.jpg',
          size: 100000,
          mimeType: '',
          extension: 'jpg'
        };

        const result = await validationService.validateFile(
          new ArrayBuffer(100000),
          metadata
        );

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: ERROR_CODES.INVALID_MIME_TYPE,
            field: 'mimeType'
          })
        );
      });
    });

    describe('File size validation', () => {
      test('should reject file that is too large', async () => {
        const metadata: FileValidationMetadata = {
          filename: 'large.jpg',
          size: FILE_SIZE_LIMITS.MAX_FILE_SIZE + 1,
          mimeType: 'image/jpeg',
          extension: 'jpg'
        };

        const result = await validationService.validateFile(
          new ArrayBuffer(metadata.size),
          metadata
        );

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: ERROR_CODES.FILE_TOO_LARGE,
            field: 'size'
          })
        );
      });

      test('should reject file that is too small', async () => {
        const metadata: FileValidationMetadata = {
          filename: 'tiny.jpg',
          size: FILE_SIZE_LIMITS.MIN_FILE_SIZE - 1,
          mimeType: 'image/jpeg',
          extension: 'jpg'
        };

        const result = await validationService.validateFile(
          new ArrayBuffer(metadata.size),
          metadata
        );

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: ERROR_CODES.FILE_TOO_SMALL,
            field: 'size'
          })
        );
      });

      test('should accept file within size limits', async () => {
        const metadata: FileValidationMetadata = {
          filename: 'normal.jpg',
          size: 1024 * 1024, // 1MB
          mimeType: 'image/jpeg',
          extension: 'jpg'
        };

        const result = await validationService.validateFile(
          new ArrayBuffer(metadata.size),
          metadata
        );

        expect(result.valid).toBe(true);
      });
    });

    describe('MIME type validation', () => {
      test('should accept allowed image MIME types', async () => {
        const mimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

        for (const mimeType of mimeTypes) {
          const metadata: FileValidationMetadata = {
            filename: `test.${mimeType.spltest('/')[1]}`,
            size: 100000,
            mimeType,
            extension: mimeType.spltest('/')[1]
          };

          const result = await validationService.validateFile(
            new ArrayBuffer(100000),
            metadata
          );

          expect(result.valid).toBe(true);
        }
      });

      test('should accept allowed document MIME types', async () => {
        const metadata: FileValidationMetadata = {
          filename: 'document.pdf',
          size: 100000,
          mimeType: 'application/pdf',
          extension: 'pdf'
        };

        const result = await validationService.validateFile(
          new ArrayBuffer(100000),
          metadata
        );

        expect(result.valid).toBe(true);
      });

      test('should reject prohibited MIME types when specified', async () => {
        const metadata: FileValidationMetadata = {
          filename: 'test.exe',
          size: 100000,
          mimeType: 'application/x-msdownload',
          extension: 'exe'
        };

        const rules = {
          maxSize: FILE_SIZE_LIMITS.MAX_FILE_SIZE,
          prohibitedMimeTypes: ['application/x-msdownload']
        };

        const result = await validationService.validateFile(
          new ArrayBuffer(100000),
          metadata,
          rules
        );

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: ERROR_CODES.PROHIBITED_FILE_TYPE,
            field: 'mimeType'
          })
        );
      });
    });

    describe('Extension validation', () => {
      test('should reject prohibited extensions', async () => {
        const metadata: FileValidationMetadata = {
          filename: 'test.exe',
          size: 100000,
          mimeType: 'image/jpeg', // 使用允許的 MIME 類型
          extension: '.exe' // 但副檔名是禁止的（包含點號）
        };

        const result = await validationService.validateFile(
          new ArrayBuffer(100000),
          metadata
        );

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: ERROR_CODES.PROHIBITED_FILE_TYPE,
            field: 'extension'
          })
        );
      });

      test('should accept allowed extensions when specified', async () => {
        const metadata: FileValidationMetadata = {
          filename: 'document.pdf',
          size: 100000,
          mimeType: 'application/pdf',
          extension: 'pdf'
        };

        const rules = {
          maxSize: FILE_SIZE_LIMITS.MAX_FILE_SIZE,
          allowedExtensions: ['pdf', 'doc', 'docx']
        };

        const result = await validationService.validateFile(
          new ArrayBuffer(100000),
          metadata,
          rules
        );

        expect(result.valid).toBe(true);
      });

      test('should reject disallowed extensions when whitelist is specified', async () => {
        const metadata: FileValidationMetadata = {
          filename: 'test.txt',
          size: 100000,
          mimeType: 'text/plain',
          extension: 'txt'
        };

        const rules = {
          maxSize: FILE_SIZE_LIMITS.MAX_FILE_SIZE,
          allowedExtensions: ['pdf', 'doc', 'docx']
        };

        const result = await validationService.validateFile(
          new ArrayBuffer(100000),
          metadata,
          rules
        );

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: ERROR_CODES.INVALID_EXTENSION,
            field: 'extension'
          })
        );
      });
    });

    describe('Platform-specific validation', () => {
      test('should apply LINE platform rules', async () => {
        const rules = validationService.getRulesForPlatform('line');

        const metadata: FileValidationMetadata = {
          filename: 'test.jpg',
          size: 100000,
          mimeType: 'image/jpeg',
          extension: 'jpg',
          platform: 'line'
        };

        const result = await validationService.validateFile(
          new ArrayBuffer(100000),
          metadata,
          rules
        );

        expect(result.valid).toBe(true);
      });

      test('should apply Facebook platform rules', async () => {
        const rules = validationService.getRulesForPlatform('facebook');

        const metadata: FileValidationMetadata = {
          filename: 'test.jpg',
          size: 100000,
          mimeType: 'image/jpeg',
          extension: 'jpg',
          platform: 'facebook'
        };

        const result = await validationService.validateFile(
          new ArrayBuffer(100000),
          metadata,
          rules
        );

        expect(result.valid).toBe(true);
      });
    });

    describe('Content validation', () => {
      test('should detect size mismatch', async () => {
        const metadata: FileValidationMetadata = {
          filename: 'test.jpg',
          size: 100000,
          mimeType: 'image/jpeg',
          extension: 'jpg'
        };

        // Create ArrayBuffer with different size than metadata
        const result = await validationService.validateFile(
          new ArrayBuffer(50000), // Different from metadata.size
          metadata
        );

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: ERROR_CODES.CORRUPTED_FILE,
            field: 'content'
          })
        );
      });
    });
  });

  describe('getRulesForPlatform', () => {
    test('should return rules for LINE platform', () => {
      const rules = validationService.getRulesForPlatform('line');

      expect(rules).toHaveProperty('maxSize');
      expect(rules).toHaveProperty('allowedMimeTypes');
      expect(Array.isArray(rules.allowedMimeTypes)).toBe(true);
    });

    test('should return rules for Facebook platform', () => {
      const rules = validationService.getRulesForPlatform('facebook');

      expect(rules).toHaveProperty('maxSize');
      expect(rules).toHaveProperty('allowedMimeTypes');
    });

    test('should return default rules for unknown platform', () => {
      const rules = validationService.getRulesForPlatform('unknown' as any);

      expect(rules).toHaveProperty('maxSize');
      expect(rules).toHaveProperty('allowedMimeTypes');
    });
  });

  describe('getRulesForRuleSet', () => {
    test('should return strict image rules', () => {
      const rules = validationService.getRulesForRuleSet('strict_image');

      expect(rules.maxSize).toBeLessThan(FILE_SIZE_LIMITS.MAX_FILE_SIZE);
      expect(rules.allowedMimeTypes).toContain('image/jpeg');
      expect(rules.allowedMimeTypes).toContain('image/png');
    });

    test('should return basic document rules', () => {
      const rules = validationService.getRulesForRuleSet('basic_document');

      expect(rules.allowedMimeTypes).toContain('application/pdf');
      expect(rules.allowedMimeTypes).toContain('text/plain');
    });

    test('should return media content rules', () => {
      const rules = validationService.getRulesForRuleSet('media_content');

      expect(rules.allowedMimeTypes).toContain('image/jpeg');
      expect(rules.allowedMimeTypes).toContain('video/mp4');
      expect(rules.allowedMimeTypes).toContain('audio/mpeg');
    });

    test('should return system admin rules', () => {
      const rules = validationService.getRulesForRuleSet('system_admin');

      expect(rules.maxSize).toBeGreaterThan(FILE_SIZE_LIMITS.MAX_FILE_SIZE);
      expect(rules.allowedMimeTypes).toEqual([]);
    });
  });

  describe('validateQuick', () => {
    test('should perform quick validation without content check', () => {
      const metadata: FileValidationMetadata = {
        filename: 'test.jpg',
        size: 100000,
        mimeType: 'image/jpeg',
        extension: 'jpg'
      };

      const result = validationService.validateQuick(metadata);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect basic errors in quick validation', () => {
      const metadata: FileValidationMetadata = {
        filename: 'test.jpg',
        size: FILE_SIZE_LIMITS.MAX_FILE_SIZE + 1,
        mimeType: 'image/jpeg',
        extension: 'jpg'
      };

      const result = validationService.validateQuick(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: ERROR_CODES.FILE_TOO_LARGE
        })
      );
    });
  });

  describe('validateFiles', () => {
    test('should validate multiple files', async () => {
      const files = [
        {
          file: new ArrayBuffer(100000),
          metadata: {
            filename: 'test1.jpg',
            size: 100000,
            mimeType: 'image/jpeg',
            extension: 'jpg'
          } as FileValidationMetadata
        },
        {
          file: new ArrayBuffer(200000),
          metadata: {
            filename: 'test2.png',
            size: 200000,
            mimeType: 'image/png',
            extension: 'png'
          } as FileValidationMetadata
        }
      ];

      const results = await validationService.validateFiles(files);

      expect(results).toHaveLength(2);
      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(true);
    });

    test('should handle mixed valid and invalid files', async () => {
      const files = [
        {
          file: new ArrayBuffer(100000),
          metadata: {
            filename: 'test1.jpg',
            size: 100000,
            mimeType: 'image/jpeg',
            extension: 'jpg'
          } as FileValidationMetadata
        },
        {
          file: new ArrayBuffer(FILE_SIZE_LIMITS.MAX_FILE_SIZE + 1),
          metadata: {
            filename: 'test2.jpg',
            size: FILE_SIZE_LIMITS.MAX_FILE_SIZE + 1,
            mimeType: 'image/jpeg',
            extension: 'jpg'
          } as FileValidationMetadata
        }
      ];

      const results = await validationService.validateFiles(files);

      expect(results).toHaveLength(2);
      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(false);
    });
  });
});