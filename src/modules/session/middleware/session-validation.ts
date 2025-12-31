// Session 模組資料驗證中間件
// Session module data validation middleware

import type { Context, Next } from 'hono';
import type { Bindings } from '@/types';
import type {
  CreateSessionData,
  UpdateSessionData,
  SessionListQuery,
  SessionSearchQuery,
  BatchSessionOperation,
  ConversationSession
} from '../types/session-types';
import { HTTP_STATUS } from '@/constants/http-status';

// ======================== 基礎驗證函數 ========================

/**
 * 清理字符串，移除潛在的XSS攻擊字符
 */
export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') return '';

  return input
    .trim()
    .replace(/[<>]/g, '') // 移除尖括號
    .replace(/javascript:/gi, '') // 移除 javascript: 協議
    .replace(/on\w+\s*=\s*[^\s>]*/gi, '') // 移除事件處理器（包含值）
    .substring(0, 1000); // 限制長度
}

/**
 * 驗證數值範圍
 */
export function validateNumberRange(value: any, min: number, max: number): number | null {
  const num = parseInt(value);
  if (isNaN(num) || num < min || num > max) {
    return null;
  }
  return num;
}

/**
 * 驗證 UUID 格式（支持 UUID v1-v5）
 */
export function validateUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * 驗證日期格式 (ISO 8601)
 */
