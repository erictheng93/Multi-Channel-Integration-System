/**
 * ============================================================================
 * 後端運行時配置層 - Layer 2: Runtime Configuration
 * ============================================================================
 *
 * 本文件提供 Cloudflare Workers 環境的類型安全配置訪問接口
 *
 * 架構設計:
 * - Layer 1: .dev.vars / wrangler.toml [vars] (環境變量存儲)
 * - Layer 2: runtime.ts (本文件 - 配置封裝)
 * - Layer 3: Handlers / Services (使用本文件提供的函數)
 *
 * 優勢:
 * - ✅ 類型安全 (TypeScript)
 * - ✅ 默認值支持
 * - ✅ 環境自動檢測
 * - ✅ 集中管理
 * - ✅ Cloudflare Workers 兼容
 *
 * @module config/runtime
 */

import { Context } from 'hono';

// ============================================================================
// 類型定義
// ============================================================================

/**
 * 環境類型
 */
export type Environment = 'development' | 'staging' | 'production';

/**
 * Cloudflare Workers 環境綁定接口
 * 擴展自 worker-configuration.d.ts 中的 Env
 */
export interface WorkerEnv {
  // URL 配置
  BACKEND_URL?: string;
  FRONTEND_URL?: string;
  WEBSOCKET_URL?: string;
  STORAGE_PUBLIC_URL?: string;

  // 環境標識
  ENVIRONMENT?: string;
  NODE_ENV?: string;

  // 安全配置
  JWT_SECRET?: string;
  ENCRYPTION_KEY?: string;

  // 外部平台憑證
  LINE_CHANNEL_SECRET?: string;
  LINE_CHANNEL_ACCESS_TOKEN?: string;
  FACEBOOK_APP_SECRET?: string;
  FACEBOOK_PAGE_ACCESS_TOKEN?: string;

  // Cloudflare 資源綁定 (from wrangler.toml)
  DB?: D1Database;
  KV_SESSION?: KVNamespace;
  KV_ANALYTICS?: KVNamespace;
  R2_BUCKET?: R2Bucket;
  DELAYED_MESSAGE_QUEUE?: Queue;

  // Durable Objects
  CONVERSATION_ROOM?: DurableObjectNamespace;
  USER_CONNECTION?: DurableObjectNamespace;
  MESSAGE_BROADCASTER?: DurableObjectNamespace;
  DELAYED_MESSAGE_PROCESSOR?: DurableObjectNamespace;
  DELAYED_MESSAGE_BUFFER?: DurableObjectNamespace;
}

/**
 * 運行時配置接口
 */
export interface RuntimeConfig {
  /** 環境類型 */
  env: Environment;

  /** 後端 URL */
  backendUrl: string;

  /** 前端 URL */
  frontendUrl: string;

  /** WebSocket URL */
  websocketUrl: string;

  /** R2 存儲公開 URL */
  storagePublicUrl: string;

  /** 是否為開發模式 */
  isDevelopment: boolean;

  /** 是否為生產模式 */
  isProduction: boolean;
}

// ============================================================================
// 環境變量讀取輔助函數
// ============================================================================

/**
 * 安全地從 Cloudflare Workers env 對象讀取環境變量
 * @param env - Cloudflare Workers env 對象
 * @param key - 環境變量鍵名
 * @param defaultValue - 默認值
 * @returns 環境變量值或默認值
 */
function getEnv(env: WorkerEnv | Record<string, any>, key: string, defaultValue: string = ''): string {
  if (!env || typeof env !== 'object') {
    console.warn(`[Runtime Config] env object is invalid, using default value for ${key}`);
    return defaultValue;
  }

  const value = (env as Record<string, any>)[key];

  if (value === undefined || value === null || value === '') {
    if (defaultValue) {
      console.debug(`[Runtime Config] ${key} not set, using default: ${defaultValue}`);
      return defaultValue;
    } else {
      console.warn(`[Runtime Config] ${key} not set and no default value provided`);
      return '';
    }
  }

  return String(value);
}

// ============================================================================
// 核心配置獲取函數
// ============================================================================

/**
 * 獲取當前環境類型
 * @param env - Cloudflare Workers env 對象
 * @returns 環境類型
 */
