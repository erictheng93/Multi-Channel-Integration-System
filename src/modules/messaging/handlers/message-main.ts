// Message Main Handler
// 基礎訊息處理器 - 提供訊息CRUD和查詢功能

import { Context } from 'hono';
import {
  successResponse,
  paginatedResponse,
  notFoundResponse,
  handleApiError
} from '../../../shared/utils/api-response';
import { MessageCrudService } from '@modules/messaging/services/message-crud';
import {
  MessageSearchQuery,
  SenderType,
  MessageType,
  MessageNotFoundError,
  InvalidMessageDataError
} from '../types/message-types';
import type { Bindings, JWTPayload } from '../../../types';

/**
 * Message CRUD 操作處理器類
 */
export class MessageMainHandler {
  /**
   * 創建新訊息
   * POST /api/messages
   */
  static async create(c: Context<{ Bindings: Bindings }>) {
    try {
      const userPayload = c.get('jwtPayload') as JWTPayload;

      let requestData: {
        conversationId: string;
        content: string;
        messageType?: MessageType;
        replyToMessageId?: string;
        metadata?: any;
      };

      try {
        requestData = await c.req.json();
      } catch (error) {
        return c.json({
          success: false,
          error: 'Invalid JSON data',
          timestamp: new Date().toISOString()
        }, 400);
      }

      const { conversationId, content, messageType, replyToMessageId, metadata } = requestData;

      // 基本驗證
      if (!conversationId || !content || content.trim().length === 0) {
        return c.json({
          success: false,
          error: 'Conversation ID and content are required',
          timestamp: new Date().toISOString()
        }, 400);
      }

      // 創建訊息服務
      const messageService = new MessageCrudService(c.env.DB);

      // 準備訊息數據
      const messageData = {
        conversationId,
        senderType: 'agent' as SenderType,
        agentSenderId: userPayload.userId.toString(),
        content: content.trim(),
        messageType: messageType || ('text' as MessageType),
        replyToMessageId,
        metadata,
      };

      const newMessage = await messageService.create(messageData);

      return successResponse(c, newMessage, 'Message created successfully');
    } catch (error) {
      console.error('Error creating message:', error);

      if (error instanceof InvalidMessageDataError) {
        return c.json({
          success: false,
          error: error.message,
          details: error.details,
          timestamp: new Date().toISOString()
        }, 400);
      }

      return handleApiError(error, c);
    }
  }

  /**
   * 獲取訊息詳情
   * GET /api/messages/:id
   */
  static async get(c: Context<{ Bindings: Bindings }>) {
    try {
      const messageId = c.req.param('id');

      if (!messageId) {
        return c.json({
          success: false,
          error: 'Message ID is required',
          timestamp: new Date().toISOString()
        }, 400);
      }

      const messageService = new MessageCrudService(c.env.DB);
      const message = await messageService.findByIdWithDetails(messageId);

      if (!message) {
        return notFoundResponse(c, 'Message');
      }

      return successResponse(c, message, 'Message retrieved successfully');
    } catch (error) {
      console.error('Error getting message:', error);
      return handleApiError(error, c);
    }
  }

  /**
   * 更新訊息
   * PUT /api/messages/:id
   */
  static async update(c: Context<{ Bindings: Bindings }>) {
    try {
      const messageId = c.req.param('id');

      if (!messageId) {
        return c.json({
          success: false,
          error: 'Message ID is required',
          timestamp: new Date().toISOString()
        }, 400);
      }

      let updateData: {
        content?: string;
        metadata?: any;
      };

      try {
        updateData = await c.req.json();
      } catch (error) {
        return c.json({
          success: false,
          error: 'Invalid JSON data',
          timestamp: new Date().toISOString()
        }, 400);
      }

      const messageService = new MessageCrudService(c.env.DB);
      const updatedMessage = await messageService.update(messageId, updateData);

      return successResponse(c, updatedMessage, 'Message updated successfully');
    } catch (error) {
      console.error('Error updating message:', error);

      if (error instanceof MessageNotFoundError) {
        return notFoundResponse(c, 'Message');
      }

      if (error instanceof InvalidMessageDataError) {
        return c.json({
          success: false,
          error: error.message,
          details: error.details,
          timestamp: new Date().toISOString()
        }, 400);
      }

      return handleApiError(error, c);
    }
  }

