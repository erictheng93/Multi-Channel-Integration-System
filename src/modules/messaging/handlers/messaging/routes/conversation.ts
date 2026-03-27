// Messaging Conversation Routes
// 對話訊息列表端點

import { Hono } from 'hono';
import { eq, and, desc, count } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import type { Bindings } from '@/types';
import { messages, conversations, customers, agents } from '@/db/schema';
import { jwtAuth } from '@/middleware/auth';
import {
  successResponse,
  errorResponse,
  badRequestResponse,
  notFoundResponse
} from '@/utils/api-response';

const conversationRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * 獲取對話訊息列表
 * GET /api/messages/conversation/:conversationId
 */
conversationRoutes.get('/conversation/:conversationId', jwtAuth, async (c) => {
  try {
    const conversationId = c.req.param('conversationId');

    // 取得分頁參數
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '20', 10)));
    const offset = (page - 1) * pageSize;

    // 取得過濾參數
    const messageType = c.req.query('messageType');
    const senderType = c.req.query('senderType');
    const includeRecalled = c.req.query('includeRecalled') === 'true';

    if (!conversationId) {
      return badRequestResponse(c, 'Conversation ID is required');
    }

    const db = createDbClient(c.env.DB);

    // 檢查對話是否存在
    const conversation = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get();

    if (!conversation) {
      return notFoundResponse(c, 'Conversation not found');
    }

    // 構建查詢條件
    const whereConditions: any[] = [eq(messages.conversationId, conversationId)];

    if (!includeRecalled) {
      whereConditions.push(eq(messages.isRecalled, false));
    }

    if (messageType) {
      whereConditions.push(eq(messages.messageType, messageType));
    }

    if (senderType) {
      whereConditions.push(eq(messages.senderType, senderType));
    }

    // 獲取訊息總數
    const totalResult = await db
      .select({ count: count() })
      .from(messages)
      .where(and(...whereConditions))
      .get();

    const total = totalResult?.count || 0;

    // 獲取分頁訊息列表
    const messageList = await db
      .select({
        // 訊息欄位
        id: messages.id,
        conversationId: messages.conversationId,
        senderType: messages.senderType,
        customerSenderId: messages.customerSenderId,
        agentSenderId: messages.agentSenderId,
        content: messages.content,
        messageType: messages.messageType,
        isRecalled: messages.isRecalled,
        recalledAt: messages.recalledAt,
        isSent: messages.isSent,
        sentAt: messages.sentAt,
        deliveryStatus: messages.deliveryStatus,
        replyToMessageId: messages.replyToMessageId,
        threadId: messages.threadId,
        sessionId: messages.sessionId,
        sessionSequence: messages.sessionSequence,
        metadata: messages.metadata,
        storedSenderName: messages.senderName, // 持久化的發送者名稱快照
        createdAt: messages.createdAt,
        // 發送者資訊 (fallback for old messages)
        customerName: customers.displayName,
        customerPlatform: customers.platform,
        agentName: agents.displayName,
        agentRole: agents.role
      })
      .from(messages)
      .leftJoin(customers, eq(messages.customerSenderId, customers.id))
      .leftJoin(agents, eq(messages.agentSenderId, agents.id))
      .where(and(...whereConditions))
      .orderBy(desc(messages.createdAt))
      .limit(pageSize)
      .offset(offset);

    // 格式化回應數據
    const formattedMessages = messageList.map(msg => ({
      id: msg.id,
      conversationId: msg.conversationId,
      senderType: msg.senderType,
      // 發送者名稱：優先使用持久化快照，回退到 JOIN 查詢（相容舊訊息）
      senderName: msg.storedSenderName
        || (msg.senderType === 'agent' ? msg.agentName : msg.customerName)
        || null,
      senderInfo: msg.senderType === 'agent' ? {
        id: msg.agentSenderId,
        name: msg.agentName,
        role: msg.agentRole
      } : msg.senderType === 'customer' ? {
        id: msg.customerSenderId,
        name: msg.customerName,
        platform: msg.customerPlatform
      } : null,
      content: msg.content,
      messageType: msg.messageType,
      isRecalled: Boolean(msg.isRecalled),
      recalledAt: msg.recalledAt,
      isSent: Boolean(msg.isSent),
      sentAt: msg.sentAt,
      deliveryStatus: msg.deliveryStatus,
      replyToMessageId: msg.replyToMessageId,
      threadId: msg.threadId,
      sessionId: msg.sessionId,
      sessionSequence: msg.sessionSequence,
      metadata: msg.metadata ? JSON.parse(msg.metadata) : null,
      createdAt: msg.createdAt
    }));

    const totalPages = Math.ceil(total / pageSize);

    return successResponse(c, {
      messages: formattedMessages,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasMore: page < totalPages
      },
      filters: {
        messageType,
        senderType,
        includeRecalled
      }
    });

  } catch (error) {
    console.error('Get conversation messages error:', error);
    return errorResponse(c, error instanceof Error ? error.message : 'Failed to get conversation messages', 500);
  }
});

export default conversationRoutes;
