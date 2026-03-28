/**
 * File Metadata Service
 * 檔案元數據服務
 */

import type {
  FileMetadata,
  ManagedFile,
  FileProcessingStatus
} from '../types/file-types';
import {
  getFileExtension,
  formatFileSize,
  calculateFileHash
} from '../utils/file-helpers';
import {
  normalizeMimeType,
  detectMimeType,
  supportsThumbnail
} from '../utils/mime-type-utils';
import { PROCESSING_OPTIONS } from '@modules/file-management/constants/file-config';
import { nowISO } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('FileMetadata');

export class MetadataService {
  /**
   * 從檔案生成基本元數據
   */
  async generateMetadata(
    file: File | ArrayBuffer,
    filename: string,
    mimeType: string
  ): Promise<FileMetadata> {
    const data = file instanceof File ? await file.arrayBuffer() : file;
    const size = data.byteLength;
    const extension = getFileExtension(filename, mimeType);
    const normalizedMimeType = normalizeMimeType(mimeType);

    const metadata: FileMetadata = {
      filename,
      originalFilename: file instanceof File ? file.name : filename,
      mimeType: normalizedMimeType,
      size,
      extension,
      lastModified: file instanceof File ? new Date(file.lastModified) : new Date()
    };

    // 如果支援，添加更詳細的元數據
    if (PROCESSING_OPTIONS.METADATA_EXTRACTION.enabled) {
      await this.enrichMetadata(data, metadata);
    }

    return metadata;
  }

  /**
   * 豐富元數據（添加圖片尺寸、影片時長等）
   */
  private async enrichMetadata(data: ArrayBuffer, metadata: FileMetadata): Promise<void> {
    try {
      // 檢測實際的 MIME 類型
      const detectedMimeType = detectMimeType(data);
      if (detectedMimeType && detectedMimeType !== metadata.mimeType) {
        log.warn("MIME type mismatch", { declared: metadata.mimeType, detected: detectedMimeType });
      }

      // 根據檔案類型提取特定元數據
      if (metadata.mimeType.startsWith('image/')) {
        await this.extractImageMetadata(data, metadata);
      } else if (metadata.mimeType.startsWith('video/')) {
        await this.extractVideoMetadata(data, metadata);
      } else if (metadata.mimeType.startsWith('audio/')) {
        await this.extractAudioMetadata(data, metadata);
      }

    } catch (error) {
      log.warn('Failed to enrich metadata:', { error });
    }
  }

  /**
   * 提取圖片元數據
   */
  private async extractImageMetadata(data: ArrayBuffer, metadata: FileMetadata): Promise<void> {
    try {
      // 創建 ImageBitmap 來獲取尺寸（如果支援）
      if (typeof createImageBitmap !== 'undefined') {
        const blob = new Blob([data], { type: metadata.mimeType });
        const imageBitmap = await createImageBitmap(blob);

        metadata.dimensions = {
          width: imageBitmap.width,
          height: imageBitmap.height
        };

        imageBitmap.close();
      } else {
        // 備用方案：解析檔案標頭獲取尺寸
        const dimensions = this.parseImageDimensions(data, metadata.mimeType);
        if (dimensions) {
          metadata.dimensions = dimensions;
        }
      }

    } catch (error) {
      log.warn('Failed to extract image metadata:', { error });
    }
  }

  /**
   * 解析圖片尺寸（從檔案標頭）
   */
  private parseImageDimensions(
    data: ArrayBuffer,
    mimeType: string
  ): { width: number; height: number } | null {
    const view = new DataView(data);

    try {
      switch (mimeType) {
        case 'image/png':
          return this.parsePngDimensions(view);
        case 'image/jpeg':
          return this.parseJpegDimensions(view);
        case 'image/gif':
          return this.parseGifDimensions(view);
        case 'image/webp':
          return this.parseWebpDimensions(view);
        default:
          return null;
      }
    } catch (error) {
      log.warn('Failed to parse image dimensions:', { error });
      return null;
    }
  }

  /**
   * 解析 PNG 尺寸
   */
  private parsePngDimensions(view: DataView): { width: number; height: number } | null {
    // PNG 標頭：8 bytes signature + 4 bytes length + 4 bytes "IHDR" + 4 bytes width + 4 bytes height
    if (view.byteLength < 24) return null;

    // 檢查 PNG 簽章
    const signature = Array.from(new Uint8Array(view.buffer, 0, 8));
    const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    if (!signature.every((byte, i) => byte === pngSignature[i])) {
      return null;
    }

    const width = view.getUint32(16, false); // big-endian
    const height = view.getUint32(20, false); // big-endian

    return { width, height };
  }

