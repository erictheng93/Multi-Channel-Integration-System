// Message Service for Conversations Module
// 訊息服務層

import { createDbClient, type Database } from '@/db/drizzle-factory';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { messages, conversations, customers, fileAttachments } from '@/db/schema';
import type { Bindings } from '@/types';
import type {
  Message,
  NewMessage,
  MessageSendRequest,
  MessageSendResponse,
} from '../types/conversation-types';
import { WebSocketBroadcastService } from '@/services/websocket-broadcast-service';
import { nowISO, nowMs } from '@/utils/timestamp'

export interface MessageServiceInterface {
  sendMessage(request: MessageSendRequest): Promise<MessageSendResponse>;
  createPendingMessage(request: MessageSendRequest): Promise<MessageSendResponse>;
  processBackgroundSending(messageId: string, request: MessageSendRequest, user: any): Promise<void>;
  getMessages(conversationId: string, limit?: number, offset?: number): Promise<Message[]>;
  recallMessage(messageId: string, userId: string): Promise<boolean>;
  updateMessage(messageId: string, updates: Partial<Message>): Promise<Message>;
}

export class MessageService implements MessageServiceInterface {
  private db: Database;
  private bindings: Bindings;

  constructor(bindings: Bindings) {
    // 🔧 FIX: Use createDbClient with casing: 'camelCase' instead of raw drizzle()
    // Raw drizzle() missing casing option caused conversations.updatedAt and lastMessageAt
    // to not be updated in batch operations (column name mismatch)
    this.db = createDbClient(bindings.DB);
    this.bindings = bindings;
  }

  /**
   * Create a pending message (Step 1 of Async Sending)
   * Inserts message to DB with 'pending' status and returns immediately.
   */
  async createPendingMessage(request: MessageSendRequest): Promise<MessageSendResponse> {
    const messageId = crypto.randomUUID();
    const timestamp = nowISO();

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
        deliveryStatus: 'pending',
        senderName: request.senderName || null,
        createdAt: timestamp,
        metadata: JSON.stringify({
          ...request.metadata,
          platform: customer.platform,
          platformUserId: customer.platformUserId
        })
      };

      // Step 3: Insert message
      await this.db.insert(messages).values(messageData);
      console.log(`[MessageService] ✅ Message inserted: ${messageId}`);

      // Step 3b: Link attachments if any
      if (request.attachmentIds && request.attachmentIds.length > 0) {
        await this.db
          .update(fileAttachments)
          .set({ messageId: messageId })
          .where(inArray(fileAttachments.id, request.attachmentIds));
        console.log(`[MessageService] 📎 Linked ${request.attachmentIds.length} attachments`);
      }

      // Step 3c: Update conversation timestamps (explicit standalone UPDATE)
      // Previously used db.batch() with dynamic array + `as any` cast, which silently
      // dropped the UPDATE operation on D1. Using explicit sequential calls instead.
      await this.db
        .update(conversations)
        .set({ lastMessageAt: timestamp, updatedAt: timestamp })
        .where(eq(conversations.id, request.conversationId));
      console.log(`[MessageService] ✅ Conversation timestamps updated - updatedAt set to ${timestamp}`);

      const insertedMessage = { ...messageData, updatedAt: timestamp };

