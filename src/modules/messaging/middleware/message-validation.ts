// Messaging 模組資料驗證中間件
// Message data validation middleware

import { Context, Next } from 'hono';
import type { Bindings } from '@/types';
import {
  isValidMessageType,
  isValidSenderType,
  isSupportedPlatform,
  isValidDelaySeconds,
  isValidMessageContent,
  DEFAULT_MESSAGE_VALIDATION
} from '../index';
import type { DelayedSendRequest, RecallRequest, BatchSendRequest } from '@modules/messaging/types/message-types';
import { HTTP_STATUS } from '@/constants/http-status';
import { validateReplyToMessageId } from '@/utils/validate-reply-to';
import { nowISO } from '@/utils/timestamp'

// ======================== 基礎驗證中間件 ========================

/**
 * 驗證訊息ID格式
 */
export async function validateMessageId(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const messageId = c.req.param('id');

    if (!messageId) {
      return c.json({
        success: false,
        error: 'Message ID is required',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 驗證 UUID 格式 (基本)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(messageId)) {
      return c.json({
        success: false,
        error: 'Invalid message ID format',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    return await next();
  } catch (error) {
    console.error('Error validating message ID:', error);
    return c.json({
      success: false,
      error: 'Message ID validation failed',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

/**
 * 驗證對話ID格式
 */
export async function validateConversationId(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const conversationId = c.req.param('conversationId') || c.req.query('conversationId');

    if (!conversationId) {
      return c.json({
        success: false,
        error: 'Conversation ID is required',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 驗證 UUID 格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(conversationId)) {
      return c.json({
        success: false,
        error: 'Invalid conversation ID format',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    return await next();
  } catch (error) {
    console.error('Error validating conversation ID:', error);
    return c.json({
      success: false,
      error: 'Conversation ID validation failed',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

/**
 * 驗證分頁參數
 */
export async function validatePaginationParams(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const page = c.req.query('page');
    const limit = c.req.query('limit');
    const offset = c.req.query('offset');

    // 驗證 page
    if (page !== undefined) {
      const pageNum = parseInt(page);
      if (isNaN(pageNum) || pageNum < 1) {
        return c.json({
          success: false,
          error: 'Page must be a positive integer',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }
    }

    // 驗證 limit
    if (limit !== undefined) {
      const limitNum = parseInt(limit);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return c.json({
          success: false,
          error: 'Limit must be between 1 and 100',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }
    }

    // 驗證 offset
    if (offset !== undefined) {
      const offsetNum = parseInt(offset);
      if (isNaN(offsetNum) || offsetNum < 0) {
        return c.json({
          success: false,
          error: 'Offset must be a non-negative integer',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }
    }

    return await next();
  } catch (error) {
    console.error('Error validating pagination params:', error);
    return c.json({
      success: false,
      error: 'Pagination validation failed',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// ======================== 訊息內容驗證 ========================

/**
 * 驗證創建訊息資料
 */
export async function validateCreateMessageData(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    let messageData: {
      conversationId?: string;
      content?: string;
      messageType?: string;
      senderType?: string;
      replyToMessageId?: string;
      metadata?: any;
    };

    try {
      messageData = await c.req.json();
    } catch (error) {
      return c.json({
        success: false,
        error: 'Invalid JSON data',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const errors: string[] = [];

    // 驗證 conversationId
    if (!messageData.conversationId) {
      errors.push('conversationId is required');
    } else {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(messageData.conversationId)) {
        errors.push('conversationId must be a valid UUID');
      }
    }

    // 驗證 content
    if (!messageData.content) {
      errors.push('content is required');
    } else if (!isValidMessageContent(messageData.content.trim())) {
      const { minLength, maxLength } = DEFAULT_MESSAGE_VALIDATION.content;
      errors.push(`content length must be between ${minLength} and ${maxLength} characters`);
    }

    // 驗證 messageType
    if (messageData.messageType && !isValidMessageType(messageData.messageType)) {
      errors.push('messageType must be one of: text, image, video, audio, file, sticker, location');
    }

    // 驗證 senderType
    if (messageData.senderType && !isValidSenderType(messageData.senderType)) {
      errors.push('senderType must be one of: customer, agent, system');
    }

    // 驗證 replyToMessageId — format check (sync)
    if (messageData.replyToMessageId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const msgPrefixRegex = /^msg_\d+_[a-z0-9]+$/;
      if (!uuidRegex.test(messageData.replyToMessageId) && !msgPrefixRegex.test(messageData.replyToMessageId)) {
        errors.push('replyToMessageId must be a valid message ID format');
      }
    }

    // Return format errors before doing async DB checks
    if (errors.length > 0) {
      return c.json({
        success: false,
        error: 'Message data validation failed',
        details: errors,
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 驗證 replyToMessageId — existence check (async, requires DB)
    if (messageData.replyToMessageId && messageData.conversationId) {
      const replyValidation = await validateReplyToMessageId(
        c.env.DB,
        messageData.replyToMessageId,
        messageData.conversationId
      );
      if (!replyValidation.valid) {
        errors.push(replyValidation.error || 'Referenced message does not exist');
      }
    }

    if (errors.length > 0) {
      return c.json({
        success: false,
        error: 'Message data validation failed',
        details: errors,
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    return await next();
  } catch (error) {
    console.error('Error validating create message data:', error);
    return c.json({
      success: false,
      error: 'Message data validation failed',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

/**
 * 驗證更新訊息資料
 */
export async function validateUpdateMessageData(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
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
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const errors: string[] = [];

    // 驗證 content
    if (updateData.content !== undefined) {
      if (!updateData.content || !isValidMessageContent(updateData.content.trim())) {
        const { minLength, maxLength } = DEFAULT_MESSAGE_VALIDATION.content;
        errors.push(`content length must be between ${minLength} and ${maxLength} characters`);
      }
    }

    // 至少要有一個可更新的欄位
    if (updateData.content === undefined && updateData.metadata === undefined) {
      errors.push('At least one field (content or metadata) must be provided for update');
    }

    if (errors.length > 0) {
      return c.json({
        success: false,
        error: 'Update data validation failed',
        details: errors,
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    return await next();
  } catch (error) {
    console.error('Error validating update message data:', error);
    return c.json({
      success: false,
      error: 'Update data validation failed',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// ======================== 延遲發送驗證 ========================

/**
 * 驗證延遲發送請求
 */
export async function validateDelayedSendData(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    let requestData: DelayedSendRequest;

    try {
      requestData = await c.req.json();
    } catch (error) {
      return c.json({
        success: false,
        error: 'Invalid JSON data',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const errors: string[] = [];

    // 驗證 conversationId
    if (!requestData.conversationId) {
      errors.push('conversationId is required');
    }

    // 驗證 content
    if (!requestData.content) {
      errors.push('content is required');
    } else if (!isValidMessageContent(requestData.content)) {
      const { minLength, maxLength } = DEFAULT_MESSAGE_VALIDATION.content;
      errors.push(`content length must be between ${minLength} and ${maxLength} characters`);
    }

    // 驗證 delaySeconds
    if (requestData.delaySeconds === undefined) {
      errors.push('delaySeconds is required');
    } else if (!isValidDelaySeconds(requestData.delaySeconds)) {
      const { minDelaySeconds, maxDelaySeconds } = DEFAULT_MESSAGE_VALIDATION.delayedSend;
      errors.push(`delaySeconds must be between ${minDelaySeconds} and ${maxDelaySeconds}`);
    }

    // 驗證 messageType
    if (requestData.messageType && !isValidMessageType(requestData.messageType)) {
      errors.push('messageType must be one of: text, image, video, audio, file, sticker, location');
    }

    // 驗證 platform
    if (requestData.platform && !isSupportedPlatform(requestData.platform)) {
      errors.push('platform must be one of: line, facebook, webchat');
    }

    if (errors.length > 0) {
      return c.json({
        success: false,
        error: 'Delayed send data validation failed',
        details: errors,
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    return await next();
  } catch (error) {
    console.error('Error validating delayed send data:', error);
    return c.json({
      success: false,
      error: 'Delayed send data validation failed',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// ======================== 召回驗證 ========================

/**
 * 驗證召回請求
 */
export async function validateRecallRequest(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    let recallData: RecallRequest;

    try {
      recallData = await c.req.json();
    } catch (error) {
      // 召回請求可以沒有 body（只需要 messageId 從路由取得）
      recallData = { messageId: c.req.param('id') || '' };
    }

    const errors: string[] = [];

    // 驗證 messageId
    if (!recallData.messageId) {
      errors.push('messageId is required');
    } else {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(recallData.messageId)) {
        errors.push('messageId must be a valid UUID');
      }
    }

    // 驗證 reason（可選）
    if (recallData.reason && recallData.reason.length > 500) {
      errors.push('reason cannot exceed 500 characters');
    }

    if (errors.length > 0) {
      return c.json({
        success: false,
        error: 'Recall request validation failed',
        details: errors,
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    return await next();
  } catch (error) {
    console.error('Error validating recall request:', error);
    return c.json({
      success: false,
      error: 'Recall request validation failed',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// ======================== 批量操作驗證 ========================

/**
 * 驗證批量發送請求
 */
export async function validateBatchSendData(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    let batchData: BatchSendRequest;

    try {
      batchData = await c.req.json();
    } catch (error) {
      return c.json({
        success: false,
        error: 'Invalid JSON data',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const errors: string[] = [];

    // 驗證 messages 陣列
    if (!batchData.messages || !Array.isArray(batchData.messages)) {
      errors.push('messages must be an array');
    } else {
      const { maxBatchSize } = DEFAULT_MESSAGE_VALIDATION.batch;

      if (batchData.messages.length === 0) {
        errors.push('messages array cannot be empty');
      } else if (batchData.messages.length > maxBatchSize) {
        errors.push(`batch size cannot exceed ${maxBatchSize} messages`);
      } else {
        // 驗證每一個訊息
        batchData.messages.forEach((message, index) => {
          if (!message.conversationId) {
            errors.push(`messages[${index}].conversationId is required`);
          }

          if (!message.content) {
            errors.push(`messages[${index}].content is required`);
          } else if (!isValidMessageContent(message.content)) {
            errors.push(`messages[${index}].content length is invalid`);
          }

          if (message.messageType && !isValidMessageType(message.messageType)) {
            errors.push(`messages[${index}].messageType is invalid`);
          }

          if (message.delaySeconds !== undefined && !isValidDelaySeconds(message.delaySeconds)) {
            errors.push(`messages[${index}].delaySeconds is invalid`);
          }
        });
      }
    }

    if (errors.length > 0) {
      return c.json({
        success: false,
        error: 'Batch send data validation failed',
        details: errors,
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    return await next();
  } catch (error) {
    console.error('Error validating batch send data:', error);
    return c.json({
      success: false,
      error: 'Batch send data validation failed',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// ======================== 搜尋驗證 ========================

/**
 * 驗證搜尋查詢參數
 */
export async function validateSearchQuery(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const content = c.req.query('content');
    const senderType = c.req.query('senderType');
    const messageType = c.req.query('messageType');
    const dateFrom = c.req.query('dateFrom');
    const dateTo = c.req.query('dateTo');

    const errors: string[] = [];

    // 驗證 content
    if (content && (content.length < 1 || content.length > 1000)) {
      errors.push('search content must be between 1 and 1000 characters');
    }

    // 驗證 senderType
    if (senderType && !isValidSenderType(senderType)) {
      errors.push('senderType must be one of: customer, agent, system');
    }

    // 驗證 messageType
    if (messageType && !isValidMessageType(messageType)) {
      errors.push('messageType must be one of: text, image, video, audio, file, sticker, location');
    }

    // 驗證日期格式
    if (dateFrom) {
      const date = new Date(dateFrom);
      if (isNaN(date.getTime())) {
        errors.push('dateFrom must be a valid ISO date string');
      }
    }

    if (dateTo) {
      const date = new Date(dateTo);
      if (isNaN(date.getTime())) {
        errors.push('dateTo must be a valid ISO date string');
      }
    }

    // 驗證日期範圍
    if (dateFrom && dateTo) {
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      if (from > to) {
        errors.push('dateFrom cannot be later than dateTo');
      }
    }

    if (errors.length > 0) {
      return c.json({
        success: false,
        error: 'Search query validation failed',
        details: errors,
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    return await next();
  } catch (error) {
    console.error('Error validating search query:', error);
    return c.json({
      success: false,
      error: 'Search query validation failed',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}