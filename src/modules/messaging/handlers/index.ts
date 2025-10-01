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

/**
 * 發送延遲訊息
 * POST /api/messages/delayed
 */
messageRouter.post(
  '/delayed',
  ...delayedSendAccess,
  async (c) => {
    // TODO: 實現延遲訊息處理器
    return c.json({
      success: true,
      message: 'Delayed message endpoint - coming soon',
      timestamp: new Date().toISOString()
    });
  }
);

/**
 * 獲取延遲訊息列表
 * GET /api/messages/delayed
 */
messageRouter.get(
  '/delayed',
  validatePaginationParams,
  checkMessageAccess,
  checkDelayedSendPermission,
  async (c) => {
    // TODO: 實現延遲訊息列表處理器
    return c.json({
      success: true,
      message: 'Delayed messages list endpoint - coming soon',
      timestamp: new Date().toISOString()
    });
  }
);

/**
 * 獲取延遲訊息詳情
 * GET /api/messages/delayed/:id
 */
messageRouter.get(
  '/delayed/:id',
  validateMessageId,
  checkMessageAccess,
  checkDelayedSendPermission,
  async (c) => {
    // TODO: 實現延遲訊息詳情處理器
    return c.json({
      success: true,
      message: 'Delayed message details endpoint - coming soon',
      timestamp: new Date().toISOString()
    });
  }
);

/**
 * 更新延遲訊息
 * PUT /api/messages/delayed/:id
 */
messageRouter.put(
  '/delayed/:id',
  validateMessageId,
  checkMessageAccess,
  checkDelayedSendPermission,
  async (c) => {
    // TODO: 實現延遲訊息更新處理器
    return c.json({
      success: true,
      message: 'Update delayed message endpoint - coming soon',
      timestamp: new Date().toISOString()
    });
  }
);

/**
 * 取消延遲訊息
 * DELETE /api/messages/delayed/:id
 */
messageRouter.delete(
  '/delayed/:id',
  validateMessageId,
  checkMessageAccess,
  checkDelayedSendPermission,
  async (c) => {
    // TODO: 實現延遲訊息取消處理器
    return c.json({
      success: true,
      message: 'Cancel delayed message endpoint - coming soon',
      timestamp: new Date().toISOString()
    });
  }
);

// ======================== 訊息召回路由 ========================

/**
 * 召回訊息
 * POST /api/messages/:id/recall
 */
messageRouter.post(
  '/:id/recall',
  ...messageRecallAccess,
  async (c) => {
    // TODO: 實現訊息召回處理器
    return c.json({
      success: true,
      message: 'Message recall endpoint - coming soon',
      timestamp: new Date().toISOString()
    });
  }
);

/**
 * 獲取召回詳情
 * GET /api/messages/recall/:id
 */
messageRouter.get(
  '/recall/:id',
  validateMessageId,
  checkMessageAccess,
  checkMessageRecallPermission,
  async (c) => {
    // TODO: 實現召回詳情處理器
    return c.json({
      success: true,
      message: 'Recall details endpoint - coming soon',
      timestamp: new Date().toISOString()
    });
  }
);

/**
 * 獲取召回歷史
 * GET /api/messages/recalls
 */
messageRouter.get(
  '/recalls',
  validatePaginationParams,
  checkMessageAccess,
  checkMessageRecallPermission,
  async (c) => {
    // TODO: 實現召回歷史處理器
    return c.json({
      success: true,
      message: 'Recall history endpoint - coming soon',
      timestamp: new Date().toISOString()
    });
  }
);

// ======================== 批量操作路由 ========================

/**
 * 批量發送訊息
 * POST /api/messages/batch/send
 */
messageRouter.post(
  '/batch/send',
  ...batchOperationAccess,
  validateMessageSender,
  async (c) => {
    // TODO: 實現批量發送處理器
    return c.json({
      success: true,
      message: 'Batch send endpoint - coming soon',
      timestamp: new Date().toISOString()
    });
  }
);

/**
 * 獲取批量操作狀態
 * GET /api/messages/batch/:operationId
 */
