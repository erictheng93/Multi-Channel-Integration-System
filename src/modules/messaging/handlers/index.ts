// Messaging Handlers 路由註冊
// 註冊所有訊息相關的API路由

import { Hono } from 'hono';
import { MessageMainHandler } from '@modules/messaging/handlers/message-main';

// 中間件導入
import {
  checkMessageAccess,
  checkSpecificMessageAccess,
  checkMessageSendPermission,
  checkMessageRecallPermission,
  checkDelayedSendPermission,
  checkBatchOperationPermission,
  applyMessageScopeFilter,
  validateMessageSender,
  validateMessageId,
  validateConversationId,
  validatePaginationParams,
  validateUpdateMessageData,
  validateSearchQuery,
  // 中間件組合
  basicMessageAccess,
  specificMessageAccess,
  messageSendAccess,
  delayedSendAccess,
  messageRecallAccess,
  batchOperationAccess,
  statsViewAccess,
  messageSearchAccess
} from '../middleware/index';

import type { Bindings } from '@/types';

// 創建訊息路由實例
const messageRouter = new Hono<{ Bindings: Bindings }>();

// ======================== 健康檢查端點 ========================

/**
 * 健康檢查
 * GET /api/messages/health
 */
messageRouter.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    module: 'messaging',
    version: '1.0.0'
  });
});

/**
 * 模組資訊
 * GET /api/messages/info
 */
messageRouter.get('/info', (c) => {
  return c.json({
    success: true,
    data: {
      module: 'messaging',
      version: '1.0.0',
      supportedPlatforms: ['line', 'facebook', 'webchat'],
      features: [
        'Real-time messaging',
        'Delayed message sending (1-120 seconds)',
        'Message recall functionality',
        'Batch operations',
        'File attachments',
        'Message search and filtering',
        'Statistics and analytics'
      ],
      endpoints: [
        'GET /health - Health check',
        'GET /info - Module information',
        'POST / - Create message',
        'GET /:id - Get message details',
        'PUT /:id - Update message',
        'HEAD /:id - Check message exists',
        'GET /:id/can-recall - Check recall eligibility',
        'GET /conversation/:conversationId - Get conversation messages',
        'GET /search - Quick search',
        'POST /advanced-search - Advanced search',
        'GET /stats - Message statistics',
        'POST /delayed - Schedule delayed message',
        'GET /delayed - List delayed messages',
        'POST /:id/recall - Recall message',
        'POST /batch/send - Batch send messages'
      ]
    },
    timestamp: new Date().toISOString()
  });
});

// ======================== 基礎CRUD路由 ========================

/**
 * 創建新訊息
 * POST /api/messages
 */
messageRouter.post(
  '/',
  ...messageSendAccess,
  MessageMainHandler.create
);

/**
 * 獲取訊息詳情
 * GET /api/messages/:id
 */
messageRouter.get(
  '/:id',
  ...specificMessageAccess,
  MessageMainHandler.get
);

/**
 * 更新訊息
 * PUT /api/messages/:id
 */
messageRouter.put(
  '/:id',
  validateMessageId,
  validateUpdateMessageData,
  checkMessageAccess,
  checkSpecificMessageAccess,
  checkMessageSendPermission,
  MessageMainHandler.update
);

/**
 * 檢查訊息是否存在
 * HEAD /api/messages/:id (通過 GET 處理)
 */
messageRouter.get(
  '/:id/exists',
  validateMessageId,
  checkMessageAccess,
  checkSpecificMessageAccess,
  MessageMainHandler.exists
);

/**
 * 檢查訊息召回資格
 * GET /api/messages/:id/can-recall
 */
messageRouter.get(
  '/:id/can-recall',
  ...specificMessageAccess,
  MessageMainHandler.canRecall
);

// ======================== 對話訊息路由 ========================

/**
 * 獲取對話訊息列表
 * GET /api/messages/conversation/:conversationId
 */
messageRouter.get(
  '/conversation/:conversationId',
  validateConversationId,
  validatePaginationParams,
  checkMessageAccess,
  applyMessageScopeFilter,
  MessageMainHandler.getConversationMessages
);

// ======================== 搜尋路由 ========================

/**
 * 快速搜尋訊息
 * GET /api/messages/search
 */
messageRouter.get(
  '/search',
  ...messageSearchAccess,
  MessageMainHandler.search
);

/**
 * 進階搜尋
 * POST /api/messages/advanced-search
 */
messageRouter.post(
  '/advanced-search',
  checkMessageAccess,
  applyMessageScopeFilter,
  MessageMainHandler.advancedSearch
);

// ======================== 統計路由 ========================

