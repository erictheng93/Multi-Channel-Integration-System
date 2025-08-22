// Cloudflare Pages Functions 中間件
// 處理 CORS 和安全標頭

interface CloudflareEnv {
  [key: string]: string
}

interface CloudflareData {
  [key: string]: unknown
}

export async function onRequest(context: EventContext<CloudflareEnv, string, CloudflareData>): Promise<Response> {
  const { request, next } = context;
  
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
  
  // CSP 標頭 (根據需要調整)
  newResponse.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.workers.dev https://cloudflareinsights.com https://multi-channel.imfinethankyouandyou.com; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self';"
  );

  return newResponse;
}