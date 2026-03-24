// Conversations Handlers Index
// 對話處理器索引

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import conversationBulkHandler from './conversation-bulk';
import conversationAssignmentHandler from './conversation-assignment';
import conversationTagsHandler from './conversation-tags';
import conversationMessagesHandler from './conversation-messages';
import conversationReadHandler from './conversation-read';
import conversationQueriesHandler from './conversation-queries';
import { nowISO } from '@/utils/timestamp'

// 創建對話主路由器
const conversationsMainHandler = new Hono<{ Bindings: Bindings }>();

// CORS 處理已移至 src/index.ts 統一管理
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
// - Real-time updates delivered via WebSocket (Durable Objects)

// 健康檢查端點（不需要認證）
conversationsMainHandler.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: nowISO(),
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
        'POST /bulk - Bulk operations (assign, close, reopen, set_priority, add_tags, remove_tags)',
        'POST /:id/assign - Assign conversation to team',
        'POST /:id/unassign - Unassign conversation',
        'POST /:id/transfer - Transfer conversation between teams',
        'GET /:id/tags - Get conversation tags',
        'POST /:id/tags - Add tags to conversation',
        'DELETE /:id/tags - Remove tags from conversation',
        'POST /:id/attachments - Upload attachment',
        'POST /:id/messages - Send message',
        'GET /:id/messages - Get messages with pagination',
        'GET /:id - Get conversation details',
        'GET / - List conversations'
      ]
    },
    timestamp: nowISO()
  });
});

// CRITICAL: Route registration order = matching priority
// More specific routes MUST be registered BEFORE generic /:id patterns.
// Hono uses first-registered, first-matched routing.

// Priority 1: /bulk (literal path before /:id patterns)
conversationsMainHandler.route('/', conversationBulkHandler);

// Priority 2: /:id/assign, /:id/unassign, /:id/transfer
conversationsMainHandler.route('/', conversationAssignmentHandler);

// Priority 3: /:id/tags (GET/POST/DELETE)
conversationsMainHandler.route('/', conversationTagsHandler);

// Priority 4: /:id/messages, /:id/attachments, /:id/read (before GET /:id)
conversationsMainHandler.route('/', conversationMessagesHandler);
conversationsMainHandler.route('/', conversationReadHandler);

// Priority 5 (LAST): GET /:id and GET / (catch-all patterns)
conversationsMainHandler.route('/', conversationQueriesHandler);

// 導出路由
export { conversationsMainHandler };
export default conversationsMainHandler;