/**
 * 獲取訊息統計
 * GET /api/messages/stats
 */
messageRouter.get(
  '/stats',
  ...statsViewAccess,
  MessageMainHandler.getStats
);

// ======================== 延遲訊息路由 ========================
// NOTE: Full delayed message implementation exists in:
// - src/handlers/delayed-message-drizzle.ts (main handler)
// - src/modules/delayed-message/ (service layer)
// - src/durable-objects/DelayedMessageScheduler.ts (scheduler)
// These stubs are for modular routing integration

/**
 * 發送延遲訊息
 * POST /api/messages/delayed
 * @see src/handlers/delayed-message-drizzle.ts for full implementation
 */
messageRouter.post(
  '/delayed',
  ...delayedSendAccess,
  async (c) => {
    // STUB: Modular routing placeholder - actual implementation in delayed-message-drizzle.ts
    return c.json({
      success: false,
      error: 'Use /api/delayed-messages endpoint for delayed message operations',
      redirectTo: '/api/delayed-messages',
      timestamp: new Date().toISOString()
    }, 308);
  }
);

/**
 * 獲取延遲訊息列表
 * GET /api/messages/delayed
 * @see src/handlers/delayed-message-drizzle.ts for full implementation
 */
messageRouter.get(
  '/delayed',
  validatePaginationParams,
  checkMessageAccess,
  checkDelayedSendPermission,
  async (c) => {
    // STUB: Modular routing placeholder - actual implementation in delayed-message-drizzle.ts
    return c.json({
      success: false,
      error: 'Use /api/delayed-messages endpoint for delayed message operations',
      redirectTo: '/api/delayed-messages',
      timestamp: new Date().toISOString()
    }, 308);
  }
);

/**
 * 獲取延遲訊息詳情
 * GET /api/messages/delayed/:id
 * @see src/handlers/delayed-message-drizzle.ts for full implementation
 */
messageRouter.get(
  '/delayed/:id',
  validateMessageId,
  checkMessageAccess,
  checkDelayedSendPermission,
  async (c) => {
    const id = c.req.param('id');
    // STUB: Modular routing placeholder - actual implementation in delayed-message-drizzle.ts
    return c.json({
      success: false,
      error: 'Use /api/delayed-messages/:id endpoint for delayed message operations',
      redirectTo: `/api/delayed-messages/${id}`,
      timestamp: new Date().toISOString()
    }, 308);
  }
);

/**
 * 更新延遲訊息
 * PUT /api/messages/delayed/:id
 * @see src/handlers/delayed-message-drizzle.ts for full implementation
 */
messageRouter.put(
  '/delayed/:id',
  validateMessageId,
  checkMessageAccess,
  checkDelayedSendPermission,
  async (c) => {
    const id = c.req.param('id');
    // STUB: Modular routing placeholder - actual implementation in delayed-message-drizzle.ts
    return c.json({
      success: false,
      error: 'Use /api/delayed-messages/:id endpoint for delayed message operations',
      redirectTo: `/api/delayed-messages/${id}`,
      timestamp: new Date().toISOString()
    }, 308);
  }
);

/**
 * 取消延遲訊息
 * DELETE /api/messages/delayed/:id
 * @see src/handlers/delayed-message-drizzle.ts for full implementation
 */
messageRouter.delete(
  '/delayed/:id',
  validateMessageId,
  checkMessageAccess,
  checkDelayedSendPermission,
  async (c) => {
    const id = c.req.param('id');
    // STUB: Modular routing placeholder - actual implementation in delayed-message-drizzle.ts
    return c.json({
      success: false,
      error: 'Use /api/delayed-messages/:id endpoint for delayed message operations',
      redirectTo: `/api/delayed-messages/${id}`,
      timestamp: new Date().toISOString()
    }, 308);
  }
);

// ======================== 訊息召回路由 ========================
// NOTE: Full recall implementation exists in:
// - src/services/message-recall-service.ts (main service)
// - src/modules/messaging/services/message-recall-service.ts (module service)
// - src/handlers/delayed-message.ts (recall endpoint)
// These stubs are for modular routing integration

/**
 * 召回訊息
 * POST /api/messages/:id/recall
 * @see src/services/message-recall-service.ts for full implementation
 */
messageRouter.post(
  '/:id/recall',
  ...messageRecallAccess,
  async (c) => {
    const id = c.req.param('id');
    // STUB: Modular routing placeholder - actual implementation in message-recall-service.ts
    return c.json({
      success: false,
      error: 'Use /api/conversations/:conversationId/messages/:id/recall endpoint',
      redirectTo: `/api/conversations/*/messages/${id}/recall`,
      timestamp: new Date().toISOString()
    }, 308);
  }
);

