/**
 * 統一的 CORS 配置
 * 集中管理所有允許的 origins，避免在多個文件中重複維護
 */

/**
 * 允許的 CORS origins 列表
 * 包含所有生產、開發和測試環境的域名
 */
export const ALLOWED_ORIGINS = [
  // 生產環境
  'https://multi-channel.imfinethankyouandyou.com',        // Backend API
  'https://multi-channel-platform-frontend.pages.dev',     // Frontend Cloudflare Pages
  'https://mcp.imfinethankyouandyou.com',                  // MCP Frontend Domain

  // 開發環境
  'http://localhost:3000',                                  // Vite dev server
  'https://localhost:3000',                                 // Vite dev server (SSL)
  'http://127.0.0.1:3000',                                  // Local IP
  'http://localhost:8787',                                  // Wrangler dev server
] as const;

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
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept',
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