      return {
        success: true,
        messageId,
        message: insertedMessage as any,
        conversationId: request.conversationId,
        content: request.content,
        timestamp
      };
    } catch (error) {
      console.error('[MessageService] createPendingMessage error:', error);
      throw error;
    }
  }

  /**
   * Process background sending (Step 2 of Async Sending)
   * Sends to LINE and updates DB status.
   */
  async processBackgroundSending(messageId: string, request: MessageSendRequest, _user: any): Promise<void> {
    try {
      console.log(`[MessageService] 🚀 Starting background sending for message ${messageId}`);
      
      const [conversationData] = await this.db
        .select({
          conversation: conversations,
          customer: customers
        })
        .from(conversations)
        .leftJoin(customers, eq(conversations.customerId, customers.id))
        .where(eq(conversations.id, request.conversationId))
        .limit(1);

      if (!conversationData?.customer) {
        console.error('[MessageService] Customer not found for background sending');
        return;
      }
      const { customer } = conversationData;

      let isSent = false;
      let deliveryStatus: 'sent' | 'failed' | 'partial' = 'failed';
      let platformMessageId: string | null = null;
      let errorMessage: string | undefined;

      // LINE Sending Logic
      if (customer.platform === 'line' && customer.platformUserId) {
        try {
          const { pushLineMessage, createTextMessage, createImageMessage, createFileFlexMessage } = await import('@/utils/line');
          const lineMessages: any[] = [];

          const hasAttachments = request.attachmentIds && request.attachmentIds.length > 0;
          const isFileOnlyContent = request.content && (
            /^Sent a file:\s*.+$/i.test(request.content) ||
            /^Sent \d+ files$/i.test(request.content) ||
            /^\[(?:檔案|圖片)\]\s*.+$/.test(request.content) ||
            /^📎\s*.+$/.test(request.content)  // 匹配 "📎 filename" 格式
          );

          // 📝 詳細日誌：追蹤附件處理
          console.log(`[MessageService] 📎 Attachment check:`, {
            hasAttachments,
            attachmentIds: request.attachmentIds,
            attachmentCount: request.attachmentIds?.length || 0,
            content: request.content?.substring(0, 50),
            isFileOnlyContent
          });

          if (request.content && request.content.trim() && !isFileOnlyContent) {
            lineMessages.push(createTextMessage(request.content));
          } else if (request.content && isFileOnlyContent && !hasAttachments) {
            lineMessages.push(createTextMessage(request.content));
          }

          // 🔧 FIX: 改進附件處理邏輯，添加驗證和詳細錯誤報告
          if (request.attachmentIds && request.attachmentIds.length > 0) {
            console.log(`[MessageService] 📎 Querying ${request.attachmentIds.length} attachment(s):`, request.attachmentIds);

            const attachmentsData = await this.db
              .select()
              .from(fileAttachments)
              .where(inArray(fileAttachments.id, request.attachmentIds));

            console.log(`[MessageService] 📎 Query result: found ${attachmentsData.length} attachment(s)`);

            // ⚠️ 關鍵驗證：檢查是否找到所有附件
            if (attachmentsData.length === 0) {
              console.error(`[MessageService] ❌ CRITICAL: No attachments found in database!`, {
                requestedIds: request.attachmentIds,
                conversationId: request.conversationId,
                messageId
              });
              errorMessage = `附件未找到: 請求了 ${request.attachmentIds.length} 個附件但資料庫中未找到任何記錄`;
            } else if (attachmentsData.length < request.attachmentIds.length) {
              console.warn(`[MessageService] ⚠️ Partial attachments found:`, {
                requested: request.attachmentIds.length,
                found: attachmentsData.length,
                foundIds: attachmentsData.map(a => a.id),
                missingIds: request.attachmentIds.filter(id => !attachmentsData.some(a => a.id === id))
              });
            }

            let processedCount = 0;
            let skippedCount = 0;

            for (const attachment of attachmentsData) {
              const fileUrl = attachment.fileUrl;
              console.log(`[MessageService] 📎 Processing attachment:`, {
                id: attachment.id,
                filename: attachment.filename,
                mimeType: attachment.mimeType,
                fileUrl: fileUrl ? fileUrl.substring(0, 80) + '...' : 'NULL',
                hasFileUrl: !!fileUrl
              });

              if (fileUrl) {
                if (attachment.mimeType?.startsWith('image/')) {
                  // Use native LINE image message (直接顯示圖片，可儲存/分享)
                  lineMessages.push(createImageMessage(fileUrl));
                  console.log(`[MessageService] ✅ Added image message for: ${attachment.filename}`);
                } else {
                  // Use Flex Message card for files (PDF, Word, Excel, etc.)
                  const flexMessage = createFileFlexMessage(
                    fileUrl,
                    attachment.filename || 'File',
                    attachment.mimeType || '',
                    attachment.fileSize || 0
                  );
                  lineMessages.push(flexMessage);
                  console.log(`[MessageService] ✅ Added file flex message for: ${attachment.filename}`);
                }
                processedCount++;
              } else {
                console.error(`[MessageService] ❌ Skipping attachment with NULL fileUrl:`, {
                  id: attachment.id,
                  filename: attachment.filename,
                  r2Key: attachment.r2Key
                });
                skippedCount++;
              }
            }

            console.log(`[MessageService] 📎 Attachment processing summary:`, {
              total: attachmentsData.length,
              processed: processedCount,
              skipped: skippedCount,
              lineMessagesCount: lineMessages.length
            });

            // ⚠️ 如果有附件但都沒有有效的 fileUrl，記錄錯誤
            if (attachmentsData.length > 0 && processedCount === 0) {
              errorMessage = `所有附件都缺少有效的 fileUrl (${skippedCount} 個附件被跳過)`;
              console.error(`[MessageService] ❌ All attachments skipped due to missing fileUrl`);
            }
          }

          console.log(`[MessageService] 📤 Final lineMessages count: ${lineMessages.length}`);

          if (lineMessages.length > 0) {
            // 🔧 FIX: LINE API 每次最多只能發送 5 則訊息，需要分批發送
            const LINE_MESSAGE_LIMIT = 5;
            const totalMessages = lineMessages.length;
            const batches = Math.ceil(totalMessages / LINE_MESSAGE_LIMIT);

            console.log(`[MessageService] 📦 Sending ${totalMessages} messages in ${batches} batch(es)`);

            let allBatchesSuccessful = true;
            let successfulBatches = 0;
            let failedBatches = 0;

            for (let i = 0; i < totalMessages; i += LINE_MESSAGE_LIMIT) {
              const batch = lineMessages.slice(i, i + LINE_MESSAGE_LIMIT);
              const batchNumber = Math.floor(i / LINE_MESSAGE_LIMIT) + 1;

              console.log(`[MessageService] 📤 Sending batch ${batchNumber}/${batches} (${batch.length} messages)`);

              const sendSuccess = await pushLineMessage(
                this.bindings.LINE_CHANNEL_ACCESS_TOKEN,
                customer.platformUserId,
                batch
              );

              if (sendSuccess) {
                successfulBatches++;
                console.log(`[MessageService] ✅ Batch ${batchNumber}/${batches} sent successfully`);
              } else {
                allBatchesSuccessful = false;
                failedBatches++;
                console.error(`[MessageService] ❌ Batch ${batchNumber}/${batches} failed`);
              }

              // 如果有多個批次，稍微延遲以避免 LINE API rate limiting
              if (i + LINE_MESSAGE_LIMIT < totalMessages) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            }

            if (allBatchesSuccessful) {
              platformMessageId = `line_${nowMs()}`;
              isSent = true;
              deliveryStatus = 'sent';
              console.log(`[MessageService] ✅ All ${batches} batch(es) sent successfully (${totalMessages} messages total)`);
            } else if (successfulBatches > 0) {
              // 部分成功
              platformMessageId = `line_${nowMs()}_partial`;
              isSent = true;
              deliveryStatus = 'partial';
              errorMessage = `部分發送成功: ${successfulBatches}/${batches} 批次成功`;
              console.warn(`[MessageService] ⚠️ Partial success: ${successfulBatches}/${batches} batches sent`);
            } else {
              errorMessage = 'LINE API returned failure for all batches';
              console.error(`[MessageService] ❌ All ${batches} batch(es) failed`);
            }
          } else if (hasAttachments) {
            // ⚠️ 有附件但最終沒有消息要發送 - 這是一個問題
            errorMessage = errorMessage || '有附件但無法生成 LINE 消息（可能是附件查詢或 fileUrl 問題）';
            console.error(`[MessageService] ❌ Has attachments but no LINE messages generated!`, {
              attachmentIds: request.attachmentIds,
              errorMessage
            });
          }
        } catch (lineError) {
          errorMessage = lineError instanceof Error ? lineError.message : 'LINE API error';
          console.error(`[MessageService] ❌ LINE API error:`, lineError);
        }
      }

      // Update Message Status
      await this.db.update(messages).set({
        isSent,
        deliveryStatus,
        platformMessageId,
        metadata: JSON.stringify({
          ...request.metadata,
          platform: customer.platform,
          platformUserId: customer.platformUserId,
          ...(errorMessage && { error: errorMessage })
        })
      }).where(eq(messages.id, messageId));

      // Broadcast Update
      const broadcastService = new WebSocketBroadcastService(this.bindings);
      await broadcastService.broadcastMessageEvent({
        type: 'message_updated',
        conversationId: request.conversationId,
        messageId: messageId,
        agentId: request.senderId,
        data: {
          deliveryStatus,
          isSent,
          platformMessageId,
          timestamp: nowISO()
        },
        priority: 'normal'
      });
      console.log(`[MessageService] 📡 Broadcasted message update: ${deliveryStatus}`);

    } catch (error) {
      console.error('[MessageService] Background sending failed:', error);
      await this.db.update(messages).set({
        deliveryStatus: 'failed',
        metadata: JSON.stringify({ error: String(error) })
      }).where(eq(messages.id, messageId));
    }
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
          console.log(`[MessageService] Sending LINE message to user ${customer.platformUserId}`);

          const { pushLineMessage, createTextMessage, createImageMessage, createFileFlexMessage } = await import('@/utils/line');
          const lineMessages: any[] = [];

          const hasAttachments = request.attachmentIds && request.attachmentIds.length > 0;
          const isFileOnlyContent = request.content && (
            /^Sent a file:\s*.+$/i.test(request.content) ||        // "Sent a file: xxx"
            /^Sent \d+ files$/i.test(request.content) ||           // "Sent 2 files", "Sent 3 files"
            /^\[(?:檔案|圖片)\]\s*.+$/.test(request.content)       // "[檔案] xxx", "[圖片] xxx"
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
            // 🔧 FIX: LINE API 每次最多只能發送 5 則訊息，需要分批發送
            const LINE_MESSAGE_LIMIT = 5;
            const totalMessages = lineMessages.length;
            const batches = Math.ceil(totalMessages / LINE_MESSAGE_LIMIT);

            console.log(`[MessageService:sendMessage] 📦 Sending ${totalMessages} messages in ${batches} batch(es)`);

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
                console.error(`[MessageService:sendMessage] ❌ Batch ${batchNumber}/${batches} failed`);
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

      const insertedMessage = {
        ...messageData,
        updatedAt: timestamp
      };

      return {
        success: isSent,
        messageId,
        message: insertedMessage as any,
        conversationId: request.conversationId,
        content: request.content,
        timestamp,
        ...(errorMessage && { error: errorMessage })
      };

    } catch (error) {
      console.error('[MessageService] sendMessage error:', error);

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
        console.error('[MessageService] Failed to save error message to DB:', dbError);
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
      console.error('MessageService.getMessages error:', error);
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
      console.error('MessageService.recallMessage error:', error);
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
      console.error('MessageService.updateMessage error:', error);
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
      console.error('MessageService.getRecentMessages error:', error);
      return [];
    }
  }

  /**
   * Get messages after a specific timestamp for streaming
   */
  async getMessagesAfterTimestamp(conversationId: string, _afterTimestamp: string): Promise<Message[]> {
    try {
      return await this.db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            eq(messages.isRecalled, false)
          )
        )
        .orderBy(messages.createdAt);

    } catch (error) {
      console.error('MessageService.getMessagesAfterTimestamp error:', error);
      return [];
    }
  }
}