/**
 * 獲取召回詳情
 * GET /api/messages/recall/:id
 * @see src/services/message-recall-service.ts for full implementation
 */
messageRouter.get(
  '/recall/:id',
  validateMessageId,
  checkMessageAccess,
  checkMessageRecallPermission,
  async (c) => {
    const id = c.req.param('id');
    // STUB: Modular routing placeholder - recall details available via message service
    return c.json({
      success: false,
      error: 'Recall details available through message metadata',
      suggestion: `GET /api/messages/${id} includes recall status`,
      timestamp: new Date().toISOString()
    }, 308);
  }
);

/**
 * 獲取召回歷史
 * GET /api/messages/recalls
 * @see src/services/message-recall-service.ts for full implementation
 */
messageRouter.get(
  '/recalls',
  validatePaginationParams,
  checkMessageAccess,
  checkMessageRecallPermission,
  async (c) => {
    // STUB: Modular routing placeholder - recall history available via audit logs
    return c.json({
      success: false,
      error: 'Recall history available through audit logs or message filtering',
      suggestion: 'Use /api/messages/search with status=recalled filter',
      timestamp: new Date().toISOString()
    }, 308);
  }
);

// ======================== 批量操作路由 ========================
// NOTE: Batch operations implementation exists in:
// - src/handlers/messaging-main.ts (bulk create/delete endpoints)
// These stubs are for modular routing integration

/**
 * 批量發送訊息
 * POST /api/messages/batch/send
 * @see src/handlers/messaging-main.ts for bulk create implementation
 */
messageRouter.post(
  '/batch/send',
  ...batchOperationAccess,
  validateMessageSender,
  async (c) => {
    // STUB: Modular routing placeholder - actual implementation in messaging-main.ts
    return c.json({
      success: false,
      error: 'Use /api/messaging/bulk-create endpoint for batch operations',
      redirectTo: '/api/messaging/bulk-create',
      timestamp: new Date().toISOString()
    }, 308);
  }
);

/**
 * 獲取批量操作狀態
 * GET /api/messages/batch/:operationId
 * PLANNED: Async batch operation tracking (not yet implemented)
 */
messageRouter.get(
  '/batch/:operationId',
  checkMessageAccess,
  checkBatchOperationPermission,
  async (c) => {
    // PLANNED: Async batch tracking - current bulk operations are synchronous
    return c.json({
      success: false,
      error: 'Async batch tracking not yet implemented',
      note: 'Current bulk operations (/api/messaging/bulk-create) are synchronous',
      timestamp: new Date().toISOString()
    }, 501);
  }
);

/**
 * 取消批量操作
 * DELETE /api/messages/batch/:operationId
 * PLANNED: Async batch cancellation (not yet implemented)
 */
messageRouter.delete(
  '/batch/:operationId',
  checkMessageAccess,
  checkBatchOperationPermission,
  async (c) => {
    // PLANNED: Async batch cancellation - current bulk operations are synchronous
    return c.json({
      success: false,
      error: 'Async batch cancellation not yet implemented',
      note: 'Current bulk operations are synchronous and complete immediately',
      timestamp: new Date().toISOString()
    }, 501);
  }
);

// ======================== 附件路由 ========================
// NOTE: Attachment operations implementation exists in:
// - src/handlers/messaging-main.ts (attachment endpoints)
// - src/modules/file-management/ (R2 storage service)
// These stubs are for modular routing integration

/**
 * 添加訊息附件
 * POST /api/messages/:id/attachments
 * @see src/handlers/messaging-main.ts for full implementation
 */
messageRouter.post(
  '/:id/attachments',
  validateMessageId,
  checkMessageAccess,
  checkSpecificMessageAccess,
  checkMessageSendPermission,
  async (c) => {
    // STUB: Modular routing placeholder - actual implementation in messaging-main.ts
    return c.json({
      success: false,
      error: 'Use /api/messaging/:conversationId/messages/:id/attachments endpoint',
      redirectTo: '/api/messaging/*/messages/*/attachments',
      timestamp: new Date().toISOString()
    }, 308);
  }
);

/**
 * 獲取訊息附件
 * GET /api/messages/:id/attachments
 * @see src/handlers/messaging-main.ts for full implementation
 */
messageRouter.get(
  '/:id/attachments',
  ...specificMessageAccess,
  async (c) => {
    // STUB: Modular routing placeholder - attachments included in message response
    return c.json({
      success: false,
      error: 'Attachments are included in message response',
      suggestion: 'GET /api/messages/:id returns attachments in response body',
      timestamp: new Date().toISOString()
    }, 308);
  }
);

