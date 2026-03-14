// Cloudflare Pages Functions 中間件
// 處理 CORS 和安全標頭
//
// 動態 CSP 配置：
// 新客戶部署時，只需在 Cloudflare Pages 設定以下環境變量：
// - BACKEND_URL: 後端 API 域名 (例如: https://api.customer.com)
// - STORAGE_URL: 存儲域名 (例如: https://storage.customer.com)
// - CUSTOM_DOMAINS: 額外允許的域名，逗號分隔 (可選)

/* eslint-disable no-undef */
/** Cloudflare Pages Functions EventContext (local definition to avoid DOM type conflicts) */
interface EventContext<Env, _P extends string, Data> {
  request: Request
  functionPath: string
  waitUntil: (_promise: Promise<unknown>) => void
  passThroughOnException: () => void
  next: (_input?: Request | string, _init?: RequestInit) => Promise<Response>
  env: Env
  params: Record<string, string | string[]>
  data: Data
}

interface CloudflareEnv {
  BACKEND_URL?: string
  STORAGE_URL?: string
  CUSTOM_DOMAINS?: string
  [key: string]: string | undefined
}

interface CloudflareData {
  [key: string]: unknown
}

/**
 * 構建動態 CSP connect-src 指令
 * 基於環境變量自動添加客戶特定的域名
 */
function buildConnectSrc(env: CloudflareEnv): string {
  // 基礎允許列表 (所有客戶通用)
  const baseSources = [
    "'self'",
    "https://*.workers.dev",
    "https://*.pages.dev",
    "https://cloudflareinsights.com",
    "https://api.line.me",
    "https://access.line.me",
    "https://liffsdk.line-scdn.net",
    "https://*.line-scdn.net",
    "wss://*.workers.dev",
  ];

  // 從環境變量動態添加客戶域名
  if (env.BACKEND_URL) {
    const backendUrl = new URL(env.BACKEND_URL);
    baseSources.push(env.BACKEND_URL);
    baseSources.push(`wss://${backendUrl.host}`);
    // 添加通配符支持子域名
    const domain = backendUrl.host.split('.').slice(-2).join('.');
    baseSources.push(`https://*.${domain}`);
    baseSources.push(`wss://*.${domain}`);
  }

  if (env.STORAGE_URL) {
    baseSources.push(env.STORAGE_URL);
  }

  // 支持額外的自定義域名
  if (env.CUSTOM_DOMAINS) {
    const customDomains = env.CUSTOM_DOMAINS.split(',').map(d => d.trim()).filter(Boolean);
    baseSources.push(...customDomains);
  }

  return baseSources.join(' ');
}

/**
 * 構建完整的 CSP 標頭
 */
function buildCSP(env: CloudflareEnv): string {
  const connectSrc = buildConnectSrc(env);

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com https://static.line-scdn.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${connectSrc}`,
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

export async function onRequest(context: EventContext<CloudflareEnv, string, CloudflareData>): Promise<Response> {
  const { request, next, env } = context;

  // 處理 CORS 預檢請求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // 繼續處理請求
  const response = await next();

  // 添加安全標頭
  const newResponse = new Response(response.body, response);

  // CORS 標頭
  newResponse.headers.set('Access-Control-Allow-Origin', '*');
  newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 安全標頭
  newResponse.headers.set('X-Frame-Options', 'DENY');
  newResponse.headers.set('X-Content-Type-Options', 'nosniff');
  newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  newResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // 動態 CSP 標頭 - 基於環境變量自動配置
  // 如果環境變量有設定，使用動態 CSP；否則讓 _headers 文件處理
  if (env.BACKEND_URL) {
    const csp = buildCSP(env);
    newResponse.headers.set('Content-Security-Policy', csp);
  }
  // 注意: 如果沒有設定 BACKEND_URL，_headers 文件的 CSP 會生效

  return newResponse;
}