export function getCurrentEnvironment(env: WorkerEnv): Environment {
  const envType = getEnv(env, 'ENVIRONMENT', 'development');

  if (envType === 'production' || envType === 'staging' || envType === 'development') {
    return envType as Environment;
  }

  // 備用檢測: NODE_ENV
  const nodeEnv = getEnv(env, 'NODE_ENV', 'development');
  if (nodeEnv === 'production') {
    return 'production';
  }

  return 'development';
}

/**
 * 獲取後端 URL
 * @param env - Cloudflare Workers env 對象
 * @returns 後端 URL
 */
export function getBackendUrl(env: WorkerEnv): string {
  const currentEnv = getCurrentEnvironment(env);
  const defaultUrl = currentEnv === 'production'
    ? 'https://multi-channel.imfinethankyouandyou.com'
    : 'http://localhost:8787';

  const url = getEnv(env, 'BACKEND_URL', defaultUrl);
  return url.replace(/\/$/, '');
}

/**
 * 獲取前端 URL
 * @param env - Cloudflare Workers env 對象
 * @returns 前端 URL
 */
export function getFrontendUrl(env: WorkerEnv): string {
  const currentEnv = getCurrentEnvironment(env);
  const defaultUrl = currentEnv === 'production'
    ? 'https://mcp.imfinethankyouandyou.com'
    : 'http://localhost:3000';

  const url = getEnv(env, 'FRONTEND_URL', defaultUrl);
  return url.replace(/\/$/, '');
}

/**
 * 獲取 WebSocket URL
 * @param env - Cloudflare Workers env 對象
 * @returns WebSocket URL
 */
export function getWebSocketUrl(env: WorkerEnv): string {
  // 優先使用顯式設置的 WebSocket URL
  const explicitWsUrl = getEnv(env, 'WEBSOCKET_URL', '');
  if (explicitWsUrl) {
    return explicitWsUrl.replace(/\/$/, '');
  }

  // 自動從 BACKEND_URL 推導
  const backendUrl = getBackendUrl(env);
  const wsUrl = backendUrl
    .replace(/^https:/, 'wss:')
    .replace(/^http:/, 'ws:');

  return `${wsUrl}/ws`;
}

/**
 * 獲取 R2 存儲公開 URL
 * @param env - Cloudflare Workers env 對象
 * @returns R2 公開 URL
 */
export function getStoragePublicUrl(env: WorkerEnv): string {
  const currentEnv = getCurrentEnvironment(env);
  const defaultUrl = currentEnv === 'production'
    ? 'https://s3.imfinethankyouandyou.com'
    : 'http://localhost:8787/files';

  const url = getEnv(env, 'STORAGE_PUBLIC_URL', defaultUrl);
  return url.replace(/\/$/, '');
}

/**
 * 檢查是否為開發模式
 * @param env - Cloudflare Workers env 對象
 * @returns 是否為開發模式
 */
export function isDevelopment(env: WorkerEnv): boolean {
  return getCurrentEnvironment(env) === 'development';
}

/**
 * 檢查是否為生產模式
 * @param env - Cloudflare Workers env 對象
 * @returns 是否為生產模式
 */
export function isProduction(env: WorkerEnv): boolean {
  return getCurrentEnvironment(env) === 'production';
}

/**
 * 檢查是否為預發布環境
 * @param env - Cloudflare Workers env 對象
 * @returns 是否為預發布環境
 */
export function isStaging(env: WorkerEnv): boolean {
  return getCurrentEnvironment(env) === 'staging';
}

// ============================================================================
// API 端點構建函數
// ============================================================================

/**
 * 構建 API 端點 URL
 * @param env - Cloudflare Workers env 對象
 * @param path - API 路徑 (如 '/api/conversations')
 * @returns 完整的 API URL
 *
 * @example
 * ```ts
 * const url = getApiEndpoint(c.env, '/api/conversations');
 * // => 'https://multi-channel.imfinethankyouandyou.com/api/conversations'
 * ```
 */