  /**
   * 解析 JPEG 尺寸
   */
  private parseJpegDimensions(view: DataView): { width: number; height: number } | null {
    let offset = 2; // 跳過 SOI marker (0xFFD8)

    while (offset < view.byteLength - 1) {
      const marker = view.getUint16(offset, false);

      if (marker === 0xFFC0 || marker === 0xFFC2) { // SOF0 或 SOF2
        if (offset + 9 < view.byteLength) {
          const height = view.getUint16(offset + 5, false);
          const width = view.getUint16(offset + 7, false);
          return { width, height };
        }
        break;
      }

      if ((marker & 0xFF00) !== 0xFF00) break;

      const length = view.getUint16(offset + 2, false);
      offset += 2 + length;
    }

    return null;
  }

  /**
   * 解析 GIF 尺寸
   */
  private parseGifDimensions(view: DataView): { width: number; height: number } | null {
    if (view.byteLength < 10) return null;

    // 檢查 GIF 簽章
    const header = new TextDecoder().decode(new Uint8Array(view.buffer, 0, 6));
    if (!header.startsWith('GIF')) return null;

    const width = view.getUint16(6, true); // little-endian
    const height = view.getUint16(8, true); // little-endian

    return { width, height };
  }

  /**
   * 解析 WebP 尺寸
   */
  private parseWebpDimensions(view: DataView): { width: number; height: number } | null {
    if (view.byteLength < 30) return null;

    // 檢查 WebP 簽章
    const riff = new TextDecoder().decode(new Uint8Array(view.buffer, 0, 4));
    const webp = new TextDecoder().decode(new Uint8Array(view.buffer, 8, 4));

    if (riff !== 'RIFF' || webp !== 'WEBP') return null;

    const format = new TextDecoder().decode(new Uint8Array(view.buffer, 12, 4));

    if (format === 'VP8 ') {
      // VP8 格式
      if (view.byteLength < 30) return null;

      const width = view.getUint16(26, true) & 0x3fff;
      const height = view.getUint16(28, true) & 0x3fff;

      return { width, height };
    } else if (format === 'VP8L') {
      // VP8L 格式
      if (view.byteLength < 25) return null;

      const bits = view.getUint32(21, true);
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >> 14) & 0x3fff) + 1;

      return { width, height };
    }

    return null;
  }

  /**
   * 提取影片元數據
   */
  private async extractVideoMetadata(_data: ArrayBuffer, _metadata: FileMetadata): Promise<void> {
    // 影片元數據提取比較複雜，通常需要專門的程式庫
    // 這裡只做基本的檔案大小記錄
    log.info('Video metadata extraction not fully implemented');
  }

  /**
   * 提取音訊元數據
   */
  private async extractAudioMetadata(_data: ArrayBuffer, _metadata: FileMetadata): Promise<void> {
    // 音訊元數據提取，可以解析 ID3 標籤等
    log.info('Audio metadata extraction not fully implemented');
  }

  /**
   * 驗證元數據完整性
   */
  validateMetadata(metadata: FileMetadata): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!metadata.filename) {
      errors.push('Filename is required');
    }

    if (!metadata.mimeType) {
      errors.push('MIME type is required');
    }

    if (!metadata.size || metadata.size <= 0) {
      errors.push('Valid file size is required');
    }

    if (!metadata.extension) {
      errors.push('File extension is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 更新檔案處理狀態
   */
  updateProcessingStatus(
    file: ManagedFile,
    status: FileProcessingStatus,
    error?: string
  ): ManagedFile {
    return {
      ...file,
      processingStatus: status,
      updatedAt: nowISO(),
      ...(error && { error })
    };
  }

  /**
   * 檢查是否需要產生縮圖
   */
  shouldGenerateThumbnail(metadata: FileMetadata): boolean {
    return (
      PROCESSING_OPTIONS.THUMBNAIL.enabled &&
      supportsThumbnail(metadata.mimeType)
    );
  }

  /**
   * 檢查是否需要壓縮
   */
  shouldCompress(metadata: FileMetadata): boolean {
    if (!PROCESSING_OPTIONS.COMPRESSION.enabled) {
      return false;
    }

    // 只壓縮圖片
    if (!metadata.mimeType.startsWith('image/')) {
      return false;
    }

    // 檢查是否超過尺寸限制
    if (metadata.dimensions) {
      const { width, height } = metadata.dimensions;
      const { maxDimensions } = PROCESSING_OPTIONS.COMPRESSION;

      return width > maxDimensions.width || height > maxDimensions.height;
    }

    return false;
  }

  /**
   * 計算檔案雜湊值（用於重複檢測）
   */
  async calculateFileHash(data: ArrayBuffer): Promise<string | null> {
    return calculateFileHash(data);
  }

  /**
   * 建立檔案摘要
   */
  createFileSummary(metadata: FileMetadata): string {
    const parts = [
      `檔案: ${metadata.filename}`,
      `大小: ${formatFileSize(metadata.size)}`,
      `類型: ${metadata.mimeType}`
    ];

    if (metadata.dimensions) {
      parts.push(`尺寸: ${metadata.dimensions.width}x${metadata.dimensions.height}`);
    }

    if (metadata.duration) {
      parts.push(`時長: ${Math.round(metadata.duration)}秒`);
    }

    return parts.join(', ');
  }
}