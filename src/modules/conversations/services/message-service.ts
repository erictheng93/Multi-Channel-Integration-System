// Message Service for Conversations Module
// 訊息服務層

import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, desc, and } from 'drizzle-orm';
import { messages, conversations } from '../../../db/schema';
import type { Bindings } from '../../../types';
import type {
  Message,
  NewMessage,
  MessageSendRequest,
  MessageSendResponse,
} from '../types/conversation-types';

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
   */
  async sendMessage(request: MessageSendRequest): Promise<MessageSendResponse> {
    try {
      const messageId = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      // Create the message record
      const messageData: NewMessage = {
        id: messageId,
        conversationId: request.conversationId,
        content: request.content,
        senderType: 'agent',
        agentSenderId: request.senderId,
        messageType: request.messageType || 'text',
        isSent: true,
        deliveryStatus: 'sent',
        createdAt: timestamp,
        metadata: JSON.stringify(request.metadata || {})
      };

      await this.db.insert(messages).values(messageData);

      // Update conversation last message time
      await this.db
        .update(conversations)
        .set({
          lastMessageAt: timestamp,
          updatedAt: timestamp
        })
        .where(eq(conversations.id, request.conversationId));

      return {
        success: true,
        messageId,
        conversationId: request.conversationId,
        content: request.content,
        timestamp,
      };

    } catch (error) {
      console.error('MessageService.sendMessage error:', error);
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

    if (!conversationId) {
      throw new Error('Missing conversation ID');
    }

    if (!body.content?.trim()) {
      throw new Error('Message content is required');
    }

    if (!body.senderId) {
      throw new Error('Sender ID is required');
    }

    return {
      conversationId,
      content: body.content.trim(),
      senderId: body.senderId,
      messageType: body.messageType || 'text',
      metadata: body.metadata || {}
    };
  }
}