// src/modules/integrations/services/webhook-conversation-service.ts
// Shared conversation find/create/update logic extracted from webhook.ts (Phase 4 refactoring)

import { eq, sql } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { conversations, messages } from '@/db/schema';
import { convertConversation } from '@/utils/drizzle-converters';
import type { Bindings } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { createContextLogger } from '@/utils/logger';
import { nowISO } from '@/utils/timestamp';
import { DistributedLockService } from '@/services/distributed-lock-service';
import { findCustomerConversation, getReopenStatus } from '@/services/customer-conversation-lookup';

const log = createContextLogger('WebhookConversation');

type Platform = 'line' | 'facebook';
type WebhookConversation = ReturnType<typeof convertConversation>;

/**
 * Raise the "new conversation" notification. Call it right after saveMessage succeeded.
 *
 * "New" is derived from stored state, not from who created the row: the notification
 * belongs to whichever request persisted the conversation's FIRST message (lowest rowid,
 * i.e. insertion order, which D1 serializes). That makes it exactly-once across
 * concurrent first messages, and a retry after a failed first save still notifies,
 * because the retried message is then the first one stored.
 * Only conversations with no message yet (lastMessageAt unset when it was loaded) pay
 * for the lookup. Non-critical: failures are logged.
 */
export async function notifyNewConversation(
  env: Bindings,
  conversation: WebhookConversation | undefined,
  messageId: string,
  platform: Platform,
  opts?: { messageContent?: string; customerDisplayName?: string }
): Promise<void> {
  if (!conversation || conversation.lastMessageAt) return;
  const platformLabel = platform.toUpperCase();
  try {
    const first = await createDbClient(env.DB)
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.conversationId, conversation.id))
      .orderBy(sql`rowid`)
      .limit(1)
      .get();
    if (first?.id !== messageId) return;

    const { triggerNewConversationNotification } = await import('@/utils/notification-trigger');
    await triggerNewConversationNotification(env, {
      conversationId: conversation.id,
      customerName: opts?.customerDisplayName || `${platformLabel} User`,
      platform: platformLabel,
      messagePreview: opts?.messageContent || '',
      teamId: conversation.assignedTeamId || undefined
    });
    log.debug('New conversation notification triggered', { platform: platformLabel });
  } catch (notificationError) {
    log.warn(`${platformLabel} Webhook: Failed to trigger new conversation notification`, {
      error: notificationError instanceof Error ? notificationError.message : String(notificationError)
    });
  }
}

/**
 * Find the customer's conversation (reopening it if closed),
 * or create a new one with UUID.
 * Returns the conversation record.
 */