messageRouter.get(
  '/batch/:operationId',
  checkMessageAccess,
  checkBatchOperationPermission,
  async (c) => {
    // TODO: 實現批量操作狀態處理器
    return c.json({
      success: true,
      message: 'Batch operation status endpoint - coming soon',
      timestamp: new Date().toISOString()
    });
  }
);

/**
 * 取消批量操作
 * DELETE /api/messages/batch/:operationId
 */
messageRouter.delete(
  '/batch/:operationId',
  checkMessageAccess,
  checkBatchOperationPermission,
  async (c) => {
    // TODO: 實現批量操作取消處理器
    return c.json({
      success: true,
      message: 'Cancel batch operation endpoint - coming soon',
      timestamp: new Date().toISOString()
    });
  }
);

// ======================== 附件路由 ========================

/**
 * 添加訊息附件
 * POST /api/messages/:id/attachments
 */
messageRouter.post(
  '/:id/attachments',
  validateMessageId,
  checkMessageAccess,
  checkSpecificMessageAccess,
  checkMessageSendPermission,
  async (c) => {
    // TODO: 實現附件上傳處理器
    return c.json({
      success: true,
      message: 'Add attachment endpoint - coming soon',
      timestamp: new Date().toISOString()
    });
  }
);

/**
 * 獲取訊息附件
 * GET /api/messages/:id/attachments
 */
messageRouter.get(
  '/:id/attachments',
  ...specificMessageAccess,
  async (c) => {
    // TODO: 實現附件列表處理器
    return c.json({
      success: true,
      message: 'Get attachments endpoint - coming soon',
      timestamp: new Date().toISOString()
    });
  }
);

/**
 * 移除訊息附件
 * DELETE /api/messages/:id/attachments/:attachmentId
 */
messageRouter.delete(
  '/:id/attachments/:attachmentId',
  validateMessageId,
  checkMessageAccess,
  checkSpecificMessageAccess,
  checkMessageSendPermission,
  async (c) => {
    // TODO: 實現附件移除處理器
    return c.json({
      success: true,
      message: 'Remove attachment endpoint - coming soon',
      timestamp: new Date().toISOString()
    });
  }
);

// ======================== 反應和互動路由 ========================

/**
 * 添加反應
 * POST /api/messages/:id/reactions
 */
messageRouter.post(
  '/:id/reactions',
  validateMessageId,
  checkMessageAccess,
  checkSpecificMessageAccess,
  async (c) => {
    // TODO: 實現反應添加處理器
    return c.json({
      success: true,
      message: 'Add reaction endpoint - coming soon',
      timestamp: new Date().toISOString()
    });
  }
);

/**
 * 移除反應
 * DELETE /api/messages/:id/reactions
 */
messageRouter.delete(
  '/:id/reactions',
  validateMessageId,
  checkMessageAccess,
  checkSpecificMessageAccess,
  async (c) => {
    // TODO: 實現反應移除處理器
    return c.json({
      success: true,
      message: 'Remove reaction endpoint - coming soon',
      timestamp: new Date().toISOString()
    });
  }
);

/**
 * 標記為已讀
 * POST /api/messages/:id/read
 */
messageRouter.post(
  '/:id/read',
  validateMessageId,
  checkMessageAccess,
  checkSpecificMessageAccess,
  async (c) => {
    // TODO: 實現已讀標記處理器
    return c.json({
      success: true,
      message: 'Mark as read endpoint - coming soon',
      timestamp: new Date().toISOString()
    });
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
  pendingEndpoints: 17,
  categories: {
    crud: ['POST /', 'GET /:id', 'PUT /:id', 'HEAD /:id'],
    search: ['GET /search', 'POST /advanced-search'],
    stats: ['GET /stats'],
    delayed: ['POST /delayed', 'GET /delayed', 'GET /delayed/:id', 'PUT /delayed/:id', 'DELETE /delayed/:id'],
    recall: ['POST /:id/recall', 'GET /recall/:id', 'GET /recalls'],
    batch: ['POST /batch/send', 'GET /batch/:operationId', 'DELETE /batch/:operationId'],
    attachments: ['POST /:id/attachments', 'GET /:id/attachments', 'DELETE /:id/attachments/:attachmentId'],
    interactions: ['POST /:id/reactions', 'DELETE /:id/reactions', 'POST /:id/read']
  }
} as const;