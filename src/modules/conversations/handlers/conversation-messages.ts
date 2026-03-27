// 對話訊息處理器
// Handles: POST /:id/attachments, POST /:id/messages, GET /:id/messages

import { Hono } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import { globalErrorHandler } from '@/core/error-handler';
import { eq, desc, and, count, inArray } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { conversations, messages, customers, agents, fileAttachments } from '@/db/schema';
import type { Bindings } from '@/types';
import { PermissionService } from '@/services/permission-service';
import { jwtAuth } from '@/middleware/auth';
import { WebSocketBroadcastService } from '@/services/websocket-broadcast-service';
import { MessageRequestService, MessageService } from '@modules/conversations/services/message-service';
import { successResponse, errorResponse } from '@/utils/api-response';
import { createContextLogger } from '@/utils/logger';
import { nowISO, nowMs } from '@/utils/timestamp';
import { getPublicFileUrl } from '@/utils/file-url';

const log = createContextLogger('ConversationMessagesHandler');

const conversationMessagesHandler = new Hono<{ Bindings: Bindings }>();

// 上傳附件（在消息發送之前）
conversationMessagesHandler.post('/:id/attachments', jwtAuth, async (c) => {
  try {
    const conversationId = c.req.param('id')!;

    if (!conversationId) {
      return c.json({
        success: false,
        error: 'Conversation ID is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const db = createDbClient(c.env.DB);

    // 檢查對話是否存在
    const conversation = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get();

    if (!conversation) {
      return c.json({
        success: false,
        error: 'Conversation not found'
      }, HTTP_STATUS.NOT_FOUND);
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
    const fileUrl = getPublicFileUrl(c.env, r2Key);
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

    return c.json({
      success: true,
      data: {
        attachmentId,
        url: fileUrl,
        filename: file.name,
        mimeType: file.type,
        size: file.size
      }
    });
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

    log.debug('SERVICE creating pending message');
    const result = await messageService.createPendingMessage(request);

    // 確保訊息已成功創建
    if (!result.messageId || !result.message) {
      throw new Error('Failed to create pending message: missing messageId or message data');
    }

    log.debug('SERVICE pending message created', { messageId: result.messageId });

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
          deliveryStatus: 'pending',
          timestamp: nowISO()
        },
        priority: 'normal'
      });
    } catch (broadcastError) {
      log.warn('WEBSOCKET: Pending message broadcast failed', { error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError) });
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
          deliveryStatus: 'pending'
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

    // 4. Trigger background sending
    log.debug('BACKGROUND scheduling background delivery');
    c.executionCtx.waitUntil(
      messageService.processBackgroundSending(result.messageId, request, user)
    );

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
      mediaUrl: '',
      mediaType: result.message.messageType as 'text' | 'image' | 'video' | 'file',
      platform: 'line' as const,
      createdAt: result.message.createdAt ? new Date(result.message.createdAt).getTime() : nowMs(),
      timestamp: result.message.createdAt ? new Date(result.message.createdAt).getTime() : nowMs(),
      deliveryStatus: 'pending',
      isSent: false,
      platformMessageId: null as string | null,
      metadata: parsedMetadata
    };

    return successResponse(c, formattedMessage, 'Message queued for delivery');

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
      fileUrl: string | null;
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
        })
        .from(fileAttachments)
        .where(inArray(fileAttachments.messageId, messageIds))
        .all();

      for (const attachment of allAttachments) {
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
          });
        }
      }
    }

    // 轉換為前端期望的 Message 格式
    const formattedMessages = messageList.map(row => ({
      id: row.id,
      conversationId: row.conversationId,
      senderType: row.senderType === 'customer' ? 'user' as const : row.senderType as 'agent' | 'system',
      senderId: row.senderType === 'customer'
        ? row.customerSenderId?.toString() || ''
        : row.agentSenderId || '',
      senderName: row.senderType === 'customer' ? row.customerName : row.agentName,
      content: row.content,
      mediaUrl: '', // Populated via file_attachments below
      mediaType: row.messageType as 'text' | 'image' | 'video' | 'file',
      platform: 'line' as const, // 需要從 conversation->customer 獲取
      createdAt: row.createdAt ? new Date(row.createdAt).getTime() : nowMs(),
      // 額外的數據庫字段
      platformMessageId: row.platformMessageId,
      isSent: row.isSent,
      deliveryStatus: row.deliveryStatus,
      metadata: row.metadata,
      sentAt: row.sentAt,
      isRecalled: row.isRecalled,
      recallDeadline: row.recallDeadline,
      recalledAt: row.recalledAt,
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

    return c.json({
      success: true,
      data: paginatedResponse,
      timestamp: nowISO()
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

export default conversationMessagesHandler;