  /**
   * 獲取對話訊息列表
   * GET /api/messages/conversation/:conversationId
   */
  static async getConversationMessages(c: Context<{ Bindings: Bindings }>) {
    try {
      const conversationId = c.req.param('conversationId');

      if (!conversationId) {
        return c.json({
          success: false,
          error: 'Conversation ID is required',
          timestamp: new Date().toISOString()
        }, 400);
      }

      // 分頁參數
      const page = parseInt(c.req.query('page') || '1');
      const limit = parseInt(c.req.query('limit') || '50');
      const offset = (page - 1) * limit;
      const orderBy = (c.req.query('order') as 'asc' | 'desc') || 'desc';

      const messageService = new MessageCrudService(c.env.DB);
      const result = await messageService.getConversationMessages(
        conversationId,
        limit,
        offset,
        orderBy
      );

      return paginatedResponse(c, result.messages, {
        page,
        limit,
        total: result.total
      }, 'Messages retrieved successfully');
    } catch (error) {
      console.error('Error getting conversation messages:', error);
      return handleApiError(error, c);
    }
  }

  /**
   * 搜尋訊息
   * GET /api/messages/search
   */
  static async search(c: Context<{ Bindings: Bindings }>) {
    try {
      // 構建搜尋查詢
      const searchQuery: MessageSearchQuery = {
        conversationId: c.req.query('conversationId'),
        content: c.req.query('content'),
        senderType: c.req.query('senderType') as SenderType,
        senderId: c.req.query('senderId'),
        messageType: c.req.query('messageType') as MessageType,
        dateFrom: c.req.query('dateFrom'),
        dateTo: c.req.query('dateTo'),
        isRecalled: c.req.query('isRecalled') === 'true' ? true :
                    c.req.query('isRecalled') === 'false' ? false : undefined,
        deliveryStatus: c.req.query('deliveryStatus') as any,
        hasAttachments: c.req.query('hasAttachments') === 'true',
        limit: parseInt(c.req.query('limit') || '50'),
        offset: parseInt(c.req.query('offset') || '0'),
      };

      const messageService = new MessageCrudService(c.env.DB);
      const result = await messageService.searchMessages(searchQuery);

      return successResponse(c, result, 'Search completed successfully');
    } catch (error) {
      console.error('Error searching messages:', error);
      return handleApiError(error, c);
    }
  }

  /**
   * 高級搜尋 (POST 方式，支援複雜查詢)
   * POST /api/messages/advanced-search
   */
  static async advancedSearch(c: Context<{ Bindings: Bindings }>) {
    try {
      let searchQuery: MessageSearchQuery;

      try {
        searchQuery = await c.req.json();
      } catch (error) {
        return c.json({
          success: false,
          error: 'Invalid JSON data',
          timestamp: new Date().toISOString()
        }, 400);
      }

      const messageService = new MessageCrudService(c.env.DB);
      const result = await messageService.searchMessages(searchQuery);

      return successResponse(c, result, 'Advanced search completed successfully');
    } catch (error) {
      console.error('Error in advanced search:', error);
      return handleApiError(error, c);
    }
  }

  /**
   * 檢查訊息是否存在
   * HEAD /api/messages/:id
   */
  static async exists(c: Context<{ Bindings: Bindings }>) {
    try {
      const messageId = c.req.param('id');

      if (!messageId) {
        return c.body(null, 400);
      }

      const messageService = new MessageCrudService(c.env.DB);
      const message = await messageService.findById(messageId);

      if (!message) {
        return c.body(null, 404);
      }

      return c.body(null, 200);
    } catch (error) {
      console.error('Error checking message existence:', error);
      return c.body(null, 500);
    }
  }

  /**
   * 獲取訊息統計
   * GET /api/messages/stats
   */
  static async getStats(c: Context<{ Bindings: Bindings }>) {
    try {
      // 獲取查詢參數
      const conversationId = c.req.query('conversationId');
      const dateFrom = c.req.query('dateFrom');
      const dateTo = c.req.query('dateTo');

      // TODO: 實現統計功能
      const stats = {
        total: 0,
        byType: {},
        bySender: {},
        byStatus: {},
        recalled: 0,
        withAttachments: 0,
        averageResponseTime: 0,
      };

      return successResponse(c, stats, 'Stats retrieved successfully');
    } catch (error) {
      console.error('Error getting message stats:', error);
      return handleApiError(error, c);
    }
  }

  /**
   * 檢查訊息召回資格
   * GET /api/messages/:id/can-recall
   */
  static async canRecall(c: Context<{ Bindings: Bindings }>) {
    try {
      const messageId = c.req.param('id');

      if (!messageId) {
        return c.json({
          success: false,
          error: 'Message ID is required',
          timestamp: new Date().toISOString()
        }, 400);
      }

      const messageService = new MessageCrudService(c.env.DB);
      const result = await messageService.canRecallMessage(messageId);

      return successResponse(c, result, 'Recall eligibility checked successfully');
    } catch (error) {
      console.error('Error checking recall eligibility:', error);
      return handleApiError(error, c);
    }
  }
}