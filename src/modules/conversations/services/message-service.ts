// Message Service for Conversations Module
// 訊息服務層

import { createDbClient } from '@/db/drizzle-factory';
import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { messages, conversations, customers, fileAttachments } from '@/db/schema';
import type { Bindings } from '@/types';
import type {
  Message,
  NewMessage,
  MessageSendRequest,
  MessageSendResponse,
} from '../types/conversation-types';
import { LineIntegrationService } from '@modules/integrations/services/line-integration-service';

export interface MessageServiceInterface {
  sendMessage(request: MessageSendRequest): Promise<MessageSendResponse>;
  getMessages(conversationId: string, limit?: number, offset?: number): Promise<Message[]>;
  recallMessage(messageId: string, userId: string): Promise<boolean>;
  updateMessage(messageId: string, updates: Partial<Message>): Promise<Message>;
}

export class MessageService implements MessageServiceInterface {
  private db: DrizzleD1Database;
  private bindings: Bindings;

  constructor(bindings: Bindings) {
    this.db = drizzle(bindings.DB);
    this.bindings = bindings;
  }

  /**
   * Send a new message in a conversation
   * ✅ FIXED: Now integrates with LINE API to actually send messages
   */
  async sendMessage(request: MessageSendRequest): Promise<MessageSendResponse> {
    const messageId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

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
      let deliveryStatus: 'sent' | 'failed' | 'pending' = 'pending';
      let errorMessage: string | undefined;

      // Step 2: Send message via LINE API (only for LINE platform)
      if (customer.platform === 'line' && customer.platformUserId) {
        try {
          console.log(`[MessageService] Sending LINE message to user ${customer.platformUserId}`);

          // 🔧 FIX: Use pushLineMessage with Flex Messages for file attachments
          const { pushLineMessage, createTextMessage, createImageMessage, createFileFlexMessage } = await import('@/utils/line');
          const lineMessages: any[] = [];

          // 🔧 FIX: 檢查是否為純文件描述訊息
          const hasAttachments = request.attachmentIds && request.attachmentIds.length > 0;
          const isFileOnlyContent = request.content && (
            /^Sent a file:\s*.+$/i.test(request.content) ||        // "Sent a file: xxx"
            /^Sent \d+ files$/i.test(request.content) ||           // "Sent 2 files", "Sent 3 files"
            /^\[(?:檔案|圖片)\]\s*.+$/.test(request.content)       // "[檔案] xxx", "[圖片] xxx"
          );

          // 只有在有實際內容（非純文件描述）時才發送文字訊息
          if (request.content && request.content.trim() && !isFileOnlyContent) {
            lineMessages.push(createTextMessage(request.content));
          } else if (request.content && isFileOnlyContent && !hasAttachments) {
            // 如果是文件描述但沒有附件，還是要發送（fallback）
            lineMessages.push(createTextMessage(request.content));
          }

          // 🔧 FIX: Handle file attachments with Flex Message cards
          if (request.attachmentIds && request.attachmentIds.length > 0) {
            // Fetch attachment data from database
            const attachmentsData = await this.db
              .select()
              .from(fileAttachments)
              .where(inArray(fileAttachments.id, request.attachmentIds));

            for (const attachment of attachmentsData) {
              const fileUrl = attachment.fileUrl;
              if (fileUrl) {
                if (attachment.mimeType?.startsWith('image/')) {
                  // Use native image message for images
                  lineMessages.push(createImageMessage(fileUrl));
                  console.log(`[MessageService] 📷 Adding image: ${attachment.filename}`);
                } else {
                  // Use Flex Message card for other files
                  const flexMessage = createFileFlexMessage(
                    fileUrl,
                    attachment.filename || 'File',
                    attachment.mimeType || '',
                    attachment.fileSize || 0
                  );
                  lineMessages.push(flexMessage);
                  console.log(`[MessageService] 📎 Adding file Flex card: ${attachment.filename}`);
                }
              }
            }
          }

          // Send messages via LINE Push API
          if (lineMessages.length > 0) {
            const sendSuccess = await pushLineMessage(
              this.bindings.LINE_CHANNEL_ACCESS_TOKEN,
              customer.platformUserId,
              lineMessages
            );

            if (sendSuccess) {
              platformMessageId = `line_${Date.now()}`;
              isSent = true;
              deliveryStatus = 'sent';
              console.log(`[MessageService] ✅ LINE message sent successfully: ${lineMessages.length} item(s)`);
            } else {
              errorMessage = 'LINE API returned failure';
              deliveryStatus = 'failed';
              console.error(`[MessageService] ❌ LINE API failed`);
            }
          } else {
            errorMessage = 'No content or attachments to send';
            deliveryStatus = 'failed';
            console.error(`[MessageService] ❌ No content to send`);
          }

        } catch (lineError) {
          errorMessage = lineError instanceof Error ? lineError.message : 'LINE API error';
          deliveryStatus = 'failed';
          console.error(`[MessageService] ❌ LINE API error:`, lineError);
        }
      } else if (customer.platform !== 'line') {
        // For non-LINE platforms, mark as pending (not yet implemented)
        deliveryStatus = 'pending';
        errorMessage = `Platform ${customer.platform} not yet supported`;
        console.warn(`[MessageService] ⚠️ Platform ${customer.platform} not yet supported`);
      } else {
        errorMessage = 'Missing platformUserId for LINE customer';
        deliveryStatus = 'failed';
        console.error(`[MessageService] ❌ Missing platformUserId`);
      }

      // Step 3: Save message to database with correct status
      const messageData: NewMessage = {
        id: messageId,
        conversationId: request.conversationId,
        content: request.content,
        senderType: 'agent',
        agentSenderId: request.senderId,
        messageType: request.messageType || 'text',
        platformMessageId,  // ✅ NOW SET from LINE API response
        isSent,             // ✅ NOW based on actual LINE API result
        deliveryStatus,     // ✅ NOW reflects real delivery status
        createdAt: timestamp,
        metadata: JSON.stringify({
          ...request.metadata,
          platform: customer.platform,
          platformUserId: customer.platformUserId,
          ...(errorMessage && { error: errorMessage })
        })
      };

      await this.db.insert(messages).values(messageData);

      // 🔧 FIX: Step 3.5: Link attachments to the message
      if (request.attachmentIds && request.attachmentIds.length > 0) {
        console.log(`[MessageService] 📎 Linking ${request.attachmentIds.length} attachments to message ${messageId}`);
        await this.db
          .update(fileAttachments)
          .set({ messageId: messageId })
          .where(inArray(fileAttachments.id, request.attachmentIds));
        console.log(`[MessageService] ✅ Attachments linked successfully`);
      }

      // Step 4: Update conversation last message time
      await this.db
        .update(conversations)
        .set({
          lastMessageAt: timestamp,
          updatedAt: timestamp
        })
        .where(eq(conversations.id, request.conversationId));

      // Step 5: Query back the complete message object
      const [insertedMessage] = await this.db
        .select()
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);

      if (!insertedMessage) {
        throw new Error('Failed to retrieve inserted message');
      }

      return {
        success: isSent, // ✅ NOW reflects actual LINE API success
        messageId,
        message: insertedMessage,
        conversationId: request.conversationId,
        content: request.content,
        timestamp,
        ...(errorMessage && { error: errorMessage })
      };

    } catch (error) {
      console.error('[MessageService] sendMessage error:', error);

      // Save failed message to database for tracking
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
      const timestamp = new Date().toISOString();

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
        updatedAt: new Date().toISOString()
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
   * Get recent messages for SSE streaming
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
   * Get messages after a specific timestamp for SSE streaming
   */
  async getMessagesAfterTimestamp(conversationId: string, afterTimestamp: string): Promise<Message[]> {
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