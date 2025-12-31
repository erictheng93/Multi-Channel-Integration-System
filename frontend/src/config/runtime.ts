/**
 * ============================================================================
 * 運行時配置層 - Layer 2: Runtime Configuration
 * ============================================================================
 *
 * 本文件提供類型安全的環境變量訪問接口
 *
 * 架構設計:
 * - Layer 1: .env 文件 (環境變量存儲)
 * - Layer 2: runtime.ts (本文件 - 配置封裝)
 * - Layer 3: 業務代碼 (使用本文件提供的函數)
 *
 * 優勢:
 * - ✅ 類型安全 (TypeScript)
 * - ✅ 默認值支持
 * - ✅ 環境自動檢測
 * - ✅ 集中管理
 * - ✅ 易於測試
 *
 * @module config/runtime
 */

// ============================================================================
// 類型定義
// ============================================================================

/**
 * 環境類型
 */
export type Environment = 'development' | 'staging' | 'production';

/**
 * 運行時配置接口
 */
export interface RuntimeConfig {
  /** 環境類型 */
  env: Environment;

  /** 後端 API URL */
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

  /** 是否啟用調試 */
  debug: boolean;

  /** WebSocket 配置 */
  websocket: {
    enabled: boolean;
    autoReconnect: boolean;
    reconnectDelay: number;
    maxRetries: number;
    debug: boolean;
  };

  /** 功能開關 */
  features: {
    searchCache: boolean;
    performanceMonitoring: boolean;
    experimentalFeatures: boolean;
  };
}

// ============================================================================
// 環境變量讀取輔助函數
// ============================================================================

/**
 * 安全地讀取環境變量
 * @param key - 環境變量鍵名
 * @param defaultValue - 默認值
 * @returns 環境變量值或默認值
 */
function getEnv(key: string, defaultValue: string = ''): string {
  if (typeof import.meta.env === 'undefined') {
    console.warn(`[Runtime Config] import.meta.env is undefined, using default value for ${key}`);
    return defaultValue;
  }

  const value = import.meta.env[key];

  if (value === undefined || value === null || value === '') {
    if (defaultValue) {
      console.debug(`[Runtime Config] ${key} not set, using default: ${defaultValue}`);
      return defaultValue;
    } else {
      console.warn(`[Runtime Config] ${key} not set and no default value provided`);
      return '';
    }
  }

  return value;
}

/**
 * 讀取布爾型環境變量
 * @param key - 環境變量鍵名
 * @param defaultValue - 默認值
 * @returns 布爾值
 */
function getBooleanEnv(key: string, defaultValue: boolean = false): boolean {
  const value = getEnv(key, String(defaultValue));
  return value === 'true' || value === '1';
}

/**
 * 讀取數字型環境變量
 * @param key - 環境變量鍵名
 * @param defaultValue - 默認值
 * @returns 數字值
 */
