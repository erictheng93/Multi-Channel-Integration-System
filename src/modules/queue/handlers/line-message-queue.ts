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
 * Agent -> HTTP Handler -> Queue.send() -> Immediate Response
 * |
 * v
 * Queue Consumer -> LINE API -> WebSocket Status Update
 */

import type { Bindings, LineMessageQueuePayload, LineMessageQueueResult, MediaProcessingPayload, LineQueuePayload } from '@/types/bindings';
import type { LineReplyMessage } from '@/types';
import { pushLineMessage, createTextMessage, createImageMessage, createFileFlexMessage } from '@/utils/line';
import { WebSocketBroadcastService } from '@/services/websocket-broadcast-service';
import { createDbClient } from '@/db/drizzle-factory';
import { messages } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { nowMs } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger'
import { processLineMedia } from '@/modules/integrations/services/webhook-media-service';

const log = createContextLogger('LineMessageQueue')

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
   * Routes to outbound message handler or media processing handler based on payload type
   */
  async processBatch(batch: MessageBatch<LineQueuePayload>): Promise<void> {
    log.info('Processing batch', { count: batch.messages.length });

    for (const message of batch.messages) {
      try {
        const payload = message.body;

        // Route by type: media_processing vs outbound_message (default)
        if (payload.type === 'media_processing') {
          await this.processMediaMessage(payload as MediaProcessingPayload);
          message.ack();
          log.info('Media processing completed', { messageId: payload.messageId });
        } else {
          // Outbound message (existing behavior, backward compatible for messages without type)
          const result = await this.processMessage(payload as LineMessageQueuePayload);
          if (result.success) {
            message.ack();
            log.info('Message delivered successfully', { messageId: result.messageId });
          } else {
            message.retry();
            log.warn('Message failed, will retry', { messageId: result.messageId, error: result.error });
          }
        }
      } catch (error) {
        const messageId = message.body.messageId || 'unknown';
        log.error('Error processing queue message', { messageId }, error instanceof Error ? error : String(error));
        message.retry();
      }
    }
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

      // FIX: LINE API 每次最多只能發送 5 則訊息，需要分批發送
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
        log.info('Sending messages in batches', { totalMessages });

        for (let i = 0; i < totalMessages; i += LINE_MESSAGE_LIMIT) {
          const batch = lineMessages.slice(i, i + LINE_MESSAGE_LIMIT);
          const batchSuccess = await pushLineMessage(
            this.env.LINE_CHANNEL_ACCESS_TOKEN,
            payload.recipientPlatformId,
            batch
          );

          if (!batchSuccess) {
            sendResult = false;
            log.error('Batch failed', { batchIndex: Math.floor(i / LINE_MESSAGE_LIMIT) + 1 });
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
        log.info('Message delivered', { messageId: payload.messageId, durationMs: duration });

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
  private async buildLineMessages(payload: LineMessageQueuePayload): Promise<LineReplyMessage[]> {
    const lineMessages: LineReplyMessage[] = [];

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

      log.info('Updated message status', { messageId, status });
    } catch (error) {
      log.error('Failed to update message status', { messageId }, error instanceof Error ? error : String(error));
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

      log.info('Broadcasted delivery status', { messageId: result.messageId });
    } catch (error) {
      log.error('Failed to broadcast delivery status', { messageId: result.messageId }, error instanceof Error ? error : String(error));
      // Don't throw - broadcast failure shouldn't fail message delivery
    }
  }

  /**
   * Process a media processing message
   * Downloads file from LINE API, stores in R2, creates file_attachments,
   * and broadcasts message_updated via WebSocket
   */
  private async processMediaMessage(payload: MediaProcessingPayload): Promise<void> {
    const { messageId, conversationId, lineMessageId, lineMessageType, fileName } = payload;

    log.info('Processing media from queue', { messageId, lineMessageId, lineMessageType, fileName });

    // Step 1: Download from LINE API + upload to R2 + insert file_attachments
    const fileAttachmentData = await processLineMedia(
      this.env, messageId, lineMessageId, lineMessageType, fileName
    );

    if (fileAttachmentData.length === 0) {
      // processLineMedia returns [] on failure — let queue retry
      throw new Error(`Media processing failed for LINE message ${lineMessageId}`);
    }

    // Step 2: Broadcast message_updated to global WebSocket (conversation list)
    // Non-critical: media is already persisted. A broadcast failure must NOT
    // throw -- otherwise the queue retries the whole job and re-stores the media.
    try {
      await this.broadcastService.broadcastMessageEvent({
        type: 'message_updated',
        conversationId,
        messageId,
        data: { file_attachments: fileAttachmentData },
        priority: 'high'
      });
    } catch (broadcastErr) {
      log.warn('Media message_updated broadcast failed (non-critical)', {
        messageId,
        error: broadcastErr instanceof Error ? broadcastErr.message : String(broadcastErr)
      });
    }

    // Step 3: Notify CustomerConversationDO directly (conversation detail page)
    try {
      if (this.env.CUSTOMER_CONVERSATION_DO) {
        const doId = this.env.CUSTOMER_CONVERSATION_DO.idFromName(conversationId);
        const doStub = this.env.CUSTOMER_CONVERSATION_DO.get(doId);
        await doStub.fetch(new Request('https://customer-conversation-do/notify-message-updated', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            messageId,
            data: { file_attachments: fileAttachmentData }
          })
        }));
      }
    } catch (doErr) {
      log.warn('CustomerConversationDO message_updated notify failed', {
        error: doErr instanceof Error ? doErr.message : String(doErr)
      });
      // Non-critical — don't throw, media is already stored
    }

    log.info('Media processing complete', { messageId, lineMessageId, attachments: fileAttachmentData.length });
  }
}

/**
 * Queue handler export for Cloudflare Workers
 * This is called by the Workers runtime when messages arrive
 */
export async function handleLineMessageQueue(
  batch: MessageBatch<LineQueuePayload>,
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
    log.info('Enqueued message for delivery', { messageId: payload.messageId });
    return { success: true };
  } catch (error) {
    log.error('Failed to enqueue message', {}, error instanceof Error ? error : String(error));
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
