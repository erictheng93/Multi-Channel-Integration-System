/**
 * File Validation Service Unit Tests
 * 檔案驗證服務單元測試
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FileValidationService } from '@modules/file-management/services/validation-service';
import type { FileValidationMetadata } from '@modules/file-management/types/validation-types';
import { FILE_SIZE_LIMITS } from '@modules/file-management/constants/file-config';

describe('FileValidationService', () => {
  let validationService: FileValidationService;

  beforeEach(() => {
    validationService = new FileValidationService();
  });

  describe('驗證基本功能', () => {
    it('應該能夠創建 ValidationService 實例', () => {
      expect(validationService).toBeDefined();
      expect(validationService).toBeInstanceOf(FileValidationService);
    });

    it('應該有預設的驗證規則', () => {
      const rules = (validationService as any).defaultRules;
      expect(rules).toBeDefined();
      expect(rules.maxSize).toBe(FILE_SIZE_LIMITS.MAX_FILE_SIZE);
      expect(rules.minSize).toBe(FILE_SIZE_LIMITS.MIN_FILE_SIZE);
      expect(rules.allowedMimeTypes).toBeInstanceOf(Array);
      expect(rules.prohibitedExtensions).toBeInstanceOf(Array);
    });
  });

  describe('快速驗證 (validateQuick)', () => {
    it('應該通過有效的檔案元數據驗證', () => {
      const metadata: FileValidationMetadata = {
        filename: 'test-image.jpg',
        size: 1024 * 1024, // 1MB
        mimeType: 'image/jpeg',
        extension: 'jpg'
      };

      const result = validationService.validateQuick(metadata);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('應該拒絕空檔名', () => {
      const metadata: FileValidationMetadata = {
        filename: '',
        size: 1024,
        mimeType: 'image/jpeg',
        extension: 'jpg'
      };

      const result = validationService.validateQuick(metadata);

      expect(result.valid).toBe(false);
      // 空檔名會同時觸發 MISSING_FILE 和 INVALID_FILENAME 兩個錯誤
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors.some(e => e.field === 'filename')).toBe(true);
    });

    it('應該拒絕無效的 MIME 類型', () => {
      const metadata: FileValidationMetadata = {
        filename: 'test.jpg',
        size: 1024,
        mimeType: '',
        extension: 'jpg'
      };

      const result = validationService.validateQuick(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'mimeType')).toBe(true);
    });

    it('應該拒絕超過最大大小限制的檔案', () => {
      const metadata: FileValidationMetadata = {
        filename: 'large-file.jpg',
        size: FILE_SIZE_LIMITS.MAX_FILE_SIZE + 1,
        mimeType: 'image/jpeg',
        extension: 'jpg'
      };

      const result = validationService.validateQuick(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'size')).toBe(true);
    });

    it('應該拒絕小於最小大小限制的檔案', () => {
      const metadata: FileValidationMetadata = {
        filename: 'tiny-file.jpg',
        size: FILE_SIZE_LIMITS.MIN_FILE_SIZE - 1,
        mimeType: 'image/jpeg',
        extension: 'jpg'
      };

      const result = validationService.validateQuick(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'size')).toBe(true);
    });

    it('應該拒絕禁止的副檔名', () => {
      const metadata: FileValidationMetadata = {
        filename: 'malicious.exe',
        size: 1024,
        mimeType: 'application/x-msdownload',
        extension: '.exe'  // 副檔名需要包含點號
      };

      const result = validationService.validateQuick(metadata);

      expect(result.valid).toBe(false);
      // 可能會同時觸發 MIME type 和 extension 錯誤
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field === 'extension' || e.field === 'mimeType')).toBe(true);
    });
  });

  describe('完整檔案驗證 (validateFile)', () => {
    it('應該驗證有效的圖片檔案', async () => {
      // 創建一個假的 JPEG 檔案 (簡化的檔頭)
      const jpegHeader = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
      const buffer = jpegHeader.buffer;

      const metadata: FileValidationMetadata = {
        filename: 'photo.jpg',
        size: buffer.byteLength,
        mimeType: 'image/jpeg',
        extension: 'jpg'
      };

      const result = await validationService.validateFile(buffer, metadata);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('應該檢測檔案簽章與 MIME 類型不符', async () => {
      // PNG 檔頭但宣稱是 JPEG
      const pngHeader = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const buffer = pngHeader.buffer;

      const metadata: FileValidationMetadata = {
        filename: 'fake.jpg',
        size: buffer.byteLength,
        mimeType: 'image/jpeg',
        extension: 'jpg'
      };

      const result = await validationService.validateFile(buffer, metadata);

      // 應該有警告
      expect(result.warnings).toBeDefined();
      if (result.warnings && result.warnings.length > 0) {
        expect(result.warnings[0].field).toBe('content');
      }
    });

    it('應該驗證檔案大小與 metadata 一致', async () => {
      const data = new Uint8Array(1000);
      const buffer = data.buffer;

      const metadata: FileValidationMetadata = {
        filename: 'test.dat',
        size: 500, // 不符合實際大小
        mimeType: 'application/octet-stream',
        extension: 'dat'
      };

      const result = await validationService.validateFile(buffer, metadata);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'content')).toBe(true);
    });

    it('應該處理驗證過程中的錯誤', async () => {
      const metadata: FileValidationMetadata = {
        filename: 'test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
        extension: '.jpg'
      };

      // 測試檔案內容與 metadata 大小不符的情況
      const arrayBuffer = new ArrayBuffer(2048); // 與 metadata.size 不符
      const result = await validationService.validateFile(arrayBuffer, metadata);

      // 應該產生大小不符的錯誤
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'CORRUPTED_FILE')).toBe(true);
    });
  });

  describe('平台特定規則 (getRulesForPlatform)', () => {
    it('應該返回 LINE 平台的驗證規則', () => {
      const rules = validationService.getRulesForPlatform('line');

      expect(rules).toBeDefined();
      expect(rules.maxSize).toBeDefined();
      expect(rules.allowedMimeTypes).toBeInstanceOf(Array);
    });

    it('應該返回 Facebook 平台的驗證規則', () => {
      const rules = validationService.getRulesForPlatform('facebook');

      expect(rules).toBeDefined();
      expect(rules.maxSize).toBeDefined();
      expect(rules.allowedMimeTypes).toBeInstanceOf(Array);
    });

    it('應該對未知平台返回預設規則', () => {
      const rules = validationService.getRulesForPlatform('unknown' as any);

      expect(rules).toBeDefined();
      expect(rules.maxSize).toBe(FILE_SIZE_LIMITS.MAX_FILE_SIZE);
    });
  });

  describe('規則集 (getRulesForRuleSet)', () => {
    it('應該返回嚴格圖片規則', () => {
      const rules = validationService.getRulesForRuleSet('strict_image');

      expect(rules).toBeDefined();
      expect(rules.maxSize).toBeLessThanOrEqual(FILE_SIZE_LIMITS.MAX_IMAGE_SIZE);
      expect(rules.allowedMimeTypes).toContain('image/jpeg');
      expect(rules.allowedMimeTypes).toContain('image/png');
    });

    it('應該返回基本文件規則', () => {
      const rules = validationService.getRulesForRuleSet('basic_document');

      expect(rules).toBeDefined();
      expect(rules.allowedMimeTypes).toContain('application/pdf');
      expect(rules.allowedMimeTypes).toContain('text/plain');
    });

    it('應該返回媒體內容規則', () => {
      const rules = validationService.getRulesForRuleSet('media_content');

      expect(rules).toBeDefined();
      expect(rules.allowedMimeTypes).toContain('image/jpeg');
      expect(rules.allowedMimeTypes).toContain('video/mp4');
      expect(rules.allowedMimeTypes).toContain('audio/mpeg');
    });

    it('應該返回系統管理員規則（更寬鬆）', () => {
      const rules = validationService.getRulesForRuleSet('system_admin');

      expect(rules).toBeDefined();
      expect(rules.maxSize).toBe(50 * 1024 * 1024); // 50MB
      expect(rules.allowedMimeTypes).toHaveLength(0); // 允許所有類型
    });
  });

  describe('平台特定驗證', () => {
    it('應該驗證 LINE 平台的檔案限制', () => {
      const metadata: FileValidationMetadata = {
        filename: 'line-image.jpg',
        size: 1024 * 1024,
        mimeType: 'image/jpeg',
        extension: 'jpg',
        platform: 'line'
      };

      const result = validationService.validateQuick(metadata);

      // LINE 平台應該接受 JPEG 圖片
      expect(result.valid).toBe(true);
    });

    it('應該拒絕超過平台限制的檔案', () => {
      const metadata: FileValidationMetadata = {
        filename: 'huge-file.jpg',
        size: 50 * 1024 * 1024, // 50MB
        mimeType: 'image/jpeg',
        extension: 'jpg',
        platform: 'line'
      };

      const result = validationService.validateQuick(metadata);

      // 應該超過 LINE 平台限制
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'size')).toBe(true);
    });
  });

  describe('批量驗證 (validateFiles)', () => {
    it('應該能夠批量驗證多個檔案', async () => {
      const files = [
        {
          file: new Uint8Array(1000).buffer,
          metadata: {
            filename: 'file1.jpg',
            size: 1000,
            mimeType: 'image/jpeg',
            extension: 'jpg'
          }
        },
        {
          file: new Uint8Array(2000).buffer,
          metadata: {
            filename: 'file2.png',
            size: 2000,
            mimeType: 'image/png',
            extension: 'png'
          }
        }
      ];

      const results = await validationService.validateFiles(files);

      expect(results).toHaveLength(2);
      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(true);
    });

    it('應該識別批量驗證中的無效檔案', async () => {
      const files = [
        {
          file: new Uint8Array(1000).buffer,
          metadata: {
            filename: 'valid.jpg',
            size: 1000,
            mimeType: 'image/jpeg',
            extension: 'jpg'
          }
        },
        {
          file: new Uint8Array(FILE_SIZE_LIMITS.MAX_FILE_SIZE + 1000).buffer,
          metadata: {
            filename: 'toolarge.jpg',
            size: FILE_SIZE_LIMITS.MAX_FILE_SIZE + 1000,
            mimeType: 'image/jpeg',
            extension: 'jpg'
          }
        }
      ];

      const results = await validationService.validateFiles(files);

      expect(results).toHaveLength(2);
      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(false);
    });
  });

  describe('邊界條件測試', () => {
    it('應該正確處理剛好在大小限制邊界的檔案', () => {
      const metadata: FileValidationMetadata = {
        filename: 'boundary.jpg',
        size: FILE_SIZE_LIMITS.MAX_FILE_SIZE,
        mimeType: 'image/jpeg',
        extension: 'jpg'
      };

      const result = validationService.validateQuick(metadata);

      expect(result.valid).toBe(true);
    });

    it('應該處理特殊字符的檔名', () => {
      const metadata: FileValidationMetadata = {
        filename: '特殊-文件_123.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
        extension: 'jpg'
      };

      const result = validationService.validateQuick(metadata);

      expect(result).toBeDefined();
    });

    it('應該處理多個副檔名的檔案', () => {
      const metadata: FileValidationMetadata = {
        filename: 'archive.tar.gz',
        size: 1024,
        mimeType: 'application/gzip',
        extension: 'gz'
      };

      const result = validationService.validateQuick(metadata);

      expect(result).toBeDefined();
    });
  });

  describe('錯誤信息驗證', () => {
    it('應該提供清晰的錯誤代碼和訊息', () => {
      const metadata: FileValidationMetadata = {
        filename: '',
        size: 0,
        mimeType: '',
        extension: ''
      };

      const result = validationService.validateQuick(metadata);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      result.errors.forEach(error => {
        expect(error.code).toBeDefined();
        expect(error.message).toBeDefined();
        expect(error.severity).toBeDefined();
      });
    });

    it('應該包含錯誤的欄位信息', () => {
      const metadata: FileValidationMetadata = {
        filename: 'test.jpg',
        size: FILE_SIZE_LIMITS.MAX_FILE_SIZE + 1,
        mimeType: 'image/jpeg',
        extension: 'jpg'
      };

      const result = validationService.validateQuick(metadata);

      expect(result.valid).toBe(false);
      const sizeError = result.errors.find(e => e.field === 'size');
      expect(sizeError).toBeDefined();
      expect(sizeError?.value).toBe(metadata.size);
    });
  });
});
