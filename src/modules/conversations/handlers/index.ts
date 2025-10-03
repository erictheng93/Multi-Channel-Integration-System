// Conversations Handlers Index
// 對話處理器索引

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import conversationMainHandler from '@modules/conversations/handlers/conversation-main';

// 創建對話主路由器
const conversationsMainHandler = new Hono<{ Bindings: Bindings }>();

// 🔥 CORS Middleware - Add CORS headers to ALL responses
conversationsMainHandler.use('*', async (c, next) => {
  const origin = c.req.header('Origin') || '';
  const allowedOrigins = [
    'https://multi-channel.imfinethankyouandyou.com',
    'http://localhost:3000',
    'https://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8787',
  ];

  // Check if origin matches Cloudflare Pages preview domains
  const isPagesPreview = origin.endsWith('.multi-channel-platform-frontend.pages.dev');

  await next();

  // Add CORS headers to response
  if ((allowedOrigins.includes(origin) || isPagesPreview) && origin) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
  }
});

// 🔥 CORS Preflight Handler - Handle OPTIONS requests
conversationsMainHandler.options('*', (c) => {
  const origin = c.req.header('Origin') || '';
  const allowedOrigins = [
    'https://multi-channel.imfinethankyouandyou.com',
    'http://localhost:3000',
    'https://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8787',
  ];

  // Check if origin matches Cloudflare Pages preview domains
  const isPagesPreview = origin.endsWith('.multi-channel-platform-frontend.pages.dev');

  const response = new Response(null, { status: 204 });

  // Add CORS headers if origin is allowed
  if ((allowedOrigins.includes(origin) || isPagesPreview) && origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  response.headers.set('Access-Control-Max-Age', '86400');

  // Prevent Cloudflare edge caching of OPTIONS responses
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
});

// 健康檢查端點（不需要認證）
conversationsMainHandler.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    module: 'conversations',
    version: '1.0.0'
  });
});

// 模組資訊端點（不需要認證）
conversationsMainHandler.get('/info', (c) => {
  return c.json({
    success: true,
    data: {
      module: 'conversations',
      version: '1.0.0',
      endpoints: [
        'GET /health - Health check',
        'GET /info - Module information',
        'GET / - List conversations',
        'GET /:id - Get conversation details',
        'POST /:id/assign - Assign conversation',
        'POST /:id/transfer - Transfer conversation',
        'POST /:id/messages - Send message',
        'GET /:id/messages - Get messages with pagination',
        'GET /stream - SSE conversation updates',
        'GET /:conversationId/messages/stream - SSE message stream'
      ]
    },
    timestamp: new Date().toISOString()
  });
});

// 將所有對話路由掛載到主路由器
conversationsMainHandler.route('/', conversationMainHandler);

// 導出路由
export { conversationsMainHandler };
export default conversationsMainHandler;
export * from './conversation-main';