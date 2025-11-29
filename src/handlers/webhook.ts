// worker/src/handlers/webhook.ts
// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/src/handlers/webhook.ts
// Created by: Webhook Handler Developer

import { Context } from 'hono';
import { eq, and, ne } from 'drizzle-orm';
import { createDbClient } from '../db/drizzle-factory';
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

// 🆕 P2-1: Import shared webhook services
import {
  verifyWebhookSignature,
  type SignatureVerificationResult
} from '../services/webhook-signature-service';
import {
  validateLineWebhook as validateLinePayload,
  validateFacebookWebhook as validateFacebookPayload,
  validatePayloadSize,
  isLineWebhookBody,
  isFacebookWebhookBody
} from '../services/webhook-validation';
import {
  parseLineMessage as parseLineMessageContent,
  parseFacebookMessage as parseFacebookMessageContent,
  hasDownloadableMedia
} from '../services/platform-message-parser';

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

      // 🆕 P2-1: 使用共享服務驗證 payload 大小
      const sizeValidation = validatePayloadSize(body, 1024 * 1024); // 1MB limit
      if (!sizeValidation.valid) {
        console.error('❌ [LINE Webhook] Payload too large:', sizeValidation.size);
        return errorResponse(c, 'Payload too large', 413);
      }

      // 🆕 P2-1: 使用共享簽名驗證服務
      const headers = Object.fromEntries(
        [...c.req.raw.headers.entries()].map(([k, v]) => [k.toLowerCase(), v])
      );

      const signatureResult = await verifyWebhookSignature(
        'line',
        body,
        headers,
        c.env.LINE_CHANNEL_SECRET
      );

      if (!signatureResult.valid) {
        console.error('❌ [LINE Webhook] Signature verification failed:', signatureResult.error);
        return unauthorizedResponse(c, signatureResult.error || 'Invalid signature');
      }

      console.log('✅ [LINE Webhook] Signature verified successfully');

      let data: LineWebhookBody;
      try {
        data = JSON.parse(body) as LineWebhookBody;
      } catch (parseError) {
        return errorResponse(c, 'Invalid JSON payload');
      }

      // 🆕 P2-1: 使用共享驗證服務
      const validationResult = validateLinePayload(data);
      if (!validationResult.valid) {
        console.error('❌ [LINE Webhook] Invalid webhook payload:', validationResult.errors);
        return errorResponse(c, validationResult.errors.join(', ') || 'Invalid webhook payload');
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

// ==================== DEPRECATED FUNCTIONS ====================
// 🚨 These functions are deprecated and will be removed in a future version.
// Please use the shared services from:
// - src/services/webhook-validation.ts
// - src/services/webhook-signature-service.ts
// - src/services/platform-message-parser.ts

/**
 * @deprecated Use `validateLineWebhook` from `src/services/webhook-validation.ts` instead.
 * This function is kept for backward compatibility with external imports.
 */
export function validateLineWebhook(data: unknown): data is LineWebhookBody {
  // Delegate to shared service
  return isLineWebhookBody(data);
}

/**
 * @deprecated Use `validateFacebookWebhook` from `src/services/webhook-validation.ts` instead.
 * This function is kept for backward compatibility.
 */
function validateFacebookWebhook(data: unknown): data is FacebookWebhookBody {
  // Delegate to shared service
  return isFacebookWebhookBody(data);
}

// 安全日誌記錄函數
function logSecurely(platform: string, userId: string, messageLength: number) {
  console.log(`Processed ${platform} message from user [${userId.slice(0, 8)}...]: [${messageLength} chars]`);
}

/**
 * @deprecated Use `verifyWebhookSignature` from `src/services/webhook-signature-service.ts` instead.
 * The new service provides timing-safe comparison and better error handling.
 * This function is kept for backward compatibility with external imports.
 */
export async function verifyLineSignature(body: string, signature: string, secret: string): Promise<boolean> {
  // Delegate to shared service with timing-safe comparison
  const result = await verifyWebhookSignature('line', body, { 'x-line-signature': signature }, secret);
  return result.valid;
}

// 處理 Line 訊息
export async function processLineMessage(env: Bindings, event: LineEvent) {
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
    const drizzleDb = createDbClient(env.DB);
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
      console.error('❌ [LINE Webhook] Failed to find or create user after insert');
      console.error('❌ [LINE Webhook] User ID:', userId.substring(0, 10) + '...');
      return;
    }
    
    console.log('✅ [LINE Webhook] User found/created successfully:', {
      userId: user.id,
      platformUserId: user.platformUserId?.substring(0, 10) + '...',
      displayName: user.displayName
    });
    
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
    console.log('🔍 [LINE Webhook] Searching for existing conversation for customer:', user.id);
    let conversation = await drizzleDb
      .select()
      .from(conversations)
      .where(and(
        eq(conversations.customerId, user.id),
        ne(conversations.status, 'closed')
      ))
      .get();
      
    console.log('🔍 [LINE Webhook] Existing conversation found:', conversation ? conversation.id : 'None');

    if (!conversation) {
      // 建立新對話（使用 UUID）
      const conversationId = uuidv4();
      const timestamp = new Date().toISOString();
      
      console.log('🔄 [LINE Webhook] Creating new conversation...', {
        conversationId,
        customerId: user.id,
        timestamp
      });
      
      try {
        // 插入新對話
        const insertResult = await drizzleDb
          .insert(conversations)
          .values({
            id: conversationId,
            customerId: user.id,
            assignedTeamId: null,
            assignedUserId: null,
            status: 'active',
            priority: 'normal',
            firstResponseAt: null,
            closedAt: null,
            internalNotes: null,
            lastMessageAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp
          });
          
        console.log('✅ [LINE Webhook] Conversation insert completed:', { conversationId, insertResult });

        // Re-query the created conversation to get full object
        console.log('🔍 [LINE Webhook] Re-querying created conversation...');
        const newConversation = await drizzleDb
          .select()
          .from(conversations)
          .where(eq(conversations.id, conversationId))
          .get();
        
        if (!newConversation) {
          console.error('❌ [LINE Webhook] Failed to retrieve created conversation with ID:', conversationId);
          console.error('❌ [LINE Webhook] Customer ID:', user.id);
          console.error('❌ [LINE Webhook] Timestamp:', timestamp);
          
          // 嘗試查詢是否有任何該用戶的對話
          const anyUserConversations = await drizzleDb
            .select()
            .from(conversations)
            .where(eq(conversations.customerId, user.id))
            .all();
            
          console.error('❌ [LINE Webhook] All conversations for customer:', anyUserConversations);
          
          // 檢查數據庫連接狀態
          const dbTest = await drizzleDb.select().from(customers).where(eq(customers.id, user.id)).get();
          console.error('❌ [LINE Webhook] Database connection test (customer query):', dbTest ? 'OK' : 'FAILED');
          
          throw new Error('Failed to retrieve created conversation after successful insert');
        }
        
        conversation = convertConversation(newConversation) as any;
        console.log('✅ [LINE Webhook] New conversation created and retrieved successfully:', {
          id: conversationId,
          customerId: user.id,
          status: conversation?.status
        });
      } catch (convError) {
        console.error('❌ [LINE Webhook] Failed to create conversation:', {
          error: convError instanceof Error ? convError.message : 'Unknown error',
          conversationId,
          customerId: user.id,
          timestamp,
          stack: convError instanceof Error ? convError.stack : undefined
        });
        throw new Error(`Failed to create conversation: ${convError}`);
      }
    } else {
      // 更新對話
      const timestamp = new Date().toISOString();
      console.log('🔄 [LINE Webhook] Updating existing conversation:', {
        conversationId: conversation.id,
        customerId: user.id,
        timestamp
      });
      
      await drizzleDb
        .update(conversations)
        .set({
          lastMessageAt: timestamp,
          updatedAt: timestamp
        })
        .where(eq(conversations.id, conversation.id));
        
      console.log('✅ [LINE Webhook] Existing conversation updated successfully');
    }

    // 🚨 冪等性檢查：檢查是否已存在相同的 platformMessageId
    console.log('🔍 [LINE Webhook] Checking for duplicate messages with platformMessageId:', message.id);
    const existingMessage = await drizzleDb
      .select()
      .from(messages)
      .where(eq(messages.platformMessageId, message.id))
      .get();

    if (existingMessage) {
      console.log(`⚠️ [LINE Webhook] Message already exists with platformMessageId: ${message.id}, skipping duplicate processing`);
      return; // 直接返回，不重複處理
    }
    
    console.log('✅ [LINE Webhook] No duplicate message found, proceeding with message creation');

    // 儲存訊息（使用 UUID 作為訊息 ID）
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();
    
    console.log('💾 [LINE Webhook] Creating message...', {
      messageId,
      conversationId: conversation!.id,
      customerId: user.id,
      messageType: messageType,
      contentLength: messageContent.length,
      platformMessageId: message.id
    });
    
    try {
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

      // 🚀 Trigger latest message cache update
      try {
        const { LatestMessageJobQueue } = await import('../workers/latest-message-worker');
        const jobQueue = new LatestMessageJobQueue(env);
        await jobQueue.updateLatestMessage(conversation!.id, messageId, 'high');
        console.log(`📤 [Webhook] Triggered cache update for LINE message in conversation ${conversation!.id}`);
      } catch (error) {
        console.warn(`⚠️ [Webhook] Failed to trigger cache update:`, error);
        // Don't fail the webhook for cache update failures
      }
        
        console.log('✅ [LINE Webhook] Message created successfully:', {
          messageId,
          conversationId: conversation!.id,
          customerId: user.id,
          platformMessageId: message.id
        });
        
      } catch (messageError) {
        console.error('❌ [LINE Webhook] Failed to create message:', {
          error: messageError instanceof Error ? messageError.message : 'Unknown error',
          messageId,
          conversationId: conversation!.id,
          customerId: user.id,
          platformMessageId: message.id,
          stack: messageError instanceof Error ? messageError.stack : undefined
        });
        throw new Error(`Failed to create message: ${messageError}`);
      }

    // 🔧 FIX: Process media BEFORE broadcasting so file_attachments is available
    // This ensures WebSocket clients receive complete message data including file info
    let fileAttachmentData: any[] = [];
    
    if (mediaData && message.type !== 'location' && message.type !== 'sticker') {
      console.log(`📥 [LINE Webhook] Processing media BEFORE broadcast for ${message.type} message...`);
      try {
        const { processLineMediaMessage } = await import('../utils/file-storage');
        const mediaFile = await processLineMediaMessage(
          env,
          message.id,
          message.type,
          message.fileName
        );
        
        if (mediaFile) {
          // Extract R2 key from the proxy URL
          const r2Key = mediaFile.url.includes('/api/files/public/')
            ? mediaFile.url.split('/api/files/public/')[1]
            : `media/line/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${mediaFile.id}`;

          const newFileAttachment = {
            id: mediaFile.id,
            messageId: messageId,
            filename: mediaFile.filename,
            mimeType: mediaFile.mimeType,
            fileSize: mediaFile.size,
            fileUrl: mediaFile.url,
            r2Key: r2Key,
            createdAt: new Date().toISOString()
          };

          // Store to database
          await drizzleDb.insert(fileAttachments).values(newFileAttachment);
          
          // Keep for broadcast
          fileAttachmentData = [newFileAttachment];
          
          console.log(`✅ [LINE Webhook] Media processed and stored BEFORE broadcast: ${mediaFile.filename}`);
        }
      } catch (storageError) {
        console.error('⚠️ [LINE Webhook] Error processing media before broadcast:', storageError);
        // Continue with broadcast even if media processing fails
      }
    }

    // 🚀 WebSocket Real-time Broadcast: Notify CustomerConversationDO
    // This triggers instant UI updates for all connected agents viewing this conversation
    try {
      // Construct complete message object for broadcasting
      // 🔧 FIX: Include senderId and file_attachments for frontend compatibility
      const broadcastMessage = {
        id: messageId,
        conversationId: conversation!.id,
        senderType: 'customer' as const,
        customerSenderId: user.id,
        agentSenderId: null,
        senderId: user.id,  // 🔧 FIX: Add senderId for frontend
        content: messageContent,
        messageType: messageType,
        platformMessageId: message.id,
        isRecalled: false,
        recallDeadline: null,
        recalledAt: null,
        isSent: true,
        sentAt: null,
        deliveryStatus: 'delivered' as const,
        replyToMessageId: null,
        threadId: null,
        sessionId: null,
        sessionSequence: 1,
        metadata: mediaData ? JSON.stringify(mediaData) : null,
        createdAt: timestamp,
        file_attachments: fileAttachmentData  // 🔧 FIX: Include file attachments
      };

      // Get CustomerConversationDO instance
      const conversationDOId = env.CUSTOMER_CONVERSATION_DO.idFromName(conversation!.id);
      const conversationDO = env.CUSTOMER_CONVERSATION_DO.get(conversationDOId);

      console.log(`📡 [LINE Webhook] Preparing to notify CustomerConversationDO for conversation: ${conversation!.id}`);

      // Use fetch() to send notification to CustomerConversationDO
      const notifyRequest = new Request('https://fake-host/notify-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversation!.id,
          message: broadcastMessage
        })
      });

      const response = await conversationDO.fetch(notifyRequest);

      if (response.ok) {
        console.log(`✅ [LINE Webhook] Notified CustomerConversationDO for WebSocket broadcast`);
      } else {
        const errorText = await response.text();
        console.error(`⚠️ [LINE Webhook] CustomerConversationDO returned error:`, errorText);
      }
    } catch (broadcastError) {
      console.error('❌ [LINE Webhook] Failed to broadcast via WebSocket:', broadcastError);
      // Don't fail webhook processing - message is saved to database
    }

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
        console.log('✅ [LINE Webhook] Activity recorded');

        // REMOVED: SSE broadcast (Phase 4 cleanup - replaced by WebSocket real-time events)
        // const { broadcastActivity } = await import('./activity-stream');
        // await broadcastActivity(env, activity);

        // Note: WebSocket real-time events are now handled by websocket-broadcast-service
      } else {
        console.warn('⚠️ [LINE Webhook] Failed to create activity');
      }
    } catch (activityError) {
      console.warn('❌ [LINE Webhook] Failed to record activity:', activityError);
    }

    // 如果是多媒體訊息，下載並存儲到 R2
    console.log(`🔍 [LINE Webhook] Media processing check:`, {
      hasMediaData: !!mediaData,
      messageType: message.type,
      shouldProcess: !!(mediaData && message.type !== 'location' && message.type !== 'sticker'),
      lineMessageId: message.id,
      fileName: message.fileName || 'N/A'
    });

    if (mediaData && message.type !== 'location' && message.type !== 'sticker') {
      console.log(`📥 [LINE Webhook] Starting media download for ${message.type} message...`);
      try {
        const { processLineMediaMessage } = await import('../utils/file-storage');
        console.log(`📦 [LINE Webhook] Calling processLineMediaMessage with:`, {
          lineMessageId: message.id,
          messageType: message.type,
          fileName: message.fileName || 'N/A'
        });
        const mediaFile = await processLineMediaMessage(
          env,
          message.id,
          message.type,
          message.fileName
        );
        console.log(`📤 [LINE Webhook] processLineMediaMessage returned:`, mediaFile ? {
          id: mediaFile.id,
          filename: mediaFile.filename,
          size: mediaFile.size,
          url: mediaFile.url
        } : 'NULL');
        
        if (mediaFile) {
          // 將檔案資訊存儲到資料庫 - using Drizzle ORM
          // 🔧 FIX: Column names must match schema.ts exactly!
          const drizzleDb = createDbClient(env.DB);

          // Extract R2 key from the proxy URL
          // URL format: https://multi-channel.imfinethankyouandyou.com/api/files/public/{r2Key}
          const r2Key = mediaFile.url.includes('/api/files/public/')
            ? mediaFile.url.split('/api/files/public/')[1]
            : `media/line/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${mediaFile.id}`;

          const newFileAttachment = {
            id: mediaFile.id,
            messageId: messageId,
            filename: mediaFile.filename,        // 🔧 FIX: was 'fileName'
            mimeType: mediaFile.mimeType,        // 🔧 FIX: was 'fileType'
            fileSize: mediaFile.size,
            fileUrl: mediaFile.url,              // 🔧 FIX: Added - stores proxy URL
            r2Key: r2Key,                        // 🔧 FIX: Now stores actual R2 path
            createdAt: new Date().toISOString()
          };

          await drizzleDb.insert(fileAttachments).values(newFileAttachment);

          console.log(`✅ [LINE Webhook] Media stored: ${mediaFile.filename}, URL: ${mediaFile.url}`);
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
    const drizzleDb = createDbClient(env.DB);
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
            assignedTeamId: null,
            assignedUserId: null,
            status: 'active',
            priority: 'normal',
            firstResponseAt: null,
            closedAt: null,
            internalNotes: null,
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

    // 🚀 Trigger latest message cache update
    try {
      const { LatestMessageJobQueue } = await import('../workers/latest-message-worker');
      const jobQueue = new LatestMessageJobQueue(env);
      await jobQueue.updateLatestMessage(conversation!.id, messageId, 'high');
      console.log(`📤 [Webhook] Triggered cache update for Facebook message in conversation ${conversation!.id}`);
    } catch (error) {
      console.warn(`⚠️ [Webhook] Failed to trigger cache update:`, error);
      // Don't fail the webhook for cache update failures
    }

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
        console.log('✅ [Facebook Webhook] Activity recorded');

        // REMOVED: SSE broadcast (Phase 4 cleanup - replaced by WebSocket real-time events)
        // const { broadcastActivity } = await import('./activity-stream');
        // await broadcastActivity(env, activity);

        // Note: WebSocket real-time events are now handled by websocket-broadcast-service
      } else {
        console.warn('⚠️ [Facebook Webhook] Failed to create activity');
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
          const drizzleDb = createDbClient(env.DB);
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
// ==================== Hono Router Wrapper ====================
import { Hono } from 'hono';

/**
 * Webhook Router - Hono wrapper for webhook handlers
 * Provides a unified router interface for LINE and Facebook webhooks
 */
export const webhookRouter = new Hono<{ Bindings: Bindings }>();

// Health check endpoint
webhookRouter.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    module: 'webhook',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// LINE webhook endpoint
webhookRouter.post('/line', (c) => webhookHandler.line(c));

// Facebook webhook endpoint
webhookRouter.get('/facebook', (c) => webhookHandler.facebook(c));
webhookRouter.post('/facebook', (c) => webhookHandler.facebook(c));

// Default export for route registry
export default webhookRouter;
