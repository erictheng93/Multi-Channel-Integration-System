// Messaging Health Routes
// 訊息模組健康檢查端點

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { nowISO } from '@/utils/timestamp'

const healthRoutes = new Hono<{ Bindings: Bindings }>();

healthRoutes.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    module: 'messaging',
    timestamp: nowISO(),
    version: '2.0.0'
  });
});

healthRoutes.get('/info', (c) => {
  return c.json({
    success: true,
    data: {
      module: 'messaging',
      version: '2.0.0',
      status: 'operational',
      features: [
        'Message CRUD operations',
        'Conversation message listing',
        'Advanced search functionality',
        'Message statistics',
        'Real-time message support',
        'Bulk operations (create/delete)',
        'File attachment management',
        'Message forwarding',
        'Message tagging system',
        'Data export (JSON/CSV)'
      ],
      endpoints: [
        'GET /health - Health check',
        'GET /info - Module information',
        'POST / - Create new message',
        'GET /:id - Get message by ID',
        'PUT /:id - Update message',
        'DELETE /:id - Delete message',
        'GET /conversation/:conversationId - Get conversation messages',
        'GET /search - Search messages',
        'GET /stats - Message statistics',
        'POST /bulk-create - Bulk create messages',
        'POST /bulk-delete - Bulk delete messages',
        'GET /:id/attachments - Get message attachments',
        'POST /:id/attachments - Upload message attachment',
        'POST /:id/forward - Forward message to conversations',
        'PUT /:id/tags - Add/update message tags',
        'GET /tags - Get all available tags',
        'GET /export - Export messages (JSON/CSV)'
      ]
    },
    timestamp: nowISO()
  });
});

export default healthRoutes;
