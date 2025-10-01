// Conversations Handlers Index
// 對話處理器索引

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import conversationMainHandler from '@modules/conversations/handlers/conversation-main';

// 創建對話主路由器
const conversationsMainHandler = new Hono<{ Bindings: Bindings }>();

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