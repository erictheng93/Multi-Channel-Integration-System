// Legacy delayed-message contract routes under /api/messages.

import { Hono } from 'hono';
import type { Context } from 'hono';
import { eq } from 'drizzle-orm';
import { createContextLogger } from '@/utils/logger';
import { createDbClient } from '@/db/drizzle-factory';
import { delayedMessages, messages } from '@/db/schema';
import { jwtAuth } from '@/middleware/auth';
import type { Bindings, JWTPayload } from '@/types';
import { badRequestResponse, errorResponse } from '@/utils/api-response';
import { contractJson } from '@/utils/api-contract-response';
import {
  messageContracts,
  type ContractResponse,
  type PendingMessage
} from '@shared/api-contracts';
import { DelayedMessageManager } from '@modules/delayed-message/services/DelayedMessageManager';
import type {
  DelayedMessageEntity,
  DelayedMessageRequest
} from '@modules/delayed-message/types';
import { nowISO } from '@/utils/timestamp';

const log = createContextLogger('MsgLegacyDelayed');
const legacyDelayedRoutes = new Hono<{ Bindings: Bindings }>();

type AuthUserInfo = {
  id: string;
  displayName?: string;
  role?: string;
};

function getAuthUser(c: Context<{ Bindings: Bindings }>): AuthUserInfo {
  const payload = c.get('jwtPayload') as JWTPayload | undefined;
  const user = c.get('user') as
    | { id?: string | number; displayName?: string; username?: string; role?: string }
    | undefined;

  return {
    id: String(user?.id ?? payload?.userId ?? ''),
    displayName: user?.displayName ?? payload?.displayName ?? payload?.username,
    role: user?.role ?? payload?.role
  };
}

function parsePositiveInt(value: string | undefined, fallback: number, max?: number): number {
  const parsed = Number.parseInt(value || '', 10);
  const normalized = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return max ? Math.min(normalized, max) : normalized;
}

function parseMetadata(entity: DelayedMessageEntity): Record<string, unknown> {
  return entity.metadata && typeof entity.metadata === 'object' ? entity.metadata : {};
}

function metadataString(metadata: Record<string, unknown>, key: string, fallback = ''): string {
  const value = metadata[key];
  return typeof value === 'string' ? value : fallback;
}

function isSupportedPlatform(value: unknown): value is 'line' | 'facebook' {
  return value === 'line' || value === 'facebook';
}

function toPendingMessage(entity: DelayedMessageEntity): PendingMessage {
  const metadata = parseMetadata(entity);
  const scheduledSendTime = entity.scheduledAt;
  const canRecall = entity.status === 'pending' && new Date() < new Date(scheduledSendTime);

  return {
    id: entity.id,
    conversation_id: entity.conversationId,
    customer_name: metadataString(metadata, 'customerName', ''),
    content: entity.content,
    platform: metadataString(metadata, 'platform', 'line'),
    scheduled_send_time: scheduledSendTime,
    recall_deadline: scheduledSendTime,
    status: entity.status,
    can_recall: canRecall,
    message_type: entity.messageType,
    created_at: entity.createdAt
  };
}

legacyDelayedRoutes.post('/delayed', jwtAuth, async (c) => {
  try {
    const user = getAuthUser(c);
    const body = await c.req.json();

    if (!isSupportedPlatform(body.platform)) {
      return badRequestResponse(c, 'Platform must be one of: line, facebook');
    }

    const request: DelayedMessageRequest = {
      conversationId: body.conversationId,
      content: body.content,
      delaySeconds: body.delaySeconds,
      messageType: body.messageType || 'text',
      mediaUrl: body.mediaUrl,
      senderId: user.id,
      recipientPlatformId: body.recipientPlatformId,
      platform: body.platform
    };

    const result = await new DelayedMessageManager(c.env).sendDelayedMessage(request, user);

    if (!result.success) {
      return badRequestResponse(c, result.error || 'Failed to send delayed message');
    }

    return contractJson(c, messageContracts.sendDelayedMessage, {
      success: true,
      data: {
        messageId: result.messageId || '',
        scheduledSendTime: result.scheduledSendTime || '',
        recallDeadline: result.recallDeadline || ''
      },
      timestamp: nowISO()
    } as ContractResponse<typeof messageContracts.sendDelayedMessage>);
  } catch (error) {
    log.error('Send legacy delayed message error', {}, error as Error);
    return errorResponse(
      c,
      error instanceof Error ? error.message : 'Failed to send delayed message',
      500
    );
  }
});