// Message Request Validation Service
export class MessageRequestService {
  static async validateAndParse(c: any): Promise<MessageSendRequest> {
    const conversationId = c.req.param('id');
    const body = await c.req.json();

    console.log(`[MessageRequestService] 📥 Raw request body:`, JSON.stringify(body));
    console.log(`[MessageRequestService] 📎 attachmentIds in body:`, body.attachmentIds);

    if (!conversationId) {
      throw new Error('Missing conversation ID');
    }

    // 🔧 FIX: Content is required unless attachments are provided
    const hasAttachments = body.attachmentIds && body.attachmentIds.length > 0;
    console.log(`[MessageRequestService] 📎 hasAttachments:`, hasAttachments);

    if (!body.content?.trim() && !hasAttachments) {
      throw new Error('Message content or attachments are required');
    }

    if (!body.senderId) {
      throw new Error('Sender ID is required');
    }

    const result = {
      conversationId,
      content: body.content?.trim() || '',
      senderId: body.senderId,
      messageType: body.messageType || 'text',
      metadata: body.metadata || {},
      attachmentIds: body.attachmentIds || []  // 🔧 FIX: Include attachmentIds
    };

    console.log(`[MessageRequestService] ✅ Parsed request:`, JSON.stringify(result));
    return result;
  }
}