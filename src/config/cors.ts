/**
 * ============================================================================
 * 統一的 CORS 配置 - Layer 2/3: 配置層
 * ============================================================================
 * 集中管理所有允許的 origins，支持動態環境配置
 *
 * 設計原則:
 * 1. 生產環境: 必須通過環境變量顯式配置 (FRONTEND_URL, BACKEND_URL)
 * 2. 開發環境: 自動包含 localhost 相關域名
 * 3. 動態擴展: 支持通過 ADDITIONAL_ALLOWED_ORIGINS 添加額外域名
 *
 * @see getAllowedOrigins(env) - 推薦使用的動態配置函數
 */

import { getCurrentEnvironment, type WorkerEnv } from './runtime';
import { nowISO } from '@/utils/timestamp'

/**
 * 開發環境專用 origins 列表
 * 這些域名僅在非生產環境自動包含
 */
export const DEVELOPMENT_ORIGINS = [
  'http://localhost:3000', // Vite dev server
  'http://localhost:3001', // Vite dev server (alt port)
  'https://localhost:3000', // Vite dev server (SSL)
  'https://localhost:3001', // Vite dev server (SSL, alt port)
  'http://127.0.0.1:3000', // Local IP
  'http://127.0.0.1:3001', // Local IP (alt port)
  'http://localhost:8787', // Wrangler dev server
] as const;

/**
 * @deprecated 請使用 getAllowedOrigins(env) 以支持環境動態配置
 * 保留此常量僅為向後兼容，生產環境中不應直接使用
 */
export const ALLOWED_ORIGINS = DEVELOPMENT_ORIGINS;

/**
 * 動態獲取允許的 origins (推薦)
 * 根據環境變量動態構建允許的 origins 列表
 *
 * @param env - Cloudflare Workers 環境對象
 * @returns 允許的 origins 數組
 *
 * @example
 * ```ts
 * const allowedOrigins = getAllowedOrigins(c.env);
 * if (allowedOrigins.includes(origin)) {
 * // 允許此 origin
 * }
 * ```
 */
export function getAllowedOrigins(env?: WorkerEnv): string[] {
  const origins = new Set<string>();

  // 確定當前環境
  const currentEnv = env ? getCurrentEnvironment(env) : 'development';

  // 非生產環境: 自動包含開發 origins
  if (currentEnv !== 'production') {
    DEVELOPMENT_ORIGINS.forEach(origin => origins.add(origin));
  }

  if (env) {
    // 從環境變量讀取配置的 URLs (生產環境必需)
    if (env.FRONTEND_URL) {
      origins.add(env.FRONTEND_URL);
    }
    if (env.BACKEND_URL) {
      origins.add(env.BACKEND_URL);
    }
    if (env.STORAGE_PUBLIC_URL) {
      origins.add(env.STORAGE_PUBLIC_URL);
    }
    // 相容性: 也檢查 R2_PUBLIC_URL
    const r2Url = (env as Record<string, unknown>).R2_PUBLIC_URL as string;
    if (r2Url) {
      origins.add(r2Url);
    }

    // 支持額外的允許 origins (逗號分隔)
    const additionalOrigins = (env as Record<string, unknown>).ADDITIONAL_ALLOWED_ORIGINS as string;
    if (additionalOrigins) {
      additionalOrigins
        .split(',')
        .map(o => o.trim())
        .filter(o => o)
        .forEach(origin => origins.add(origin));
    }

    // 支持 Cloudflare Pages 預覽部署
    const cfPagesUrl = (env as Record<string, unknown>).CF_PAGES_URL as string;
    if (cfPagesUrl) {
      origins.add(cfPagesUrl);
    }
  }

  // 生產環境驗證: 確保至少配置了 FRONTEND_URL
  if (currentEnv === 'production' && origins.size === 0) {
    console.warn(
      '[CORS] Warning: No allowed origins configured in production. ' +
      'Please set FRONTEND_URL, BACKEND_URL in environment variables.'
    );
  }

  return Array.from(origins);
}

/**
 * 檢查給定的 origin 是否被允許
 * @param origin - 要檢查的 origin
 * @param env - Cloudflare Workers 環境對象 (可選，用於動態配置)
 * @returns 如果允許則返回 true
 */
export function isOriginAllowed(origin: string | undefined, env?: WorkerEnv): boolean {
  if (!origin) {
    return false;
  }

  // 使用動態配置檢查
  const allowedOrigins = getAllowedOrigins(env);
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // 支持 Cloudflare Pages 預覽部署模式
  // 格式: https://{commit-hash}.{project-name}.pages.dev
  if (origin.match(/^https:\/\/[a-f0-9]+\.[a-z0-9-]+\.pages\.dev$/)) {
    return true;
  }

  return false;
}

/**
 * CORS Headers 配置
 */
export const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, X-Session-Id, X-Conversation-Id, X-Context-Team-ID',
  'Access-Control-Max-Age': '86400', // 24 hours
  'Access-Control-Allow-Credentials': 'true',
} as const;

/**
 * 為響應添加 CORS headers
 * @param origin - 請求的 origin
 * @param headers - Headers 對象
 * @param env - 環境變量 (用於動態配置)
 */
