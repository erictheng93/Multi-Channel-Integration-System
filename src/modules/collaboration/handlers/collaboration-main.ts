// Collaboration Main Handler
// 協作模組的統一 API 處理器

import { Hono } from 'hono';
import type { Context } from 'hono';
import { collaboration } from '@modules/collaboration/services/collaboration-manager';
import type { Bindings, JWTPayload } from '@/types';
import {
  successResponse,
  errorResponse,
  handleApiError
} from '@/utils/api-response';
import { requireIntId, getValidatedParam } from '@/middleware/param-validator';
import { nowISO } from '@/utils/timestamp'

const app = new Hono<{ Bindings: Bindings }>();

/**
 * 獲取對話的協作狀態
 * GET /api/collaboration/conversations/:id/state
 */
app.get('/conversations/:id/state', requireIntId(), async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const conversationId = getValidatedParam<number>(c, 'id');
    const protocol = c.req.query('protocol') as 'websocket' | 'http' | undefined;
    const state = await collaboration.getConversationState(conversationId, protocol);

    return successResponse(c, state, 'Conversation state retrieved successfully');
  } catch (error) {
    return handleApiError(error, c);
  }
});

/**
 * 獲取對話的查看者列表
 * GET /api/collaboration/conversations/:id/viewers
 */
app.get('/conversations/:id/viewers', requireIntId(), async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const conversationId = getValidatedParam<number>(c, 'id');
    const protocol = c.req.query('protocol') as 'websocket' | 'http' | undefined;
    const viewers = await collaboration.getConversationViewers(conversationId, protocol);

    return successResponse(c, { viewers }, 'Viewers retrieved successfully');
  } catch (error) {
    return handleApiError(error, c);
  }
});

/**
 * 加入對話
 * POST /api/collaboration/conversations/:id/join
 */
app.post('/conversations/:id/join', requireIntId(), async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const conversationId = getValidatedParam<number>(c, 'id');
    const payload = c.get('jwtPayload') as JWTPayload;
    const body = await c.req.json().catch(() => ({}));
    const protocol = body.protocol as 'websocket' | 'http' | undefined;

    await collaboration.joinConversation({
      conversationId,
      userId: Number(payload.userId),
      protocol,
      metadata: {
        username: payload.username,
        displayName: payload.displayName,
        role: payload.role
      }
    });

    return successResponse(c, null, 'Joined conversation successfully');
  } catch (error) {
    return handleApiError(error, c);
  }
});

/**
 * 離開對話
 * POST /api/collaboration/conversations/:id/leave
 */
app.post('/conversations/:id/leave', requireIntId(), async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const conversationId = getValidatedParam<number>(c, 'id');
    const payload = c.get('jwtPayload') as JWTPayload;
    await collaboration.leaveConversation({
      conversationId,
      userId: Number(payload.userId)
    });

    return successResponse(c, null, 'Left conversation successfully');
  } catch (error) {
    return handleApiError(error, c);
  }
});

/**
 * 發送輸入狀態
 * POST /api/collaboration/typing
 */
app.post('/typing', async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const payload = c.get('jwtPayload') as JWTPayload;
    const body = await c.req.json();

    const { conversationId, status } = body;

    if (!conversationId || !status) {
      return errorResponse(c, 'Missing required fields: conversationId, status', 400);
    }

    if (status !== 'start' && status !== 'stop') {
      return errorResponse(c, 'Invalid status. Must be "start" or "stop"', 400);
    }

    await collaboration.sendTyping({
      conversationId: parseInt(conversationId),
      userId: Number(payload.userId),
      status
    });

    return successResponse(c, null, `Typing ${status} sent successfully`);
  } catch (error) {
    return handleApiError(error, c);
  }
});

/**
 * 更新在線狀態
 * POST /api/collaboration/presence
 */
app.post('/presence', async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const payload = c.get('jwtPayload') as JWTPayload;
    const body = await c.req.json();

    const { status, currentConversation, metadata } = body;

    if (!status) {
      return errorResponse(c, 'Missing required field: status', 400);
    }

    const validStatuses = ['online', 'away', 'busy', 'offline'];
    if (!validStatuses.includes(status)) {
      return errorResponse(c, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    await collaboration.updatePresence({
      userId: Number(payload.userId),
      status,
      currentConversation: currentConversation ? parseInt(currentConversation) : undefined,
      metadata
    });

    return successResponse(c, null, 'Presence updated successfully');
  } catch (error) {
    return handleApiError(error, c);
  }
});

/**
 * 獲取協作統計
 * GET /api/collaboration/stats
 */
app.get('/stats', async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const protocol = c.req.query('protocol') as 'websocket' | 'http' | undefined;
    const stats = await collaboration.getStats(protocol);

    return successResponse(c, stats, 'Statistics retrieved successfully');
  } catch (error) {
    return handleApiError(error, c);
  }
});

/**
 * 清理過期狀態
 * POST /api/collaboration/cleanup
 */
app.post('/cleanup', async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const payload = c.get('jwtPayload') as JWTPayload;

    // 只有 admin 可以執行清理
    if (payload.role !== 'admin') {
      return errorResponse(c, 'Insufficient permissions', 403);
    }

    const cleaned = await collaboration.cleanup();

    return successResponse(c, { cleanedCount: cleaned }, 'Cleanup completed successfully');
  } catch (error) {
    return handleApiError(error, c);
  }
});

/**
 * 健康檢查
 * GET /api/collaboration/health
 */
app.get('/health', async (c: Context<{ Bindings: Bindings }>) => {
  try {
    // 注意：isInitialized() 依賴於中間件初始化
    // 如果訪問此端點時模組尚未初始化，status 將顯示 not_initialized
    // 這是正常的，因為初始化是延遲執行的（在第一個請求的中間件中）
    const isInitialized = collaboration.isInitialized();
    const config = collaboration.getConfig();
    const protocols = collaboration.getAvailableProtocols();

    return successResponse(c, {
      status: isInitialized ? 'healthy' : 'not_initialized',
      config: {
        defaultProtocol: config.defaultProtocol,
        enableWebSocket: config.enableWebSocket
      },
      availableProtocols: protocols,
      timestamp: nowISO(),
      note: isInitialized ? undefined : 'Module will initialize on first business request. Try accessing any conversation endpoint or refresh this page after a few seconds.'
    }, 'Health check completed');
  } catch (error) {
    return errorResponse(c, 'Health check failed', 500);
  }
});

export default app;
