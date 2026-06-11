// Messaging CRUD Routes
// 訊息 CRUD 操作端點

import { Hono } from 'hono';
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('MsgCrud')

import { eq, and, isNull } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import type { Bindings, JWTPayload } from '@/types';
import { messages, conversations, customers, agents, fileAttachments } from '@/db/schema';
import { jwtAuth } from '@/middleware/auth';
import {
  successResponse,
  errorResponse,
  badRequestResponse,
  notFoundResponse,
  forbiddenResponse
} from '@/utils/api-response';
import { validateReplyToMessageId } from '@/utils/validate-reply-to';
import { getMentionedUserIds } from '@/utils/mention-parser';
import { triggerMentionNotification } from '@/utils/notification-trigger';
import { nowISO, nowMs } from '@/utils/timestamp'
import { ActivityService, ACTIVITY_ACTIONS, RESOURCE_TYPES } from '@modules/activities';
import { contractJson } from '@/utils/api-contract-response';
import { messageContracts, type ContractResponse } from '@shared/api-contracts';

const crudRoutes = new Hono<{ Bindings: Bindings }>();
type MessageUpdateValues = Partial<typeof messages.$inferInsert>;

/**
 * 獲取特定訊息
 * GET /api/messages/:id
 */
crudRoutes.get('/:id', jwtAuth, async (c) => {
  try {
    const messageId = c.req.param('id');

    if (!messageId) {
      return badRequestResponse(c, 'Message ID is required');
    }

    const userPayload = c.get('jwtPayload') as JWTPayload;
    const db = createDbClient(c.env.DB);

    // 獲取訊息詳細資訊，包含相關的對話和發送者資訊
    // F4: also select conversations.assignedTeamId so we can enforce team
    // scope after fetch; soft-deleted messages must be hidden.
    const messageQuery = await db
      .select({
        // 訊息資訊
        id: messages.id,
        conversationId: messages.conversationId,
        senderType: messages.senderType,
        customerSenderId: messages.customerSenderId,
        agentSenderId: messages.agentSenderId,
        content: messages.content,
        messageType: messages.messageType,
        platformMessageId: messages.platformMessageId,
        isRecalled: messages.isRecalled,
        recallDeadline: messages.recallDeadline,
        recalledAt: messages.recalledAt,
        isSent: messages.isSent,
        sentAt: messages.sentAt,
        deliveryStatus: messages.deliveryStatus,
        replyToMessageId: messages.replyToMessageId,
        threadId: messages.threadId,
        sessionId: messages.sessionId,
        sessionSequence: messages.sessionSequence,
        metadata: messages.metadata,
        createdAt: messages.createdAt,
        // 對話資訊
        conversationStatus: conversations.status,
        conversationPriority: conversations.priority,
        conversationAssignedTeamId: conversations.assignedTeamId,
        // 代理人資訊
        agentName: agents.displayName,
        agentRole: agents.role,
        // 客戶資訊
        customerName: customers.displayName,
        customerPlatform: customers.platform
      })
      .from(messages)
      .leftJoin(conversations, eq(messages.conversationId, conversations.id))
      .leftJoin(agents, eq(messages.agentSenderId, agents.id))
      .leftJoin(customers, eq(messages.customerSenderId, customers.id))
      .where(and(
        eq(messages.id, messageId),
        isNull(messages.deletedAt)
      ))
      .get();

    if (!messageQuery) {
      return notFoundResponse(c, 'Message not found');
    }

    // F4: enforce team-scoped access. Admins see everything. Other agents
    // can only read messages whose conversation is in one of their
    // allowedTeamIds, or is unassigned (shared pool, matching the visibility
    // rule used by getVisibleConversations).
    const isAdmin = userPayload.role === 'admin';
    const assignedTeamId = messageQuery.conversationAssignedTeamId;
    const allowedTeams = userPayload.allowedTeamIds ?? [];
    const teamAllowed =
      isAdmin ||
      assignedTeamId === null ||
      assignedTeamId === undefined ||
      allowedTeams.includes(assignedTeamId);

    if (!teamAllowed) {
      // Return 404 (not 403) to avoid leaking message existence to unauthorised agents.
      return notFoundResponse(c, 'Message not found');
    }

    // 構造回應數據
    const messageDetail = {
      id: messageQuery.id,
      conversationId: messageQuery.conversationId,
      senderType: messageQuery.senderType,
      senderInfo: messageQuery.senderType === 'agent' ? {
        id: messageQuery.agentSenderId,
        name: messageQuery.agentName,
        role: messageQuery.agentRole
      } : messageQuery.senderType === 'customer' ? {
        id: messageQuery.customerSenderId,
        name: messageQuery.customerName,
        platform: messageQuery.customerPlatform
      } : null,
      content: messageQuery.content,
      messageType: messageQuery.messageType,
      platformMessageId: messageQuery.platformMessageId,
      isRecalled: Boolean(messageQuery.isRecalled),
      recallDeadline: messageQuery.recallDeadline,
      recalledAt: messageQuery.recalledAt,
      isSent: Boolean(messageQuery.isSent),
      sentAt: messageQuery.sentAt,
      deliveryStatus: messageQuery.deliveryStatus,
      replyToMessageId: messageQuery.replyToMessageId,
      threadId: messageQuery.threadId,
      sessionId: messageQuery.sessionId,
      sessionSequence: messageQuery.sessionSequence,
      metadata: messageQuery.metadata ? JSON.parse(messageQuery.metadata) : null,
      createdAt: messageQuery.createdAt,
      conversationInfo: {
        status: messageQuery.conversationStatus,
        priority: messageQuery.conversationPriority
      }
    };

    return contractJson(c, messageContracts.getMessageDetails, {
      success: true,
      data: messageDetail,
      timestamp: nowISO()
    } as ContractResponse<typeof messageContracts.getMessageDetails>);

  } catch (error) {
    log.error('Get message error', {}, error as Error);
    return errorResponse(c, error instanceof Error ? error.message : 'Failed to get message', 500);
  }
});