export function getApiEndpoint(env: WorkerEnv, path: string): string {
  const baseUrl = getBackendUrl(env);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

/**
 * 構建 WebSocket 端點 URL
 * @param env - Cloudflare Workers env 對象
 * @param path - WebSocket 路徑
 * @returns 完整的 WebSocket URL
 */
export function getWebSocketEndpoint(env: WorkerEnv, path: string): string {
  const wsUrl = getWebSocketUrl(env);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${wsUrl}${normalizedPath}`;
}

/**
 * 構建文件訪問 URL
 * @param env - Cloudflare Workers env 對象
 * @param fileKey - 文件鍵值或路徑
 * @returns 完整的文件 URL
 */
export function getFileUrl(env: WorkerEnv, fileKey: string): string {
  const storageUrl = getStoragePublicUrl(env);
  const normalizedKey = fileKey.startsWith('/') ? fileKey.slice(1) : fileKey;
  return `${storageUrl}/${normalizedKey}`;
}

// ============================================================================
// 完整配置對象
// ============================================================================

/**
 * 獲取完整的運行時配置
 * @param env - Cloudflare Workers env 對象
 * @returns 運行時配置對象
 */
export function getRuntimeConfig(env: WorkerEnv): RuntimeConfig {
  const envType = getCurrentEnvironment(env);

  return {
    env: envType,
    backendUrl: getBackendUrl(env),
    frontendUrl: getFrontendUrl(env),
    websocketUrl: getWebSocketUrl(env),
    storagePublicUrl: getStoragePublicUrl(env),
    isDevelopment: envType === 'development',
    isProduction: envType === 'production',
  };
}

// ============================================================================
// Hono Context 輔助函數
// ============================================================================

/**
 * 從 Hono Context 獲取運行時配置
 * @param c - Hono Context
 * @returns 運行時配置對象
 *
 * @example
 * ```ts
 * app.get('/api/config', (c) => {
 *   const config = getConfigFromContext(c);
 *   return c.json(config);
 * });
 * ```
 */
export function getConfigFromContext(c: Context): RuntimeConfig {
  return getRuntimeConfig(c.env as WorkerEnv);
}

/**
 * 從 Hono Context 獲取後端 URL
 * @param c - Hono Context
 * @returns 後端 URL
 */
export function getBackendUrlFromContext(c: Context): string {
  return getBackendUrl(c.env as WorkerEnv);
}

/**
 * 從 Hono Context 獲取前端 URL
 * @param c - Hono Context
 * @returns 前端 URL
 */
export function getFrontendUrlFromContext(c: Context): string {
  return getFrontendUrl(c.env as WorkerEnv);
}

// ============================================================================
// 配置驗證
// ============================================================================

/**
 * 驗證運行時配置是否完整
 * @param env - Cloudflare Workers env 對象
 * @throws 如果配置無效則拋出錯誤
 */
export function validateRuntimeConfig(env: WorkerEnv): void {
  const config = getRuntimeConfig(env);
  const errors: string[] = [];

  // 驗證 URL 格式
  const urlFields: Array<keyof Pick<RuntimeConfig, 'backendUrl' | 'frontendUrl' | 'websocketUrl' | 'storagePublicUrl'>> = [
    'backendUrl',
    'frontendUrl',
    'websocketUrl',
    'storagePublicUrl'
  ];

  urlFields.forEach(field => {
    const url = config[field];
    if (url && !url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('ws://') && !url.startsWith('wss://')) {
      errors.push(`${field} has invalid format: ${url}`);
    }
  });

  if (errors.length > 0) {
    console.error('[Runtime Config] Configuration errors found:', errors);
    throw new Error(`Runtime configuration validation failed:\n${errors.join('\n')}`);
  }

  console.info('[Runtime Config] Configuration validated successfully', {
    env: config.env,
    backendUrl: config.backendUrl,
    frontendUrl: config.frontendUrl,
  });
}

// ============================================================================
// 調試輔助
// ============================================================================

/**
 * 打印當前配置 (僅在開發環境)
 * @param env - Cloudflare Workers env 對象
 */
export function logRuntimeConfig(env: WorkerEnv): void {
  if (!isDevelopment(env)) {
    return;
  }

  const config = getRuntimeConfig(env);
  console.log('🔧 [Runtime Config] Current Configuration:');
  console.log('  Environment:', config.env);
  console.log('  Backend URL:', config.backendUrl);
  console.log('  Frontend URL:', config.frontendUrl);
  console.log('  WebSocket URL:', config.websocketUrl);
  console.log('  Storage URL:', config.storagePublicUrl);
}
