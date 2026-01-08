// Conversations Handlers Index
// 對話處理器索引

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import conversationMainHandler from '@modules/conversations/handlers/conversation-main';

// 創建對話主路由器
const conversationsMainHandler = new Hono<{ Bindings: Bindings }>();

// ✅ CORS 處理已移至 src/index.ts 統一管理
// 不再需要模組級別的 CORS middleware 和 OPTIONS handler
// 全局 CORS 使用 getAllowedOrigins(env) 動態配置，來源包括：
// - FRONTEND_URL 環境變數 (生產環境必須設置)
// - BACKEND_URL 環境變數 (生產環境必須設置)
// - *.pages.dev (Cloudflare Pages preview 分支)
// - localhost:3000, 127.0.0.1:3000, localhost:8787 (開發環境)
//
// 全局 CORS middleware 在 src/index.ts (Line 106) 提供：
// - 自動 origin 驗證和 credentials 支援
// - 統一的 OPTIONS preflight 處理（Line 139）
// - SSE 端點使用 getSSECorsHeaders() 提供專門的 CORS 配置

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
        'POST /bulk - Bulk operations (assign, close, reopen, set_priority, add_tags, remove_tags)',
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