export function validateISODate(dateString: string): boolean {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  if (!isoDateRegex.test(dateString)) return false;

  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

// ======================== 請求大小驗證 ========================

/**
 * 驗證請求大小
 */
export async function validateRequestSize(c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> {
  try {
    const contentLength = c.req.header('content-length');

    if (contentLength && parseInt(contentLength) > 1048576) { // 1MB limit
      return c.json({
        success: false,
        error: 'Request size too large (max 1MB)',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.PAYLOAD_TOO_LARGE);
    }

    await next();
  } catch (error) {
    console.error('Request size validation error:', error);
    return c.json({
      success: false,
      error: 'Request validation failed',
      timestamp: new Date().toISOString()
    }, HTTP_STATUS.BAD_REQUEST);
  }
}

/**
 * 驗證速率限制
 */
export async function validateRateLimit(c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> {
  try {
    // TODO: 實現速率限制邏輯
    // 可以使用 Cloudflare KV 存儲請求計數
    await next();
  } catch (error) {
    console.error('Rate limit validation error:', error);
    return c.json({
      success: false,
      error: 'Rate limit check failed',
      timestamp: new Date().toISOString()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// ======================== 會話ID驗證 ========================

/**
 * 驗證會話ID參數
 */
export async function validateSessionId(c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> {
  try {
    const sessionId = c.req.param('sessionId');

    if (!sessionId) {
      return c.json({
        success: false,
        error: 'Session ID is required',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!validateUUID(sessionId)) {
      return c.json({
        success: false,
        error: 'Invalid session ID format',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    c.set('sessionId', sessionId);
    await next();
  } catch (error) {
    console.error('Session ID validation error:', error);
    return c.json({
      success: false,
      error: 'Session ID validation failed',
      timestamp: new Date().toISOString()
    }, HTTP_STATUS.BAD_REQUEST);
  }
}

/**
 * 驗證對話ID參數
 */
export async function validateConversationId(c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> {
  try {
    const conversationId = c.req.param('conversationId');

    if (!conversationId) {
      return c.json({
        success: false,
        error: 'Conversation ID is required',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!validateUUID(conversationId)) {
      return c.json({
        success: false,
        error: 'Invalid conversation ID format',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    await next();
  } catch (error) {
    console.error('Conversation ID validation error:', error);
    return c.json({
      success: false,
      error: 'Conversation ID validation failed',
      timestamp: new Date().toISOString()
    }, HTTP_STATUS.BAD_REQUEST);
  }
}

// ======================== 會話資料驗證 ========================

/**
 * 驗證會話創建資料
 */
export async function validateCreateSessionData(c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> {
  try {
    const body = await c.req.json() as CreateSessionData;

    // 必填欄位檢查
    if (!body.conversationId) {
      return c.json({
        success: false,
        error: 'conversationId is required',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!validateUUID(body.conversationId)) {
      return c.json({
        success: false,
        error: 'Invalid conversationId format',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!body.senderType || !['customer', 'agent', 'system'].includes(body.senderType)) {
      return c.json({
        success: false,
        error: 'senderType must be one of: customer, agent, system',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 可選欄位檢查
    if (body.sessionType && !['continuous', 'scheduled', 'support', 'marketing'].includes(body.sessionType)) {
      return c.json({
        success: false,
        error: 'sessionType must be one of: continuous, scheduled, support, marketing',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (body.priority && !['low', 'medium', 'high', 'urgent'].includes(body.priority)) {
      return c.json({
        success: false,
        error: 'priority must be one of: low, medium, high, urgent',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 清理和驗證字符串欄位
    if (body.topic) {
      body.topic = sanitizeString(body.topic);
      if (body.topic.length > 200) {
        return c.json({
          success: false,
          error: 'topic cannot exceed 200 characters',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.BAD_REQUEST);
      }
    }

    if (body.messageContent) {
      body.messageContent = sanitizeString(body.messageContent);
      if (body.messageContent.length > 2000) {
        return c.json({
          success: false,
          error: 'messageContent cannot exceed 2000 characters',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.BAD_REQUEST);
      }
    }

    // 驗證標籤
    if (body.tags) {
      if (!Array.isArray(body.tags) || body.tags.length > 10) {
        return c.json({
          success: false,
          error: 'tags must be an array with maximum 10 items',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.BAD_REQUEST);
      }

      body.tags = body.tags.map(tag => sanitizeString(tag)).filter(tag => tag.length > 0);
    }

    c.set('createSessionData', body);
    await next();
  } catch (error) {
    console.error('Create session data validation error:', error);
    return c.json({
      success: false,
      error: 'Invalid JSON data or validation failed',
      timestamp: new Date().toISOString()
    }, HTTP_STATUS.BAD_REQUEST);
  }
}

/**
 * 驗證會話更新資料
 */
export async function validateUpdateSessionData(c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> {
  try {
    const body = await c.req.json() as UpdateSessionData;

    // 至少需要一個要更新的欄位
    if (Object.keys(body).length === 0) {
      return c.json({
        success: false,
        error: 'At least one field is required for update',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 驗證可選欄位
    if (body.sessionType && !['continuous', 'scheduled', 'support', 'marketing'].includes(body.sessionType)) {
      return c.json({
        success: false,
        error: 'sessionType must be one of: continuous, scheduled, support, marketing',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (body.priority && !['low', 'medium', 'high', 'urgent'].includes(body.priority)) {
      return c.json({
        success: false,
        error: 'priority must be one of: low, medium, high, urgent',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (body.sentiment && !['positive', 'negative', 'neutral'].includes(body.sentiment)) {
      return c.json({
        success: false,
        error: 'sentiment must be one of: positive, negative, neutral',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (typeof body.isActive !== 'undefined' && typeof body.isActive !== 'boolean') {
      return c.json({
        success: false,
        error: 'isActive must be a boolean',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 清理字符串欄位
    if (body.topic !== undefined) {
      if (body.topic !== null) {
        body.topic = sanitizeString(body.topic);
        if (body.topic.length > 200) {
          return c.json({
            success: false,
            error: 'topic cannot exceed 200 characters',
            timestamp: new Date().toISOString()
          }, HTTP_STATUS.BAD_REQUEST);
        }
      }
    }

    // 驗證結束時間
    if (body.endTime !== undefined) {
      if (body.endTime !== null && !validateISODate(body.endTime)) {
        return c.json({
          success: false,
          error: 'endTime must be a valid ISO date string',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.BAD_REQUEST);
      }
    }

    // 驗證標籤
    if (body.tags) {
      if (!Array.isArray(body.tags) || body.tags.length > 10) {
        return c.json({
          success: false,
          error: 'tags must be an array with maximum 10 items',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.BAD_REQUEST);
      }

      body.tags = body.tags.map(tag => sanitizeString(tag)).filter(tag => tag.length > 0);
    }

    c.set('updateSessionData', body);
    await next();
  } catch (error) {
    console.error('Update session data validation error:', error);
    return c.json({
      success: false,
      error: 'Invalid JSON data or validation failed',
      timestamp: new Date().toISOString()
    }, HTTP_STATUS.BAD_REQUEST);
  }
}

// ======================== 查詢參數驗證 ========================

/**
 * 驗證會話列表查詢參數
 */
export async function validateSessionListQuery(c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> {
  try {
    const query: SessionListQuery = {};

    // 解析查詢參數
    const conversationId = c.req.query('conversationId');
    if (conversationId) {
      if (!validateUUID(conversationId)) {
        return c.json({
          success: false,
          error: 'Invalid conversationId format',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.BAD_REQUEST);
      }
      query.conversationId = conversationId;
    }

    const isActive = c.req.query('isActive');
    if (isActive !== undefined) {
      if (isActive !== 'true' && isActive !== 'false') {
        return c.json({
          success: false,
          error: 'isActive must be true or false',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.BAD_REQUEST);
      }
      query.isActive = isActive === 'true';
    }

    const sessionType = c.req.query('sessionType') as ConversationSession['sessionType'];
    if (sessionType && !['continuous', 'scheduled', 'support', 'marketing'].includes(sessionType)) {
      return c.json({
        success: false,
        error: 'sessionType must be one of: continuous, scheduled, support, marketing',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.BAD_REQUEST);
    }
    if (sessionType) query.sessionType = sessionType;

    const priority = c.req.query('priority') as ConversationSession['priority'];
    if (priority && !['low', 'medium', 'high', 'urgent'].includes(priority)) {
      return c.json({
        success: false,
        error: 'priority must be one of: low, medium, high, urgent',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.BAD_REQUEST);
    }
    if (priority) query.priority = priority;

    const sentiment = c.req.query('sentiment') as ConversationSession['sentiment'];
    if (sentiment && !['positive', 'negative', 'neutral'].includes(sentiment)) {
      return c.json({
        success: false,
        error: 'sentiment must be one of: positive, negative, neutral',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.BAD_REQUEST);
    }
    if (sentiment) query.sentiment = sentiment;

    // 日期驗證
    const startDate = c.req.query('startDate');
    if (startDate) {
      if (!validateISODate(startDate)) {
        return c.json({
          success: false,
          error: 'startDate must be a valid ISO date string',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.BAD_REQUEST);
      }
      query.startDate = startDate;
    }

    const endDate = c.req.query('endDate');
    if (endDate) {
      if (!validateISODate(endDate)) {
        return c.json({
          success: false,
          error: 'endDate must be a valid ISO date string',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.BAD_REQUEST);
      }
      query.endDate = endDate;
    }

    // 字符串參數清理
    const topic = c.req.query('topic');
    if (topic) {
      query.topic = sanitizeString(topic);
    }

    const tag = c.req.query('tag');
    if (tag) {
      query.tag = sanitizeString(tag);
    }

    // 分頁參數
    const page = validateNumberRange(c.req.query('page') || '1', 1, 1000);
    const pageSize = validateNumberRange(c.req.query('pageSize') || '20', 1, 100);

    if (!page) {
      return c.json({
        success: false,
        error: 'page must be between 1 and 1000',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!pageSize) {
      return c.json({
        success: false,
        error: 'pageSize must be between 1 and 100',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    query.page = page;
    query.pageSize = pageSize;

    c.set('sessionQuery', query);
    await next();
  } catch (error) {
    console.error('Session list query validation error:', error);
    return c.json({
      success: false,
      error: 'Query validation failed',
      timestamp: new Date().toISOString()
    }, HTTP_STATUS.BAD_REQUEST);
  }
}

/**
 * 驗證會話搜尋查詢參數
 */
export async function validateSessionSearchQuery(c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> {
  try {
    const query: SessionSearchQuery = {
      query: ''
    };

    const searchQuery = c.req.query('query');
    if (!searchQuery) {
      return c.json({
        success: false,
        error: 'query parameter is required',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    query.query = sanitizeString(searchQuery);
    if (query.query.length < 2) {
      return c.json({
        success: false,
        error: 'query must be at least 2 characters',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const conversationId = c.req.query('conversationId');
    if (conversationId) {
      if (!validateUUID(conversationId)) {
        return c.json({
          success: false,
          error: 'Invalid conversationId format',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.BAD_REQUEST);
      }
      query.conversationId = conversationId;
    }

    const sessionType = c.req.query('sessionType') as ConversationSession['sessionType'];
    if (sessionType && !['continuous', 'scheduled', 'support', 'marketing'].includes(sessionType)) {
      return c.json({
        success: false,
        error: 'sessionType must be one of: continuous, scheduled, support, marketing',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.BAD_REQUEST);
    }
    if (sessionType) query.sessionType = sessionType;

    const limit = validateNumberRange(c.req.query('limit') || '20', 1, 100);
    if (!limit) {
      return c.json({
        success: false,
        error: 'limit must be between 1 and 100',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.BAD_REQUEST);
    }
    query.limit = limit;

    c.set('sessionSearchQuery', query);
    await next();
  } catch (error) {
    console.error('Session search query validation error:', error);
    return c.json({
      success: false,
      error: 'Search query validation failed',
      timestamp: new Date().toISOString()
    }, HTTP_STATUS.BAD_REQUEST);
  }
}

// ======================== 批量操作驗證 ========================

/**
 * 驗證批量會話操作資料
 */
export async function validateBatchSessionOperation(c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> {
  try {
    const body = await c.req.json() as BatchSessionOperation;

    if (!body.sessionIds || !Array.isArray(body.sessionIds) || body.sessionIds.length === 0) {
      return c.json({
        success: false,
        error: 'sessionIds must be a non-empty array',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (body.sessionIds.length > 100) {
      return c.json({
        success: false,
        error: 'Cannot process more than 100 sessions at once',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 驗證所有會話ID格式
    for (const sessionId of body.sessionIds) {
      if (!validateUUID(sessionId)) {
        return c.json({
          success: false,
          error: `Invalid session ID format: ${sessionId}`,
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.BAD_REQUEST);
      }
    }

    if (!['close', 'reopen', 'update_priority', 'add_tags', 'remove_tags', 'delete'].includes(body.action)) {
      return c.json({
        success: false,
        error: 'action must be one of: close, reopen, update_priority, add_tags, remove_tags, delete',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 驗證操作相關數據
    if (['update_priority', 'add_tags', 'remove_tags'].includes(body.action)) {
      if (!body.data) {
        return c.json({
          success: false,
          error: `data is required for action: ${body.action}`,
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.BAD_REQUEST);
      }

      if (body.action === 'update_priority' && !body.data.priority) {
        return c.json({
          success: false,
          error: 'priority is required in data for update_priority action',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.BAD_REQUEST);
      }

      if (['add_tags', 'remove_tags'].includes(body.action) && !body.data.tags) {
        return c.json({
          success: false,
          error: 'tags are required in data for tag operations',
          timestamp: new Date().toISOString()
        }, HTTP_STATUS.BAD_REQUEST);
      }
    }

    c.set('batchOperation', body);
    await next();
  } catch (error) {
    console.error('Batch operation validation error:', error);
    return c.json({
      success: false,
      error: 'Invalid JSON data or validation failed',
      timestamp: new Date().toISOString()
    }, HTTP_STATUS.BAD_REQUEST);
  }
}