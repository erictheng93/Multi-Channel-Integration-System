// Message Service for Conversations Module
// 訊息服務層

import { createDbClient, type Database } from '@/db/drizzle-factory';
import { eq, desc, and, inArray, gte } from 'drizzle-orm';
import { messages, conversations, customers, fileAttachments } from '@/db/schema';
import type { Bindings } from '@/types';
import type { LineReplyMessage } from '@/types';
import type { Context } from 'hono';
import type {
  Message,
  NewMessage,
  MessageSendRequest,
  MessageSendResponse,
} from '../types/conversation-types';
import { MessageDeliveryService } from './message-delivery-service';
import { nowISO, nowMs } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('MessageService');
const requestLog = createContextLogger('MessageRequestService');

function toMessageSnapshot(messageData: NewMessage, updatedAt: string | null): Message {
  return {
    id: messageData.id ?? '',
    conversationId: messageData.conversationId,
    senderType: messageData.senderType,
    customerSenderId: messageData.customerSenderId ?? null,
    agentSenderId: messageData.agentSenderId ?? null,
    content: messageData.content,
    messageType: typeof messageData.messageType === 'string' ? messageData.messageType : 'text',
    platformMessageId: messageData.platformMessageId ?? null,
    isRecalled: messageData.isRecalled ?? false,
    recallDeadline: messageData.recallDeadline ?? null,
    recalledAt: messageData.recalledAt ?? null,
    isSent: messageData.isSent ?? true,
    sentAt: messageData.sentAt ?? null,
    deliveryStatus: messageData.deliveryStatus ?? 'delivered',
    replyToMessageId: messageData.replyToMessageId ?? null,
    threadId: messageData.threadId ?? null,
    sessionId: messageData.sessionId ?? null,
    sessionSequence: messageData.sessionSequence ?? 1,
    metadata: messageData.metadata ?? null,
    senderName: messageData.senderName ?? null,
    readBy: messageData.readBy ?? null,
    createdAt: messageData.createdAt ?? null,
    updatedAt,
    deletedAt: null
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type MessageRequestType = NonNullable<MessageSendRequest['messageType']>;

function isMessageRequestType(value: unknown): value is MessageRequestType {
  return value === 'text' || value === 'image' || value === 'file' || value === 'quick_reply';
}

export interface MessageServiceInterface {
  sendMessage(request: MessageSendRequest): Promise<MessageSendResponse>;
  createPendingMessage(request: MessageSendRequest, recallWindowSeconds?: number): Promise<MessageSendResponse>;
  processBackgroundSending(messageId: string, request: MessageSendRequest, user: unknown): Promise<void>;
  getMessages(conversationId: string, limit?: number, offset?: number): Promise<Message[]>;
  recallMessage(messageId: string, userId: string): Promise<boolean>;
  updateMessage(messageId: string, updates: Partial<Message>): Promise<Message>;
}

export class MessageService implements MessageServiceInterface {
  private db: Database;
  private bindings: Bindings;

  constructor(bindings: Bindings) {
    // FIX: Use createDbClient with casing: 'camelCase' instead of raw drizzle()
    // Raw drizzle() missing casing option caused conversations.updatedAt and lastMessageAt
    // to not be updated in batch operations (column name mismatch)
    this.db = createDbClient(bindings.DB);
    this.bindings = bindings;
  }

  /**
   * Create a pending message (Step 1 of Async Sending)
   * Inserts message to DB with 'pending' status and returns immediately.
   *
   * With recallWindowSeconds > 0 the message is created as 'buffered' with a
   * recallDeadline snapshot instead — it must NOT be delivered before the
   * window expires (DelayedMessageScheduler owns the timing).
   */
  async createPendingMessage(request: MessageSendRequest, recallWindowSeconds: number = 0): Promise<MessageSendResponse> {
    const messageId = crypto.randomUUID();
    const timestamp = nowISO();
    let buffered = false;

    try {
      // Step 1: Get conversation with customer details
      const [conversationData] = await this.db
        .select({
          conversation: conversations,
          customer: customers
        })
        .from(conversations)
        .leftJoin(customers, eq(conversations.customerId, customers.id))
        .where(eq(conversations.id, request.conversationId))
        .limit(1);

      if (!conversationData || !conversationData.customer) {
        throw new Error(`Conversation or customer not found`);
      }

      const { customer } = conversationData;
      buffered = recallWindowSeconds > 0 && customer.platform === 'line';

      // Step 2: Insert Message (Pending)
      const messageData: NewMessage = {
        id: messageId,
        conversationId: request.conversationId,
        content: request.content,
        senderType: 'agent',
        agentSenderId: request.senderId,
        messageType: request.messageType || 'text',
        platformMessageId: null,
        isSent: false,
        deliveryStatus: buffered ? 'buffered' : 'pending',
        recallDeadline: null,
        senderName: request.senderName || null,
        createdAt: timestamp,
        metadata: JSON.stringify({
          ...request.metadata,
          platform: customer.platform,
          platformUserId: customer.platformUserId,
          // Persisted so MessageDeliveryService can rebuild the send from D1
          // alone (delayed delivery via DO alarm has no request object).
          ...(request.attachmentIds && request.attachmentIds.length > 0 && {
            attachmentIds: request.attachmentIds
          })
        })
      };

      // Step 3: Insert message
      await this.db.insert(messages).values(messageData);
      log.info('Message inserted', { messageId });

      // Step 3b: Link attachments if any
      if (request.attachmentIds && request.attachmentIds.length > 0) {
        await this.db
          .update(fileAttachments)
          .set({ messageId: messageId })
          .where(inArray(fileAttachments.id, request.attachmentIds));
        log.info('Linked attachments', { count: request.attachmentIds.length });
      }

      // Step 3c: Update conversation timestamps (explicit standalone UPDATE)
      // Previously used db.batch() with dynamic array + `as any` cast, which silently
      // dropped the UPDATE operation on D1. Using explicit sequential calls instead.
      await this.db
        .update(conversations)
        .set({ lastMessageAt: timestamp, updatedAt: timestamp })
        .where(eq(conversations.id, request.conversationId));
      log.info('Conversation timestamps updated', { updatedAt: timestamp });

      const insertedMessage = toMessageSnapshot(messageData, timestamp);

      return {
        success: true,
        messageId,
        message: insertedMessage,
        conversationId: request.conversationId,
        content: request.content,
        timestamp
      };
    } catch (error) {
      log.error('createPendingMessage error', {}, error instanceof Error ? error : String(error));
      throw error;
    }
  }

  /**
   * Process background sending (Step 2 of Async Sending)
   * Delegates to the shared MessageDeliveryService, which reads the message
   * and its attachments from D1 (also used by DelayedMessageScheduler DO).
   */
  async processBackgroundSending(messageId: string, _request: MessageSendRequest, _user: unknown): Promise<void> {
    const deliveryService = new MessageDeliveryService(this.bindings);
    await deliveryService.deliver(messageId);
  }

  /**
   * Send a new message in a conversation (Synchronous - Legacy/Fallback)
   */
  async sendMessage(request: MessageSendRequest): Promise<MessageSendResponse> {
    const messageId = crypto.randomUUID();
    const timestamp = nowISO();

    try {
      // Step 1: Get conversation with customer details to get platformUserId
      const [conversationData] = await this.db
        .select({
          conversation: conversations,
          customer: customers
        })
        .from(conversations)
        .leftJoin(customers, eq(conversations.customerId, customers.id))
        .where(eq(conversations.id, request.conversationId))
        .limit(1);

      if (!conversationData) {
        throw new Error(`Conversation ${request.conversationId} not found`);
      }

      if (!conversationData.customer) {
        throw new Error(`Customer not found for conversation ${request.conversationId}`);
      }

      const { customer } = conversationData;
      let platformMessageId: string | null = null;
      let isSent = false;
      let deliveryStatus: 'sent' | 'failed' | 'pending' | 'partial' = 'pending';
      let errorMessage: string | undefined;

      // Step 2: Send message via LINE API (only for LINE platform)
      if (customer.platform === 'line' && customer.platformUserId) {
        try {
          log.info('Sending LINE message', { platformUserId: customer.platformUserId });

          const { pushLineMessage, createTextMessage, createImageMessage, createFileFlexMessage } = await import('@/utils/line');
          const lineMessages: LineReplyMessage[] = [];

          const hasAttachments = request.attachmentIds && request.attachmentIds.length > 0;
          const isFileOnlyContent = request.content && (
            /^Sent a file:\s*.+$/i.test(request.content) ||        // "Sent a file: xxx"
            /^Sent \d+ files$/i.test(request.content) ||           // "Sent 2 files", "Sent 3 files"
            /^\[(?:檔案|圖片)\]\s*.+$/.test(request.content) // "[檔案] xxx", "[圖片] xxx"
          );

          if (request.content && request.content.trim() && !isFileOnlyContent) {
            lineMessages.push(createTextMessage(request.content));
          } else if (request.content && isFileOnlyContent && !hasAttachments) {
            lineMessages.push(createTextMessage(request.content));
          }

          if (request.attachmentIds && request.attachmentIds.length > 0) {
            const attachmentsData = await this.db
              .select()
              .from(fileAttachments)
              .where(inArray(fileAttachments.id, request.attachmentIds));

            for (const attachment of attachmentsData) {
              const fileUrl = attachment.fileUrl;
              if (fileUrl) {
                if (attachment.mimeType?.startsWith('image/')) {
                  // Use native LINE image message (直接顯示圖片，可儲存/分享)
                  lineMessages.push(createImageMessage(fileUrl));
                } else {
                  // Use Flex Message card for files (PDF, Word, Excel, etc.)
                  const flexMessage = createFileFlexMessage(
                    fileUrl,
                    attachment.filename || 'File',
                    attachment.mimeType || '',
                    attachment.fileSize || 0
                  );
                  lineMessages.push(flexMessage);
                }
              }
            }
          }

          if (lineMessages.length > 0) {
            // FIX: LINE API 每次最多只能發送 5 則訊息，需要分批發送
            const LINE_MESSAGE_LIMIT = 5;
            const totalMessages = lineMessages.length;
            const batches = Math.ceil(totalMessages / LINE_MESSAGE_LIMIT);

            log.info('Sending messages in batches', { totalMessages, batches });

            let allBatchesSuccessful = true;
            let successfulBatches = 0;

            for (let i = 0; i < totalMessages; i += LINE_MESSAGE_LIMIT) {
              const batch = lineMessages.slice(i, i + LINE_MESSAGE_LIMIT);
              const batchNumber = Math.floor(i / LINE_MESSAGE_LIMIT) + 1;

              const sendSuccess = await pushLineMessage(
                this.bindings.LINE_CHANNEL_ACCESS_TOKEN,
                customer.platformUserId,
                batch
              );

              if (sendSuccess) {
                successfulBatches++;
              } else {
                allBatchesSuccessful = false;
                log.error('Batch failed', { batchNumber, batches });
              }

              // 批次間延遲
              if (i + LINE_MESSAGE_LIMIT < totalMessages) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            }

            if (allBatchesSuccessful) {
              platformMessageId = `line_${nowMs()}`;
              isSent = true;
              deliveryStatus = 'sent';
            } else if (successfulBatches > 0) {
              platformMessageId = `line_${nowMs()}_partial`;
              isSent = true;
              deliveryStatus = 'partial';
              errorMessage = `部分發送成功: ${successfulBatches}/${batches} 批次`;
            } else {
              errorMessage = 'LINE API returned failure for all batches';
              deliveryStatus = 'failed';
            }
          } else {
            errorMessage = 'No content or attachments to send';
            deliveryStatus = 'failed';
          }

        } catch (lineError) {
          errorMessage = lineError instanceof Error ? lineError.message : 'LINE API error';
          deliveryStatus = 'failed';
        }
      } else if (customer.platform !== 'line') {
        deliveryStatus = 'pending';
        errorMessage = `Platform ${customer.platform} not yet supported`;
      } else {
        errorMessage = 'Missing platformUserId for LINE customer';
        deliveryStatus = 'failed';
      }

      // Step 3: Insert message
      const messageData: NewMessage = {
        id: messageId,
        conversationId: request.conversationId,
        content: request.content,
        senderType: 'agent',
        agentSenderId: request.senderId,
        messageType: request.messageType || 'text',
        platformMessageId,
        isSent,
        deliveryStatus,
        senderName: request.senderName || null,
        createdAt: timestamp,
        metadata: JSON.stringify({
          ...request.metadata,
          platform: customer.platform,
          platformUserId: customer.platformUserId,
          ...(errorMessage && { error: errorMessage })
        })
      };
      await this.db.insert(messages).values(messageData);

      // Step 3b: Link attachments if any
      if (request.attachmentIds && request.attachmentIds.length > 0) {
        await this.db
          .update(fileAttachments)
          .set({ messageId: messageId })
          .where(inArray(fileAttachments.id, request.attachmentIds));
      }

      // Step 3c: Update conversation timestamps (explicit standalone UPDATE)
      // Previously used db.batch() with dynamic array + `as any` cast, which silently
      // dropped the UPDATE operation on D1. Using explicit sequential calls instead.
      await this.db
        .update(conversations)
        .set({
          lastMessageAt: timestamp,
          updatedAt: timestamp
        })
        .where(eq(conversations.id, request.conversationId));

      const insertedMessage = toMessageSnapshot(messageData, timestamp);

      return {
        success: isSent,
        messageId,
        message: insertedMessage,
        conversationId: request.conversationId,
        content: request.content,
        timestamp,
        ...(errorMessage && { error: errorMessage })
      };

    } catch (error) {
      log.error('sendMessage error', {}, error instanceof Error ? error : String(error));

      try {
        const failedMessageData: NewMessage = {
          id: messageId,
          conversationId: request.conversationId,
          content: request.content,
          senderType: 'agent',
          agentSenderId: request.senderId,
          messageType: request.messageType || 'text',
          platformMessageId: null,
          isSent: false,
          deliveryStatus: 'failed',
          senderName: request.senderName || null,
          createdAt: timestamp,
          metadata: JSON.stringify({
            ...request.metadata,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        };

        await this.db.insert(messages).values(failedMessageData);
      } catch (dbError) {
        log.error('Failed to save error message to DB', {}, dbError instanceof Error ? dbError : String(dbError));
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send message',
      };
    }
  }

  /**
   * Get messages for a conversation with pagination
   */
  async getMessages(conversationId: string, limit: number = 50, offset: number = 0): Promise<Message[]> {
    try {
      const messageList = await this.db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            eq(messages.isRecalled, false)
          )
        )
        .orderBy(desc(messages.createdAt))
        .limit(Math.min(limit, 100))
        .offset(offset);

      return messageList;

    } catch (error) {
      log.error('getMessages error', { conversationId }, error instanceof Error ? error : String(error));
      return [];
    }
  }

  /**
   * Recall a message (soft delete)
   */
  async recallMessage(messageId: string, userId: string): Promise<boolean> {
    try {
      const timestamp = nowISO();

      await this.db
        .update(messages)
        .set({
          isRecalled: true,
          recalledAt: timestamp,
          // Store who recalled it in metadata
          metadata: JSON.stringify({ recalledBy: userId, recalledAt: timestamp })
        })
        .where(eq(messages.id, messageId));

      return true;

    } catch (error) {
      log.error('recallMessage error', { messageId }, error instanceof Error ? error : String(error));
      return false;
    }
  }

  /**
   * Update an existing message
   */
  async updateMessage(messageId: string, updates: Partial<Message>): Promise<Message> {
    try {
      const updateData = {
        ...updates,
        updatedAt: nowISO()
      };

      await this.db
        .update(messages)
        .set(updateData)
        .where(eq(messages.id, messageId));

      const [updatedMessage] = await this.db
        .select()
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);

      if (!updatedMessage) {
        throw new Error(`Message with ID ${messageId} not found after update`);
      }

      return updatedMessage;

    } catch (error) {
      log.error('updateMessage error', { messageId }, error instanceof Error ? error : String(error));
      throw error;
    }
  }

  /**
   * Get recent messages for streaming
   */
  async getRecentMessages(conversationId: string, limit: number): Promise<Message[]> {
    try {
      const recentMessages = await this.db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            eq(messages.isRecalled, false)
          )
        )
        .orderBy(desc(messages.createdAt))
        .limit(limit);

      // Return in chronological order (oldest first)
      return recentMessages.reverse();

    } catch (error) {
      log.error('getRecentMessages error', { conversationId }, error instanceof Error ? error : String(error));
      return [];
    }
  }

  /**
   * Get messages after a specific timestamp for streaming
   */
  async getMessagesAfterTimestamp(conversationId: string, afterTimestamp: string): Promise<Message[]> {
    try {
      return await this.db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            eq(messages.isRecalled, false),
            gte(messages.createdAt, afterTimestamp)
          )
        )
        .orderBy(messages.createdAt);

    } catch (error) {
      log.error('getMessagesAfterTimestamp error', { conversationId }, error instanceof Error ? error : String(error));
      return [];
    }
  }
}

