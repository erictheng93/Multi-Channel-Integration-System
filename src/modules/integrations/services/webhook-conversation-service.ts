// src/modules/integrations/services/webhook-conversation-service.ts
// Shared conversation find/create/update logic extracted from webhook.ts (Phase 4 refactoring)

import { eq, and, ne } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { conversations, messages } from '@/db/schema';
import { convertConversation } from '@/utils/drizzle-converters';
import type { Bindings } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { createContextLogger } from '@/utils/logger';
import { nowISO } from '@/utils/timestamp'

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

  console.log(`🔍 [${platformLabel} Webhook] Searching for existing conversation for customer:`, customerId);
  let conversation = await drizzleDb
    .select()
    .from(conversations)
    .where(and(
      eq(conversations.customerId, customerId),
      ne(conversations.status, 'closed')
    ))
    .get();

  console.log(`🔍 [${platformLabel} Webhook] Existing conversation found:`, conversation ? conversation.id : 'None');

  if (!conversation) {
    // 建立新對話（使用 UUID）
    const conversationId = uuidv4();
    const timestamp = nowISO();

    if (platform === 'line') {
      console.log(`🔄 [${platformLabel} Webhook] Creating new conversation...`, {
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
          // Note: assignedUserId removed - only team assignment is supported now
          status: 'active',
          priority: 'normal',
          firstResponseAt: null,
          closedAt: null,
          internalNotes: null,
          lastMessageAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp
        });

      if (platform === 'line') {
        console.log(`✅ [${platformLabel} Webhook] Conversation insert completed:`, { conversationId, insertResult });
      }

      // Re-query the created conversation to get full object
      if (platform === 'line') {
        console.log(`🔍 [${platformLabel} Webhook] Re-querying created conversation...`);
      }
      const newConversation = await drizzleDb
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .get();

      if (!newConversation) {
        if (platform === 'line') {
          // 嘗試查詢是否有任何該用戶的對話
          const anyUserConversations = await drizzleDb
            .select()
            .from(conversations)
            .where(eq(conversations.customerId, customerId))
            .all();

          // 檢查數據庫連接狀態
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

      conversation = convertConversation(newConversation) as any;

      if (platform === 'line') {
        console.log(`✅ [${platformLabel} Webhook] New conversation created and retrieved successfully:`, {
          id: conversationId,
          customerId,
          status: conversation?.status
        });
      } else {
        log.debug('Created new Facebook conversation', { conversationId });
      }

      // 🆕 觸發新對話通知（新創建的對話）— LINE only
      if (platform === 'line') {
        try {
          const { triggerNewConversationNotification } = await import('@/utils/notification-trigger');
          await triggerNewConversationNotification(env, {
            conversationId: conversationId,
            customerName: opts?.customerDisplayName || `${platformLabel} User`,
            platform: platformLabel,
            messagePreview: opts?.messageContent || '',
            teamId: newConversation.assignedTeamId || undefined
          });
          console.log(`✅ [${platformLabel} Webhook] New conversation notification triggered`);
        } catch (notificationError) {
          log.warn(`${platformLabel} Webhook: Failed to trigger new conversation notification`, {
            error: notificationError instanceof Error ? notificationError.message : String(notificationError)
          });
          // 不要讓通知失敗影響主流程
        }
      }
    } catch (convError) {
      log.error(`${platformLabel} Webhook: Failed to create conversation`, {
        error: convError instanceof Error ? convError.message : 'Unknown error',
        conversationId,
        customerId,
        timestamp
      });
      throw new Error(`Failed to create conversation: ${convError}`);
    }
  } else {
    // 更新對話
    const timestamp = nowISO();
    if (platform === 'line') {
      console.log(`🔄 [${platformLabel} Webhook] Updating existing conversation:`, {
        conversationId: conversation.id,
        customerId,
        timestamp
      });
    }

    await drizzleDb
      .update(conversations)
      .set({
        lastMessageAt: timestamp,
        updatedAt: timestamp
      })
      .where(eq(conversations.id, conversation.id));

    if (platform === 'line') {
      console.log(`✅ [${platformLabel} Webhook] Existing conversation updated successfully`);
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

  console.log(`🔍 [${platformLabel} Webhook] Checking for duplicate messages with platformMessageId:`, platformMessageId);
  const existingMessage = await drizzleDb
    .select()
    .from(messages)
    .where(eq(messages.platformMessageId, platformMessageId))
    .get();

  if (existingMessage) {
    console.log(`⚠️ [${platformLabel} Webhook] Message already exists with platformMessageId: ${platformMessageId}, skipping duplicate processing`);
    return true;
  }

  console.log(`✅ [${platformLabel} Webhook] No duplicate message found, proceeding with message creation`);
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
    console.log(`💾 [${platformLabel} Webhook] Creating message...`, {
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

    // 🚀 Trigger latest message cache update
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
      console.log(`✅ [${platformLabel} Webhook] Message created successfully:`, {
        messageId,
        conversationId,
        customerId,
        platformMessageId
      });
    }
  } catch (messageError) {
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
