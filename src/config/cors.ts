/**
 * ============================================================================
 * 統一的 CORS 配置 - Layer 2/3: 配置層
 * ============================================================================
 * 集中管理所有允許的 origins，支持動態環境配置
 *
 * 📋 注意: 本文件現在支持兩種模式：
 * 1. 靜態模式: 使用硬編碼的 ALLOWED_ORIGINS (向後兼容)
 * 2. 動態模式: 使用 getAllowedOrigins(env) 函數 (推薦)
 */

/**
 * ⚠️ 已棄用: 靜態 origins 列表 (僅向後兼容)
 * 推薦使用 getAllowedOrigins(env) 函數獲取動態配置
 *
 * @deprecated 請使用 getAllowedOrigins(env) 以支持環境動態配置
 */
export const ALLOWED_ORIGINS = [
  // 生產環境 (默認值 - 實際值應從環境變量讀取)
  'https://multi-channel.imfinethankyouandyou.com',        // Backend API
  'https://multi-channel-platform-frontend.pages.dev',     // Frontend Cloudflare Pages
  'https://mcp.imfinethankyouandyou.com',                  // MCP Frontend Domain

  // 開發環境 (本地開發)
  'http://localhost:3000',                                  // Vite dev server
  'http://localhost:3001',                                  // Vite dev server (alt port)
  'https://localhost:3000',                                 // Vite dev server (SSL)
  'https://localhost:3001',                                 // Vite dev server (SSL, alt port)
  'http://127.0.0.1:3000',                                  // Local IP
  'http://127.0.0.1:3001',                                  // Local IP (alt port)
  'http://localhost:8787',                                  // Wrangler dev server
] as const;

/**
 * ✅ 動態獲取允許的 origins (推薦)
 * 根據環境變量動態構建允許的 origins 列表
 *
 * @param env - Cloudflare Workers 環境對象
 * @returns 允許的 origins 數組
 *
 * @example
 * ```ts
 * const allowedOrigins = getAllowedOrigins(c.env);
 * if (allowedOrigins.includes(origin)) {
 *   // 允許此 origin
 * }
 * ```
 */
export function getAllowedOrigins(env?: any): string[] {
  if (!env) {
    // 無環境對象，返回靜態列表
    return [...ALLOWED_ORIGINS];
  }

  const origins: string[] = [];

  // 從環境變量讀取生產 URLs
  const backendUrl = env.BACKEND_URL || 'https://multi-channel.imfinethankyouandyou.com';
  const frontendUrl = env.FRONTEND_URL || 'https://mcp.imfinethankyouandyou.com';

  // 添加生產環境 URLs
  origins.push(backendUrl);
  origins.push(frontendUrl);

  // 添加備用前端 URL
  origins.push('https://multi-channel-platform-frontend.pages.dev');

  // 開發環境 URLs (總是包含)
  origins.push(
    'http://localhost:3000',
    'http://localhost:3001',
    'https://localhost:3000',
    'https://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://localhost:8787'
  );

  // 去重並返回
  return [...new Set(origins)];
}

/**
 * 檢查給定的 origin 是否被允許
 * @param origin - 要檢查的 origin
 * @returns 如果允許則返回 true
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    return false;
  }

  // 檢查是否在白名單中
  if (ALLOWED_ORIGINS.includes(origin as any)) {
    return true;
  }

  // 檢查是否為 Cloudflare Pages preview 域名
  // 例如：abc123.multi-channel-platform-frontend.pages.dev
  if (origin.endsWith('.multi-channel-platform-frontend.pages.dev')) {
    return true;
  }

  return false;
}

/**
 * CORS Headers 配置
 */
export const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, X-Session-Id, X-Conversation-Id',
  'Access-Control-Max-Age': '86400', // 24 hours
  'Access-Control-Allow-Credentials': 'true',
} as const;

/**
 * 為響應添加 CORS headers
 * @param origin - 請求的 origin
 * @param headers - Headers 對象
 */
export function addCorsHeaders(origin: string | undefined, headers: Headers): void {
  if (!origin || !isOriginAllowed(origin)) {
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
 * @returns Response 對象
 */
export function createCorsPreflightResponse(origin: string | undefined): Response {
  const response = new Response(null, { status: 204 });

  if (origin && isOriginAllowed(origin)) {
    addCorsHeaders(origin, response.headers);
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
    console.log(`✅ CORS ${prefix}: Allowed origin: ${origin}`);
  } else {
    console.warn(`❌ CORS ${prefix}: Blocked origin: ${origin}`);
  }
}

/**
 * SSE 專用 CORS 標頭配置
 *
 * SSE 使用 EventSource API，有特殊要求：
 * 1. EventSource 不支持自定義標頭，只能通過 URL 參數傳遞 token
 * 2. 如果 origin 在允許列表中，返回該 origin (支持 credentials)
 * 3. 如果 origin 不在列表中，返回 '*' (允許連接但無 credentials)
 *
 * @param origin - Request Origin header
 * @param additionalHeaders - 額外的允許標頭 (如 Authorization)
 * @returns SSE CORS headers object
 */
export function getSSECorsHeaders(
  origin: string | undefined,
  additionalHeaders?: string[]
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  };

  if (origin && isOriginAllowed(origin)) {
    // ✅ 允許的來源：返回具體 origin，支持 credentials
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
    console.log(`✅ [SSE CORS] Allowed origin: ${origin}`);
  } else {
    // ⚠️ 未知來源：返回 '*'，允許連接但不支持 credentials
    headers['Access-Control-Allow-Origin'] = '*';
    if (origin) {
      console.warn(`⚠️ [SSE CORS] Unknown origin (wildcard fallback): ${origin}`);
    }
  }

  // 設置允許的標頭
  const allowedHeaders = ['Cache-Control', ...(additionalHeaders || [])];
  headers['Access-Control-Allow-Headers'] = allowedHeaders.join(', ');

  return headers;
}

/**
 * 工具函數：應用 SSE CORS 標頭到 Hono Context
 *
 * @param c - Hono Context
 * @param additionalHeaders - 額外的允許標頭
 */
export function applySSECorsHeaders(
  c: any, // Context type from hono
  additionalHeaders?: string[]
): void {
  const origin = c.req.header('Origin');
  const headers = getSSECorsHeaders(origin, additionalHeaders);

  Object.entries(headers).forEach(([key, value]) => {
    c.header(key, value);
  });
}
