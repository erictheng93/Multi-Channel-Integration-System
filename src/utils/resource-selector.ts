/**
 * 資源選擇器 - 根據環境變數選擇正確的資源綁定
 * 這樣可以在同一個 Worker 中根據部署時的環境使用不同的資源
 */

import type { Bindings } from '../types/bindings';

/**
 * 資源選擇器類
 */
export class ResourceSelector {
  private env: Bindings;
  private environment: string;

  constructor(env: Bindings) {
    this.env = env;
    this.environment = env.ENVIRONMENT || 'production';
  }

  /**
   * 獲取資料庫實例
   */
  getDatabase(): D1Database {
    return this.environment === 'development' ? this.env.DB_DEV : this.env.DB_PROD;
  }

  /**
   * 獲取 Sessions KV 命名空間
   */
  getSessionsKV(): KVNamespace {
    return this.environment === 'development' ? this.env.SESSIONS_DEV : this.env.SESSIONS_PROD;
  }

  /**
   * 獲取 Cache KV 命名空間
   */
  getCacheKV(): KVNamespace {
    return this.environment === 'development' ? this.env.CACHE_DEV : this.env.CACHE_PROD;
  }

  /**
   * 獲取 R2 儲存桶
   */
  getR2Bucket(): R2Bucket {
    return this.environment === 'development' ? this.env.R2_BUCKET_DEV : this.env.R2_BUCKET_PROD;
  }

  /**
   * 獲取當前環境
   */
  getEnvironment(): string {
    return this.environment;
  }

  /**
   * 是否為開發環境
   */
  isDevelopment(): boolean {
    return this.environment === 'development';
  }

  /**
   * 是否為生產環境
   */
  isProduction(): boolean {
    return this.environment === 'production';
  }

  /**
   * 獲取所有資源的統一介面
   */
  getResources() {
    return {
      DB: this.getDatabase(),
      SESSIONS: this.getSessionsKV(),
      CACHE: this.getCacheKV(),
      R2_BUCKET: this.getR2Bucket(),
      environment: this.environment
    };
  }
}

/**
 * 快速創建資源選擇器
 */
export function createResourceSelector(env: Bindings): ResourceSelector {
  return new ResourceSelector(env);
}

/**
 * 快速獲取資源
 */
export function getResources(env: Bindings) {
  const selector = new ResourceSelector(env);
  return selector.getResources();
}