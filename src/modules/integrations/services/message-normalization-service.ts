/**
 * Message Normalization Service
 *
 * Provides a unified interface for processing messages across different platforms
 * (LINE, Facebook, WhatsApp, etc.)
 *
 * This service extracts common logic from webhook handlers and enables
 * easier addition of new platforms.
 */

import type { D1Database } from '@cloudflare/workers-types';

// ===== Type Definitions =====

export type Platform = 'line' | 'facebook' | 'whatsapp' | 'telegram' | 'instagram';

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker' | 'template';

export interface NormalizedMessage {
  // Core message data
  id: string;
  conversationId: string;
  content: string;
  messageType: MessageType;

  // Sender information
  senderType: 'customer' | 'agent' | 'system';
  customerId?: number;
  customerDisplayName?: string;
  agentId?: string;

  // Platform metadata
  platform: Platform;
  platformMessageId: string;
  platformUserId: string;

  // Timestamps
  timestamp: string;
  createdAt: string;

  // Attachments
  attachments?: MessageAttachment[];

  // Platform-specific data (preserved for backward compatibility)
  platformData: PlatformMessageData;

  // Additional metadata
  metadata?: Record<string, any>;
}

export interface MessageAttachment {
  type: 'image' | 'video' | 'audio' | 'file';
  url: string;
  filename?: string;
  mimeType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  duration?: number;
}

export type PlatformMessageData = LineMessageData | FacebookMessageData | WhatsAppMessageData;

