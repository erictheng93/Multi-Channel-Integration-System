// src/modules/integrations/services/webhook-conversation-service.ts
// Shared conversation find/create/update logic extracted from webhook.ts (Phase 4 refactoring)

import { eq, and, ne } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { conversations, messages } from '@/db/schema';
import { convertConversation } from '@/utils/drizzle-converters';
import type { Bindings } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { createContextLogger } from '@/utils/logger';
import { nowISO } from '@/utils/timestamp';
import { DistributedLockService } from '@/services/distributed-lock-service';

const log = createContextLogger('WebhookConversation');

type Platform = 'line' | 'facebook';

/**
 * Find an existing open conversation for a customer,
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
): Promise<any> {
  const drizzleDb = createDbClient(env.DB);
  const platformLabel = platform.toUpperCase();

  console.log(`[${platformLabel} Webhook] Searching for existing conversation for customer:`, customerId);

  // Fast path: check for existing conversation (no lock needed)
  let conversation = await drizzleDb
    .select()
    .from(conversations)
    .where(and(
      eq(conversations.customerId, customerId),
      ne(conversations.status, 'closed')
    ))
    .get();

  console.log(`[${platformLabel} Webhook] Existing conversation found:`, conversation ? conversation.id : 'None');

  if (!conversation) {
    // Slow path: creation needs distributed lock to prevent duplicates
    const lockService = new DistributedLockService(env);
    conversation = await lockService.withLock(
      `webhook:conversation:${customerId}`,
      async () => {
        // Double-check inside lock — another request may have created the conversation
        const existing = await drizzleDb
          .select()
          .from(conversations)
          .where(and(
            eq(conversations.customerId, customerId),
            ne(conversations.status, 'closed')
          ))
          .get();

        if (existing) {
          // Another request created it while we waited for the lock — just update timestamps
          const updateTimestamp = nowISO();
          const updateFields: Record<string, unknown> = {
            lastMessageAt: updateTimestamp,
            updatedAt: updateTimestamp
          };
          if (!existing.assignedTeamId && opts?.assignedTeamId) {
            updateFields.assignedTeamId = opts.assignedTeamId;
          }
          await drizzleDb
            .update(conversations)
            .set(updateFields)
            .where(eq(conversations.id, existing.id));
          if (!existing.assignedTeamId && opts?.assignedTeamId) {
            existing.assignedTeamId = opts.assignedTeamId;
          }
          return existing;
        }

        // 建立新對話（使用 UUID）
        const conversationId = uuidv4();
        const timestamp = nowISO();

        if (platform === 'line') {
          console.log(`[${platformLabel} Webhook] Creating new conversation...`, {
            conversationId,
            customerId,
            timestamp
          });
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
              lastMessageAt: timestamp,
              createdAt: timestamp,
              updatedAt: timestamp
            });

          if (platform === 'line') {
            console.log(`[${platformLabel} Webhook] Conversation insert completed:`, { conversationId, insertResult });
          }

          if (platform === 'line') {
            console.log(`[${platformLabel} Webhook] Re-querying created conversation...`);
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

          const created = convertConversation(newConversation) as any;

          if (platform === 'line') {
            console.log(`[${platformLabel} Webhook] New conversation created and retrieved successfully:`, {
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

    // Trigger notification OUTSIDE the lock (non-critical, reduces lock hold time)
    if (platform === 'line' && conversation) {
      try {
        const { triggerNewConversationNotification } = await import('@/utils/notification-trigger');
        await triggerNewConversationNotification(env, {
          conversationId: conversation.id,
          customerName: opts?.customerDisplayName || `${platformLabel} User`,
          platform: platformLabel,
          messagePreview: opts?.messageContent || '',
          teamId: conversation.assignedTeamId || undefined
        });
        console.log(`[${platformLabel} Webhook] New conversation notification triggered`);
      } catch (notificationError) {
        log.warn(`${platformLabel} Webhook: Failed to trigger new conversation notification`, {
          error: notificationError instanceof Error ? notificationError.message : String(notificationError)
        });
      }
    }

    return conversation;
  } else {
    // 更新對話
    const timestamp = nowISO();
    if (platform === 'line') {
      console.log(`[${platformLabel} Webhook] Updating existing conversation:`, {
        conversationId: conversation.id,
        customerId,
        timestamp
      });
    }

    // Fix: 如果現有對話沒有團隊指派，但呼叫方提供了 teamId，補上指派
    const updateFields: Record<string, any> = {
      lastMessageAt: timestamp,
      updatedAt: timestamp
    };

    if (!conversation.assignedTeamId && opts?.assignedTeamId) {
      updateFields.assignedTeamId = opts.assignedTeamId;
      console.log(`[${platformLabel} Webhook] Backfilling team assignment on existing conversation:`, {
        conversationId: conversation.id,
        assignedTeamId: opts.assignedTeamId
      });
    }

    await drizzleDb
      .update(conversations)
      .set(updateFields)
      .where(eq(conversations.id, conversation.id));

    // 更新本地 conversation 物件以反映最新狀態
    if (!conversation.assignedTeamId && opts?.assignedTeamId) {
      conversation.assignedTeamId = opts.assignedTeamId;
    }

    if (platform === 'line') {
      console.log(`[${platformLabel} Webhook] Existing conversation updated successfully`);
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

  console.log(`[${platformLabel} Webhook] Checking for duplicate messages with platformMessageId:`, platformMessageId);
  const existingMessage = await drizzleDb
    .select()
    .from(messages)
    .where(eq(messages.platformMessageId, platformMessageId))
    .get();

  if (existingMessage) {
    console.log(`[${platformLabel} Webhook] Message already exists with platformMessageId: ${platformMessageId}, skipping duplicate processing`);
    return true;
  }

  console.log(`[${platformLabel} Webhook] No duplicate message found, proceeding with message creation`);
  return false;
}

/**
 * Save a new message to the database.
 * Returns the generated messageId.
 */
export async function saveMessage(
  env: Bindings,
  conversationId: string,
  customerId: number,
  messageContent: string,
  messageType: string,
  platformMessageId: string | null,
  displayName: string | null,
  mediaData: any,
  platform: Platform
): Promise<string> {
  const drizzleDb = createDbClient(env.DB);
  const platformLabel = platform.toUpperCase();
  const messageId = uuidv4();
  const timestamp = nowISO();

  if (platform === 'line') {
    console.log(`[${platformLabel} Webhook] Creating message...`, {
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

    // Trigger latest message cache update
    try {
      const { LatestMessageJobQueue } = await import('@/workers/latest-message-worker');
      const jobQueue = new LatestMessageJobQueue(env);
      await jobQueue.updateLatestMessage(conversationId, messageId, 'high');
      log.debug(`Triggered cache update for ${platform} message`, { conversationId });
    } catch (error) {
      log.warn('Failed to trigger cache update', { error: error instanceof Error ? error.message : String(error) });
      // Don't fail the webhook for cache update failures
    }

    if (platform === 'line') {
      console.log(`[${platformLabel} Webhook] Message created successfully:`, {
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