/**
 * 更新訊息
 * PUT /api/messages/:id
 */
crudRoutes.put('/:id', jwtAuth, async (c) => {
  try {
    const messageId = c.req.param('id');
    const userPayload = c.get('jwtPayload') as JWTPayload;

    if (!messageId) {
      return badRequestResponse(c, 'Message ID is required');
    }

    let updateData: {
      content?: string;
      messageType?: string;
      metadata?: unknown;
    };

    try {
      updateData = await c.req.json();
    } catch (error) {
      return badRequestResponse(c, 'Invalid JSON data');
    }

    const db = createDbClient(c.env.DB);

    // 檢查訊息是否存在以及用戶權限
    const existingMessage = await db
      .select({
        id: messages.id,
        agentSenderId: messages.agentSenderId,
        senderType: messages.senderType,
        isRecalled: messages.isRecalled,
        createdAt: messages.createdAt
      })
      .from(messages)
      .where(eq(messages.id, messageId))
      .get();

    if (!existingMessage) {
      return notFoundResponse(c, 'Message not found');
    }

    // F9: positive-check authorization. The previous form only ran the
    // guard when senderType === 'agent', so customer/system messages fell
    // through and were editable by any agent. Now we require ownership
    // (agent message authored by the caller) OR admin role; everything
    // else is rejected — customer and system messages are never editable
    // via this endpoint.
    const isAdmin = userPayload.role === 'admin';
    const isOwnAgentMessage =
      existingMessage.senderType === 'agent' &&
      existingMessage.agentSenderId === userPayload.userId.toString();

    if (!isAdmin && !isOwnAgentMessage) {
      return forbiddenResponse(c, 'Only the sender or admin can update this message');
    }

    // 檢查訊息是否已被撤回
    if (existingMessage.isRecalled) {
      return badRequestResponse(c, 'Cannot update a recalled message');
    }

    // 準備更新數據
    const updateValues: MessageUpdateValues = {
      updatedAt: nowISO()
    };

    if (updateData.content !== undefined) {
      if (!updateData.content.trim()) {
        return badRequestResponse(c, 'Content cannot be empty');
      }
      updateValues.content = updateData.content;
    }

    if (updateData.messageType !== undefined) {
      updateValues.messageType = updateData.messageType;
    }

    if (updateData.metadata !== undefined) {
      updateValues.metadata = JSON.stringify(updateData.metadata);
    }

    // 執行更新
    await db
      .update(messages)
      .set(updateValues)
      .where(eq(messages.id, messageId));

    // 獲取更新後的訊息
    const updatedMessage = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        content: messages.content,
        messageType: messages.messageType,
        metadata: messages.metadata,
        createdAt: messages.createdAt
      })
      .from(messages)
      .where(eq(messages.id, messageId))
      .get();

    return successResponse(c, {
      ...updatedMessage,
      metadata: updatedMessage?.metadata ? JSON.parse(updatedMessage.metadata) : null
    }, 'Message updated successfully');

  } catch (error) {
    log.error('Update message error', {}, error as Error);
    return errorResponse(c, error instanceof Error ? error.message : 'Failed to update message', 500);
  }
});

/**
 * 刪除訊息 (撤回訊息)
 * DELETE /api/messages/:id
 */