legacyDelayedRoutes.post('/recall', jwtAuth, async (c) => {
  try {
    const user = getAuthUser(c);
    const body = await c.req.json();
    const messageId = typeof body.messageId === 'string' ? body.messageId : '';

    if (!messageId.trim()) {
      return badRequestResponse(c, 'Message ID is required');
    }

    const result = await new DelayedMessageManager(c.env).recallDelayedMessage(messageId, user);

    if (!result.success) {
      return badRequestResponse(c, result.error || 'Failed to recall message');
    }

    return contractJson(c, messageContracts.recallMessage, {
      success: true,
      data: {
        success: true,
        messageId: result.messageId || messageId
      },
      timestamp: nowISO()
    } as ContractResponse<typeof messageContracts.recallMessage>);
  } catch (error) {
    log.error('Recall legacy delayed message error', {}, error as Error);
    return errorResponse(
      c,
      error instanceof Error ? error.message : 'Failed to recall message',
      500
    );
  }
});

legacyDelayedRoutes.get('/pending', jwtAuth, async (c) => {
  try {
    const user = getAuthUser(c);
    const page = parsePositiveInt(c.req.query('page'), 1);
    const pageSize = parsePositiveInt(c.req.query('pageSize'), 20, 100);
    const result = await new DelayedMessageManager(c.env).getPendingMessages(
      user.id,
      page,
      pageSize
    );

    return contractJson(c, messageContracts.getPendingMessages, {
      success: true,
      data: {
        items: result.items.map(toPendingMessage),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize
      },
      timestamp: nowISO()
    } as ContractResponse<typeof messageContracts.getPendingMessages>);
  } catch (error) {
    log.error('Get legacy pending delayed messages error', {}, error as Error);
    return errorResponse(
      c,
      error instanceof Error ? error.message : 'Failed to get pending messages',
      500
    );
  }
});

legacyDelayedRoutes.get('/:messageId/can-recall', jwtAuth, async (c) => {
  try {
    const user = getAuthUser(c);
    const messageId = c.req.param('messageId');

    if (!messageId?.trim()) {
      return badRequestResponse(c, 'Message ID is required');
    }

    const db = createDbClient(c.env.DB);

    const delayed = await db
      .select({
        agentId: delayedMessages.agentId,
        scheduledAt: delayedMessages.scheduledAt,
        status: delayedMessages.status
      })
      .from(delayedMessages)
      .where(eq(delayedMessages.id, messageId))
      .get();

    let canRecall = false;

    if (delayed) {
      canRecall =
        delayed.status === 'pending' &&
        new Date() < new Date(delayed.scheduledAt) &&
        (user.role === 'admin' || delayed.agentId === user.id);
    } else {
      const message = await db
        .select({
          senderType: messages.senderType,
          agentSenderId: messages.agentSenderId,
          isRecalled: messages.isRecalled,
          recallDeadline: messages.recallDeadline
        })
        .from(messages)
        .where(eq(messages.id, messageId))
        .get();

      canRecall = Boolean(
        message &&
          !message.isRecalled &&
          (!message.recallDeadline || new Date() <= new Date(message.recallDeadline)) &&
          (user.role === 'admin' ||
            (message.senderType === 'agent' && message.agentSenderId === user.id))
      );
    }

    return contractJson(c, messageContracts.canRecallMessage, {
      success: true,
      data: { canRecall },
      timestamp: nowISO()
    } as ContractResponse<typeof messageContracts.canRecallMessage>);
  } catch (error) {
    log.error('Check legacy delayed recall eligibility error', {}, error as Error);
    return errorResponse(
      c,
      error instanceof Error ? error.message : 'Failed to check recall eligibility',
      500
    );
  }
});

export default legacyDelayedRoutes;