function getNumberEnv(key: string, defaultValue: number = 0): number {
  const value = getEnv(key, String(defaultValue));
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// ============================================================================
// 核心配置獲取函數
// ============================================================================

/**
 * 獲取當前環境類型
 * @returns 環境類型
 */
export function getCurrentEnvironment(): Environment {
  const env = getEnv('VITE_ENV', 'development');

  if (env === 'production' || env === 'staging' || env === 'development') {
    return env as Environment;
  }

  // 備用檢測: 使用 import.meta.env.PROD
  if (import.meta.env.PROD) {
    return 'production';
  }

  return 'development';
}

/**
 * 獲取後端 API URL
 * @returns 後端 URL
 */
export function getBackendUrl(): string {
  const url = getEnv(
    'VITE_BACKEND_URL',
    import.meta.env.PROD
      ? 'https://multi-channel.imfinethankyouandyou.com'
      : 'http://localhost:8787'
  );

  // 移除尾部斜線
  return url.replace(/\/$/, '');
}

/**
 * 獲取前端 URL
 * @returns 前端 URL
 */
export function getFrontendUrl(): string {
  const url = getEnv(
    'VITE_FRONTEND_URL',
    import.meta.env.PROD
      ? 'https://mcp.imfinethankyouandyou.com'
      : 'http://localhost:3000'
  );

  return url.replace(/\/$/, '');
}

/**
 * 獲取 WebSocket URL
 * 如果未設置 VITE_WEBSOCKET_URL，則自動從 BACKEND_URL 推導
 * @returns WebSocket URL
 */
export function getWebSocketUrl(): string {
  // 優先使用顯式設置的 WebSocket URL
  const explicitWsUrl = getEnv('VITE_WEBSOCKET_URL', '');
  if (explicitWsUrl) {
    return explicitWsUrl.replace(/\/$/, '');
  }

  // 自動從 BACKEND_URL 推導
  const backendUrl = getBackendUrl();
  const wsUrl = backendUrl
    .replace(/^https:/, 'wss:')
    .replace(/^http:/, 'ws:');

  return `${wsUrl}/ws`;
}

/**
 * 獲取 R2 存儲公開 URL
 * @returns R2 公開 URL
 */
export function getStoragePublicUrl(): string {
  const url = getEnv(
    'VITE_STORAGE_PUBLIC_URL',
    import.meta.env.PROD
      ? 'https://s3.imfinethankyouandyou.com'
      : 'http://localhost:8787/files'
  );

  return url.replace(/\/$/, '');
}

/**
 * 檢查是否為開發模式
 * @returns 是否為開發模式
 */
export function isDevelopment(): boolean {
  return getCurrentEnvironment() === 'development';
}

/**
 * 檢查是否為生產模式
 * @returns 是否為生產模式
 */
export function isProduction(): boolean {
  return getCurrentEnvironment() === 'production';
}

/**
 * 檢查是否為預發布環境
 * @returns 是否為預發布環境
 */
export function isStaging(): boolean {
  return getCurrentEnvironment() === 'staging';
}

/**
 * 檢查是否啟用調試模式
 * @returns 是否啟用調試
 */
export function isDebugEnabled(): boolean {
  return getBooleanEnv('VITE_DEBUG', isDevelopment());
}

// ============================================================================
// API 端點構建函數
// ============================================================================

/**
 * 構建 API 端點 URL
 * @param path - API 路徑 (如 '/api/conversations')
 * @returns 完整的 API URL
 *
 * @example
 * ```ts
 * const url = getApiEndpoint('/api/conversations');
 * // => 'https://multi-channel.imfinethankyouandyou.com/api/conversations'
 * ```
 */
export function getApiEndpoint(path: string): string {
  const baseUrl = getBackendUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

/**
 * 構建 WebSocket 端點 URL
 * @param path - WebSocket 路徑 (如 '/conversation/123')
 * @returns 完整的 WebSocket URL
 *
 * @example
 * ```ts
 * const url = getWebSocketEndpoint('/conversation/123');
 * // => 'wss://multi-channel.imfinethankyouandyou.com/ws/conversation/123'
 * ```
 */
export function getWebSocketEndpoint(path: string): string {
  const wsUrl = getWebSocketUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${wsUrl}${normalizedPath}`;
}

/**
 * 構建文件訪問 URL
 * @param fileKey - 文件鍵值或路徑
 * @returns 完整的文件 URL
 *
 * @example
 * ```ts
 * const url = getFileUrl('avatars/user123.jpg');
 * // => 'https://s3.imfinethankyouandyou.com/avatars/user123.jpg'
 * ```
 */
export function getFileUrl(fileKey: string): string {
  const storageUrl = getStoragePublicUrl();
  const normalizedKey = fileKey.startsWith('/') ? fileKey.slice(1) : fileKey;
  return `${storageUrl}/${normalizedKey}`;
}

// ============================================================================
// 完整配置對象
// ============================================================================

/**
 * 獲取完整的運行時配置
 * @returns 運行時配置對象
 */
export function getRuntimeConfig(): RuntimeConfig {
  const env = getCurrentEnvironment();
  const isDev = env === 'development';
  const isProd = env === 'production';

  return {
    env,
    backendUrl: getBackendUrl(),
    frontendUrl: getFrontendUrl(),
    websocketUrl: getWebSocketUrl(),
    storagePublicUrl: getStoragePublicUrl(),
    isDevelopment: isDev,
    isProduction: isProd,
    debug: isDebugEnabled(),

    websocket: {
      enabled: getBooleanEnv('VITE_WEBSOCKET_ENABLED', true),
      autoReconnect: getBooleanEnv('VITE_WEBSOCKET_AUTO_RECONNECT', true),
      reconnectDelay: getNumberEnv('VITE_WEBSOCKET_RECONNECT_DELAY', isDev ? 5000 : 3000),
      maxRetries: getNumberEnv('VITE_WEBSOCKET_MAX_RETRIES', isDev ? 5 : 10),
      debug: getBooleanEnv('VITE_WEBSOCKET_DEBUG', isDev),
    },

    features: {
      searchCache: getBooleanEnv('VITE_ENABLE_SEARCH_CACHE', true),
      performanceMonitoring: getBooleanEnv('VITE_ENABLE_PERFORMANCE_MONITORING', true),
      experimentalFeatures: getBooleanEnv('VITE_ENABLE_EXPERIMENTAL_FEATURES', isDev),
    },
  };
}

// ============================================================================
// 配置驗證
// ============================================================================

/**
 * 驗證運行時配置是否完整
 * 在應用啟動時調用此函數確保配置正確
 */
export function validateRuntimeConfig(): void {
  const config = getRuntimeConfig();
  const errors: string[] = [];

  // 驗證必需的 URL
  if (!config.backendUrl) {
    errors.push('VITE_BACKEND_URL is not set');
  }

  if (!config.frontendUrl) {
    errors.push('VITE_FRONTEND_URL is not set');
  }

  if (!config.websocketUrl) {
    errors.push('VITE_WEBSOCKET_URL is not set');
  }

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
// 啟動時日誌
// ============================================================================

// 在開發環境下打印配置信息
if (isDevelopment()) {
  console.group('🔧 Runtime Configuration');
  console.log('Environment:', getCurrentEnvironment());
  console.log('Backend URL:', getBackendUrl());
  console.log('Frontend URL:', getFrontendUrl());
  console.log('WebSocket URL:', getWebSocketUrl());
  console.log('Storage URL:', getStoragePublicUrl());
  console.log('Debug Mode:', isDebugEnabled());
  console.groupEnd();
}

// ============================================================================
// 導出默認配置 (便於導入)
// ============================================================================

/**
 * 默認導出: 完整配置對象
 */
export default getRuntimeConfig();