crudRoutes.delete('/:id', jwtAuth, async (c) => {
  try {
    const messageId = c.req.param('id');
    const userPayload = c.get('jwtPayload') as JWTPayload;

    if (!messageId) {
      return badRequestResponse(c, 'Message ID is required');
    }

    const db = createDbClient(c.env.DB);

    // 檢查訊息是否存在以及用戶權限
    const existingMessage = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        agentSenderId: messages.agentSenderId,
        senderType: messages.senderType,
        isRecalled: messages.isRecalled,
        recallDeadline: messages.recallDeadline,
        content: messages.content,
        createdAt: messages.createdAt
      })
      .from(messages)
      .where(eq(messages.id, messageId))
      .get();

    if (!existingMessage) {
      return notFoundResponse(c, 'Message not found');
    }

    // F9: positive-check authorization for recall, same pattern as PUT.
    // Customer/system messages must never be recallable by an agent — the
    // previous guard only fired when senderType==='agent', so customer
    // messages fell through and an agent could overwrite transcript
    // history with the "[recalled]" marker on someone else's words.
    const isAdmin = userPayload.role === 'admin';
    const isOwnAgentMessage =
      existingMessage.senderType === 'agent' &&
      existingMessage.agentSenderId === userPayload.userId.toString();

    if (!isAdmin && !isOwnAgentMessage) {
      return forbiddenResponse(c, 'Only the sender or admin can recall this message');
    }

    // 檢查訊息是否已被撤回
    if (existingMessage.isRecalled) {
      return badRequestResponse(c, 'Message has already been recalled');
    }

    // 檢查撤回時限（如果設定了）
    if (existingMessage.recallDeadline) {
      const deadline = new Date(existingMessage.recallDeadline);
      const now = new Date();
      if (now > deadline) {
        return badRequestResponse(c, 'Message recall deadline has passed');
      }
    }

    const recalledAt = nowISO();

    // 撤回訊息 (軟刪除，保留記錄)
    await db
      .update(messages)
      .set({
        isRecalled: true,
        recalledAt: recalledAt,
        content: '[This message has been recalled]'
      })
      .where(eq(messages.id, messageId));

    // Fire-and-forget activity logging
    const activityService = new ActivityService(c.env.DB);
    activityService.logActivity({
      userId: userPayload.userId.toString(),
      userName: userPayload.displayName || userPayload.username || 'Unknown',
      userRole: userPayload.role,
      action: ACTIVITY_ACTIONS.MESSAGE_RECALL,
      resourceType: RESOURCE_TYPES.MESSAGE,
      resourceId: messageId,
      details: { conversationId: existingMessage.conversationId },
      ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      userAgent: c.req.header('User-Agent')
    }).catch(() => {});

    return successResponse(c, {
      id: messageId,
      conversationId: existingMessage.conversationId,
      isRecalled: true,
      recalledAt,
      recalledBy: {
        id: userPayload.userId.toString(),
        name: userPayload.displayName || 'Unknown User'
      }
    }, 'Message recalled successfully');

  } catch (error) {
    log.error('Delete message error', {}, error as Error);
    return errorResponse(c, error instanceof Error ? error.message : 'Failed to recall message', 500);
  }
});

/**
 * 創建新訊息
 * POST /api/messages
 */
