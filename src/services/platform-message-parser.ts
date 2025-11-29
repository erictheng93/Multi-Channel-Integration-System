// Platform Message Parser Service
// 統一的平台訊息解析服務 - 從 webhook.ts 和 webhook-router-service.ts 提取

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker';
export type Platform = 'line' | 'facebook' | 'instagram';

export interface ParsedMessage {
  content: string;
  type: MessageType;
  platform: Platform;
  mediaData: MediaData | null;
  metadata: Record<string, unknown>;
}

export interface MediaData {
  id?: string;
  type: MessageType;
  contentProvider?: {
    type: string;
    originalContentUrl?: string;
    previewImageUrl?: string;
  };
  duration?: number;
  fileName?: string;
  fileSize?: number;
}

export interface LocationData {
  title?: string;
  address?: string;
  latitude: number;
  longitude: number;
}

/**
 * Parse LINE message event into normalized format
 * Extracted from webhook.ts (lines 242-295)
 */
export function parseLineMessage(message: any): ParsedMessage {
  let content = '';
  let type: MessageType = 'text';
  let mediaData: MediaData | null = null;
  const metadata: Record<string, unknown> = {};

  if (!message) {
    return { content: '', type: 'text', platform: 'line', mediaData: null, metadata };
  }

  switch (message.type) {
    case 'text':
      content = message.text || '';
      type = 'text';
      break;

    case 'image':
      content = '[圖片]';
      type = 'image';
      mediaData = {
        id: message.id,
        type: 'image',
        contentProvider: message.contentProvider
      };
      break;

    case 'video':
      content = '[影片]';
      type = 'video';
      mediaData = {
        id: message.id,
        type: 'video',
        duration: message.duration,
        contentProvider: message.contentProvider
      };
      break;

    case 'audio':
      content = '[語音]';
      type = 'audio';
      mediaData = {
        id: message.id,
        type: 'audio',
        duration: message.duration,
        contentProvider: message.contentProvider
      };
      break;

    case 'file':
      content = `[檔案] ${message.fileName || 'Unknown file'}`;
      type = 'file';
      mediaData = {
        id: message.id,
        type: 'file',
        fileName: message.fileName,
        fileSize: message.fileSize
      };
      break;

    case 'location':
      const locationTitle = message.title || 'Location';
      const locationAddress = message.address || 'Unknown address';
      content = `[位置] ${locationTitle}: ${locationAddress}`;
      type = 'location';
      metadata.location = {
        title: message.title,
        address: message.address,
        latitude: message.latitude,
        longitude: message.longitude
      } as LocationData;
      break;

    case 'sticker':
      content = '[貼圖]';
      type = 'sticker';
      metadata.sticker = {
        packageId: message.packageId,
        stickerId: message.stickerId
      };
      break;

    default:
      content = `[未支援的訊息類型: ${message.type}]`;
      type = 'text';
      metadata.originalType = message.type;
  }

  return {
    content,
    type,
    platform: 'line',
    mediaData,
    metadata
  };
}

/**
 * Parse Facebook message event into normalized format
 * Extracted from webhook.ts (lines 796-858)
 */
export function parseFacebookMessage(message: any): ParsedMessage {
  let content = '';
  let type: MessageType = 'text';
  let mediaData: MediaData | null = null;
  const metadata: Record<string, unknown> = {};

  if (!message) {
    return { content: '', type: 'text', platform: 'facebook', mediaData: null, metadata };
  }

  // Text message
  if (message.text) {
    content = message.text;
    type = 'text';
  }

  // Attachments (images, videos, audio, files)
  if (message.attachments && Array.isArray(message.attachments)) {
    const attachment = message.attachments[0]; // Process first attachment

    if (attachment) {
      switch (attachment.type) {
        case 'image':
          content = '[圖片]';
          type = 'image';
          mediaData = {
            type: 'image',
            contentProvider: {
              type: 'external',
              originalContentUrl: attachment.payload?.url
            }
          };
          break;

        case 'video':
          content = '[影片]';
          type = 'video';
          mediaData = {
            type: 'video',
            contentProvider: {
              type: 'external',
              originalContentUrl: attachment.payload?.url
            }
          };
          break;

        case 'audio':
          content = '[語音]';
          type = 'audio';
          mediaData = {
            type: 'audio',
            contentProvider: {
              type: 'external',
              originalContentUrl: attachment.payload?.url
            }
          };
          break;

        case 'file':
          content = '[檔案]';
          type = 'file';
          mediaData = {
            type: 'file',
            contentProvider: {
              type: 'external',
              originalContentUrl: attachment.payload?.url
            }
          };
          break;

        case 'location':
          const coords = attachment.payload?.coordinates;
          content = `[位置] ${coords?.lat || 0}, ${coords?.long || 0}`;
          type = 'location';
          metadata.location = {
            latitude: coords?.lat,
            longitude: coords?.long
          };
          break;

        case 'fallback':
          content = attachment.payload?.title || '[連結]';
          type = 'text';
          metadata.fallback = {
            url: attachment.payload?.url,
            title: attachment.payload?.title
          };
          break;

        default:
          content = `[${attachment.type || '未知附件'}]`;
          type = 'text';
          metadata.originalAttachmentType = attachment.type;
      }

      // Store all attachments for reference
      metadata.attachments = message.attachments;
    }
  }

  // Quick reply payload
  if (message.quick_reply) {
    metadata.quickReply = message.quick_reply;
  }

  // Reply to
  if (message.reply_to) {
    metadata.replyTo = message.reply_to;
  }

  return {
    content,
    type,
    platform: 'facebook',
    mediaData,
    metadata
  };
}

/**
 * Map LINE message type to internal message type
 * Extracted from webhook-router-service.ts (lines 752-767)
 */
export function mapLineMessageType(lineMessageType: string): MessageType {
  const messageMap: Record<string, MessageType> = {
    'text': 'text',
    'image': 'image',
    'video': 'video',
    'audio': 'audio',
    'file': 'file',
    'location': 'location',
    'sticker': 'sticker'
  };

  return messageMap[lineMessageType] || 'text';
}

/**
 * Map Facebook attachment type to internal message type
 */
export function mapFacebookMessageType(fbAttachmentType: string): MessageType {
  const messageMap: Record<string, MessageType> = {
    'image': 'image',
    'video': 'video',
    'audio': 'audio',
    'file': 'file',
    'location': 'location',
    'fallback': 'text'
  };

  return messageMap[fbAttachmentType] || 'text';
}

/**
 * Parse message from any supported platform
 */
export function parseMessage(platform: Platform, message: any): ParsedMessage {
  switch (platform) {
    case 'line':
      return parseLineMessage(message);
    case 'facebook':
    case 'instagram':
      return parseFacebookMessage(message);
    default:
      return {
        content: '',
        type: 'text',
        platform,
        mediaData: null,
        metadata: { error: 'Unsupported platform' }
      };
  }
}

/**
 * Extract display content from parsed message (for UI display)
 */
export function getDisplayContent(parsed: ParsedMessage): string {
  return parsed.content;
}

/**
 * Check if message has downloadable media
 */
export function hasDownloadableMedia(parsed: ParsedMessage): boolean {
  return parsed.mediaData !== null &&
         parsed.type !== 'location' &&
         parsed.type !== 'sticker';
}
