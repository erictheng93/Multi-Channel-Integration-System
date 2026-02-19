/**
 * LINE Message Queue Consumer Handler
 * Phase 3: LINE 非同步化
 *
 * Purpose: Process LINE messages asynchronously for better UX
 * - Decouples HTTP response from LINE API calls
 * - Provides automatic retry with exponential backoff
 * - Reports delivery status via WebSocket
 *
 * Architecture:
 *   Agent -> HTTP Handler -> Queue.send() -> Immediate Response
 *                              |
 *                              v
 *                        Queue Consumer -> LINE API -> WebSocket Status Update
 */

import type { Bindings, LineMessageQueuePayload, LineMessageQueueResult } from '@/types/bindings';
import { pushLineMessage, createTextMessage, createImageMessage, createFileFlexMessage } from '@/utils/line';
import { WebSocketBroadcastService } from '@/services/websocket-broadcast-service';
import { createDbClient } from '@/db/drizzle-factory';
import { messages } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { nowMs } from '@/utils/timestamp'

/**
 * LINE Message Queue Consumer
 * Processes batches of LINE messages from the queue
 */
export class LineMessageQueueConsumer {
  private env: Bindings;
  private broadcastService: WebSocketBroadcastService;

  constructor(env: Bindings) {
    this.env = env;
    this.broadcastService = new WebSocketBroadcastService(env);
  }