crudRoutes.post('/', jwtAuth, async (c) => {
  try {
    const userPayload = c.get('jwtPayload') as JWTPayload;

    let requestData: {
      conversationId: string;
      content: string;
      messageType?: string;
      replyToMessageId?: string;
      metadata?: unknown;
      attachmentIds?: string[];
    };

    try {
      requestData = await c.req.json();
    } catch (error) {
      return badRequestResponse(c, 'Invalid JSON data');
    }

    const { conversationId, content, messageType, replyToMessageId, metadata, attachmentIds } = requestData;

    // 基本驗證
    if (!conversationId || !content || content.trim().length === 0) {
      return badRequestResponse(c, 'Conversation ID and content are required');
    }

    // 創建資料庫連線
    const db = createDbClient(c.env.DB);

    // 檢查對話是否存在 — also fetch assignedTeamId so we can enforce team scope.
    // F5: filter soft-deleted conversations to match the soft-delete contract.
    const conversation = await db
      .select({
        id: conversations.id,
        assignedTeamId: conversations.assignedTeamId,
      })
      .from(conversations)
      .where(and(
        eq(conversations.id, conversationId),
        isNull(conversations.deletedAt)
      ))
      .get();

    if (!conversation) {
      return notFoundResponse(c, 'Conversation not found');
    }

    // F5: enforce team scope on write. The sibling send endpoint at
    // conversations/handlers/conversation-messages.ts calls
    // PermissionService.checkPermission('message','send'), but this route
    // bypassed it entirely — any agent could post into any conversation
    // and have the message delivered to the customer on LINE/Messenger.
    // Mirror the same rule as F4 GET: admin OK, unassigned shared pool OK,
    // otherwise assignedTeamId must be in the JWT's allowedTeamIds.
    const isAdmin = userPayload.role === 'admin';
    const assignedTeamId = conversation.assignedTeamId;
    const allowedTeams = userPayload.allowedTeamIds ?? [];
    const teamAllowed =
      isAdmin ||
      assignedTeamId === null ||
      assignedTeamId === undefined ||
      allowedTeams.includes(assignedTeamId);

    if (!teamAllowed) {
      return forbiddenResponse(c, 'You do not have access to this conversation');
    }

    // Validate replyToMessageId exists (app-level FK enforcement)
    if (replyToMessageId) {
      const replyValidation = await validateReplyToMessageId(c.env.DB, replyToMessageId, conversationId);
      if (!replyValidation.valid) {
        return badRequestResponse(c, replyValidation.error || 'Invalid replyToMessageId');
      }
    }

    // 生成訊息 ID
    const messageId = `msg_${nowMs()}_${Math.random().toString(36).substr(2, 9)}`;

    // 準備訊息數據
    const messageData = {
      id: messageId,
      conversationId,
      senderType: 'agent' as const,
      agentSenderId: userPayload.userId.toString(),
      content,
      messageType: messageType || 'text',
      replyToMessageId: replyToMessageId || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      isSent: true,
      deliveryStatus: 'sent',
      senderName: userPayload.displayName || null,
      sentAt: nowISO(),
      createdAt: nowISO()
    };

    // 插入訊息
    await db.insert(messages).values(messageData);

    // 更新對話的最後訊息時間
    await db
      .update(conversations)
      .set({
        lastMessageAt: nowISO(),
        updatedAt: nowISO()
      })
      .where(eq(conversations.id, conversationId));

    // 處理附件關聯
    if (attachmentIds && attachmentIds.length > 0) {
      for (const attachmentId of attachmentIds) {
        await db
          .update(fileAttachments)
          .set({ messageId: messageId })
          .where(
            and(
              eq(fileAttachments.id, attachmentId),
              isNull(fileAttachments.messageId)
            )
          );
      }
    }

    // 查詢關聯的附件
    let attachments: unknown[] = [];
    if (attachmentIds && attachmentIds.length > 0) {
      attachments = await db
        .select()
        .from(fileAttachments)
        .where(eq(fileAttachments.messageId, messageId))
        .all();
    }

    // @提及通知檢測與觸發
    const mentionedUserIds = getMentionedUserIds(content);
    if (mentionedUserIds.length > 0) {
      // 獲取發送者的顯示名稱
      const senderName = userPayload.displayName || userPayload.username || 'Agent';

      // 為每個被提及的用戶發送通知 (排除自己)
      for (const mentionedUserId of mentionedUserIds) {
        if (mentionedUserId !== userPayload.userId.toString()) {
          triggerMentionNotification(c.env, {
            mentionedUserId,
            mentionerName: senderName,
            mentionerId: userPayload.userId,
            conversationId,
            messagePreview: content.substring(0, 100)
          }).catch(err => {
            log.warn('Failed to trigger mention notification', { error: err instanceof Error ? err.message : String(err) });
          });
        }
      }
    }

    // Fire-and-forget activity logging
    const activityService = new ActivityService(c.env.DB);
    activityService.logActivity({
      userId: userPayload.userId.toString(),
      userName: userPayload.displayName || userPayload.username || 'Unknown',
      userRole: userPayload.role,
      action: ACTIVITY_ACTIONS.MESSAGE_SEND,
      resourceType: RESOURCE_TYPES.MESSAGE,
      resourceId: messageId,
      details: { conversationId, messageType: messageType || 'text' },
      ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      userAgent: c.req.header('User-Agent')
    }).catch(() => {});

    return successResponse(c, {
      id: messageId,
      conversationId,
      content,
      messageType: messageType || 'text',
      senderType: 'agent',
      agentSenderId: userPayload.userId.toString(),
      sentAt: messageData.sentAt,
      createdAt: messageData.createdAt,
      file_attachments: attachments,
      mentionedUserIds: mentionedUserIds.length > 0 ? mentionedUserIds : undefined
    }, 'Message created successfully', 201);

  } catch (error) {
    log.error('Create message error', {}, error as Error);
    return errorResponse(c, error instanceof Error ? error.message : 'Failed to create message', 500);
  }
});

export default crudRoutes;