export interface LineMessageData {
  platform: 'line';
  replyToken?: string;
  packageId?: string;  // For stickers
  stickerId?: string;
  userId: string;
  source: {
    type: 'user' | 'group' | 'room';
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
}

export interface FacebookMessageData {
  platform: 'facebook';
  mid: string;  // Facebook message ID
  senderId: string;
  recipientId: string;
  quickReply?: {
    payload: string;
  };
  referral?: {
    ref: string;
    source: string;
    type: string;
  };
}

export interface WhatsAppMessageData {
  platform: 'whatsapp';
  messageId: string;
  from: string;
  timestamp: string;
  context?: {
    messageId: string;  // For replies
  };
}

// ===== Inbound Message Processing =====

export interface ProcessInboundMessageOptions {
  platform: Platform;
  rawEvent: any;
  channelConfig: any;
  db: D1Database;
  teamId: number;
}

export interface ProcessInboundMessageResult {
  success: boolean;
  normalizedMessage?: NormalizedMessage;
  conversationId?: string;
  customerId?: number;
  error?: string;
}

export class MessageNormalizationService {
  /**
   * Process an inbound message from any platform
   */
  async processInboundMessage(
    options: ProcessInboundMessageOptions
  ): Promise<ProcessInboundMessageResult> {
    const { platform, rawEvent, channelConfig, db, teamId } = options;

    try {
      // Step 1: Extract platform-specific data
      const extracted = await this.extractPlatformData(platform, rawEvent);
      if (!extracted) {
        return { success: false, error: 'Failed to extract platform data' };
      }

      // Step 2: Find or create customer
      const customer = await this.findOrCreateCustomer(
        db,
        platform,
        extracted.platformUserId,
        extracted.displayName,
        extracted.avatarUrl,
        teamId
      );

      if (!customer) {
        return { success: false, error: 'Failed to create customer' };
      }

      // Step 3: Find or create conversation
      const conversation = await this.findOrCreateConversation(
        db,
        customer.id,
        teamId
      );

      if (!conversation) {
        return { success: false, error: 'Failed to create conversation' };
      }

      // Step 4: Normalize message
      const normalizedMessage = await this.normalizeMessage(
        platform,
        rawEvent,
        extracted,
        conversation.id,
        customer.id,
        customer.displayName || 'Unknown'
      );

      // Step 5: Check for duplicates (idempotency)
      const isDuplicate = await this.checkDuplicate(db, normalizedMessage.platformMessageId);
      if (isDuplicate) {
        console.log(`[MessageNormalization] Duplicate message detected: ${normalizedMessage.platformMessageId}`);
        return {
          success: true,
          normalizedMessage,
          conversationId: conversation.id,
          customerId: customer.id
        };
      }

      // Step 6: Store message in database
      await this.storeMessage(db, normalizedMessage);

      // Step 7: Update conversation last message timestamp
      await this.updateConversationTimestamp(db, conversation.id);

      return {
        success: true,
        normalizedMessage,
        conversationId: conversation.id,
        customerId: customer.id,
      };
    } catch (error) {
      console.error(`[MessageNormalization] Error processing ${platform} message:`, error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Extract platform-specific data from raw event
   */
  private async extractPlatformData(
    platform: Platform,
    rawEvent: any
  ): Promise<{
    platformMessageId: string;
    platformUserId: string;
    displayName: string;
    avatarUrl?: string;
    content: string;
    messageType: MessageType;
    attachments?: MessageAttachment[];
    platformData: PlatformMessageData;
  } | null> {
    switch (platform) {
      case 'line':
        return this.extractLineData(rawEvent);
      case 'facebook':
        return this.extractFacebookData(rawEvent);
      case 'whatsapp':
        return this.extractWhatsAppData(rawEvent);
      default:
        console.error(`[MessageNormalization] Unsupported platform: ${platform}`);
        return null;
    }
  }

  /**
   * Extract LINE message data
   */
  private async extractLineData(event: any): Promise<any> {
    const { message, source, replyToken, timestamp } = event;

    let content = '';
    let messageType: MessageType = 'text';
    let attachments: MessageAttachment[] = [];

    switch (message.type) {
      case 'text':
        content = message.text;
        messageType = 'text';
        break;
      case 'image':
        content = '[Image]';
        messageType = 'image';
        attachments.push({
          type: 'image',
          url: `line://image/${message.id}`,  // Placeholder, will be replaced with R2 URL
        });
        break;
      case 'video':
        content = '[Video]';
        messageType = 'video';
        attachments.push({
          type: 'video',
          url: `line://video/${message.id}`,
        });
        break;
      case 'audio':
        content = '[Audio]';
        messageType = 'audio';
        attachments.push({
          type: 'audio',
          url: `line://audio/${message.id}`,
          duration: message.duration,
        });
        break;
      case 'file':
        content = `[File: ${message.fileName}]`;
        messageType = 'file';
        attachments.push({
          type: 'file',
          url: `line://file/${message.id}`,
          filename: message.fileName,
          fileSize: message.fileSize,
        });
        break;
      case 'location':
        content = `[Location: ${message.address}]`;
        messageType = 'location';
        break;
      case 'sticker':
        content = '[Sticker]';
        messageType = 'sticker';
        break;
      default:
        content = `[Unsupported message type: ${message.type}]`;
    }

    return {
      platformMessageId: message.id,
      platformUserId: source.userId,
      displayName: 'LINE User',  // Will be updated via profile sync
      content,
      messageType,
      attachments,
      platformData: {
        platform: 'line' as const,
        replyToken,
        packageId: message.packageId,
        stickerId: message.stickerId,
        userId: source.userId,
        source: {
          type: source.type,
          userId: source.userId,
          groupId: source.groupId,
          roomId: source.roomId,
        },
      },
    };
  }

  /**
   * Extract Facebook message data
   */
  private async extractFacebookData(event: any): Promise<any> {
    const { sender, message, timestamp } = event;

    let content = '';
    let messageType: MessageType = 'text';
    let attachments: MessageAttachment[] = [];

    if (message.text) {
      content = message.text;
      messageType = 'text';
    }

    if (message.attachments) {
      for (const attachment of message.attachments) {
        const att: MessageAttachment = {
          type: attachment.type,
          url: attachment.payload?.url || '',
        };

        switch (attachment.type) {
          case 'image':
            content = content || '[Image]';
            messageType = 'image';
            break;
          case 'video':
            content = content || '[Video]';
            messageType = 'video';
            break;
          case 'audio':
            content = content || '[Audio]';
            messageType = 'audio';
            break;
          case 'file':
            content = content || '[File]';
            messageType = 'file';
            att.filename = attachment.payload?.name;
            break;
        }

        attachments.push(att);
      }
    }

    return {
      platformMessageId: message.mid,
      platformUserId: sender.id,
      displayName: 'Facebook User',  // Will be updated via profile sync
      content: content || '[Message]',
      messageType,
      attachments,
      platformData: {
        platform: 'facebook' as const,
        mid: message.mid,
        senderId: sender.id,
        recipientId: event.recipient?.id || '',
        quickReply: message.quick_reply,
        referral: message.referral,
      },
    };
  }

  /**
   * Extract WhatsApp message data (placeholder for future implementation)
   */
  private async extractWhatsAppData(event: any): Promise<any> {
    // TODO: Implement WhatsApp message extraction
    throw new Error('WhatsApp integration not yet implemented');
  }

  /**
   * Find or create customer in database
   */
  private async findOrCreateCustomer(
    db: D1Database,
    platform: Platform,
    platformUserId: string,
    displayName: string,
    avatarUrl: string | undefined,
    teamId: number
  ): Promise<{ id: number; displayName: string } | null> {
    try {
      // Check if customer exists
      const existing = await db
        .prepare('SELECT id, display_name FROM customers WHERE platform = ? AND platform_user_id = ?')
        .bind(platform, platformUserId)
        .first<{ id: number; display_name: string }>();

      if (existing) {
        return { id: existing.id, displayName: existing.display_name };
      }

      // Create new customer
      const result = await db
        .prepare(
          `INSERT INTO customers (platform, platform_user_id, display_name, avatar_url, source_team_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
        .bind(platform, platformUserId, displayName, avatarUrl || null, teamId)
        .run();

      if (!result.meta.last_row_id) {
        return null;
      }

      return {
        id: result.meta.last_row_id as number,
        displayName,
      };
    } catch (error) {
      console.error('[MessageNormalization] Error in findOrCreateCustomer:', error);
      return null;
    }
  }

  /**
   * Find or create conversation for customer
   */
  private async findOrCreateConversation(
    db: D1Database,
    customerId: number,
    teamId: number
  ): Promise<{ id: string } | null> {
    try {
      // Find active conversation for customer
      const existing = await db
        .prepare("SELECT id FROM conversations WHERE customer_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1")
        .bind(customerId)
        .first<{ id: string }>();

      if (existing) {
        return existing;
      }

      // Create new conversation
      const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      await db
        .prepare(
          `INSERT INTO conversations (id, customer_id, assigned_team_id, status, priority, created_at, updated_at, last_message_at)
           VALUES (?, ?, ?, 'active', 'normal', datetime('now'), datetime('now'), datetime('now'))`
        )
        .bind(conversationId, customerId, teamId)
        .run();

      return { id: conversationId };
    } catch (error) {
      console.error('[MessageNormalization] Error in findOrCreateConversation:', error);
      return null;
    }
  }

  /**
   * Normalize message to common format
   */
  private async normalizeMessage(
    platform: Platform,
    rawEvent: any,
    extracted: any,
    conversationId: string,
    customerId: number,
    customerDisplayName: string
  ): Promise<NormalizedMessage> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const timestamp = new Date().toISOString();

    return {
      id: messageId,
      conversationId,
      content: extracted.content,
      messageType: extracted.messageType,
      senderType: 'customer',
      customerId,
      customerDisplayName,
      platform,
      platformMessageId: extracted.platformMessageId,
      platformUserId: extracted.platformUserId,
      timestamp,
      createdAt: timestamp,
      attachments: extracted.attachments,
      platformData: extracted.platformData,
      metadata: {
        rawEvent: JSON.stringify(rawEvent),
      },
    };
  }

  /**
   * Check if message already exists (idempotency)
   */
  private async checkDuplicate(db: D1Database, platformMessageId: string): Promise<boolean> {
    const existing = await db
      .prepare('SELECT id FROM messages WHERE platform_message_id = ?')
      .bind(platformMessageId)
      .first();
    return !!existing;
  }

  /**
   * Store normalized message in database
   */
  private async storeMessage(db: D1Database, message: NormalizedMessage): Promise<void> {
    await db
      .prepare(
        `INSERT INTO messages (
          id, conversation_id, sender_type, customer_sender_id, content, message_type,
          platform_message_id, metadata, created_at, is_sent, sent_at, delivery_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), 'delivered')`
      )
      .bind(
        message.id,
        message.conversationId,
        message.senderType,
        message.customerId || null,
        message.content,
        message.messageType,
        message.platformMessageId,
        JSON.stringify({
          platform: message.platform,
          platformData: message.platformData,
          attachments: message.attachments,
          ...message.metadata,
        }),
        message.createdAt
      )
      .run();
  }

  /**
   * Update conversation's last message timestamp
   */
  private async updateConversationTimestamp(db: D1Database, conversationId: string): Promise<void> {
    await db
      .prepare("UPDATE conversations SET last_message_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
      .bind(conversationId)
      .run();
  }
}

/**
 * Factory function to create message normalization service
 */
export function createMessageNormalizationService(): MessageNormalizationService {
  return new MessageNormalizationService();
}
