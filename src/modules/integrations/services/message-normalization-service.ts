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
import { nowISO, nowMs } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger';
import type { Bindings } from '@/types';
import { findOrCreateCustomer as sharedFindOrCreateCustomer } from './webhook-customer-service';

const log = createContextLogger('MessageNormalization');

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
  metadata?: Record<string, unknown>;
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
  rawEvent: unknown;
  channelConfig: unknown;
  db: D1Database;
  env?: Bindings;  // NEW: needed for distributed lock in shared service
  teamId: number;
}

export interface ProcessInboundMessageResult {
  success: boolean;
  normalizedMessage?: NormalizedMessage;
  conversationId?: string;
  customerId?: number;
  error?: string;
}

interface ExtractedPlatformData {
  platformMessageId: string;
  platformUserId: string;
  displayName: string;
  avatarUrl?: string;
  content: string;
  messageType: MessageType;
  attachments?: MessageAttachment[];
  platformData: PlatformMessageData;
}

interface LineRawMessage {
  id: string;
  type: string;
  text?: string;
  duration?: number;
  fileName?: string;
  fileSize?: number;
  address?: string;
  packageId?: string;
  stickerId?: string;
}

interface LineRawEvent {
  message: LineRawMessage;
  source: {
    type: 'user' | 'group' | 'room';
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  replyToken?: string;
  timestamp?: number;
}

interface FacebookRawAttachment {
  type: MessageAttachment['type'];
  payload?: {
    url?: string;
    name?: string;
  };
}

interface FacebookRawEvent {
  sender: { id: string };
  recipient?: { id?: string };
  message: {
    mid: string;
    text?: string;
    attachments?: FacebookRawAttachment[];
    quick_reply?: { payload: string };
    referral?: FacebookMessageData['referral'];
  };
  timestamp?: number;
}

interface WhatsAppMediaPayload {
  id?: string;
  mime_type?: string;
  caption?: string;
  filename?: string;
  sha256?: string;
}

interface WhatsAppRawMessage {
  id: string;
  from: string;
  timestamp?: string;
  type: string;
  text?: { body?: string };
  image?: WhatsAppMediaPayload;
  video?: WhatsAppMediaPayload;
  audio?: WhatsAppMediaPayload;
  document?: WhatsAppMediaPayload;
  sticker?: WhatsAppMediaPayload;
  location?: {
    latitude?: number;
    longitude?: number;
    name?: string;
    address?: string;
  };
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string; description?: string };
  };
  button?: {
    text?: string;
    payload?: string;
  };
  context?: {
    id?: string;
  };
}

interface WhatsAppRawContact {
  wa_id?: string;
  profile?: {
    name?: string;
  };
}

interface WhatsAppValuePayload {
  messages?: WhatsAppRawMessage[];
  contacts?: WhatsAppRawContact[];
}

interface WhatsAppWebhookEvent {
  entry?: Array<{
    changes?: Array<{
      value?: WhatsAppValuePayload;
    }>;
  }>;
  messages?: WhatsAppRawMessage[];
  contacts?: WhatsAppRawContact[];
}

