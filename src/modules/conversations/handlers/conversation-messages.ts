// 對話訊息處理器
// Handles: POST /:id/attachments, POST /:id/messages, GET /:id/messages

import { Hono } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import { globalErrorHandler } from '@/core/error-handler';
import { eq, desc, and, count, inArray, isNull, gte, sql } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { conversations, messages, customers, agents, fileAttachments } from '@/db/schema';
import type { Bindings, JWTPayload } from '@/types';
import { PermissionService } from '@/services/permission-service';
import { jwtAuth } from '@/middleware/auth';
import { WebSocketBroadcastService } from '@/services/websocket-broadcast-service';
import { MessageRequestService, MessageService } from '@modules/conversations/services/message-service';
import { MessageRecallService } from '@modules/messaging/services/message-recall-service';
import { ActivityService, ACTIVITY_ACTIONS, RESOURCE_TYPES } from '@modules/activities';
import { errorResponse } from '@/utils/api-response';
import { createContextLogger } from '@/utils/logger';
import { nowISO, nowMs } from '@/utils/timestamp';
import {
  getSignedFileUrl,
  getSignedDownloadUrl,
  PERSISTENT_ATTACHMENT_URL_TTL_SECONDS
} from '@/utils/file-url';
import { conversationMessageContracts, type ContractResponse } from '@shared/api-contracts';
import { contractJson } from '@/utils/api-contract-response';
import type { DeliveryStatus, MessageType } from '@shared/types/core';
import { getRecallWindowSeconds } from '@/services/recall-window-config';
import { cancelBufferedDelivery, scheduleOrDeliverNow } from '../services/buffered-send-scheduler';

/**
 * Resolve the customer platform of an outbound message from its stored
 * metadata (written by createPendingMessage). Unknown → null.
 */
const resolveMessagePlatform = (metadata: string | null): string | null => {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata) as Record<string, unknown>;
    return typeof parsed.platform === 'string' ? parsed.platform : null;
  } catch {
    return null;
  }
};

const log = createContextLogger('ConversationMessagesHandler');

const resolveAttachmentUrl = async (
  env: Bindings,
  fileUrl: string | null,
  r2Key: string | null
): Promise<string> => {
  if (!r2Key) {
    return fileUrl || '';
  }

  try {
    return await getSignedFileUrl(env, r2Key);
  } catch (error) {
    log.warn('Failed to sign attachment URL, fallback to stored value', {
      r2Key,
      error: error instanceof Error ? error.message : String(error)
    });
    return fileUrl || '';
  }
};

const conversationMessagesHandler = new Hono<{ Bindings: Bindings }>();

const escapeLikePattern = (value: string): string => value.replace(/[\\%_]/g, match => `\\${match}`);

type ConversationMessageContractRow = {
  id: string;
  conversationId: string;
  senderType: string;
  customerSenderId: number | null;
  agentSenderId: string | null;
  content: string;
  messageType: string;
  platformMessageId?: string | null;
  isSent?: boolean | number | null;
  deliveryStatus?: string | null;
  metadata?: string | null;
  sentAt?: string | null;
  recallDeadline?: string | null;
  recalledAt?: string | null;
  isRecalled?: boolean | number | null;
  createdAt?: string | null;
  customerName?: string | null;
  customerPlatform?: string | null;
  agentName?: string | null;
};

