// worker/src/handlers/webhook.ts
// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/src/handlers/webhook.ts
// Created by: Webhook Handler Developer

import { Context } from 'hono';
import { eq, and, ne } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { customers, conversations, messages, fileAttachments } from '../db/schema';
// 使用fileAttachments表的推斷類型而不是NewFileAttachment
import { convertConversation } from '../utils/drizzle-converters';
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
import { ActivityService } from '../services/activity-service';

export const webhookHandler = {
  // 處理 Line Webhook
  async line(c: Context<{ Bindings: Bindings }>) {
    console.log('🔔 [LINE Webhook] Request received at:', new Date().toISOString());
    
    try {
      // 驗證簽名
      const signature = c.req.header('X-Line-Signature');
      const body = await c.req.text();
      
      console.log('🔍 [LINE Webhook] Headers:', {
        'X-Line-Signature': signature ? 'Present' : 'Missing',
        'Content-Type': c.req.header('Content-Type'),
        'Content-Length': body.length
      });

      // 檢查 payload 大小 (1MB 限制)
      if (body.length > 1024 * 1024) {
        console.error('❌ [LINE Webhook] Payload too large:', body.length);
        return errorResponse(c, 'Payload too large', 413);
      }

      if (!signature) {
        console.error('❌ [LINE Webhook] Missing X-Line-Signature header');
        return errorResponse(c, 'Missing signature');
      }

      console.log('🔐 [LINE Webhook] Verifying signature...');
      const isValid = await verifyLineSignature(body, signature, c.env.LINE_CHANNEL_SECRET);
      
      if (!isValid) {
        console.error('❌ [LINE Webhook] Invalid signature');
        console.log('   Received signature:', signature.substring(0, 20) + '...');
        return unauthorizedResponse(c, 'Invalid signature');
      }
      
      console.log('✅ [LINE Webhook] Signature verified successfully');

      let data: LineWebhookBody;
      try {
        data = JSON.parse(body) as LineWebhookBody;
      } catch (parseError) {
        return errorResponse(c, 'Invalid JSON payload');
      }

      // 輸入驗證
      if (!validateLineWebhook(data)) {
        console.error('❌ [LINE Webhook] Invalid webhook payload structure');
        return errorResponse(c, 'Invalid webhook payload');
      }

      console.log('📦 [LINE Webhook] Processing events:', {
        destination: data.destination,
        eventCount: data.events.length,
        firstEventType: data.events[0]?.type
      });

      // 處理事件
      for (const event of data.events) {
        console.log('🎯 [LINE Webhook] Processing event:', {
          type: event.type,
          userId: event.source?.userId?.substring(0, 10) + '...',
          messageType: event.message?.type
        });
        
        if (event.type === 'message' && event.message) {
          await processLineMessage(c.env, event);
        } else {
          console.log('🔄 [LINE Webhook] Skipping non-message event:', event.type);
        }
      }

      console.log('✅ [LINE Webhook] All events processed successfully');
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
  
  console.log('💬 [LINE Message] Processing message from user:', userId.substring(0, 10) + '...');
  
  if (!message) {
    console.warn('⚠️ [LINE Message] No message in LINE event');
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
    const drizzleDb = drizzle(env.DB);
    let user = await drizzleDb
      .select()
      .from(customers)
      .where(and(
        eq(customers.platformUserId, userId),
        eq(customers.platform, 'line')
      ))
      .get();

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

      // 建立新使用者
      const timestamp = new Date().toISOString();
      await drizzleDb
        .insert(customers)
        .values({
          platform: 'line',
          platformUserId: userId,
          displayName,
          avatarUrl,
          createdAt: timestamp,
          updatedAt: timestamp
        });

      // 重新查詢刚建立的用户
      user = await drizzleDb
        .select()
        .from(customers)
        .where(and(
          eq(customers.platformUserId, userId),
          eq(customers.platform, 'line')
        ))
        .get();
    } 
    
    if (!user) {
      console.error('Failed to find or create user after insert');
      return;
    }
    
    if (user.id) {
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
    let conversation = await drizzleDb
      .select()
      .from(conversations)
      .where(and(
        eq(conversations.customerId, user.id),
        ne(conversations.status, 'closed')
      ))
      .get();

    if (!conversation) {
      // 建立新對話（使用 UUID）
      const conversationId = uuidv4();
      const timestamp = new Date().toISOString();
      try {
        await drizzleDb
          .insert(conversations)
          .values({
            id: conversationId,
            customerId: user.id,
            status: 'active',
            lastMessageAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp
          });

        // Re-query the created conversation to get full object
        const newConversation = await drizzleDb
          .select()
          .from(conversations)
          .where(eq(conversations.id, conversationId))
          .get();
        
        if (!newConversation) {
          throw new Error('Failed to retrieve created conversation');
        }
        
        conversation = convertConversation(newConversation) as any;
        console.log(`✅ Created new conversation: ${conversationId}`);
      } catch (convError) {
        console.error('❌ Failed to create conversation:', convError);
        throw new Error(`Failed to create conversation: ${convError}`);
      }
    } else {
      // 更新對話
      const timestamp = new Date().toISOString();
      await drizzleDb
        .update(conversations)
        .set({
          lastMessageAt: timestamp,
          updatedAt: timestamp
        })
        .where(eq(conversations.id, conversation.id));
    }

    // 🚨 冪等性檢查：檢查是否已存在相同的 platformMessageId
    const existingMessage = await drizzleDb
      .select()
      .from(messages)
      .where(eq(messages.platformMessageId, message.id))
      .get();

    if (existingMessage) {
      console.log(`⚠️ [LINE Webhook] Message already exists with platformMessageId: ${message.id}, skipping duplicate processing`);
      return; // 直接返回，不重複處理
    }

    // 儲存訊息（使用 UUID 作為訊息 ID）
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();
    await drizzleDb
      .insert(messages)
      .values({
        id: messageId,
        conversationId: conversation!.id,
        senderType: 'customer',
        customerSenderId: user.id,
        content: messageContent,
        messageType: messageType,
        platformMessageId: message.id,
        isSent: true,
        deliveryStatus: 'delivered',
        metadata: mediaData ? JSON.stringify(mediaData) : null,
        createdAt: timestamp
      });

    // 記錄活動以觸發 SSE 更新
    try {
      const activityService = new ActivityService(env.DB);
      const activity = await activityService.logActivity({
        userId: 'system',
        userName: 'Webhook Handler',
        userRole: 'system',
        action: 'message_received',
        resourceType: 'conversation',
        resourceId: String(conversation!.id),
        details: {
          conversationId: conversation!.id,
          customerId: user.id,
          platform: 'line',
          messageType: messageType,
          messageId: messageId,
          content: messageContent.substring(0, 100) // 只記錄前100字元
        }
      });

      if (activity) {
        console.log('✅ [LINE Webhook] Activity recorded, triggering SSE broadcast...');
        
        // 🚨 關鍵修復：觸發 SSE 推送
        const { broadcastActivity } = await import('./activity-stream');
        await broadcastActivity(env, activity);
        
        console.log('📢 [LINE Webhook] SSE broadcast triggered successfully');
      } else {
        console.warn('⚠️ [LINE Webhook] Failed to create activity, skipping SSE broadcast');
      }
    } catch (activityError) {
      console.warn('❌ [LINE Webhook] Failed to record activity:', activityError);
    }

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
          // 將檔案資訊存儲到資料庫 - using Drizzle ORM
          const drizzleDb = drizzle(env.DB);
          const newFileAttachment: any = {
            id: mediaFile.id,
            messageId: messageId,
            fileName: mediaFile.filename,
            fileType: mediaFile.mimeType,
            fileSize: mediaFile.size,
            r2Key: mediaFile.url, // Using url as r2Key for now
            url: mediaFile.originalUrl,
            createdAt: new Date().toISOString()
          };
          
          await drizzleDb.insert(fileAttachments).values(newFileAttachment);
          
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
    const drizzleDb = drizzle(env.DB);
    let user = await drizzleDb
      .select()
      .from(customers)
      .where(and(
        eq(customers.platformUserId, userId),
        eq(customers.platform, 'facebook')
      ))
      .get();

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

      // 建立新使用者
      const timestamp = new Date().toISOString();
      await drizzleDb
        .insert(customers)
        .values({
          platform: 'facebook',
          platformUserId: userId,
          displayName,
          avatarUrl,
          createdAt: timestamp,
          updatedAt: timestamp
        });

      // 重新查詢刚建立的用户
      user = await drizzleDb
        .select()
        .from(customers)
        .where(and(
          eq(customers.platformUserId, userId),
          eq(customers.platform, 'facebook')
        ))
        .get();
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
    
    // 確保用戶存在才繼續
    if (!user) {
      console.error('No user available for Facebook conversation');
      return;
    }

    // 查詢或建立對話
    let conversation = await drizzleDb
      .select()
      .from(conversations)
      .where(and(
        eq(conversations.customerId, user.id),
        ne(conversations.status, 'closed')
      ))
      .get();

    if (!conversation) {
      // 建立新對話（使用 UUID）
      const conversationId = uuidv4();
      const timestamp = new Date().toISOString();
      try {
        await drizzleDb
          .insert(conversations)
          .values({
            id: conversationId,
            customerId: user.id,
            status: 'active',
            lastMessageAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp
          });

        // Re-query the created conversation to get full object
        const newConversation = await drizzleDb
          .select()
          .from(conversations)
          .where(eq(conversations.id, conversationId))
          .get();
        
        if (!newConversation) {
          throw new Error('Failed to retrieve created conversation');
        }
        
        conversation = convertConversation(newConversation) as any;
        console.log(`✅ Created new conversation: ${conversationId}`);
      } catch (convError) {
        console.error('❌ Failed to create conversation:', convError);
        throw new Error(`Failed to create conversation: ${convError}`);
      }
    } else {
      // 更新對話
      const timestamp = new Date().toISOString();
      await drizzleDb
        .update(conversations)
        .set({
          lastMessageAt: timestamp,
          updatedAt: timestamp
        })
        .where(eq(conversations.id, conversation.id));
    }

    // 🚨 冪等性檢查：檢查是否已存在相同的 platformMessageId (Facebook)
    if (message.mid) {
      const existingMessage = await drizzleDb
        .select()
        .from(messages)
        .where(eq(messages.platformMessageId, message.mid))
        .get();

      if (existingMessage) {
        console.log(`⚠️ [Facebook Webhook] Message already exists with platformMessageId: ${message.mid}, skipping duplicate processing`);
        return; // 直接返回，不重複處理
      }
    }

    // 儲存訊息（使用 UUID 作為訊息 ID）
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();
    await drizzleDb
      .insert(messages)
      .values({
        id: messageId,
        conversationId: conversation!.id,
        senderType: 'customer',
        customerSenderId: user.id,
        content: messageContent,
        messageType: messageType,
        platformMessageId: message.mid || null,
        isSent: true,
        deliveryStatus: 'delivered',
        metadata: mediaData ? JSON.stringify(mediaData) : null,
        createdAt: timestamp
      });

    // 記錄活動以觸發 SSE 更新
    try {
      const activityService = new ActivityService(env.DB);
      const activity = await activityService.logActivity({
        userId: 'system',
        userName: 'Webhook Handler',
        userRole: 'system',
        action: 'message_received',
        resourceType: 'conversation',
        resourceId: String(conversation!.id),
        details: {
          conversationId: conversation!.id,
          customerId: user.id,
          platform: 'facebook',
          messageType: messageType,
          messageId: messageId,
          content: messageContent.substring(0, 100) // 只記錄前100字元
        }
      });

      if (activity) {
        console.log('✅ [Facebook Webhook] Activity recorded, triggering SSE broadcast...');
        
        // 🚨 關鍵修復：觸發 SSE 推送
        const { broadcastActivity } = await import('./activity-stream');
        await broadcastActivity(env, activity);
        
        console.log('📢 [Facebook Webhook] SSE broadcast triggered successfully');
      } else {
        console.warn('⚠️ [Facebook Webhook] Failed to create activity, skipping SSE broadcast');
      }
    } catch (activityError) {
      console.warn('❌ [Facebook Webhook] Failed to record activity:', activityError);
    }

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
          // 將檔案資訊存儲到資料庫 - using Drizzle ORM
          const drizzleDb = drizzle(env.DB);
          const newFileAttachment: any = {
            id: mediaFile.id,
            messageId: messageId,
            fileName: mediaFile.filename,
            fileType: mediaFile.mimeType,
            fileSize: mediaFile.size,
            r2Key: mediaFile.url, // Using url as r2Key for now
            url: mediaFile.originalUrl,
            createdAt: new Date().toISOString()
          };
          
          await drizzleDb.insert(fileAttachments).values(newFileAttachment);
          
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