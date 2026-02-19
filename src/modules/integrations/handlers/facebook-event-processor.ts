// src/modules/integrations/handlers/facebook-event-processor.ts
// Facebook event processing logic extracted from webhook.ts (Phase 4 refactoring)
// Contains: processFacebookMessage

import { eq, and } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { customers } from '@/db/schema';
import type { Bindings, FacebookMessaging, FacebookMediaData } from '@/types';
import { ActivityService } from '@modules/activities';
import { createContextLogger } from '@/utils/logger';
import { findOrCreateCustomer, triggerBackgroundSyncIfNeeded } from '../services/webhook-customer-service';
import { findOrCreateConversation, isDuplicateMessage, saveMessage } from '../services/webhook-conversation-service';
import { processFacebookMedia } from '../services/webhook-media-service';
import { nowISO } from '@/utils/timestamp'

const log = createContextLogger('Webhook');

// 安全日誌記錄函數
function logSecurely(platform: string, userId: string, messageLength: number) {
  console.log(`Processed ${platform} message from user [${userId.slice(0, 8)}...]: [${messageLength} chars]`);
}

// 處理 Facebook 訊息
export async function processFacebookMessage(env: Bindings, messaging: FacebookMessaging) {
  const userId = messaging.sender.id;
  const message = messaging.message;

  if (!message) {
    log.warn('Facebook Message: No message in messaging event');
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
        const { createUserSyncService } = await import('@/services/user-sync');
        const userSyncService = createUserSyncService(env);
        const profile = await userSyncService.syncFacebookUser(userId);
        if (profile) {
          displayName = profile.displayName;
          avatarUrl = profile.pictureUrl;
        }
      } catch (profileError) {
        log.warn('Failed to sync Facebook user profile', { error: profileError instanceof Error ? profileError.message : String(profileError) });
      }

      // 建立新使用者
      const timestamp = nowISO();
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
        const { createUserSyncService } = await import('@/services/user-sync');
        const userSyncService = createUserSyncService(env);
        const needsUpdate = await userSyncService.needsUpdate(userId, 'facebook');

        if (needsUpdate) {
          // 異步更新用戶資料（不等待完成）
          userSyncService.syncFacebookUser(userId).catch((error: unknown) => {
            log.warn('Background Facebook user sync failed', { error: error instanceof Error ? error.message : String(error) });
          });
        }
      } catch (syncError) {
        log.warn('Error checking Facebook user sync status', { error: syncError instanceof Error ? syncError.message : String(syncError) });
      }
    }

    // 確保用戶存在才繼續
    if (!user) {
      log.error('Facebook Webhook: No user available for conversation');
      return;
    }

    // 查詢或建立對話
    const conversation = await findOrCreateConversation(env, user.id, 'facebook');

    // 🚨 冪等性檢查：檢查是否已存在相同的 platformMessageId (Facebook)
    if (message.mid) {
      if (await isDuplicateMessage(env, message.mid, 'facebook')) {
        return; // 直接返回，不重複處理
      }
    }

    // 儲存訊息
    const messageId = await saveMessage(
      env,
      conversation!.id,
      user.id,
      messageContent,
      messageType,
      message.mid || null,
      user.displayName || null,
      mediaData,
      'facebook'
    );

    // 記錄活動
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

        // Note: WebSocket real-time events are handled by websocket-broadcast-service
      } else {
        log.warn('Facebook Webhook: Failed to create activity');
      }
    } catch (activityError) {
      log.warn('Facebook Webhook: Failed to record activity', { error: activityError instanceof Error ? activityError.message : String(activityError) });
    }

    // Note: Individual agent notifications removed - only team assignment is supported now
    // Team members will receive notifications via WebSocket broadcast
    if (conversation!.assignedTeamId) {
      // 動態導入 notification-trigger 函數
      import('@/utils/notification-trigger').then(({ triggerNewConversationNotification }) => {
        triggerNewConversationNotification(env, {
          conversationId: conversation!.id,
          customerName: user.displayName || 'Facebook User',
          platform: 'Facebook',
          messagePreview: messageContent.substring(0, 100),
          teamId: conversation!.assignedTeamId ?? undefined
        }).catch((err: unknown) => {
          log.warn('Facebook Webhook: Failed to trigger team notification', {
            error: err instanceof Error ? err.message : String(err)
          });
        });
      });
    }

    // 如果是多媒體訊息，下載並存儲到 R2
    if (mediaData && mediaData.url && messageType !== 'location') {
      await processFacebookMedia(
        env,
        messageId,
        mediaData.url,
        messageType,
        message.mid || messageId,
        mediaData.title
      );
    }

    logSecurely('Facebook', userId, messageContent.length);
  } catch (error) {
    log.error('Error processing Facebook message', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userIdPrefix: userId.slice(0, 8),
      messageType: messaging.message?.attachments?.[0]?.type || 'text'
    });
    throw error;
  }
}