export async function findOrCreateConversation(
  env: Bindings,
  customerId: number,
  platform: Platform,
  opts?: {
    messageContent?: string;
    customerDisplayName?: string;
    assignedTeamId?: number | null;
  }
) : Promise<WebhookConversation | undefined> {
  const drizzleDb = createDbClient(env.DB);
  const platformLabel = platform.toUpperCase();

  log.debug(`Searching for existing conversation for customer`, { platform: platformLabel, customerId });

  // Fast path: check for existing conversation (no lock needed)
  // 一位客戶只有一個對話；已結案的對話也在這裡找到，下方會重新開啟。
  // 舊資料可能有多筆：優先未結案，否則取最近的已結案（見 findCustomerConversation）。
  const existingConversation = await findCustomerConversation(drizzleDb, customerId);
  let conversation: WebhookConversation | undefined = existingConversation
    ? convertConversation(existingConversation)
    : undefined;

  log.debug(`Existing conversation found`, { platform: platformLabel, conversationId: conversation ? conversation.id : 'None' });

  if (!conversation) {
    // Slow path: creation needs distributed lock to prevent duplicates
    const lockService = new DistributedLockService(env);
    conversation = await lockService.withLock(
      `webhook:conversation:${customerId}`,
      async () => {
        // Double-check inside lock — another request may have created the conversation
        const existing = await findCustomerConversation(drizzleDb, customerId);

        if (existing) {
          // Another request created it while we waited for the lock. Only
          // backfill assignment here; saveMessage owns lastMessageAt updates.
          const updateTimestamp = nowISO();
          const updateFields: Record<string, unknown> = {};
          if (!existing.assignedTeamId && opts?.assignedTeamId) {
            updateFields.assignedTeamId = opts.assignedTeamId;
            updateFields.updatedAt = updateTimestamp;
          }
          if (Object.keys(updateFields).length > 0) {
            await drizzleDb
              .update(conversations)
              .set(updateFields)
              .where(eq(conversations.id, existing.id));
          }
          if (!existing.assignedTeamId && opts?.assignedTeamId) {
            existing.assignedTeamId = opts.assignedTeamId;
          }
          return convertConversation(existing);
        }

        // 建立新對話（使用 UUID）
        const conversationId = uuidv4();
        const timestamp = nowISO();

        if (platform === 'line') {
          log.debug(`Creating new conversation`, { platform: platformLabel, conversationId, customerId, timestamp });
        }

        try {
          // 插入新對話 (只支援團隊指派，個人指派已移除)
          const insertResult = await drizzleDb
            .insert(conversations)
            .values({
              id: conversationId,
              customerId,
              assignedTeamId: opts?.assignedTeamId ?? null,
              status: 'active',
              priority: 'normal',
              firstResponseAt: null,
              closedAt: null,
              lastMessageAt: null,
              createdAt: timestamp,
              updatedAt: timestamp
            });

          if (platform === 'line') {
            log.debug(`Conversation insert completed`, { platform: platformLabel, conversationId, insertResult });
          }

          if (platform === 'line') {
            log.debug(`Re-querying created conversation`, { platform: platformLabel });
          }
          const newConversation = await drizzleDb
            .select()
            .from(conversations)
            .where(eq(conversations.id, conversationId))
            .get();

          if (!newConversation) {
            if (platform === 'line') {
              const anyUserConversations = await drizzleDb
                .select()
                .from(conversations)
                .where(eq(conversations.customerId, customerId))
                .all();

              const { customers: customersTable } = await import('@/db/schema');
              const dbTest = await drizzleDb.select().from(customersTable).where(eq(customersTable.id, customerId)).get();

              log.error(`${platformLabel} Webhook: Failed to retrieve created conversation`, {
                conversationId,
                customerId,
                timestamp,
                allConversationsCount: anyUserConversations?.length || 0,
                dbConnectionTest: dbTest ? 'OK' : 'FAILED'
              });
            }
            throw new Error('Failed to retrieve created conversation after successful insert');
          }

          const created = convertConversation(newConversation);

          if (platform === 'line') {
            log.debug(`New conversation created and retrieved successfully`, {
              platform: platformLabel,
              id: conversationId,
              customerId,
              status: created?.status
            });
          } else {
            log.debug('Created new Facebook conversation', { conversationId });
          }

          return created;
        } catch (convError) {
          log.error(`${platformLabel} Webhook: Failed to create conversation`, {
            error: convError instanceof Error ? convError.message : 'Unknown error',
            conversationId,
            customerId,
            timestamp
          });
          throw new Error(`Failed to create conversation: ${convError}`);
        }
      },
      { ttl: 10000, timeout: 5000 }
    );

    return conversation;
  } else {
    // 更新對話
    const timestamp = nowISO();
    if (platform === 'line') {
      log.debug(`Updating existing conversation`, {
        platform: platformLabel,
        conversationId: conversation.id,
        customerId,
        timestamp
      });
    }

    // Fix: 如果現有對話沒有團隊指派，但呼叫方提供了 teamId，補上指派
    const updateFields: Record<string, unknown> = {};

    if (!conversation.assignedTeamId && opts?.assignedTeamId) {
      updateFields.assignedTeamId = opts.assignedTeamId;
      updateFields.updatedAt = timestamp;
      log.debug(`Backfilling team assignment on existing conversation`, {
        platform: platformLabel,
        conversationId: conversation.id,
        assignedTeamId: opts.assignedTeamId
      });
    }

    // 客戶在已結案的對話再次傳訊 → 自動重新開啟（依指派狀態回到 assigned / active）
    const reopenedStatus = getReopenStatus(
      conversation.status,
      Boolean(conversation.assignedTeamId || opts?.assignedTeamId)
    );
    if (reopenedStatus) {
      updateFields.status = reopenedStatus;
      updateFields.closedAt = null;
      updateFields.updatedAt = timestamp;
    }

    if (Object.keys(updateFields).length > 0) {
      await drizzleDb
        .update(conversations)
        .set(updateFields)
        .where(eq(conversations.id, conversation.id));
    }

    if (reopenedStatus) {
      conversation.status = reopenedStatus;
      log.info('Reopened closed conversation on inbound message', { conversationId: conversation.id, status: reopenedStatus });
      try {
        const { WebSocketBroadcastService } = await import('@/services/websocket-broadcast-service');
        await new WebSocketBroadcastService(env).broadcastConversationEvent({
          type: 'conversation_status_changed',
          conversationId: conversation.id,
          data: { status: reopenedStatus, timestamp },
          priority: 'normal'
        });
      } catch (broadcastError) {
        log.warn('Reopen broadcast failed, continuing', { error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError) });
      }
    }

    // 更新本地 conversation 物件以反映最新狀態
    if (!conversation.assignedTeamId && opts?.assignedTeamId) {
      conversation.assignedTeamId = opts.assignedTeamId;
    }

    if (platform === 'line') {
      log.debug(`Existing conversation updated successfully`, { platform: platformLabel });
    }
  }

  return conversation;
}

