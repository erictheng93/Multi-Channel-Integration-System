// Simplified Message Service - Extracted from handler complexity
import type { Bindings, DbMessage } from '../types';
import { createDbClient } from '../db/drizzle-factory';
import { messages, conversations, customers } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface MessageRequest {
  conversationId: string;
  content: string;
  senderId: string;
  senderType: 'agent' | 'customer';
  messageType?: string;
  attachmentIds?: string[];
}

export interface MessageResult {
  success: boolean;
  messageId?: string;
  data?: DbMessage;
  error?: string;
}

export class MessageService {
  private db: ReturnType<typeof drizzle>;
  private env: Bindings;

  constructor(env: Bindings) {
    this.env = env;
    this.db = createDbClient(env.DB);
  }

  async sendMessage(request: MessageRequest): Promise<MessageResult> {
    const messageId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    try {
      // 1. Validate conversation exists
      const conversation = await this.getConversationWithPlatform(request.conversationId);
      if (!conversation) {
        return { success: false, error: 'Conversation not found' };
      }

      // 2. Create message record
      const messageData = await this.createMessageRecord(messageId, request, timestamp);

      // 3. Send to platform
      const platformResult = await this.sendToPlatform(conversation, request);

      // 4. Update delivery status
      await this.updateDeliveryStatus(messageId, platformResult.success, timestamp);

      // 5. Update conversation timestamp
      await this.updateConversationTimestamp(request.conversationId, timestamp);

      return {
        success: true,
        messageId,
        data: messageData
      };

    } catch (error) {
      console.error('MessageService.sendMessage error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Message sending failed'
      };
    }
  }

  private async getConversationWithPlatform(conversationId: string) {
    return await this.db
      .select({
        id: conversations.id,
        customerId: conversations.customerId,
        platform: customers.platform,
        platformUserId: customers.platformUserId
      })
      .from(conversations)
      .innerJoin(customers, eq(conversations.customerId, customers.id))
      .where(eq(conversations.id, conversationId))
      .get();
  }

  private async createMessageRecord(messageId: string, request: MessageRequest, timestamp: string) {
    const messageData = {
      id: messageId,
      conversationId: request.conversationId,
      senderType: request.senderType,
      ...(request.senderType === 'agent' ? { agentSenderId: request.senderId } : {}),
      ...(request.senderType === 'customer' ? { customerSenderId: parseInt(request.senderId) } : {}),
      content: request.content,
      messageType: (request.messageType || 'text') as 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker',
      isRecalled: false,
      isSent: false,
      deliveryStatus: 'pending' as const,
      metadata: request.attachmentIds ? JSON.stringify({ attachmentIds: request.attachmentIds }) : '',
      createdAt: timestamp
    };

    await this.db.insert(messages).values(messageData);
    return messageData;
  }

  private async sendToPlatform(conversation: any, request: MessageRequest) {
    try {
      if (conversation.platform === 'line') {
        const { pushLineMessage, createTextMessage } = await import('../utils/line');
        const lineMessages = [createTextMessage(request.content)];

        const success = await pushLineMessage(
          this.env.LINE_CHANNEL_ACCESS_TOKEN,
          conversation.platformUserId,
          lineMessages
        );

        return { success };
      }

      // Add other platforms as needed
      return { success: false, error: 'Unsupported platform' };

    } catch (error) {
      console.error('Platform sending error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Platform error' };
    }
  }

  private async updateDeliveryStatus(messageId: string, success: boolean, timestamp: string) {
    await this.db
      .update(messages)
      .set({
        isSent: success,
        deliveryStatus: success ? 'sent' : 'failed',
        sentAt: timestamp
      })
      .where(eq(messages.id, messageId));
  }

  private async updateConversationTimestamp(conversationId: string, timestamp: string) {
    await this.db
      .update(conversations)
      .set({
        lastMessageAt: timestamp,
        updatedAt: timestamp
      })
      .where(eq(conversations.id, conversationId));
  }
}