export function addCorsHeaders(origin: string | undefined, headers: Headers, env?: WorkerEnv): void {
  if (!origin || !isOriginAllowed(origin, env)) {
    return;
  }

  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Credentials', CORS_HEADERS['Access-Control-Allow-Credentials']);
  headers.set('Access-Control-Allow-Methods', CORS_HEADERS['Access-Control-Allow-Methods']);
  headers.set('Access-Control-Allow-Headers', CORS_HEADERS['Access-Control-Allow-Headers']);
  headers.set('Access-Control-Max-Age', CORS_HEADERS['Access-Control-Max-Age']);
}

/**
 * 創建 CORS OPTIONS 預檢響應
 * @param origin - 請求的 origin
 * @param env - 環境變量 (用於動態配置)
 * @returns Response 對象
 */
export function createCorsPreflightResponse(origin: string | undefined, env?: WorkerEnv): Response {
  const response = new Response(null, { status: 204 });

  if (origin && isOriginAllowed(origin, env)) {
    addCorsHeaders(origin, response.headers, env);
  }

  // 防止 Cloudflare edge 緩存 OPTIONS 響應
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
}

/**
 * 日誌 CORS 請求（用於調試）
 * @param origin - 請求的 origin
 * @param allowed - 是否允許
 * @param context - 上下文描述
 */
export function logCorsRequest(origin: string | undefined, allowed: boolean, context: string = ''): void {
  const prefix = context ? `[${context}]` : '';
  if (allowed) {
    console.log(` CORS ${prefix}: Allowed origin: ${origin}`);
  } else {
    console.warn(` CORS ${prefix}: Blocked origin: ${origin}`);
  }
}

// ============================================================================
// CORS Error Response Helpers (Configuration Guard Pattern)
// ============================================================================

/**
 * CORS configuration error details
 */
export interface CorsConfigurationError {
  error: string;
  code: 'CORS_ORIGIN_NOT_ALLOWED' | 'CORS_CONFIGURATION_MISSING';
  message: string;
  requestedOrigin: string | undefined;
  allowedOrigins: string[];
  isConfigurationIssue: boolean;
  resolution: {
    steps: string[];
    documentation: string;
  };
  timestamp: string;
}

/**
 * Creates a detailed CORS error response with configuration guidance
 *
 * @param origin - The blocked origin
 * @param env - Environment bindings to check configuration
 * @returns CorsConfigurationError object
 */
export function createCorsErrorDetails(
  origin: string | undefined,
  env?: WorkerEnv
): CorsConfigurationError {
  const currentEnv = env ? getCurrentEnvironment(env) : 'unknown';
  const allowedOrigins = getAllowedOrigins(env);
  const hasFrontendUrl = !!(env?.FRONTEND_URL);
  const hasBackendUrl = !!(env?.BACKEND_URL);

  // Determine if this is a configuration issue
  const isConfigurationIssue = currentEnv === 'production' && !hasFrontendUrl && !hasBackendUrl;

  const baseError: CorsConfigurationError = {
    error: isConfigurationIssue ? 'CORS_CONFIGURATION_MISSING' : 'CORS_ORIGIN_NOT_ALLOWED',
    code: isConfigurationIssue ? 'CORS_CONFIGURATION_MISSING' : 'CORS_ORIGIN_NOT_ALLOWED',
    message: isConfigurationIssue
      ? 'CORS is blocking requests because FRONTEND_URL is not configured in production environment.'
      : `Origin '${origin}' is not in the allowed origins list.`,
    requestedOrigin: origin,
    allowedOrigins: allowedOrigins,
    isConfigurationIssue,
    resolution: isConfigurationIssue
      ? {
          steps: [
            '1. Go to Cloudflare Dashboard (https://dash.cloudflare.com)',
            '2. Navigate to: Workers & Pages -> mcis-worker -> Settings -> Variables',
            '3. Add environment variable: FRONTEND_URL = ' + (origin || 'https://your-frontend-domain.com'),
            '4. Add environment variable: BACKEND_URL = https://your-backend-domain.com',
            '5. Click "Save and Deploy"',
            '6. Wait for deployment to complete (~30 seconds)',
            '7. Refresh the page',
          ],
          documentation: 'https://developers.cloudflare.com/workers/configuration/environment-variables/',
        }
      : {
          steps: [
            `1. The origin '${origin}' is not in the allowed list`,
            '2. To allow this origin, add it to ADDITIONAL_ALLOWED_ORIGINS environment variable',
            '3. Or set FRONTEND_URL to this origin if it is your primary frontend',
          ],
          documentation: 'https://developers.cloudflare.com/workers/configuration/environment-variables/',
        },
    timestamp: nowISO(),
  };

  return baseError;
}

/**
 * Creates a CORS blocked response with detailed error information
 *
 * @param origin - The blocked origin
 * @param env - Environment bindings
 * @returns Response object with 403 status
 */
export function createCorsBlockedResponse(
  origin: string | undefined,
  env?: WorkerEnv
): Response {
  const errorDetails = createCorsErrorDetails(origin, env);

  return new Response(JSON.stringify(errorDetails, null, 2), {
    status: 403,
    headers: {
      'Content-Type': 'application/json',
      'X-CORS-Error': errorDetails.code,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