  /**
   * Process a batch of messages from the queue
   * Called by Cloudflare Queue consumer
   */
  async processBatch(batch: MessageBatch<LineMessageQueuePayload>): Promise<void> {
    console.log(`📨 [LINE Queue] Processing batch of ${batch.messages.length} messages`);

    const results: { message: Message<LineMessageQueuePayload>; success: boolean; error?: string }[] = [];

    for (const message of batch.messages) {
      try {
        const result = await this.processMessage(message.body);
        results.push({ message, success: result.success, error: result.error });

        if (result.success) {
          // Acknowledge successful message
          message.ack();
          console.log(`✅ [LINE Queue] Message ${message.body.messageId} delivered successfully`);
        } else {
          // Retry failed message (will be automatically retried by Cloudflare)
          message.retry();
          console.warn(`⚠️ [LINE Queue] Message ${message.body.messageId} failed, will retry: ${result.error}`);
        }
      } catch (error) {
        console.error(`❌ [LINE Queue] Error processing message ${message.body.messageId}:`, error);
        message.retry();
        results.push({
          message,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Log batch summary
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    console.log(`📊 [LINE Queue] Batch complete: ${successCount} succeeded, ${failureCount} failed`);
  }

  /**
   * Process a single message
   */
  private async processMessage(payload: LineMessageQueuePayload): Promise<LineMessageQueueResult> {
    const startTime = nowMs();

    try {
      // Build LINE messages array
      const lineMessages = await this.buildLineMessages(payload);

      if (lineMessages.length === 0) {
        return {
          messageId: payload.messageId,
          conversationId: payload.conversationId,
          success: false,
          error: 'No messages to send'
        };
      }

      // 🔧 FIX: LINE API 每次最多只能發送 5 則訊息，需要分批發送
      const LINE_MESSAGE_LIMIT = 5;
      const totalMessages = lineMessages.length;
      let sendResult = true;

      if (totalMessages <= LINE_MESSAGE_LIMIT) {
        // 5 則以下直接發送
        sendResult = await pushLineMessage(
          this.env.LINE_CHANNEL_ACCESS_TOKEN,
          payload.recipientPlatformId,
          lineMessages
        );
      } else {
        // 超過 5 則需要分批發送
        console.log(`[LINE Queue] 📦 Sending ${totalMessages} messages in batches`);

        for (let i = 0; i < totalMessages; i += LINE_MESSAGE_LIMIT) {
          const batch = lineMessages.slice(i, i + LINE_MESSAGE_LIMIT);
          const batchSuccess = await pushLineMessage(
            this.env.LINE_CHANNEL_ACCESS_TOKEN,
            payload.recipientPlatformId,
            batch
          );

          if (!batchSuccess) {
            sendResult = false;
            console.error(`[LINE Queue] ❌ Batch ${Math.floor(i / LINE_MESSAGE_LIMIT) + 1} failed`);
          }

          // 批次間延遲
          if (i + LINE_MESSAGE_LIMIT < totalMessages) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }

      if (sendResult) {
        // Update message status in database
        await this.updateMessageStatus(payload.messageId, 'delivered');

        // Broadcast success via WebSocket
        await this.broadcastDeliveryStatus({
          messageId: payload.messageId,
          conversationId: payload.conversationId,
          success: true,
          deliveredAt: nowMs()
        });

        const duration = Date.now() - startTime;
        console.log(`✅ [LINE Queue] Message ${payload.messageId} delivered in ${duration}ms`);

        return {
          messageId: payload.messageId,
          conversationId: payload.conversationId,
          success: true,
          deliveredAt: nowMs()
        };
      } else {
        // LINE API returned failure
        const error = 'LINE API returned failure';

        // Broadcast failure via WebSocket
        await this.broadcastDeliveryStatus({
          messageId: payload.messageId,
          conversationId: payload.conversationId,
          success: false,
          error,
          retryCount: payload.metadata.retryCount
        });

        return {
          messageId: payload.messageId,
          conversationId: payload.conversationId,
          success: false,
          error
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Broadcast failure via WebSocket
      await this.broadcastDeliveryStatus({
        messageId: payload.messageId,
        conversationId: payload.conversationId,
        success: false,
        error: errorMessage,
        retryCount: payload.metadata.retryCount
      });

      return {
        messageId: payload.messageId,
        conversationId: payload.conversationId,
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Build LINE message objects from payload
   */
  private async buildLineMessages(payload: LineMessageQueuePayload): Promise<any[]> {
    const lineMessages: any[] = [];

    // Check if content is just a file description (should not send as text)
    const isFileOnlyContent = payload.content && (
      /^Sent a file:\s*.+$/i.test(payload.content) ||
      /^Sent \d+ files$/i.test(payload.content) ||
      /^\[(?:檔案|圖片)\]\s*.+$/.test(payload.content)
    );

    // Add text message if content is not just a file description
    if (payload.content && !isFileOnlyContent) {
      lineMessages.push(createTextMessage(payload.content));
    }

    // Add attachments - Images use native LINE format, files use Flex Message
    if (payload.attachments && payload.attachments.length > 0) {
      for (const attachment of payload.attachments) {
        if (attachment.type === 'image') {
          // Use native LINE image message (直接顯示圖片，可儲存/分享)
          lineMessages.push(createImageMessage(attachment.url));
        } else {
          // Use Flex Message card for files (PDF, Word, Excel, etc.)
          lineMessages.push(createFileFlexMessage(
            attachment.url,
            attachment.filename || 'File',
            attachment.mimeType || 'application/octet-stream',
            attachment.fileSize || 0
          ));
        }
      }
    }

    return lineMessages;
  }

  /**
   * Update message status in database
   */
  private async updateMessageStatus(messageId: string, status: 'delivered' | 'failed'): Promise<void> {
    try {
      const db = createDbClient(this.env.DB);

      await db.update(messages)
        .set({
          deliveryStatus: status === 'delivered' ? 'delivered' : 'failed'
        })
        .where(eq(messages.id, messageId));

      console.log(`📝 [LINE Queue] Updated message ${messageId} status to ${status}`);
    } catch (error) {
      console.error(`❌ [LINE Queue] Failed to update message status:`, error);
      // Don't throw - status update failure shouldn't fail message delivery
    }
  }

  /**
   * Broadcast delivery status via WebSocket
   */
  private async broadcastDeliveryStatus(result: LineMessageQueueResult): Promise<void> {
    try {
      await this.broadcastService.broadcastMessageEvent({
        type: result.success ? 'message_delivered' : 'message_recall_failed',
        messageId: result.messageId,
        conversationId: result.conversationId,
        userId: 'system',
        data: {
          messageId: result.messageId,
          conversationId: result.conversationId,
          success: result.success,
          deliveredAt: result.deliveredAt,
          error: result.error,
          retryCount: result.retryCount
        }
      });

      console.log(`📡 [LINE Queue] Broadcasted delivery status for message ${result.messageId}`);
    } catch (error) {
      console.error(`❌ [LINE Queue] Failed to broadcast delivery status:`, error);
      // Don't throw - broadcast failure shouldn't fail message delivery
    }
  }
}

/**
 * Queue handler export for Cloudflare Workers
 * This is called by the Workers runtime when messages arrive
 */
export async function handleLineMessageQueue(
  batch: MessageBatch<LineMessageQueuePayload>,
  env: Bindings
): Promise<void> {
  const consumer = new LineMessageQueueConsumer(env);
  await consumer.processBatch(batch);
}

/**
 * Helper function to enqueue a LINE message
 * Used by message handlers to send messages asynchronously
 */
export async function enqueueLineMessage(
  env: Bindings,
  payload: LineMessageQueuePayload
): Promise<{ success: boolean; error?: string }> {
  try {
    await env.LINE_MESSAGE_QUEUE.send(payload);
    console.log(`📤 [LINE Queue] Enqueued message ${payload.messageId} for delivery`);
    return { success: true };
  } catch (error) {
    console.error(`❌ [LINE Queue] Failed to enqueue message:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to enqueue message'
    };
  }
}

/**
 * Create a queue payload from message data
 * Helper to construct properly typed payloads
 */
export function createLineMessagePayload(params: {
  messageId: string;
  conversationId: string;
  recipientPlatformId: string;
  content: string;
  messageType: 'text' | 'image' | 'file' | 'flex';
  agentId: string;
  agentName?: string;
  attachments?: Array<{
    id: string;
    type: 'image' | 'video' | 'audio' | 'file';
    url: string;
    filename?: string;
    mimeType?: string;
    fileSize?: number;
  }>;
  requestId?: string;
}): LineMessageQueuePayload {
  return {
    messageId: params.messageId,
    conversationId: params.conversationId,
    recipientPlatformId: params.recipientPlatformId,
    content: params.content,
    messageType: params.messageType,
    attachments: params.attachments,
    metadata: {
      agentId: params.agentId,
      agentName: params.agentName,
      enqueuedAt: nowMs(),
      retryCount: 0,
      originalRequestId: params.requestId
    }
  };
}

export default {
  handleLineMessageQueue,
  enqueueLineMessage,
  createLineMessagePayload,
  LineMessageQueueConsumer
};
