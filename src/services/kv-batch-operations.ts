/**
 * KV Batch Operations
 *
 * Provides batch get/put/delete operations with chunking,
 * parallel processing, and retry logic for KV namespaces.
 *
 * @module services/kv-batch-operations
 */

import { KV_BATCH_CONFIG } from '../config/kv-config';
import { KVCompression } from './kv-compression-service';
import { nowMs } from '@/utils/timestamp';

// =================== Types ===================

export interface BatchOperationResult<T> {
  success: boolean;
  processed: number;
  failed: number;
  results: T[];
  errors: string[];
  duration: number;
}

// =================== Batch Operations ===================

/**
 * Batch KV operations with retry logic
 */
export class KVBatchOperations {
  private kv: KVNamespace;
  private config = KV_BATCH_CONFIG;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  /**
   * Batch get multiple keys
   */
  async batchGet<T = string>(
    keys: string[],
    options?: { type?: 'text' | 'json' | 'arrayBuffer' }
  ): Promise<BatchOperationResult<{ key: string; value: T | null }>> {
    const startTime = nowMs();
    const results: { key: string; value: T | null }[] = [];
    const errors: string[] = [];

    // Process in chunks
    const chunks = this.chunkArray(keys, this.config.MAX_BATCH_SIZE);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (key) => {
        try {
          let value: T | null = null;
          if (options?.type === 'json') {
            value = await this.kv.get(key, 'json') as T | null;
          } else if (options?.type === 'arrayBuffer') {
            value = await this.kv.get(key, 'arrayBuffer') as T | null;
          } else {
            const raw = await this.kv.get(key, 'text');
            if (raw) {
              value = await KVCompression.decompress(raw) as T;
            }
          }
          return { key, value, error: null };
        } catch (error) {
          return { key, value: null, error: String(error) };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);

      for (const result of chunkResults) {
        if (result.error) {
          errors.push(`${result.key}: ${result.error}`);
        }
        results.push({ key: result.key, value: result.value });
      }
    }

    return {
      success: errors.length === 0,
      processed: results.length,
      failed: errors.length,
      results,
      errors,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Batch put multiple key-value pairs
   */
  async batchPut(
    items: Array<{
      key: string;
      value: string;
      ttl?: number;
      metadata?: Record<string, unknown>;
    }>,
    options?: { compress?: boolean }
  ): Promise<BatchOperationResult<{ key: string; success: boolean }>> {
    const startTime = nowMs();
    const results: { key: string; success: boolean }[] = [];
    const errors: string[] = [];

    // Process in chunks with parallel limit
    const chunks = this.chunkArray(items, this.config.MAX_PARALLEL_OPS);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (item) => {
        try {
          let valueToStore = item.value;

          // Apply compression if requested
          if (options?.compress !== false) {
            const compressed = await KVCompression.compress(item.key, item.value);
            valueToStore = compressed.data;
          }

          await this.kv.put(item.key, valueToStore, {
            expirationTtl: item.ttl,
            metadata: item.metadata,
          });

          return { key: item.key, success: true, error: null };
        } catch (error) {
          return { key: item.key, success: false, error: String(error) };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);

      for (const result of chunkResults) {
        if (result.error) {
          errors.push(`${result.key}: ${result.error}`);
        }
        results.push({ key: result.key, success: result.success });
      }
    }

    return {
      success: errors.length === 0,
      processed: results.length,
      failed: errors.length,
      results,
      errors,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Batch delete multiple keys
   */
  async batchDelete(keys: string[]): Promise<BatchOperationResult<{ key: string; deleted: boolean }>> {
    const startTime = nowMs();
    const results: { key: string; deleted: boolean }[] = [];
    const errors: string[] = [];

    // Process in chunks
    const chunks = this.chunkArray(keys, this.config.MAX_PARALLEL_OPS);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (key) => {
        try {
          await this.kv.delete(key);
          return { key, deleted: true, error: null };
        } catch (error) {
          return { key, deleted: false, error: String(error) };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);

      for (const result of chunkResults) {
        if (result.error) {
          errors.push(`${result.key}: ${result.error}`);
        }
        results.push({ key: result.key, deleted: result.deleted });
      }
    }

    return {
      success: errors.length === 0,
      processed: results.length,
      failed: errors.length,
      results,
      errors,
      duration: Date.now() - startTime,
    };
  }

  /**
   * List all keys with pagination
   */
  async listAllKeys(prefix?: string): Promise<string[]> {
    const allKeys: string[] = [];
    let cursor: string | undefined;

    do {
      const listResult = await this.kv.list({
        prefix,
        cursor,
        limit: 1000,
      });
      allKeys.push(...listResult.keys.map(k => k.name));
      cursor = listResult.list_complete ? undefined : listResult.cursor;
    } while (cursor);

    return allKeys;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