// Message Request Validation Service
export class MessageRequestService {
  static async validateAndParse(c: Context<{ Bindings: Bindings }>): Promise<MessageSendRequest> {
    const conversationId = c.req.param('id');
    const body = await c.req.json<Record<string, unknown>>();

    requestLog.debug('Raw request body', { body: JSON.stringify(body) });
    requestLog.debug('attachmentIds in body', { attachmentIds: body.attachmentIds });

    if (!conversationId) {
      throw new Error('Missing conversation ID');
    }

    // FIX: Content is required unless attachments are provided
    const attachmentIds = Array.isArray(body.attachmentIds)
      ? body.attachmentIds.filter((id): id is string => typeof id === 'string')
      : [];
    const hasAttachments = attachmentIds.length > 0;
    requestLog.debug('hasAttachments', { hasAttachments });

    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content && !hasAttachments) {
      throw new Error('Message content or attachments are required');
    }

    if (typeof body.senderId !== 'string' || !body.senderId) {
      throw new Error('Sender ID is required');
    }

    const result: MessageSendRequest = {
      conversationId,
      content,
      senderId: body.senderId,
      messageType: isMessageRequestType(body.messageType) ? body.messageType : 'text',
      metadata: isRecord(body.metadata) ? body.metadata : {},
      attachmentIds
    };

    requestLog.debug('Parsed request', { result: JSON.stringify(result) });
    return result;
  }
}