export class MessageNormalizationService {
  /**
   * Process an inbound message from any platform
   */
  async processInboundMessage(
    options: ProcessInboundMessageOptions
  ): Promise<ProcessInboundMessageResult> {
    const { platform, rawEvent, channelConfig: _channelConfig, db, teamId } = options;

    try {
      // Step 1: Extract platform-specific data
      const extracted = await this.extractPlatformData(platform, rawEvent);
      if (!extracted) {
        return { success: false, error: 'Failed to extract platform data' };
      }

      // Step 2: Find or create customer (use shared service if env available, fallback to local)
      let customer: { id: number; displayName: string } | null;
      if (options.env && (platform === 'line' || platform === 'facebook')) {
        const result = await sharedFindOrCreateCustomer(
          options.env,
          extracted.platformUserId,
          platform,
          { sourceTeamId: teamId }
        );
        customer = result ? { id: result.id, displayName: result.displayName || 'Unknown' } : null;
      } else {
        // Legacy fallback for callers that don't pass env
        customer = await this.findOrCreateCustomer(
          db,
          platform,
          extracted.platformUserId,
          extracted.displayName,
          extracted.avatarUrl,
          teamId
        );
      }

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
        log.debug(`Duplicate message detected`, { platformMessageId: normalizedMessage.platformMessageId });
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
      log.error(`Error processing ${platform} message`, {}, error instanceof Error ? error : new Error(String(error)));
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Extract platform-specific data from raw event
   */
  private async extractPlatformData(
    platform: Platform,
    rawEvent: unknown
  ): Promise<ExtractedPlatformData | null> {
    switch (platform) {
      case 'line':
        return this.extractLineData(rawEvent);
      case 'facebook':
        return this.extractFacebookData(rawEvent);
      case 'whatsapp':
        return this.extractWhatsAppData(rawEvent);
      default:
        log.error(`Unsupported platform: ${platform}`);
        return null;
    }
  }

  /**
   * Extract LINE message data
   */
  private async extractLineData(event: unknown): Promise<ExtractedPlatformData> {
    const { message, source, replyToken, timestamp: _timestamp } = event as LineRawEvent;

    let content = '';
    let messageType: MessageType = 'text';
    let attachments: MessageAttachment[] = [];

    switch (message.type) {
      case 'text':
        content = message.text || '';
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
      platformUserId: source.userId || '',
      displayName: 'LINE User',  // Will be updated via profile sync
      content,
      messageType,
      attachments,
      platformData: {
        platform: 'line' as const,
        replyToken,
        packageId: message.packageId,
        stickerId: message.stickerId,
        userId: source.userId || '',
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
  private async extractFacebookData(event: unknown): Promise<ExtractedPlatformData> {
    const { sender, message, recipient, timestamp: _timestamp } = event as FacebookRawEvent;

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
        recipientId: recipient?.id || '',
        quickReply: message.quick_reply,
        referral: message.referral,
      },
    };
  }

  /**
   * Extract WhatsApp Cloud API message data.
   */
  private async extractWhatsAppData(event: unknown): Promise<ExtractedPlatformData | null> {
    const payload = this.getWhatsAppValuePayload(event);
    const message = payload.messages?.[0];

    if (!message?.id || !message.from) {
      throw new Error('Invalid WhatsApp webhook payload: missing message id or sender');
    }

    const contact = payload.contacts?.find((item) => item.wa_id === message.from) || payload.contacts?.[0];
    const displayName = contact?.profile?.name || message.from;
    const attachments: MessageAttachment[] = [];
    let content = '';
    let messageType: MessageType = 'text';

    switch (message.type) {
      case 'text':
        content = message.text?.body || '';
        messageType = 'text';
        break;
      case 'image':
        ({ content, messageType } = this.extractWhatsAppMedia(message.image, 'image', '[Image]', attachments));
        break;
      case 'video':
        ({ content, messageType } = this.extractWhatsAppMedia(message.video, 'video', '[Video]', attachments));
        break;
      case 'audio':
        ({ content, messageType } = this.extractWhatsAppMedia(message.audio, 'audio', '[Audio]', attachments));
        break;
      case 'document':
        ({ content, messageType } = this.extractWhatsAppMedia(message.document, 'file', '[File]', attachments));
        break;
      case 'sticker':
        content = '[Sticker]';
        messageType = 'sticker';
        break;
      case 'location':
        content = this.formatWhatsAppLocation(message.location);
        messageType = 'location';
        break;
      case 'interactive':
        content = message.interactive?.button_reply?.title
          || message.interactive?.list_reply?.title
          || '[Interactive message]';
        messageType = 'template';
        break;
      case 'button':
        content = message.button?.text || '[Button reply]';
        messageType = 'text';
        break;
      default:
        content = `[Unsupported WhatsApp message type: ${message.type}]`;
        messageType = 'text';
    }

    return {
      platformMessageId: message.id,
      platformUserId: message.from,
      displayName,
      content,
      messageType,
      attachments,
      platformData: {
        platform: 'whatsapp' as const,
        messageId: message.id,
        from: message.from,
        timestamp: message.timestamp || '',
        context: message.context?.id ? { messageId: message.context.id } : undefined,
      },
    };
  }

  private getWhatsAppValuePayload(event: unknown): WhatsAppValuePayload {
    const webhookEvent = event as WhatsAppWebhookEvent;
    return webhookEvent.entry?.[0]?.changes?.[0]?.value || {
      messages: webhookEvent.messages,
      contacts: webhookEvent.contacts,
    };
  }

  private extractWhatsAppMedia(
    media: WhatsAppMediaPayload | undefined,
    type: MessageAttachment['type'],
    fallbackContent: string,
    attachments: MessageAttachment[]
  ): { content: string; messageType: MessageType } {
    attachments.push({
      type,
      url: media?.id || '',
      filename: media?.filename,
      mimeType: media?.mime_type,
    });

    return {
      content: media?.caption || (media?.filename ? `[File: ${media.filename}]` : fallbackContent),
      messageType: type === 'file' ? 'file' : type,
    };
  }

  private formatWhatsAppLocation(location: WhatsAppRawMessage['location']): string {
    if (!location) {
      return '[Location]';
    }

    if (location.name || location.address) {
      return `[Location: ${[location.name, location.address].filter(Boolean).join(' - ')}]`;
    }

    if (location.latitude !== undefined && location.longitude !== undefined) {
      return `[Location: ${location.latitude}, ${location.longitude}]`;
    }

    return '[Location]';
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
      log.error('Error in findOrCreateCustomer', {}, error instanceof Error ? error : new Error(String(error)));
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
      const conversationId = `conv_${nowMs()}_${Math.random().toString(36).substring(7)}`;
      await db
        .prepare(
          `INSERT INTO conversations (id, customer_id, assigned_team_id, status, priority, created_at, updated_at, last_message_at)
           VALUES (?, ?, ?, 'active', 'normal', datetime('now'), datetime('now'), datetime('now'))`
        )
        .bind(conversationId, customerId, teamId)
        .run();

      return { id: conversationId };
    } catch (error) {
      log.error('Error in findOrCreateConversation', {}, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Normalize message to common format
   */
  private async normalizeMessage(
    platform: Platform,
    rawEvent: unknown,
    extracted: ExtractedPlatformData,
    conversationId: string,
    customerId: number,
    customerDisplayName: string
  ): Promise<NormalizedMessage> {
    const messageId = `msg_${nowMs()}_${Math.random().toString(36).substring(7)}`;
    const timestamp = nowISO();

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