/**
 * Check for duplicate message by platformMessageId.
 * Returns true if a duplicate was found (caller should skip processing).
 */
export async function isDuplicateMessage(
  env: Bindings,
  platformMessageId: string,
  platform: Platform
): Promise<boolean> {
  const drizzleDb = createDbClient(env.DB);
  const platformLabel = platform.toUpperCase();

  log.debug(`Checking for duplicate messages`, { platform: platformLabel, platformMessageId });
  const existingMessage = await drizzleDb
    .select()
    .from(messages)
    .where(eq(messages.platformMessageId, platformMessageId))
    .get();

  if (existingMessage) {
    log.debug(`Message already exists, skipping duplicate processing`, { platform: platformLabel, platformMessageId });
    return true;
  }

  log.debug(`No duplicate message found, proceeding with message creation`, { platform: platformLabel });
  return false;
}

/**
 * Save a new message to the database.
 * Returns the generated messageId, or the winning row's id when a concurrent redelivery
 * inserted the same platform message first (`outcome.duplicate` is then set, so only the
 * request that really inserted the row raises the new-conversation notification).
 */
export async function saveMessage(
  env: Bindings,
  conversationId: string,
  customerId: number,
  messageContent: string,
  messageType: string,
  platformMessageId: string | null,
  displayName: string | null,
  mediaData: unknown,
  platform: Platform,
  outcome?: { duplicate?: boolean }
): Promise<string> {
  const drizzleDb = createDbClient(env.DB);
  const platformLabel = platform.toUpperCase();
  const messageId = uuidv4();
  const timestamp = nowISO();

  if (platform === 'line') {
    log.debug(`Creating message`, {
      platform: platformLabel,
      messageId,
      conversationId,
      customerId,
      messageType,
      contentLength: messageContent.length,
      platformMessageId
    });
  }

  try {
    await drizzleDb
      .insert(messages)
      .values({
        id: messageId,
        conversationId,
        senderType: 'customer',
        customerSenderId: customerId,
        content: messageContent,
        messageType,
        platformMessageId,
        isSent: true,
        deliveryStatus: 'delivered',
        metadata: mediaData ? JSON.stringify(mediaData) : null,
        senderName: displayName || null,
        createdAt: timestamp
      });

    try {
      await drizzleDb
        .update(conversations)
        .set({
          lastMessageAt: timestamp,
          updatedAt: timestamp
        })
        .where(eq(conversations.id, conversationId));
    } catch (timestampError) {
      log.warn(`${platformLabel} Webhook: Message saved but conversation timestamp update failed`, {
        error: timestampError instanceof Error ? timestampError.message : String(timestampError),
        messageId,
        conversationId,
        platformMessageId
      });
    }

    // The latest-message KV cache is no longer updated here: nothing reads `latest_msg:*`
    // (conversation lists come from D1), and every inbound message used to cost a
    // LatestMessageCacheCoordinator request, two storage writes and a 5 s alarm wake.

    if (platform === 'line') {
      log.debug(`Message created successfully`, {
        platform: platformLabel,
        messageId,
        conversationId,
        customerId,
        platformMessageId
      });
    }
  } catch (messageError) {
    // Handle UNIQUE constraint violation gracefully (race condition with dedup check)
    if (messageError instanceof Error && messageError.message?.includes('UNIQUE constraint failed')) {
      log.info(`${platformLabel} Webhook: Duplicate message caught by DB constraint`, { platformMessageId });
      if (outcome) outcome.duplicate = true;
      if (platformMessageId) {
        const existing = await drizzleDb
          .select({ id: messages.id })
          .from(messages)
          .where(eq(messages.platformMessageId, platformMessageId))
          .get();
        return existing?.id || messageId;
      }
      return messageId;
    }
    log.error(`${platformLabel} Webhook: Failed to create message`, {
      error: messageError instanceof Error ? messageError.message : 'Unknown error',
      messageId,
      conversationId,
      customerId,
      platformMessageId
    });
    throw new Error(`Failed to create message: ${messageError}`);
  }

  return messageId;
}
