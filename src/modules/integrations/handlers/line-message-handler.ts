// src/modules/integrations/handlers/line-message-handler.ts
// LINE message event processing — extracted from line-event-processor.ts

import { eq, desc } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { customerTeamAssignments } from '@/db/schema';
import type { Bindings, LineEvent, LineMediaData } from '@/types';
import { ActivityService } from '@modules/activities';
import { WebSocketBroadcastService } from '@/services/websocket-broadcast-service';
import { createContextLogger } from '@/utils/logger';

import { findOrCreateConversation, isDuplicateMessage, saveMessage } from '../services/webhook-conversation-service';
import { nowMs } from '@/utils/timestamp';
import { evaluate as autoReplyEvaluate } from '@modules/auto-reply/services/auto-reply-engine';
import { findOrCreateCustomer, triggerBackgroundSyncIfNeeded } from '../services/webhook-customer-service';
import type { DeferFn } from './webhook';

const log = createContextLogger('Webhook');

// Safe logging function
function logSecurely(platform: string, userId: string, messageLength: number) {
  log.info(`Processed ${platform} message`, { userIdPrefix: userId.slice(0, 8), messageLength });
}

// Process LINE message events
export async function processLineMessage(env: Bindings, event: LineEvent, defer: DeferFn = () => {}) {
  const userId = event.source.userId;
  const message = event.message;

  log.info('Processing message from user', { userIdPrefix: userId.substring(0, 10) });

  if (!message) {
    log.warn('LINE Message: No message in LINE event');
    return;
  }

  try {
    // EARLY DEDUPE: Skip ALL processing for redelivered messages.
    //
    // Why this MUST be first: a redelivery with the same platformMessageId
    // should not run customer/conversation side effects. last_message_at is
    // now advanced only after saveMessage() inserts a row, but duplicate events
    // still need to avoid extra profile syncs, assignment lookups, and broadcasts.
    //
    // Incident: 2026-04-24 — 元隆企業社 redelivery bumped last_message_at to
    // 08:18:44Z but no message row was written; operator believed a new message
    // arrived (list re-sorted) and could not find it in the chat.
    if (message.id && await isDuplicateMessage(env, message.id, 'line')) {
      log.info('LINE Webhook: Duplicate message, skipping all processing', {
        platformMessageId: message.id,
        userIdPrefix: userId.substring(0, 10),
      });
      return;
    }

    // Smart type correction: detect and fix LINE API type misidentification
    // Problem: LINE API may incorrectly identify some files as video/audio type
    // Solution: If message has fileName field, force correct to 'file' type
    let correctedMessageType = message.type;

    if (message.fileName && message.type !== 'file') {
      log.warn('Message type mismatch detected — auto-correcting', {
        originalType: message.type,
        correctedType: 'file',
        fileName: message.fileName,
        fileSize: message.fileSize,
        messageId: message.id,
        userIdPrefix: userId.substring(0, 10)
      });
      correctedMessageType = 'file';
    }

    // Diagnostic log: record details of all file-related messages
    if (message.fileName || message.type === 'file' || correctedMessageType === 'file') {
      log.debug('File message details', {
        messageId: message.id,
        originalType: message.type,
        correctedType: correctedMessageType,
        fileName: message.fileName,
        fileSize: message.fileSize,
        hasFileName: !!message.fileName,
        wasTypeCorrected: message.type !== correctedMessageType
      });
    }

    // Parse message content and type
    let messageContent = '';
    let messageType = correctedMessageType;  // Use corrected type
    let mediaData: LineMediaData | null = null;

    switch (correctedMessageType) {  // Use corrected type
      case 'text':
        messageContent = message.text || '';
        break;
      case 'image':
        messageContent = '[圖片]';
        mediaData = {
          originalContentUrl: `https://api.line.me/v2/bot/message/${message.id}/content`,
          previewImageUrl: `https://api.line.me/v2/bot/message/${message.id}/content/preview`
        };
        break;
      case 'video':
        messageContent = '[影片]';
        mediaData = {
          originalContentUrl: `https://api.line.me/v2/bot/message/${message.id}/content`,
          previewImageUrl: `https://api.line.me/v2/bot/message/${message.id}/content/preview`
        };
        break;
      case 'audio':
        messageContent = '[語音]';
        mediaData = {
          originalContentUrl: `https://api.line.me/v2/bot/message/${message.id}/content`,
          duration: message.duration || 0
        };
        break;
      case 'file':
        messageContent = `[檔案] ${message.fileName || 'Unknown file'}`;
        mediaData = {
          originalContentUrl: `https://api.line.me/v2/bot/message/${message.id}/content`,
          fileName: message.fileName || '',
          fileSize: message.fileSize || 0
        };
        break;
      case 'location':
        messageContent = `[位置] ${message.title || 'Location'}: ${message.address || 'Unknown address'}`;
        mediaData = {
          title: message.title || '',
          address: message.address || '',
          latitude: message.latitude || 0,
          longitude: message.longitude || 0
        };
        break;
      case 'sticker':
        messageContent = '[貼圖]';
        mediaData = {
          packageId: message.packageId || '',
          stickerId: message.stickerId || ''
        };
        break;
      default:
        messageContent = `[${message.type}]`;
        mediaData = message;
        break;
    }

    // Query or create user via consolidated webhook-customer-service
    const user = await findOrCreateCustomer(env, userId, 'line', {
      groupId: event.source.groupId,
    });

    if (!user) {
      log.error('LINE Webhook: Failed to find or create user', { userIdPrefix: userId.substring(0, 10) });
      // Throw instead of silent return — allows LINE to retry the webhook
      throw new Error(`Failed to find or create LINE user: ${userId.substring(0, 10)}...`);
    }

    log.debug('User found/created successfully', {
      userId: user.id,
      platformUserIdPrefix: user.platformUserId?.substring(0, 10),
      displayName: user.displayName,
    });

    triggerBackgroundSyncIfNeeded(env, userId, 'line', event.source.groupId);

    // Fix: Query customer_team_assignments to get QR Code team assignment
    // Resolves bug where processLineMessage always had assignedTeamId as null
    let assignedTeamId: number | null = null;
    try {
      const drizzleDb2 = createDbClient(env.DB);
      const assignment = await drizzleDb2
        .select({ teamId: customerTeamAssignments.teamId })
        .from(customerTeamAssignments)
        .where(eq(customerTeamAssignments.platformUserId, userId))
        .orderBy(desc(customerTeamAssignments.assignedAt))
        .limit(1)
        .get();
      if (assignment) {
        assignedTeamId = assignment.teamId;
        log.debug('Found team assignment from QR code', { assignedTeamId });
      }
    } catch (assignmentError) {
      log.warn('LINE Message: Failed to query customer_team_assignments', {
        error: assignmentError instanceof Error ? assignmentError.message : String(assignmentError)
      });
    }

    // Find or create conversation
    // (Dedupe already happened at the top of this try block — see EARLY DEDUPE.)
    const conversation = await findOrCreateConversation(env, user.id, 'line', {
      messageContent,
      customerDisplayName: user.displayName || 'LINE User',
      assignedTeamId
    });

    // Save message
    const messageId = await saveMessage(
      env,
      conversation!.id,
      user.id,
      messageContent,
      messageType,
      message.id,
      user.displayName || null,
      mediaData,
      'line'
    );

    // =================== SYNC: Auto-reply (replyToken expires ~30s) ===================
    if (conversation) {
      try {
        log.debug('Auto-reply evaluating', { teamId: conversation.assignedTeamId ?? null, conversationId: conversation.id });
        const autoReplyResult = await autoReplyEvaluate(
          {
            message: { content: messageContent, messageType, platform: 'line' },
            conversationId: conversation.id,
            teamId: conversation.assignedTeamId ?? null,
            replyToken: event.replyToken || null,
            customerId: user.id,
            platformUserId: userId,
          },
          env
        );

        if (autoReplyResult.matched) {
          log.info('Auto-reply triggered', {
            ruleId: autoReplyResult.ruleId,
            ruleName: autoReplyResult.ruleName,
            replyMethod: autoReplyResult.replyMethod,
            error: autoReplyResult.error || 'none',
          });
        } else {
          log.debug('Auto-reply: no matching rule');
        }
      } catch (autoReplyError) {
        log.warn('LINE Webhook: Auto-reply evaluation failed (non-critical)', {
          error: autoReplyError instanceof Error ? autoReplyError.message : String(autoReplyError),
        });
      }
    }

    // =================== DEFERRED: Non-critical tasks via waitUntil ===================
    const convId = conversation!.id;
    const convTeamId = conversation!.assignedTeamId;
    const userDisplayName = user.displayName || 'LINE User';
    const customerId = user.id;

    // A. WebSocket broadcast (includes metadata for immediate file/media rendering)
    defer((async () => {
      try {
        const broadcastService = new WebSocketBroadcastService(env);
        await broadcastService.broadcastNewMessage({
          conversationId: convId,
          message: {
            id: messageId,
            content: messageContent,
            messageType: messageType,
            senderType: 'customer',
            senderId: String(customerId),
            platform: 'line',
            timestamp: nowMs(),
            deliveryStatus: 'delivered',
            metadata: mediaData ? JSON.stringify(mediaData) : undefined,
          },
          source: 'webhook',
          teamId: convTeamId ?? undefined
        });
        log.debug('Deferred broadcast completed', { conversationId: convId });
      } catch (err) {
        log.warn('LINE Webhook: Deferred broadcast failed', { error: err instanceof Error ? err.message : String(err) });
      }
    })());

    // B+C. Media processing via Queue (replaces defer for reliability)
    // Each file gets its own queue message → own Worker invocation → no resource contention
    if (mediaData && correctedMessageType !== 'location' && correctedMessageType !== 'sticker') {
      try {
        await env.LINE_MESSAGE_QUEUE.send({
          type: 'media_processing' as const,
          messageId,
          conversationId: convId,
          teamId: convTeamId ?? undefined,
          lineMessageId: message.id,
          lineMessageType: correctedMessageType,
          fileName: message.fileName,
          enqueuedAt: Date.now(),
        });
        log.debug('Enqueued media processing', { messageId, lineMessageId: message.id, type: correctedMessageType });
      } catch (queueErr) {
        log.error('Failed to enqueue media processing', {
          messageId,
          lineMessageId: message.id,
          error: queueErr instanceof Error ? queueErr.message : String(queueErr)
        });
        // Non-critical: message is already saved, frontend has metadata fallback
      }
    }

    // E. Activity logging
    defer((async () => {
      try {
        const activityService = new ActivityService(env.DB);
        await activityService.logActivity({
          userId: 'system',
          userName: 'Webhook Handler',
          userRole: 'system',
          action: 'message_received',
          resourceType: 'conversation',
          resourceId: String(convId),
          details: {
            conversationId: convId,
            customerId,
            platform: 'line',
            messageType: messageType,
            messageId: messageId,
            content: messageContent.substring(0, 100)
          }
        });
      } catch (err) {
        log.warn('LINE Webhook: Deferred activity logging failed', { error: err instanceof Error ? err.message : String(err) });
      }
    })());

    // F. Notifications
    defer((async () => {
      try {
        const { triggerNewConversationNotification } = await import('@/utils/notification-trigger');
        await triggerNewConversationNotification(env, {
          conversationId: convId,
          customerName: userDisplayName,
          platform: 'LINE',
          messagePreview: messageContent,
          teamId: convTeamId ?? undefined
        });
      } catch (err) {
        log.warn('LINE Webhook: Deferred notification failed', { error: err instanceof Error ? err.message : String(err) });
      }
    })());

    logSecurely('LINE', userId, messageContent.length);
  } catch (error) {
    log.error('Error processing LINE message', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userIdPrefix: userId.slice(0, 8),
      messageType: event.message?.type
    });
    throw error;
  }
}