function parseReadBy(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function parseMessageMetadata(value: string | null | undefined): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function normalizeMessageType(value: string | null | undefined): MessageType {
  switch (value) {
    case 'image':
    case 'video':
    case 'audio':
    case 'file':
    case 'location':
    case 'sticker':
      return value;
    default:
      return 'text';
  }
}

function normalizeDeliveryStatus(value: string | null | undefined): DeliveryStatus | undefined {
  switch (value) {
    case 'pending':
    case 'buffered':
    case 'sending':
    case 'sent':
    case 'delivered':
    case 'failed':
      return value;
    default:
      return undefined;
  }
}

function toConversationMessageContract(row: ConversationMessageContractRow) {
  const createdAt = row.createdAt ? new Date(row.createdAt).getTime() : nowMs();
  const messageType = normalizeMessageType(row.messageType);

  return {
    id: row.id,
    conversationId: row.conversationId,
    senderType: row.senderType === 'customer' ? 'user' as const : row.senderType as 'agent' | 'system',
    senderId: row.senderType === 'customer'
      ? row.customerSenderId?.toString() || ''
      : row.agentSenderId || '',
    senderName: (row.senderType === 'customer' ? row.customerName : row.agentName) || undefined,
    content: row.content,
    mediaUrl: '',
    mediaType: messageType,
    messageType,
    platform: row.customerPlatform === 'facebook' ? 'facebook' as const : 'line' as const,
    timestamp: createdAt,
    createdAt,
    platformMessageId: row.platformMessageId ?? null,
    isSent: Boolean(row.isSent),
    deliveryStatus: normalizeDeliveryStatus(row.deliveryStatus),
    metadata: parseMessageMetadata(row.metadata),
    sentAt: row.sentAt,
    isRecalled: Boolean(row.isRecalled),
    recallDeadline: row.recallDeadline,
    recalledAt: row.recalledAt
  };
}

// 上傳附件（在消息發送之前）
conversationMessagesHandler.post('/:id/attachments', jwtAuth, async (c) => {
  try {
    const conversationId = c.req.param('id')!;
    const userPayload = c.get('jwtPayload') as JWTPayload;

    if (!conversationId) {
      return c.json({
        success: false,
        error: 'Conversation ID is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const db = createDbClient(c.env.DB);

    // 檢查對話是否存在 — fetch assignedTeamId for the F19 team-scope gate.
    const conversation = await db
      .select({
        id: conversations.id,
        assignedTeamId: conversations.assignedTeamId,
      })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get();

    if (!conversation) {
      return c.json({
        success: false,
        error: 'Conversation not found'
      }, HTTP_STATUS.NOT_FOUND);
    }

    // F19: enforce team scope on attachment upload, mirroring F5's POST
    // /api/messages and the sibling /:id/messages send handler. The
    // previous code only checked conversation existence — any agent could
    // upload a file into any conversation's R2 prefix and insert a
    // file_attachments row, enabling cross-team data injection when
    // combined with a message-send IDOR.
    const isAdmin = userPayload.role === 'admin';
    const assignedTeamId = conversation.assignedTeamId;
    const allowedTeams = userPayload.allowedTeamIds ?? [];
    const teamAllowed =
      isAdmin ||
      assignedTeamId === null ||
      assignedTeamId === undefined ||
      allowedTeams.includes(assignedTeamId);

    if (!teamAllowed) {
      return c.json({
        success: false,
        error: 'You do not have access to this conversation'
      }, HTTP_STATUS.FORBIDDEN);
    }

    // 解析 FormData
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    // 驗證文件
    if (!file || file.size === 0) {
      return c.json({
        success: false,
        error: 'No file provided'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 文件大小限制：10MB
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return c.json({
        success: false,
        error: 'File too large (max 10MB)'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 生成 R2 key
    const timestamp = nowMs();
    const randomStr = Math.random().toString(36).substr(2, 9);
    const fileExtension = file.name.split('.').pop() || 'bin';
    const r2Key = `attachments/${conversationId}/pending/${timestamp}_${randomStr}.${fileExtension}`;

    // 上傳到 R2
    try {
      const arrayBuffer = await file.arrayBuffer();
      await c.env.R2_BUCKET.put(r2Key, arrayBuffer, {
        httpMetadata: {
          contentType: file.type,
          cacheControl: 'public, max-age=604800'
        }
      });
    } catch (error) {
      log.error('R2 upload error', { error: error instanceof Error ? error.message : String(error) });
      return c.json({
        success: false,
        error: 'Failed to upload file to storage'
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    // Generate public URL via unified utility
    const fileUrl = await getSignedFileUrl(c.env, r2Key, PERSISTENT_ATTACHMENT_URL_TTL_SECONDS);
    log.debug('Upload generated proxy URL', { fileUrl });

    // 保存附件記錄到資料庫（messageId 為 null，等待消息創建時關聯）
    const attachmentId = `att_${timestamp}_${randomStr}`;

    await db.insert(fileAttachments).values({
      id: attachmentId,
      messageId: null, // Will be updated when message is sent
      conversationId, // Associate with conversation for tracking
      filename: file.name,
      mimeType: file.type,
      fileSize: file.size,
      fileUrl,
      r2Key,
      uploadStatus: 'completed', // Direct upload completed
      createdAt: nowISO()
    });

    return contractJson(c, conversationMessageContracts.uploadAttachment, {
      success: true,
      data: {
        attachmentId,
        url: fileUrl,
        filename: file.name,
        mimeType: file.type,
        size: file.size
      }
    } satisfies ContractResponse<typeof conversationMessageContracts.uploadAttachment>);
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// 發送訊息 - Simplified with extracted services
conversationMessagesHandler.post('/:id/messages', jwtAuth, async (c) => {
  // Phase 1 Emergency Debug Logging
  log.debug('MESSAGE HANDLER entry', {
    timestamp: nowISO(),
    conversationId: c.req.param('id'),
    method: c.req.method,
    path: c.req.path
  });

  try {
    log.debug('AUTH checking user context');
    const user = c.get('user');
    log.debug('AUTH user info', { userId: user?.id, role: user?.role, displayName: user?.displayName });

    // 1. Validate and parse request
    log.debug('PARSE starting request validation');
    const request = await MessageRequestService.validateAndParse(c);
    log.debug('PARSE request validated', { contentLength: request.content?.length, senderId: request.senderId });

    // 2. Check permissions
    log.debug('PERMISSION checking permissions');
    const hasPermission = await PermissionService.checkPermission(
      user.id,
      'message',
      'send',
      {
        userId: Number(user.id),
        role: user.role,
        resourceId: request.conversationId
      },
      c.env.DB
    );

    log.debug('PERMISSION check result', { hasPermission });

    if (!hasPermission) {
      log.warn('PERMISSION denied', { userId: user.id });
      return errorResponse(c, user.role === 'agent'
        ? '權限不足，您無權對此訊息進行任何操作。只有指派給您的對話或團隊負責人能夠回覆未指派的對話。'
        : 'Permission denied', 403);
    }

    // 3. Send message (Async Pattern)
    log.debug('SERVICE creating MessageService instance');
    const messageService = new MessageService(c.env);

    // Recall window: >0 buffers the message on the DelayedMessageScheduler DO
    // (recallable until the deadline); 0 keeps the legacy immediate path.
    const recallWindowSeconds = await getRecallWindowSeconds(c.env);

    log.debug('SERVICE creating pending message', { recallWindowSeconds });
    const result = await messageService.createPendingMessage(request, recallWindowSeconds);

    // 確保訊息已成功創建
    if (!result.messageId || !result.message) {
      throw new Error('Failed to create pending message: missing messageId or message data');
    }

    log.debug('SERVICE pending message created', { messageId: result.messageId });

    const deliveryPlan = await scheduleOrDeliverNow(c.env, {
      messageId: result.messageId,
      conversationId: request.conversationId,
      recallWindowSeconds,
      canBuffer: result.message.deliveryStatus === 'buffered'
    });

    const initialDeliveryStatus: DeliveryStatus = deliveryPlan.deliveryStatus;
    const initialRecallDeadline: string | null = deliveryPlan.recallDeadline;

    // 3.1 Broadcast Pending Message
    try {
      const broadcastService = new WebSocketBroadcastService(c.env);
      await broadcastService.broadcastMessageEvent({
        type: 'message_sent',
        conversationId: request.conversationId,
        messageId: result.messageId,
        agentId: request.senderId,
        data: {
          content: request.content,
          messageType: request.messageType,
          sender: {
            id: user.id,
            name: user.displayName,
            role: user.role
          },
          deliveryStatus: initialDeliveryStatus,
          recallDeadline: initialRecallDeadline,
          timestamp: nowISO()
        },
        priority: 'normal'
      });
    } catch (broadcastError) {
      log.warn('WEBSOCKET: Pending message broadcast failed', { error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError) });
    }

    // Deliver only after the pending-message broadcast above so a
    // message_updated event (from the background send) can never arrive
    // ahead of the message_sent event for the same messageId.
    if (deliveryPlan.needsImmediateDelivery) {
      c.executionCtx.waitUntil(
        messageService.processBackgroundSending(result.messageId!, request, user)
      );
    }

    // Phase B4: Unified Broadcast for Conversation List & Detail Updates
    // Uses WebSocketBroadcastService.broadcastNewMessage() for both:
    // 1. CustomerConversationDO - conversation detail page real-time updates
    // 2. MessageBroadcaster global - conversation list page lastMessage updates
    try {
      // Security: Fetch teamId for team-scoped broadcast (P1 fix)
      let teamId: number | undefined;
      try {
        const db = createDbClient(c.env.DB);
        const [conv] = await db.select({ assignedTeamId: conversations.assignedTeamId })
          .from(conversations)
          .where(eq(conversations.id, request.conversationId))
          .limit(1);
        teamId = conv?.assignedTeamId || undefined;
      } catch (teamIdError) {
        log.warn('Failed to fetch teamId for broadcast', { error: teamIdError instanceof Error ? teamIdError.message : String(teamIdError) });
      }

      const unifiedBroadcastService = new WebSocketBroadcastService(c.env);
      const broadcastResult = await unifiedBroadcastService.broadcastNewMessage({
        conversationId: request.conversationId,
        message: {
          id: result.messageId,
          content: request.content,
          messageType: request.messageType || 'text',
          senderType: 'agent',
          senderId: String(user.id),
          senderName: user.displayName,
          platform: 'line',
          timestamp: nowMs(),
          deliveryStatus: initialDeliveryStatus,
          recallDeadline: initialRecallDeadline
        },
        source: 'api',
        // Security: Team-scoped broadcast (P1 fix - prevent cross-team data leakage)
        teamId
      });
      log.debug('UNIFIED_BROADCAST: Agent message broadcast completed', {
        conversationBroadcast: broadcastResult.conversationBroadcast,
        globalBroadcast: broadcastResult.globalBroadcast
      });
    } catch (broadcastError) {
      log.warn('UNIFIED_BROADCAST: Agent message broadcast failed (non-critical)', {
        error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError)
      });
      // Non-critical - conversation list will still update on next poll
    }

    // 5. Return response immediately
    log.debug('RESPONSE returning early success response');

    // Transform to frontend format (Pending status)
    // Safe metadata parsing with error handling
    let parsedMetadata = {};
    if (result.message.metadata) {
      try {
        parsedMetadata = JSON.parse(result.message.metadata as string);
      } catch (parseError) {
        log.warn('Failed to parse message metadata', { error: parseError instanceof Error ? parseError.message : String(parseError) });
        parsedMetadata = {};
      }
    }

    const formattedMessage = {
      id: result.message.id,
      conversationId: result.message.conversationId,
      senderType: 'agent' as const,
      senderId: result.message.agentSenderId || request.senderId,
      senderName: user.displayName,
      content: result.message.content,
      messageType: normalizeMessageType(result.message.messageType),
      mediaUrl: '',
      mediaType: result.message.messageType as 'text' | 'image' | 'video' | 'file',
      platform: 'line' as const,
      createdAt: result.message.createdAt ? new Date(result.message.createdAt).getTime() : nowMs(),
      timestamp: result.message.createdAt ? new Date(result.message.createdAt).getTime() : nowMs(),
      deliveryStatus: initialDeliveryStatus,
      recallDeadline: initialRecallDeadline,
      isSent: false,
      platformMessageId: null as string | null,
      metadata: parsedMetadata
    };

    return contractJson(c, conversationMessageContracts.send, {
      success: true,
      data: formattedMessage,
      message: 'Message queued for delivery'
    } satisfies ContractResponse<typeof conversationMessageContracts.send>);

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

conversationMessagesHandler.put('/:id/messages/read', jwtAuth, async (c) => {
  try {
    const conversationId = c.req.param('id')!;
    const user = c.get('user');
    const userPayload = c.get('jwtPayload') as JWTPayload;
    const agentId = userPayload.userId.toString();
    const db = createDbClient(c.env.DB);

    const hasPermission = await PermissionService.checkPermission(
      user.id,
      'conversation',
      'view',
      {
        userId: Number(user.id),
        role: user.role,
        resourceId: conversationId
      },
      c.env.DB
    );

    if (!hasPermission) {
      return c.json({ success: false, error: 'Permission denied' }, HTTP_STATUS.FORBIDDEN);
    }

    const batchSize = 50;
    let offset = 0;

    while (true) {
      const result = await c.env.DB.prepare(`
        SELECT id, read_by
        FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC
        LIMIT ? OFFSET ?
      `).bind(conversationId, batchSize, offset).all<{ id: string; read_by: string | null }>();
      const rows = result.results || [];

      if (rows.length === 0) {
        break;
      }

      const now = nowISO();
      const statements = rows
        .map((row) => {
          const readBy = parseReadBy(row.read_by);
          if (readBy.includes(agentId)) {
            return null;
          }

          return c.env.DB
            .prepare('UPDATE messages SET read_by = ?, updated_at = ? WHERE id = ?')
            .bind(JSON.stringify([...readBy, agentId]), now, row.id);
        })
        .filter((statement): statement is D1PreparedStatement => statement !== null);

      if (statements.length > 0) {
        await c.env.DB.batch(statements);
      }

      if (rows.length < batchSize) {
        break;
      }

      offset += rows.length;
    }

    await db
      .update(conversations)
      .set({ lastReadAt: nowISO(), markedUnreadAt: null, updatedAt: nowISO() })
      .where(eq(conversations.id, conversationId));

    return contractJson(c, conversationMessageContracts.markAllAsRead, {
      success: true,
      timestamp: nowISO()
    } as ContractResponse<typeof conversationMessageContracts.markAllAsRead>);
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

conversationMessagesHandler.put('/:id/messages/:messageId/read', jwtAuth, async (c) => {
  try {
    const conversationId = c.req.param('id')!;
    const messageId = c.req.param('messageId')!;
    const userPayload = c.get('jwtPayload') as JWTPayload;
    const agentId = userPayload.userId.toString();
    const db = createDbClient(c.env.DB);

    const existing = await db
      .select({ id: messages.id, readBy: messages.readBy })
      .from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)))
      .get();

    if (!existing) {
      return c.json({ success: false, error: 'Message not found' }, HTTP_STATUS.NOT_FOUND);
    }

    const readBy = parseReadBy(existing.readBy);
    if (!readBy.includes(agentId)) {
      await db
        .update(messages)
        .set({ readBy: JSON.stringify([...readBy, agentId]), updatedAt: nowISO() })
        .where(eq(messages.id, messageId));
    }

    return contractJson(c, conversationMessageContracts.markMessageAsRead, {
      success: true,
      timestamp: nowISO()
    } as ContractResponse<typeof conversationMessageContracts.markMessageAsRead>);
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

conversationMessagesHandler.get('/:id/messages/search', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const conversationId = c.req.param('id')!;
    const query = (c.req.query('q') || '').trim();
    const messageType = c.req.query('messageType');
    const senderType = c.req.query('senderType');
    const from = c.req.query('from');

    if (!query) {
      return c.json({ success: false, error: 'Search query is required' }, HTTP_STATUS.BAD_REQUEST);
    }

    const hasPermission = await PermissionService.checkPermission(
      user.id,
      'conversation',
      'view',
      {
        userId: Number(user.id),
        role: user.role,
        resourceId: conversationId
      },
      c.env.DB
    );

    if (!hasPermission) {
      return c.json({ success: false, error: 'Permission denied' }, HTTP_STATUS.FORBIDDEN);
    }

    const db = createDbClient(c.env.DB);
    const escapedQuery = `%${escapeLikePattern(query)}%`;
    const whereConditions = [
      eq(messages.conversationId, conversationId),
      isNull(messages.deletedAt),
      sql`${messages.content} LIKE ${escapedQuery} ESCAPE '\\'`
    ];

    if (messageType) {
      whereConditions.push(eq(messages.messageType, messageType));
    }
    if (senderType === 'customer' || senderType === 'agent') {
      whereConditions.push(eq(messages.senderType, senderType));
    }
    if (from) {
      whereConditions.push(gte(messages.createdAt, from));
    }

    const rows = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        senderType: messages.senderType,
        customerSenderId: messages.customerSenderId,
        agentSenderId: messages.agentSenderId,
        content: messages.content,
        messageType: messages.messageType,
        platformMessageId: messages.platformMessageId,
        isSent: messages.isSent,
        deliveryStatus: messages.deliveryStatus,
        metadata: messages.metadata,
        sentAt: messages.sentAt,
        recallDeadline: messages.recallDeadline,
        recalledAt: messages.recalledAt,
        isRecalled: messages.isRecalled,
        createdAt: messages.createdAt,
        customerName: customers.displayName,
        customerPlatform: customers.platform,
        agentName: agents.displayName
      })
      .from(messages)
      .leftJoin(customers, eq(messages.customerSenderId, customers.id))
      .leftJoin(agents, eq(messages.agentSenderId, agents.id))
      .where(and(...whereConditions))
      .orderBy(desc(messages.createdAt))
      .limit(50)
      .all();

    return contractJson(c, conversationMessageContracts.search, {
      success: true,
      data: rows.map(toConversationMessageContract),
      timestamp: nowISO()
    } satisfies ContractResponse<typeof conversationMessageContracts.search>);
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

conversationMessagesHandler.get('/:id/messages/:messageId', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const conversationId = c.req.param('id')!;
    const messageId = c.req.param('messageId')!;

    const hasPermission = await PermissionService.checkPermission(
      user.id,
      'conversation',
      'view',
      {
        userId: Number(user.id),
        role: user.role,
        resourceId: conversationId
      },
      c.env.DB
    );

    if (!hasPermission) {
      return c.json({ success: false, error: 'Permission denied' }, HTTP_STATUS.FORBIDDEN);
    }

    const db = createDbClient(c.env.DB);
    const row = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        senderType: messages.senderType,
        customerSenderId: messages.customerSenderId,
        agentSenderId: messages.agentSenderId,
        content: messages.content,
        messageType: messages.messageType,
        platformMessageId: messages.platformMessageId,
        isSent: messages.isSent,
        deliveryStatus: messages.deliveryStatus,
        metadata: messages.metadata,
        sentAt: messages.sentAt,
        recallDeadline: messages.recallDeadline,
        recalledAt: messages.recalledAt,
        isRecalled: messages.isRecalled,
        createdAt: messages.createdAt,
        customerName: customers.displayName,
        customerPlatform: customers.platform,
        agentName: agents.displayName
      })
      .from(messages)
      .leftJoin(customers, eq(messages.customerSenderId, customers.id))
      .leftJoin(agents, eq(messages.agentSenderId, agents.id))
      .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)))
      .get();

    if (!row) {
      return c.json({ success: false, error: 'Message not found' }, HTTP_STATUS.NOT_FOUND);
    }

    return contractJson(c, conversationMessageContracts.get, {
      success: true,
      data: toConversationMessageContract(row),
      timestamp: nowISO()
    } satisfies ContractResponse<typeof conversationMessageContracts.get>);
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

conversationMessagesHandler.put('/:id/messages/:messageId', jwtAuth, async (c) => {
  try {
    const conversationId = c.req.param('id')!;
    const messageId = c.req.param('messageId')!;
    const userPayload = c.get('jwtPayload') as JWTPayload;
    const body = await c.req.json();
    const content = typeof body.content === 'string' ? body.content.trim() : '';

    if (!content) {
      return c.json({ success: false, error: 'Content cannot be empty' }, HTTP_STATUS.BAD_REQUEST);
    }

    const db = createDbClient(c.env.DB);
    const existing = await db
      .select({
        id: messages.id,
        senderType: messages.senderType,
        agentSenderId: messages.agentSenderId,
        isRecalled: messages.isRecalled
      })
      .from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)))
      .get();

    if (!existing) {
      return c.json({ success: false, error: 'Message not found' }, HTTP_STATUS.NOT_FOUND);
    }

    const isAdmin = userPayload.role === 'admin';
    const isOwnAgentMessage =
      existing.senderType === 'agent' &&
      existing.agentSenderId === userPayload.userId.toString();

    if (!isAdmin && !isOwnAgentMessage) {
      return c.json({ success: false, error: 'Only the sender or admin can update this message' }, HTTP_STATUS.FORBIDDEN);
    }

    if (existing.isRecalled) {
      return c.json({ success: false, error: 'Cannot update a recalled message' }, HTTP_STATUS.BAD_REQUEST);
    }

    await db
      .update(messages)
      .set({ content, updatedAt: nowISO() })
      .where(eq(messages.id, messageId));

    const updated = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        senderType: messages.senderType,
        customerSenderId: messages.customerSenderId,
        agentSenderId: messages.agentSenderId,
        content: messages.content,
        messageType: messages.messageType,
        platformMessageId: messages.platformMessageId,
        isSent: messages.isSent,
        deliveryStatus: messages.deliveryStatus,
        metadata: messages.metadata,
        sentAt: messages.sentAt,
        recallDeadline: messages.recallDeadline,
        recalledAt: messages.recalledAt,
        isRecalled: messages.isRecalled,
        createdAt: messages.createdAt,
        customerName: customers.displayName,
        customerPlatform: customers.platform,
        agentName: agents.displayName
      })
      .from(messages)
      .leftJoin(customers, eq(messages.customerSenderId, customers.id))
      .leftJoin(agents, eq(messages.agentSenderId, agents.id))
      .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)))
      .get();

    const updatedContractMessage = updated ? toConversationMessageContract(updated) : undefined;
    const broadcastService = new WebSocketBroadcastService(c.env);
    await broadcastService.broadcastMessageEvent({
      type: 'message_updated',
      conversationId,
      messageId,
      agentId: userPayload.userId.toString(),
      data: {
        content,
        message: updatedContractMessage,
        timestamp: nowISO()
      },
      priority: 'normal'
    });

    const activityService = new ActivityService(c.env.DB);
    activityService.logActivity({
      userId: userPayload.userId.toString(),
      userName: userPayload.displayName || userPayload.username || 'Unknown',
      userRole: userPayload.role,
      action: ACTIVITY_ACTIONS.MESSAGE_UPDATE,
      resourceType: RESOURCE_TYPES.MESSAGE,
      resourceId: messageId,
      details: { conversationId },
      ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      userAgent: c.req.header('User-Agent')
    }).catch(() => {});

    return contractJson(c, conversationMessageContracts.edit, {
      success: true,
      data: updatedContractMessage,
      timestamp: nowISO()
    } satisfies ContractResponse<typeof conversationMessageContracts.edit>);
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

conversationMessagesHandler.delete('/:id/messages/:messageId', jwtAuth, async (c) => {
  try {
    const conversationId = c.req.param('id')!;
    const messageId = c.req.param('messageId')!;
    const userPayload = c.get('jwtPayload') as JWTPayload;
    const db = createDbClient(c.env.DB);

    const existing = await db
      .select({
        id: messages.id,
        senderType: messages.senderType,
        agentSenderId: messages.agentSenderId,
        isRecalled: messages.isRecalled,
        recallDeadline: messages.recallDeadline,
        isSent: messages.isSent,
        deliveryStatus: messages.deliveryStatus,
        metadata: messages.metadata
      })
      .from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)))
      .get();

    if (!existing) {
      return c.json({ success: false, error: 'Message not found' }, HTTP_STATUS.NOT_FOUND);
    }

    const isAdmin = userPayload.role === 'admin';
    const isOwnAgentMessage =
      existing.senderType === 'agent' &&
      existing.agentSenderId === userPayload.userId.toString();

    if (!isAdmin && !isOwnAgentMessage) {
      return contractJson(c, conversationMessageContracts.recall, {
        success: false,
        error: 'Only the sender or admin can recall this message',
        timestamp: nowISO()
      } as ContractResponse<typeof conversationMessageContracts.recall>, HTTP_STATUS.FORBIDDEN);
    }

    if (existing.isRecalled) {
      return contractJson(c, conversationMessageContracts.recall, {
        success: false,
        error: 'Message has already been recalled',
        timestamp: nowISO()
      } as ContractResponse<typeof conversationMessageContracts.recall>, HTTP_STATUS.BAD_REQUEST);
    }

    const isBuffered = existing.deliveryStatus === 'buffered' && !existing.isSent;

    if (isBuffered) {
      // Real recall: the DO is the sole arbiter of the deadline race. Cancel
      // succeeds only while the push is still pending — the customer will
      // never receive the message. No separate date check here: a stale
      // clock must not reject a cancel the DO would still accept.
      const cancelled = await cancelBufferedDelivery(c.env, { messageId, conversationId });
      if (!cancelled) {
        return contractJson(
          c,
          conversationMessageContracts.recall,
          {
            success: false,
            error: 'Message recall deadline has passed',
            timestamp: nowISO()
          } as ContractResponse<typeof conversationMessageContracts.recall>,
          HTTP_STATUS.BAD_REQUEST
        );
      }
    } else {
      // Already pushed (or legacy immediate path). LINE has no unsend API —
      // be honest instead of pretending the customer copy disappeared.
      const platform = resolveMessagePlatform(existing.metadata);
      if (platform !== 'facebook') {
        return contractJson(
          c,
          conversationMessageContracts.recall,
          {
            success: false,
            error: 'LINE 已送達的訊息無法撤回（LINE 不支援收回已發送的訊息）',
            timestamp: nowISO()
          } as ContractResponse<typeof conversationMessageContracts.recall>,
          HTTP_STATUS.BAD_REQUEST
        );
      }

      if (existing.recallDeadline && new Date() > new Date(existing.recallDeadline)) {
        return contractJson(c, conversationMessageContracts.recall, {
          success: false,
          error: 'Message recall deadline has passed',
          timestamp: nowISO()
        } as ContractResponse<typeof conversationMessageContracts.recall>, HTTP_STATUS.BAD_REQUEST);
      }
    }

    const recallService = new MessageRecallService(c.env.DB, c.env);
    const recallResult = await recallService.recallMessage(
      messageId,
      userPayload.userId.toString(),
      undefined,
      { deadlineAlreadyEnforced: isBuffered }
    );

    if (!recallResult.success) {
      return contractJson(
        c,
        conversationMessageContracts.recall,
        {
          success: false,
          error: recallResult.error || 'Failed to recall message',
          timestamp: nowISO()
        } as ContractResponse<typeof conversationMessageContracts.recall>,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const recalledAt = recallResult.recalledAt || nowISO();

    await db
      .update(messages)
      .set({
        isRecalled: true,
        recalledAt,
        updatedAt: nowISO(),
        content: '[This message has been recalled]'
      })
      .where(eq(messages.id, messageId));

    const broadcastService = new WebSocketBroadcastService(c.env);
    await broadcastService.broadcastMessageEvent({
      type: 'message_recall_success',
      conversationId,
      messageId,
      agentId: userPayload.userId.toString(),
      data: {
        isRecalled: true,
        recalledAt,
        timestamp: nowISO()
      },
      priority: 'high'
    });

    const activityService = new ActivityService(c.env.DB);
    activityService.logActivity({
      userId: userPayload.userId.toString(),
      userName: userPayload.displayName || userPayload.username || 'Unknown',
      userRole: userPayload.role,
      action: ACTIVITY_ACTIONS.MESSAGE_RECALL,
      resourceType: RESOURCE_TYPES.MESSAGE,
      resourceId: messageId,
      details: { conversationId },
      ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      userAgent: c.req.header('User-Agent')
    }).catch(() => {});

    return contractJson(c, conversationMessageContracts.recall, {
      success: true,
      timestamp: nowISO()
    } as ContractResponse<typeof conversationMessageContracts.recall>);
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// 獲取對話的訊息（支持分頁）
conversationMessagesHandler.get('/:id/messages', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const conversationId = c.req.param('id')!;

    // 獲取分頁參數
    const hasPaginationQuery =
      c.req.query('page') !== undefined || c.req.query('pageSize') !== undefined;
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '30', 10)));
    const offset = (page - 1) * pageSize;

    log.debug('Messages API getting messages', { conversationId, page, pageSize, offset });

    // 檢查權限
    const hasPermission = await PermissionService.checkPermission(
      user.id,
      'conversation',
      'view',
      {
        userId: Number(user.id),
        role: user.role,
        resourceId: conversationId
      },
      c.env.DB
    );

    if (!hasPermission) {
      return c.json({
        success: false,
        error: 'Permission denied',
        timestamp: nowISO()
      }, HTTP_STATUS.FORBIDDEN);
    }

    // 檢查對話是否存在
    const drizzleDb = createDbClient(c.env.DB);
    const conversation = await drizzleDb
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get();

    if (!conversation) {
      return c.json({
        success: false,
        error: 'Conversation not found',
        timestamp: nowISO()
      }, HTTP_STATUS.NOT_FOUND);
    }

    // 獲取訊息總數
    const totalResult = await drizzleDb
      .select({ count: count() })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .get();

    const total = totalResult?.count || 0;
    log.debug('Messages API total messages', { total });

    // 獲取分頁訊息（包含發送者資訊）
    const messageList = await drizzleDb
      .select({
        // Message fields
        id: messages.id,
        conversationId: messages.conversationId,
        senderType: messages.senderType,
        customerSenderId: messages.customerSenderId,
        agentSenderId: messages.agentSenderId,
        content: messages.content,
        messageType: messages.messageType,
        platformMessageId: messages.platformMessageId,
        isSent: messages.isSent,
        deliveryStatus: messages.deliveryStatus,
        metadata: messages.metadata,
        sentAt: messages.sentAt,
        recallDeadline: messages.recallDeadline,
        recalledAt: messages.recalledAt,
        isRecalled: messages.isRecalled,
        createdAt: messages.createdAt,
        // Customer info for customer messages
        customerName: customers.displayName,
        // Agent info for agent messages
        agentName: agents.displayName
      })
      .from(messages)
      .leftJoin(customers,
        and(
          eq(messages.senderType, 'customer'),
          eq(messages.customerSenderId, customers.id)
        )
      )
      .leftJoin(agents,
        and(
          eq(messages.senderType, 'agent'),
          eq(messages.agentSenderId, agents.id)
        )
      )
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt)) // 最新的消息在前面
      .limit(pageSize)
      .offset(offset);

    log.debug('Messages API retrieved messages', { count: messageList.length, page });

    // Batch-fetch file_attachments for all messages in this page
    let attachmentsByMessageId: Record<string, Array<{
      id: string;
      filename: string;
      mimeType: string;
      fileSize: number;
      fileUrl: string;
      downloadUrl?: string;
    }>> = {};
    if (messageList.length > 0) {
      const messageIds = messageList.map(m => m.id);
      const allAttachments = await drizzleDb
        .select({
          id: fileAttachments.id,
          messageId: fileAttachments.messageId,
          filename: fileAttachments.filename,
          mimeType: fileAttachments.mimeType,
          fileSize: fileAttachments.fileSize,
          fileUrl: fileAttachments.fileUrl,
          r2Key: fileAttachments.r2Key,
        })
        .from(fileAttachments)
        .where(inArray(fileAttachments.messageId, messageIds))
        .all();

      const resolvedAttachments = await Promise.all(
        allAttachments.map(async (attachment) => ({
          ...attachment,
          fileUrl: await resolveAttachmentUrl(c.env, attachment.fileUrl, attachment.r2Key),
          // Signed force-download URL. fileUrl is served inline (for <img>),
          // so the explicit download button needs a separate attachment-disposition
          // URL. Only minted when r2Key exists; failures degrade gracefully to
          // undefined and the frontend falls back to fileUrl.
          downloadUrl: attachment.r2Key
            ? await getSignedDownloadUrl(c.env, attachment.id, attachment.r2Key).catch(() => undefined)
            : undefined
        }))
      );

      for (const attachment of resolvedAttachments) {
        const msgId = attachment.messageId;
        if (msgId) {
          if (!attachmentsByMessageId[msgId]) {
            attachmentsByMessageId[msgId] = [];
          }
          attachmentsByMessageId[msgId].push({
            id: attachment.id,
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            fileSize: attachment.fileSize,
            fileUrl: attachment.fileUrl,
            downloadUrl: attachment.downloadUrl,
          });
        }
      }
    }

    // 轉換為前端期望的 Message 格式
    const formattedMessages = messageList.map(row => ({
      ...toConversationMessageContract(row),
      // File attachments from R2 storage
      file_attachments: attachmentsByMessageId[row.id] || [],
    }));

    // 返回分頁響應格式
    const totalPages = Math.ceil(total / pageSize);
    const paginatedResponse = {
      items: formattedMessages,
      page,
      pageSize,
      total,
      totalPages,
      hasMore: page < totalPages
    };

    log.debug('Messages API returning page', { page, totalPages, itemCount: formattedMessages.length, hasMore: paginatedResponse.hasMore });

    if (!hasPaginationQuery) {
      return contractJson(c, conversationMessageContracts.list, {
        success: true,
        data: formattedMessages,
        timestamp: nowISO()
      } satisfies ContractResponse<typeof conversationMessageContracts.list>);
    }

    return contractJson(c, conversationMessageContracts.listPaginated, {
      success: true,
      data: paginatedResponse,
      timestamp: nowISO()
    } satisfies ContractResponse<typeof conversationMessageContracts.listPaginated>);

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

export default conversationMessagesHandler;
