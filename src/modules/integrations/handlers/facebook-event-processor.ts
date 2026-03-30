// src/modules/integrations/handlers/facebook-event-processor.ts
// Facebook event processing logic extracted from webhook.ts (Phase 4 refactoring)
// Contains: processFacebookMessage

import type { Bindings, FacebookMessaging, FacebookMediaData } from '@/types';
import { ActivityService } from '@modules/activities';
import { WebSocketBroadcastService } from '@/services/websocket-broadcast-service';
import { createContextLogger } from '@/utils/logger';

import { findOrCreateConversation, isDuplicateMessage, saveMessage } from '../services/webhook-conversation-service';
import { processFacebookMedia } from '../services/webhook-media-service';
import { nowMs } from '@/utils/timestamp';
import { findOrCreateCustomer, triggerBackgroundSyncIfNeeded } from '../services/webhook-customer-service';
import type { DeferFn } from './webhook';

const log = createContextLogger('Webhook');

// 安全日誌記錄函數
function logSecurely(platform: string, userId: string, messageLength: number) {
  log.info('Processed message', { platform, userId: userId.slice(0, 8) + '...', messageLength });
}

// 處理 Facebook 訊息
export async function processFacebookMessage(env: Bindings, messaging: FacebookMessaging, defer: DeferFn = () => {}) {
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

    // Query or create customer (consolidated service with lock + deletedAt filter)
    const user = await findOrCreateCustomer(env, userId, 'facebook');

    if (!user) {
      log.error('Facebook Webhook: Failed to find or create user');
      return;
    }

    // Trigger background profile sync if stale (fire-and-forget with retry)
    triggerBackgroundSyncIfNeeded(env, userId, 'facebook');

    // 查詢或建立對話
    const conversation = await findOrCreateConversation(env, user.id, 'facebook');

    // 冪等性檢查：檢查是否已存在相同的 platformMessageId (Facebook)
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

    // =================== DEFERRED: Non-critical tasks via waitUntil ===================
    const convId = conversation!.id;
    const convTeamId = conversation!.assignedTeamId;
    const userDisplayName = user.displayName || 'Facebook User';
    const customerId = user.id;

    // A. WebSocket broadcast (without file_attachments)
    defer((async () => {
      try {
        const broadcastService = new WebSocketBroadcastService(env);
        await broadcastService.broadcastNewMessage({
          conversationId: convId,
          message: {
            id: messageId,
            content: messageContent,
            messageType: messageType,
            senderType: 'customer',
            senderId: String(customerId),
            platform: 'facebook',
            timestamp: nowMs(),
            deliveryStatus: 'delivered',
          },
          source: 'webhook',
          teamId: convTeamId ?? undefined
        });
      } catch (err) {
        log.warn('Facebook Webhook: Deferred broadcast failed', { error: err instanceof Error ? err.message : String(err) });
      }
    })());

    // B+C. Media processing + follow-up message_updated broadcast
    if (mediaData && mediaData.url && messageType !== 'location') {
      const fbMediaUrl = mediaData.url;
      const fbMediaTitle = mediaData.title;
      const fbMid = message.mid || messageId;
      defer((async () => {
        try {
          await processFacebookMedia(env, messageId, fbMediaUrl, messageType, fbMid, fbMediaTitle);
          const broadcastService = new WebSocketBroadcastService(env);
          await broadcastService.broadcastMessageEvent({
            type: 'message_updated',
            conversationId: convId,
            messageId,
            data: { mediaProcessed: true },
            priority: 'high'
          });
        } catch (err) {
          log.warn('Facebook Webhook: Deferred media processing failed', { error: err instanceof Error ? err.message : String(err) });
        }
      })());
    }

    // E. Activity logging
    defer((async () => {
      try {
        const activityService = new ActivityService(env.DB);
        await activityService.logActivity({
          userId: 'system',
          userName: 'Webhook Handler',
          userRole: 'system',
          action: 'message_received',
          resourceType: 'conversation',
          resourceId: String(convId),
          details: {
            conversationId: convId,
            customerId,
            platform: 'facebook',
            messageType: messageType,
            messageId: messageId,
            content: messageContent.substring(0, 100)
          }
        });
      } catch (err) {
        log.warn('Facebook Webhook: Deferred activity logging failed', { error: err instanceof Error ? err.message : String(err) });
      }
    })());

    // F. Notifications
    if (convTeamId) {
      defer((async () => {
        try {
          const { triggerNewConversationNotification } = await import('@/utils/notification-trigger');
          await triggerNewConversationNotification(env, {
            conversationId: convId,
            customerName: userDisplayName,
            platform: 'Facebook',
            messagePreview: messageContent.substring(0, 100),
            teamId: convTeamId ?? undefined
          });
        } catch (err) {
          log.warn('Facebook Webhook: Deferred notification failed', { error: err instanceof Error ? err.message : String(err) });
        }
      })());
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
