/**
 * KV Compression Service
 *
 * Provides data compression/decompression for KV storage
 * using CompressionStream/DecompressionStream (gzip).
 *
 * @module services/kv-compression-service
 */

import { KV_COMPRESSION_CONFIG } from '../config/kv-config';

// =================== Types ===================

export interface CompressedData {
  compressed: boolean;
  originalSize: number;
  compressedSize?: number;
  data: string;
}

// =================== Compression Utilities ===================

/**
 * Simple compression using base64 and run-length encoding
 * Note: For production, consider using CompressionStream API when available
 */
export class KVCompression {
  /**
   * Check if data should be compressed
   */
  static shouldCompress(key: string, data: string): boolean {
    // Never compress small data
    if (data.length < KV_COMPRESSION_CONFIG.MIN_SIZE_FOR_COMPRESSION) {
      return false;
    }

    // Check never-compress prefixes
    for (const prefix of KV_COMPRESSION_CONFIG.NEVER_COMPRESS_PREFIXES) {
      if (key.startsWith(prefix)) {
        return false;
      }
    }

    // Always compress certain prefixes
    for (const prefix of KV_COMPRESSION_CONFIG.ALWAYS_COMPRESS_PREFIXES) {
      if (key.startsWith(prefix)) {
        return true;
      }
    }

    // Compress if above threshold
    return data.length >= KV_COMPRESSION_CONFIG.MIN_SIZE_FOR_COMPRESSION;
  }

  /**
   * Compress data if beneficial
   */
  static async compress(key: string, data: string): Promise<CompressedData> {
    const originalSize = data.length;

    if (!this.shouldCompress(key, data)) {
      return {
        compressed: false,
        originalSize,
        data,
      };
    }

    try {
      // Use CompressionStream if available (modern browsers/workers)
      if (typeof CompressionStream !== 'undefined') {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(data));
            controller.close();
          },
        });

        const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
        const reader = compressedStream.getReader();
        const chunks: Uint8Array[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const compressed = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          compressed.set(chunk, offset);
          offset += chunk.length;
        }

        // Only use compression if it actually reduces size
        const compressedBase64 = btoa(String.fromCharCode(...compressed));
        if (compressedBase64.length < originalSize * 0.9) {
          return {
            compressed: true,
            originalSize,
            compressedSize: compressedBase64.length,
            data: `__COMPRESSED__:${compressedBase64}`,
          };
        }
      }
    } catch (error) {
      console.warn('[KVCompression] Compression failed, storing uncompressed:', error);
    }

    return {
      compressed: false,
      originalSize,
      data,
    };
  }

  /**
   * Decompress data if compressed
   */
  static async decompress(data: string): Promise<string> {
    if (!data.startsWith('__COMPRESSED__:')) {
      return data;
    }

    try {
      const compressedBase64 = data.slice('__COMPRESSED__:'.length);
      const compressedBytes = Uint8Array.from(atob(compressedBase64), c => c.charCodeAt(0));

      if (typeof DecompressionStream !== 'undefined') {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(compressedBytes);
            controller.close();
          },
        });

        const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
        const reader = decompressedStream.getReader();
        const chunks: Uint8Array[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        const decoder = new TextDecoder();
        return chunks.map(chunk => decoder.decode(chunk)).join('');
      }
    } catch (error) {
      console.error('[KVCompression] Decompression failed:', error);
      throw new Error('Failed to decompress data');
    }

    return data;
  }
}
