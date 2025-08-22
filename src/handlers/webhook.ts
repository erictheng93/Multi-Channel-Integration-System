// worker/src/handlers/webhook.ts
// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/src/handlers/webhook.ts
// Created by: Webhook Handler Developer

import { Context } from 'hono';
import type { 
  Bindings, 
  LineWebhookBody, 
  LineEvent,
  FacebookWebhookBody,
  FacebookMessaging,
  LineMediaData,
  FacebookMediaData
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { 
  successResponse, 
  errorResponse, 
  unauthorizedResponse,
  handleApiError 
} from '../utils/api-response';

export const webhookHandler = {
  // 處理 Line Webhook
  async line(c: Context<{ Bindings: Bindings }>) {
    try {
      // 驗證簽名
      const signature = c.req.header('X-Line-Signature');
      const body = await c.req.text();

      // 檢查 payload 大小 (1MB 限制)
      if (body.length > 1024 * 1024) {
        return errorResponse(c, 'Payload too large', 413);
      }

      if (!signature) {
        return errorResponse(c, 'Missing signature');
      }

      if (!(await verifyLineSignature(body, signature, c.env.LINE_CHANNEL_SECRET))) {
        return unauthorizedResponse(c, 'Invalid signature');
      }

      let data: LineWebhookBody;
      try {
        data = JSON.parse(body) as LineWebhookBody;
      } catch (parseError) {
        return errorResponse(c, 'Invalid JSON payload');
      }

      // 輸入驗證
      if (!validateLineWebhook(data)) {
        return errorResponse(c, 'Invalid webhook payload');
      }

      // 處理事件
      for (const event of data.events) {
        if (event.type === 'message' && event.message) {
          await processLineMessage(c.env, event);
        }
      }

      return successResponse(c, null, 'LINE webhook processed successfully');
    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 處理 Facebook Webhook
  async facebook(c: Context<{ Bindings: Bindings }>) {
    try {
      // Facebook webhook 驗證
      const mode = c.req.query('hub.mode');
      const token = c.req.query('hub.verify_token');
      const challenge = c.req.query('hub.challenge');

      if (mode === 'subscribe' && token === c.env.FB_VERIFY_TOKEN) {
        return c.text(challenge || '');
      }

      // 檢查 Content-Length header 來限制 payload 大小
      const contentLength = c.req.header('content-length');
      if (contentLength && parseInt(contentLength) > 1024 * 1024) {
        return errorResponse(c, 'Payload too large', 413);
      }

      let body: FacebookWebhookBody;
      try {
        body = await c.req.json() as FacebookWebhookBody;
      } catch (parseError) {
        return errorResponse(c, 'Invalid JSON payload');
      }

      // 輸入驗證
      if (!validateFacebookWebhook(body)) {
        return errorResponse(c, 'Invalid webhook payload');
      }

      // 處理 Facebook 訊息
      if (body.object === 'page') {
        for (const entry of body.entry) {
          if (!entry.messaging || !Array.isArray(entry.messaging)) continue;
          
          for (const messaging of entry.messaging) {
            if (messaging.message) {
              await processFacebookMessage(c.env, messaging);
            }
          }
        }
      }

      return successResponse(c, null, 'Facebook webhook processed successfully');
    } catch (error) {
      return handleApiError(error, c);
    }
  }
};

// 輸入驗證函數
function validateLineWebhook(data: unknown): data is LineWebhookBody {
  if (!data || typeof data !== 'object' || data === null) return false;
  
  const webhook = data as Record<string, unknown>;
  
  return typeof webhook.destination === 'string' &&
         Array.isArray(webhook.events) &&
         webhook.events.every((event: unknown) => {
           if (!event || typeof event !== 'object' || event === null) return false;
           const lineEvent = event as Record<string, unknown>;
           
           return typeof lineEvent.type === 'string' &&
                  typeof lineEvent.timestamp === 'number' &&
                  lineEvent.source &&
                  typeof lineEvent.source === 'object' &&
                  lineEvent.source !== null &&
                  typeof (lineEvent.source as Record<string, unknown>).userId === 'string';
         });
}

function validateFacebookWebhook(data: unknown): data is FacebookWebhookBody {
  if (!data || typeof data !== 'object' || data === null) return false;
  
  const webhook = data as Record<string, unknown>;
  
  return webhook.object === 'page' &&
         Array.isArray(webhook.entry) &&
         webhook.entry.every((entry: unknown) => {
           if (!entry || typeof entry !== 'object' || entry === null) return false;
           const fbEntry = entry as Record<string, unknown>;
           
           return typeof fbEntry.id === 'string' &&
                  typeof fbEntry.time === 'number' &&
                  (!fbEntry.messaging || Array.isArray(fbEntry.messaging));
         });
}

// 安全日誌記錄函數
function logSecurely(platform: string, userId: string, messageLength: number) {
  console.log(`Processed ${platform} message from user [${userId.slice(0, 8)}...]: [${messageLength} chars]`);
}

// 驗證 Line 簽名（使用 Web Crypto API）
async function verifyLineSignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const hash = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

    return hash === signature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// 處理 Line 訊息
async function processLineMessage(env: Bindings, event: LineEvent) {
  const userId = event.source.userId;
  const message = event.message;
  
  if (!message) {
    console.warn('No message in LINE event');
    return;
  }
  
  try {
    // 解析訊息內容和類型
    let messageContent = '';
    let messageType = message.type;
    let mediaData: LineMediaData | null = null;
    
    switch (message.type) {
      case 'text':
        messageContent = message.text || '';
        break;
      case 'image':
        messageContent = '[圖片]';
        mediaData = {
          originalContentUrl: `https://api.line.me/v2/bot/message/${message.id}/content`,
          previewImageUrl: `https://api.line.me/v2/bot/message/${message.id}/content/preview`
        };
        break;
      case 'video':
        messageContent = '[影片]';
        mediaData = {
          originalContentUrl: `https://api.line.me/v2/bot/message/${message.id}/content`,
          previewImageUrl: `https://api.line.me/v2/bot/message/${message.id}/content/preview`
        };
        break;
      case 'audio':
        messageContent = '[語音]';
        mediaData = {
          originalContentUrl: `https://api.line.me/v2/bot/message/${message.id}/content`,
          duration: message.duration || 0
        };
        break;
      case 'file':
        messageContent = `[檔案] ${message.fileName || 'Unknown file'}`;
        mediaData = {
          originalContentUrl: `https://api.line.me/v2/bot/message/${message.id}/content`,
          fileName: message.fileName || '',
          fileSize: message.fileSize || 0
        };
        break;
      case 'location':
        messageContent = `[位置] ${message.title || 'Location'}: ${message.address || 'Unknown address'}`;
        mediaData = {
          title: message.title || '',
          address: message.address || '',
          latitude: message.latitude || 0,
          longitude: message.longitude || 0
        };
        break;
      case 'sticker':
        messageContent = '[貼圖]';
        mediaData = {
          packageId: message.packageId || '',
          stickerId: message.stickerId || ''
        };
        break;
      default:
        messageContent = `[${message.type}]`;
        mediaData = message;
        break;
    }

    // 查詢或建立使用者
    let user = await env.DB.prepare(`
      SELECT * FROM customers 
      WHERE platform_user_id = ? AND platform = ?
    `).bind(userId, 'line').first();

    if (!user) {
      // 使用用戶同步服務獲取用戶資料
      let displayName = 'LINE User';
      let avatarUrl = null;
      
      try {
        const { createUserSyncService } = await import('../services/user-sync');
        const userSyncService = createUserSyncService(env);
        const profile = await userSyncService.syncLineUser(userId, event.source.groupId);
        if (profile) {
          displayName = profile.displayName;
          avatarUrl = profile.pictureUrl;
        }
      } catch (profileError) {
        console.warn('Failed to sync LINE user profile:', profileError);
      }

      // 建立新使用者（讓資料庫自動生成 ID）
      const result = await env.DB.prepare(`
        INSERT INTO customers (platform, platform_user_id, display_name, avatar_url, profile_updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).bind('line', userId, displayName, avatarUrl).run();

      const customerId = result.meta.last_row_id;
      user = { id: customerId, platform_user_id: userId };
    } else {
      // 檢查是否需要更新用戶資料
      try {
        const { createUserSyncService } = await import('../services/user-sync');
        const userSyncService = createUserSyncService(env);
        const needsUpdate = await userSyncService.needsUpdate(userId, 'line');
        
        if (needsUpdate) {
          // 異步更新用戶資料（不等待完成）
          userSyncService.syncLineUser(userId, event.source.groupId).catch(error => {
            console.warn('Background LINE user sync failed:', error);
          });
        }
      } catch (syncError) {
        console.warn('Error checking LINE user sync status:', syncError);
      }
    }

    // 查詢或建立對話
    let conversation = await env.DB.prepare(`
      SELECT * FROM conversations 
      WHERE customer_id = ? AND status != ?
    `).bind(user.id, 'closed').first();

    if (!conversation) {
      // 建立新對話（讓資料庫自動生成 ID）
      const result = await env.DB.prepare(`
        INSERT INTO conversations (
          customer_id, status, last_message_at
        ) VALUES (?, ?, datetime('now'))
      `).bind(user.id, 'active').run();

      const conversationId = result.meta.last_row_id;
      conversation = { id: conversationId };
    } else {
      // 更新對話
      await env.DB.prepare(`
        UPDATE conversations 
        SET last_message_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(conversation.id).run();
    }

    // 儲存訊息（使用 UUID 作為訊息 ID）
    const messageId = uuidv4();
    await env.DB.prepare(`
      INSERT INTO messages (
        id, conversation_id, sender_type, sender_id, content, 
        message_type, platform_message_id, is_sent, delivery_status, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      messageId,
      conversation.id,
      'customer',
      user.id,
      messageContent,
      messageType,
      message.id,
      true,
      'delivered',
      mediaData ? JSON.stringify(mediaData) : null
    ).run();

    // 如果是多媒體訊息，下載並存儲到 R2
    if (mediaData && message.type !== 'location' && message.type !== 'sticker') {
      try {
        const { processLineMediaMessage } = await import('../utils/file-storage');
        const mediaFile = await processLineMediaMessage(
          env, 
          message.id, 
          message.type,
          message.fileName
        );
        
        if (mediaFile) {
          // 將檔案資訊存儲到資料庫
          await env.DB.prepare(`
            INSERT INTO file_attachments (
              id, message_id, filename, mime_type, file_size, 
              file_url, original_url, platform, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).bind(
            mediaFile.id,
            messageId,
            mediaFile.filename,
            mediaFile.mimeType,
            mediaFile.size,
            mediaFile.url,
            mediaFile.originalUrl,
            'line'
          ).run();
          
          console.log(`LINE ${message.type} stored: ${mediaFile.filename}`);
        } else {
          console.warn(`Failed to store LINE ${message.type} for message ${message.id}`);
        }
      } catch (storageError) {
        console.error('Error storing LINE media:', storageError);
      }
    }

    logSecurely('LINE', userId, messageContent.length);
  } catch (error) {
    console.error('Error processing LINE message:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      userId: userId.slice(0, 8) + '...',
      messageType: event.message?.type,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

// 處理 Facebook 訊息
async function processFacebookMessage(env: Bindings, messaging: FacebookMessaging) {
  const userId = messaging.sender.id;
  const message = messaging.message;
  
  if (!message) {
    console.warn('No message in Facebook messaging event');
    return;
  }
  
  try {
    // 解析訊息內容和類型
    let messageContent = '';
    let messageType = 'text';
    let mediaData: FacebookMediaData | null = null;
    
    if (message.text) {
      messageContent = message.text;
      messageType = 'text';
    } else if (message.attachments && message.attachments.length > 0) {
      const attachment = message.attachments[0];
      if (!attachment) return;
      
      switch (attachment.type) {
        case 'image':
          messageContent = '[圖片]';
          messageType = 'image';
          mediaData = {
            url: attachment.payload.url || '',
            type: 'image'
          };
          break;
        case 'video':
          messageContent = '[影片]';
          messageType = 'video';
          mediaData = {
            url: attachment.payload.url || '',
            type: 'video'
          };
          break;
        case 'audio':
          messageContent = '[語音]';
          messageType = 'audio';
          mediaData = {
            url: attachment.payload.url || '',
            type: 'audio'
          };
          break;
        case 'file':
          messageContent = `[檔案] ${attachment.payload.title || 'Unknown file'}`;
          messageType = 'file';
          mediaData = {
            url: attachment.payload.url || '',
            title: attachment.payload.title || '',
            type: 'file'
          };
          break;
        case 'location':
          messageContent = `[位置] ${attachment.payload.title || 'Location'}`;
          messageType = 'location';
          mediaData = {
            coordinates: attachment.payload.coordinates || { lat: 0, long: 0 },
            title: attachment.payload.title || '',
            url: attachment.payload.url || '',
            type: 'location'
          };
          break;
        default:
          messageContent = `[${attachment.type}]`;
          messageType = attachment.type;
          mediaData = {
            url: attachment.payload.url || '',
            type: attachment.type
          };
          break;
      }
    } else {
      messageContent = '[Unknown message]';
    }

    // 查詢或建立使用者
    let user = await env.DB.prepare(`
      SELECT * FROM customers 
      WHERE platform_user_id = ? AND platform = ?
    `).bind(userId, 'facebook').first();

    if (!user) {
      // 使用用戶同步服務獲取用戶資料
      let displayName = 'Facebook User';
      let avatarUrl = null;
      
      try {
        const { createUserSyncService } = await import('../services/user-sync');
        const userSyncService = createUserSyncService(env);
        const profile = await userSyncService.syncFacebookUser(userId);
        if (profile) {
          displayName = profile.displayName;
          avatarUrl = profile.pictureUrl;
        }
      } catch (profileError) {
        console.warn('Failed to sync Facebook user profile:', profileError);
      }

      // 建立新使用者（讓資料庫自動生成 ID）
      const result = await env.DB.prepare(`
        INSERT INTO customers (platform, platform_user_id, display_name, avatar_url, profile_updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).bind('facebook', userId, displayName, avatarUrl).run();

      const customerId = result.meta.last_row_id;
      user = { id: customerId, platform_user_id: userId };
    } else {
      // 檢查是否需要更新用戶資料
      try {
        const { createUserSyncService } = await import('../services/user-sync');
        const userSyncService = createUserSyncService(env);
        const needsUpdate = await userSyncService.needsUpdate(userId, 'facebook');
        
        if (needsUpdate) {
          // 異步更新用戶資料（不等待完成）
          userSyncService.syncFacebookUser(userId).catch(error => {
            console.warn('Background Facebook user sync failed:', error);
          });
        }
      } catch (syncError) {
        console.warn('Error checking Facebook user sync status:', syncError);
      }
    }

    // 查詢或建立對話
    let conversation = await env.DB.prepare(`
      SELECT * FROM conversations 
      WHERE customer_id = ? AND status != ?
    `).bind(user.id, 'closed').first();

    if (!conversation) {
      // 建立新對話（讓資料庫自動生成 ID）
      const result = await env.DB.prepare(`
        INSERT INTO conversations (
          customer_id, status, last_message_at
        ) VALUES (?, ?, datetime('now'))
      `).bind(user.id, 'active').run();

      const conversationId = result.meta.last_row_id;
      conversation = { id: conversationId };
    } else {
      // 更新對話
      await env.DB.prepare(`
        UPDATE conversations 
        SET last_message_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(conversation.id).run();
    }

    // 儲存訊息（使用 UUID 作為訊息 ID）
    const messageId = uuidv4();
    await env.DB.prepare(`
      INSERT INTO messages (
        id, conversation_id, sender_type, sender_id, content, 
        message_type, platform_message_id, is_sent, delivery_status, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      messageId,
      conversation.id,
      'customer',
      user.id,
      messageContent,
      messageType,
      message.mid || null,
      true,
      'delivered',
      mediaData ? JSON.stringify(mediaData) : null
    ).run();

    // 如果是多媒體訊息，下載並存儲到 R2
    if (mediaData && mediaData.url && messageType !== 'location') {
      try {
        const { processFacebookMediaMessage } = await import('../utils/file-storage');
        const mediaFile = await processFacebookMediaMessage(
          env,
          mediaData.url,
          messageType,
          message.mid || messageId,
          mediaData.title
        );
        
        if (mediaFile) {
          // 將檔案資訊存儲到資料庫
          await env.DB.prepare(`
            INSERT INTO file_attachments (
              id, message_id, filename, mime_type, file_size, 
              file_url, original_url, platform, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).bind(
            mediaFile.id,
            messageId,
            mediaFile.filename,
            mediaFile.mimeType,
            mediaFile.size,
            mediaFile.url,
            mediaFile.originalUrl,
            'facebook'
          ).run();
          
          console.log(`Facebook ${messageType} stored: ${mediaFile.filename}`);
        } else {
          console.warn(`Failed to store Facebook ${messageType} for message ${message.mid}`);
        }
      } catch (storageError) {
        console.error('Error storing Facebook media:', storageError);
      }
    }

    logSecurely('Facebook', userId, messageContent.length);
  } catch (error) {
    console.error('Error processing Facebook message:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      userId: userId.slice(0, 8) + '...',
      messageType: messaging.message?.attachments?.[0]?.type || 'text',
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}