/**
 * 移除訊息附件
 * DELETE /api/messages/:id/attachments/:attachmentId
 * @see src/modules/file-management/ for file deletion
 */
messageRouter.delete(
  '/:id/attachments/:attachmentId',
  validateMessageId,
  checkMessageAccess,
  checkSpecificMessageAccess,
  checkMessageSendPermission,
  async (c) => {
    // STUB: Modular routing placeholder - use file management endpoints
    return c.json({
      success: false,
      error: 'Use /api/files/:attachmentId endpoint for file deletion',
      redirectTo: '/api/files/*',
      timestamp: new Date().toISOString()
    }, 308);
  }
);

// ======================== 反應和互動路由 ========================
// PLANNED: Reaction and interaction features
// These are planned features for future implementation

/**
 * 添加反應
 * POST /api/messages/:id/reactions
 * PLANNED: Message reactions feature (emoji reactions, likes, etc.)
 */
messageRouter.post(
  '/:id/reactions',
  validateMessageId,
  checkMessageAccess,
  checkSpecificMessageAccess,
  async (c) => {
    // PLANNED: Reaction system - not yet implemented
    // Requirements: reactions table, emoji support, user tracking
    return c.json({
      success: false,
      error: 'Message reactions feature not yet implemented',
      plannedFeature: 'Add emoji reactions to messages',
      timestamp: new Date().toISOString()
    }, 501);
  }
);

/**
 * 移除反應
 * DELETE /api/messages/:id/reactions
 * PLANNED: Remove reaction feature
 */
messageRouter.delete(
  '/:id/reactions',
  validateMessageId,
  checkMessageAccess,
  checkSpecificMessageAccess,
  async (c) => {
    // PLANNED: Reaction removal - not yet implemented
    return c.json({
      success: false,
      error: 'Message reactions feature not yet implemented',
      plannedFeature: 'Remove reactions from messages',
      timestamp: new Date().toISOString()
    }, 501);
  }
);

/**
 * 標記為已讀
 * POST /api/messages/:id/read
 * PLANNED: Read receipt tracking
 */
messageRouter.post(
  '/:id/read',
  validateMessageId,
  checkMessageAccess,
  checkSpecificMessageAccess,
  async (c) => {
    // PLANNED: Read receipts - not yet implemented
    // Requirements: read_receipts table, WebSocket broadcasting
    return c.json({
      success: false,
      error: 'Read receipts feature not yet implemented',
      plannedFeature: 'Track message read status per user',
      timestamp: new Date().toISOString()
    }, 501);
  }
);

// 導出訊息路由
export { messageRouter };

// 導出所有handler類 (供其他模組使用)
export { MessageMainHandler };

// 導出中間件 (供其他模組使用)
export * from '../middleware/index';

// ======================== 路由資訊 ========================

export const MESSAGE_ROUTER_INFO = {
  basePath: '/api/messages',
  totalEndpoints: 25,
  implementedEndpoints: 8,
  stubEndpoints: 11, // Redirect to actual implementations elsewhere
  plannedEndpoints: 6, // Future features (reactions, read receipts, async batch)
  categories: {
    // Fully implemented in this router
    crud: ['POST /', 'GET /:id', 'PUT /:id', 'HEAD /:id'],
    search: ['GET /search', 'POST /advanced-search'],
    stats: ['GET /stats'],
    // Stubs - redirect to actual implementations
    delayed: {
      endpoints: ['POST /delayed', 'GET /delayed', 'GET /delayed/:id', 'PUT /delayed/:id', 'DELETE /delayed/:id'],
      actualImplementation: '/api/delayed-messages (see src/handlers/delayed-message-drizzle.ts)'
    },
    recall: {
      endpoints: ['POST /:id/recall', 'GET /recall/:id', 'GET /recalls'],
      actualImplementation: '/api/conversations/:id/messages/:id/recall (see src/services/message-recall-service.ts)'
    },
    batch: {
      endpoints: ['POST /batch/send'],
      actualImplementation: '/api/messaging/bulk-create (see src/handlers/messaging-main.ts)'
    },
    attachments: {
      endpoints: ['POST /:id/attachments', 'GET /:id/attachments', 'DELETE /:id/attachments/:attachmentId'],
      actualImplementation: '/api/messaging/* (see src/handlers/messaging-main.ts)'
    },
    // Planned features
    interactions: {
      endpoints: ['POST /:id/reactions', 'DELETE /:id/reactions', 'POST /:id/read'],
      status: 'PLANNED - not yet implemented'
    },
    asyncBatch: {
      endpoints: ['GET /batch/:operationId', 'DELETE /batch/:operationId'],
      status: 'PLANNED - current bulk ops are synchronous'
    }
  }
} as const;