// src/modules/integrations/handlers/line-event-processor.ts
// LINE event processing logic extracted from webhook.ts (Phase 4 refactoring)
// Contains: processLineMessage, processLineFollowEvent, processLineUnfollowEvent

import { eq, and, ne, desc } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { customers, conversations, teams, customerTeamAssignments } from '@/db/schema';
import type { Bindings, LineEvent, LineMediaData } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { ActivityService } from '@modules/activities';
import { WebSocketBroadcastService } from '@/services/websocket-broadcast-service';
import { createContextLogger } from '@/utils/logger';

import { findOrCreateConversation, isDuplicateMessage, saveMessage } from '../services/webhook-conversation-service';
import { processLineMedia } from '../services/webhook-media-service';
import { nowISO, nowMs } from '@/utils/timestamp'

const log = createContextLogger('Webhook');

// 安全日誌記錄函數
function logSecurely(platform: string, userId: string, messageLength: number) {
  console.log(`Processed ${platform} message from user [${userId.slice(0, 8)}...]: [${messageLength} chars]`);
}

// 處理 Line 訊息
export async function processLineMessage(env: Bindings, event: LineEvent) {
  const userId = event.source.userId;
  const message = event.message;

  console.log('[LINE Message] Processing message from user:', userId.substring(0, 10) + '...');

  if (!message) {
    log.warn('LINE Message: No message in LINE event');
    return;
  }

  try {
    // 智能类型修正: 检测并修正 LINE API 的类型误判
    // 问题: LINE API 可能将某些文件错误识别为 video/audio 类型
    // 解决: 如果消息有 fileName 字段,强制修正为 'file' 类型
    let correctedMessageType = message.type;

    if (message.fileName && message.type !== 'file') {
      console.warn(`[LINE Webhook] Message type mismatch detected!`, {
        originalType: message.type,
        fileName: message.fileName,
        fileSize: message.fileSize,
        messageId: message.id,
        userId: userId.substring(0, 10) + '...'
      });
      console.warn(`[LINE Webhook] Auto-correcting message type from "${message.type}" to "file"`);
      correctedMessageType = 'file';
    }

    // 诊断日志: 记录所有文件相关消息的详细信息
    if (message.fileName || message.type === 'file' || correctedMessageType === 'file') {
      console.log('[LINE Webhook] File message details:', {
        messageId: message.id,
        originalType: message.type,
        correctedType: correctedMessageType,
        fileName: message.fileName,
        fileSize: message.fileSize,
        hasFileName: !!message.fileName,
        wasTypeCorrected: message.type !== correctedMessageType
      });
    }

    // 解析訊息內容和類型
    let messageContent = '';
    let messageType = correctedMessageType;  // ← 使用修正后的类型
    let mediaData: LineMediaData | null = null;

    switch (correctedMessageType) {  // ← 使用修正后的类型
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

    // 查詢或建立使用者 (uses shared service but with LINE-specific sync)
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
        const { createUserSyncService } = await import('@/services/user-sync');
        const userSyncService = createUserSyncService(env);
        const profile = await userSyncService.syncLineUser(userId, event.source.groupId);
        if (profile) {
          displayName = profile.displayName;
          avatarUrl = profile.pictureUrl;
        }
      } catch (profileError) {
        log.warn('Failed to sync LINE user profile', { error: profileError instanceof Error ? profileError.message : String(profileError) });
      }

      // Fallback: check customer_team_assignments for LIFF-captured name
      if (displayName === 'LINE User') {
        try {
          const assignment = await drizzleDb
            .select({ displayName: customerTeamAssignments.displayName })
            .from(customerTeamAssignments)
            .where(eq(customerTeamAssignments.platformUserId, userId))
            .orderBy(desc(customerTeamAssignments.assignedAt))
            .limit(1)
            .get();
          if (assignment?.displayName) {
            displayName = assignment.displayName;
            log.info('LINE Message: Using LIFF-captured displayName as fallback', { displayName });
          }
        } catch (fallbackError) {
          log.warn('Failed to query LIFF assignment for displayName fallback', {
            error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
          });
        }
      }

      // 建立新使用者
      const timestamp = nowISO();
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
      log.error('LINE Webhook: Failed to find or create user after insert', { userIdPrefix: userId.substring(0, 10) });
      return;
    }

    console.log('[LINE Webhook] User found/created successfully:', {
      userId: user.id,
      platformUserId: user.platformUserId?.substring(0, 10) + '...',
      displayName: user.displayName
    });

    if (user.id) {
      // 檢查是否需要更新用戶資料
      try {
        const { createUserSyncService } = await import('@/services/user-sync');
        const userSyncService = createUserSyncService(env);
        const needsUpdate = await userSyncService.needsUpdate(userId, 'line');

        if (needsUpdate) {
          // 異步更新用戶資料（不等待完成）
          userSyncService.syncLineUser(userId, event.source.groupId).catch((error: unknown) => {
            log.warn('Background LINE user sync failed', { error: error instanceof Error ? error.message : String(error) });
          });
        }
      } catch (syncError) {
        log.warn('Error checking LINE user sync status', { error: syncError instanceof Error ? syncError.message : String(syncError) });
      }
    }

    // Fix: 查詢 customer_team_assignments 取得 QR Code 團隊指派
    // 解決 processLineMessage 建立對話時 assignedTeamId 永遠為 null 的 bug
    let assignedTeamId: number | null = null;
    try {
      const drizzleDb = createDbClient(env.DB);
      const assignment = await drizzleDb
        .select({ teamId: customerTeamAssignments.teamId })
        .from(customerTeamAssignments)
        .where(eq(customerTeamAssignments.platformUserId, userId))
        .orderBy(desc(customerTeamAssignments.assignedAt))
        .limit(1)
        .get();
      if (assignment) {
        assignedTeamId = assignment.teamId;
        console.log(`[LINE Message] Found team assignment from QR code: teamId=${assignedTeamId}`);
      }
    } catch (assignmentError) {
      log.warn('LINE Message: Failed to query customer_team_assignments', {
        error: assignmentError instanceof Error ? assignmentError.message : String(assignmentError)
      });
    }

    // 查詢或建立對話
    const conversation = await findOrCreateConversation(env, user.id, 'line', {
      messageContent,
      customerDisplayName: user.displayName || 'LINE User',
      assignedTeamId
    });

    // 冪等性檢查：檢查是否已存在相同的 platformMessageId
    if (await isDuplicateMessage(env, message.id, 'line')) {
      return; // 直接返回，不重複處理
    }

    // 儲存訊息
    const messageId = await saveMessage(
      env,
      conversation!.id,
      user.id,
      messageContent,
      messageType,
      message.id,
      user.displayName || null,
      mediaData,
      'line'
    );

    // FIX: Process media BEFORE broadcasting so file_attachments is available
    // This ensures WebSocket clients receive complete message data including file info
    let fileAttachmentData: any[] = [];

    if (mediaData && message.type !== 'location' && message.type !== 'sticker') {
      fileAttachmentData = await processLineMedia(
        env,
        messageId,
        message.id,
        message.type,
        message.fileName
      );
    }

    // Phase B4: Unified Broadcast for Conversation List & Detail Updates
    // Uses WebSocketBroadcastService.broadcastNewMessage() for both:
    // 1. CustomerConversationDO - conversation detail page real-time updates
    // 2. MessageBroadcaster global - conversation list page lastMessage updates
    try {
      const broadcastService = new WebSocketBroadcastService(env);
      const broadcastResult = await broadcastService.broadcastNewMessage({
        conversationId: conversation!.id,
        message: {
          id: messageId,
          content: messageContent,
          messageType: messageType,
          senderType: 'customer',
          senderId: String(user.id),
          platform: 'line',
          timestamp: nowMs(),
          deliveryStatus: 'delivered',
          // Include file_attachments for immediate Flex Card display
          file_attachments: fileAttachmentData.length > 0 ? fileAttachmentData : undefined
        },
        source: 'webhook',
        // Security: Team-scoped broadcast (P1 fix - prevent cross-team data leakage)
        teamId: conversation!.assignedTeamId || undefined
      });

      console.log(`[LINE Webhook] Unified broadcast completed`, {
        conversationId: conversation!.id,
        conversationBroadcast: broadcastResult.conversationBroadcast,
        globalBroadcast: broadcastResult.globalBroadcast
      });
    } catch (broadcastError) {
      log.error('LINE Webhook: Unified broadcast failed (non-critical)', {
        error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError)
      });
      // Don't fail webhook processing - message is saved to database
    }

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
          platform: 'line',
          messageType: messageType,
          messageId: messageId,
          content: messageContent.substring(0, 100) // 只記錄前100字元
        }
      });

      if (activity) {
        console.log('[LINE Webhook] Activity recorded');

        // Note: WebSocket real-time events are handled by websocket-broadcast-service
      } else {
        log.warn('LINE Webhook: Failed to create activity');
      }
    } catch (activityError) {
      log.warn('LINE Webhook: Failed to record activity', { error: activityError instanceof Error ? activityError.message : String(activityError) });
    }

    // 通知觸發：根據對話指派狀態發送適當的通知 (僅支援團隊指派)
    try {
      // 情況 1: 已指派給團隊
      if (conversation!.assignedTeamId) {
        console.log('[LINE Webhook] Triggering notification for assigned team:', {
          conversationId: conversation!.id,
          assignedTeamId: conversation!.assignedTeamId,
          scenario: 'team_assignment'
        });

        // 動態導入 notification-trigger 函數
        const { triggerNewConversationNotification } = await import('@/utils/notification-trigger');

        // 通知該團隊的所有成員和所有管理員
        await triggerNewConversationNotification(env, {
          conversationId: conversation!.id,
          customerName: user.displayName || 'LINE User',
          platform: 'LINE',
          messagePreview: messageContent,
          teamId: conversation!.assignedTeamId
        });
      }
      // 情況 2: 未指派（沒有團隊）
      else {
        console.log('[LINE Webhook] Triggering notification for unassigned conversation:', {
          conversationId: conversation!.id,
          scenario: 'unassigned'
        });

        // 動態導入 notification-trigger 函數
        const { triggerNewConversationNotification } = await import('@/utils/notification-trigger');

        // 通知所有管理員和所有客服人員
        await triggerNewConversationNotification(env, {
          conversationId: conversation!.id,
          customerName: user.displayName || 'LINE User',
          platform: 'LINE',
          messagePreview: messageContent,
          teamId: undefined  // 沒有團隊 → 通知所有人
        });
      }

      console.log('[LINE Webhook] Notification triggered successfully');
    } catch (notificationError) {
      log.warn('LINE Webhook: Failed to trigger notification', {
        error: notificationError instanceof Error ? notificationError.message : String(notificationError),
        conversationId: conversation!.id,
        assignedTeamId: conversation!.assignedTeamId
      });
      // 不要讓通知失敗影響主流程
    }

    // 媒體已在廣播前處理完成 (Lines 622-666)
    // 不需要第二次處理，避免重複插入 file_attachments

    // Auto-Reply Engine: evaluate incoming message against rules
    if (conversation?.assignedTeamId) {
      try {
        const { evaluate } = await import('@modules/auto-reply/services/auto-reply-engine');
        const autoReplyResult = await evaluate(
          {
            message: { content: messageContent, messageType, platform: 'line' },
            conversationId: conversation.id,
            teamId: conversation.assignedTeamId,
            replyToken: event.replyToken || null,
            customerId: user.id,
            platformUserId: userId,
          },
          env
        );

        if (autoReplyResult.matched) {
          console.log('[LINE Webhook] Auto-reply triggered', {
            ruleId: autoReplyResult.ruleId,
            ruleName: autoReplyResult.ruleName,
            replyMethod: autoReplyResult.replyMethod,
          });
        }
      } catch (autoReplyError) {
        log.warn('LINE Webhook: Auto-reply evaluation failed (non-critical)', {
          error: autoReplyError instanceof Error ? autoReplyError.message : String(autoReplyError),
        });
        // Auto-reply failure should not break webhook processing
      }
    }

    logSecurely('LINE', userId, messageContent.length);
  } catch (error) {
    log.error('Error processing LINE message', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userIdPrefix: userId.slice(0, 8),
      messageType: event.message?.type
    });
    throw error;
  }
}

/**
 * 處理 LINE Follow 事件 (QR Code 加好友)
 * 當用戶通過 QR Code 掃描加入時，自動指派到對應團隊
 */
export async function processLineFollowEvent(env: Bindings, event: LineEvent) {
  const userId = event.source.userId;

  console.log('[LINE Follow] Processing follow event:', {
    userId: userId?.substring(0, 10) + '...',
    timestamp: event.timestamp,
    replyToken: event.replyToken ? 'Present' : 'None'
  });

  if (!userId) {
    log.warn('LINE Follow: No userId in follow event');
    return;
  }

  try {
    const drizzleDb = createDbClient(env.DB);

    // Step 1: 檢查用戶是否已存在
    let existingCustomer = await drizzleDb
      .select()
      .from(customers)
      .where(and(
        eq(customers.platformUserId, userId),
        eq(customers.platform, 'line')
      ))
      .get();

    // Step 2: 獲取用戶資料
    let displayName = 'LINE User';
    let avatarUrl: string | null = null;

    try {
      const { createUserSyncService } = await import('@/services/user-sync');
      const userSyncService = createUserSyncService(env);
      const profile = await userSyncService.syncLineUser(userId, event.source.groupId);
      if (profile) {
        displayName = profile.displayName;
        avatarUrl = profile.pictureUrl || null;
      }
    } catch (profileError) {
      log.warn('LINE Follow: Failed to sync user profile', {
        error: profileError instanceof Error ? profileError.message : String(profileError)
      });
    }

    // Step 3: 嘗試從 QR Code 追蹤參數獲取團隊 ID
    let assignedTeamId: number | null = null;
    let qrCodeToken: string | null = null;
    let existingConversation: any = null; // Declare at function scope for later use

    // 嘗試從多種來源獲取追蹤參數
    // 方式 1: LINE 標準的 follow.param (如果可用)
    const followParam = (event as any).follow?.param;

    // 方式 2: 從 replyToken 相關的 context 獲取 (部分 LINE 版本支援)
    const linkNonce = (event as any).link?.nonce;

    // 方式 3: 從 liff context 獲取 (如果使用 LIFF)
    const liffParam = (event as any).liff?.context?.utouId;

    qrCodeToken = followParam || linkNonce || liffParam || null;

    console.log('[LINE Follow] Checking for QR code tracking:', {
      followParam: followParam ? 'Present' : 'None',
      linkNonce: linkNonce ? 'Present' : 'None',
      liffParam: liffParam ? 'Present' : 'None',
      qrCodeToken: qrCodeToken ? qrCodeToken.substring(0, 10) + '...' : 'None'
    });

    // 優化：並行執行 Step 4, 5, 6 的團隊查找（從串行改為並行，減少 40-100ms 延遲）
    const teamFindStartTime = nowMs();

    // 定義並行查找任務
    const teamFindTasks = await Promise.all([
      // Task 1 (原 Step 4): QR Code 追蹤參數查找
      (async (): Promise<{ source: 'qr_token'; teamId: number } | null> => {
        if (!qrCodeToken) return null;
        try {
          const { QRCodeServiceImpl } = await import('@/services/qrcode-service-impl');
          const result = await QRCodeServiceImpl.handleQRCodeFollow(env.DB, {
            type: 'follow',
            source: { userId, type: 'user' },
            follow: { param: qrCodeToken }
          } as any);
          if (result.autoAssigned && result.teamId) {
            return { source: 'qr_token', teamId: result.teamId };
          }
        } catch (qrError) {
          log.warn('LINE Follow: QR code tracking failed', {
            error: qrError instanceof Error ? qrError.message : String(qrError)
          });
        }
        return null;
      })(),

      // Task 2 (原 Step 5): customer_team_assignments 表查找（優先級最高）
      (async (): Promise<{ source: 'assignment'; teamId: number; assignmentId: string; assignmentSource: string; assignedAt: string; displayName: string | null } | null> => {
        try {
          const { customerTeamAssignments } = await import('@/db/schema');
          const assignment = await drizzleDb
            .select()
            .from(customerTeamAssignments)
            .where(eq(customerTeamAssignments.platformUserId, userId))
            .orderBy(desc(customerTeamAssignments.assignedAt))
            .limit(1)
            .get();
          if (assignment) {
            return {
              source: 'assignment',
              teamId: assignment.teamId,
              assignmentId: assignment.id,
              assignmentSource: assignment.source || 'unknown',
              assignedAt: assignment.assignedAt || '',
              displayName: assignment.displayName ?? null
            };
          }
        } catch (assignmentError) {
          log.warn('LINE Follow: Failed to query customer_team_assignments', {
            error: assignmentError instanceof Error ? assignmentError.message : String(assignmentError)
          });
        }
        return null;
      })()
    ]);

    const [qrTokenResult, assignmentResult] = teamFindTasks;

    // Fallback: use LIFF-captured name if LINE API failed
    if (displayName === 'LINE User' && assignmentResult?.displayName) {
      displayName = assignmentResult.displayName;
      log.info('LINE Follow: Using LIFF-captured displayName as fallback', { displayName });
    }

    // 按優先級選擇結果：assignment > qr_token
    // 注意：已移除舊的 recent_qr fallback (qrCodes 表)，統一使用新 LIFF 系統
    if (assignmentResult) {
      assignedTeamId = assignmentResult.teamId;
      console.log(`[LINE Follow] 從 customer_team_assignments 找到團隊分配: ${assignedTeamId}`, {
        assignmentId: assignmentResult.assignmentId,
        source: assignmentResult.assignmentSource,
        assignedAt: assignmentResult.assignedAt
      });
    } else if (qrTokenResult) {
      assignedTeamId = qrTokenResult.teamId;
      console.log(`[LINE Follow] QR Code 追蹤成功，指派到團隊: ${assignedTeamId}`);
    }

    const teamFindDuration = Date.now() - teamFindStartTime;
    console.log(`[LINE Follow] 團隊查找完成 (並行優化)`, {
      duration: `${teamFindDuration}ms`,
      assignedTeamId,
      source: assignmentResult ? 'assignment' : qrTokenResult ? 'qr_token' : 'none'
    });

    const timestamp = nowISO();

    // Step 7: 創建或更新客戶記錄
    if (!existingCustomer) {
      console.log('[LINE Follow] Creating new customer...');
      await drizzleDb
        .insert(customers)
        .values({
          platform: 'line',
          platformUserId: userId,
          displayName,
          avatarUrl,
          metadata: assignedTeamId ? JSON.stringify({
            followedAt: timestamp,
            assignedViaQR: true,
            teamId: assignedTeamId
          }) : JSON.stringify({ followedAt: timestamp }),
          createdAt: timestamp,
          updatedAt: timestamp
        });

      // 重新查詢客戶
      existingCustomer = await drizzleDb
        .select()
        .from(customers)
        .where(and(
          eq(customers.platformUserId, userId),
          eq(customers.platform, 'line')
        ))
        .get();

      console.log('[LINE Follow] Customer created:', {
        customerId: existingCustomer?.id,
        displayName,
        teamId: assignedTeamId
      });
    } else {
      // 更新現有客戶的 metadata
      console.log('[LINE Follow] Updating existing customer...');
      const existingMetadata = existingCustomer.metadata
        ? JSON.parse(existingCustomer.metadata as string)
        : {};

      await drizzleDb
        .update(customers)
        .set({
          displayName,
          avatarUrl,
          metadata: JSON.stringify({
            ...existingMetadata,
            lastFollowedAt: timestamp,
            ...(assignedTeamId && { assignedViaQR: true, teamId: assignedTeamId })
          }),
          updatedAt: timestamp
        })
        .where(eq(customers.id, existingCustomer.id));
    }

    // Step 8: 如果有團隊指派，創建預設對話
    if (assignedTeamId && existingCustomer) {
      // 檢查是否已有活躍對話
      existingConversation = await drizzleDb
        .select()
        .from(conversations)
        .where(and(
          eq(conversations.customerId, existingCustomer.id),
          ne(conversations.status, 'closed')
        ))
        .get();

      if (!existingConversation) {
        // 創建新對話並指派團隊 (只支援團隊指派，個人指派已移除)
        const conversationId = uuidv4();
        await drizzleDb
          .insert(conversations)
          .values({
            id: conversationId,
            customerId: existingCustomer.id,
            assignedTeamId: assignedTeamId,
            // Note: assignedUserId removed - only team assignment is supported now
            status: 'active',
            priority: 'normal',
            lastMessageAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp
          });

        console.log('[LINE Follow] Conversation created with team assignment:', {
          conversationId,
          customerId: existingCustomer.id,
          teamId: assignedTeamId
        });
      } else if (!existingConversation.assignedTeamId) {
        // 更新現有對話的團隊指派
        await drizzleDb
          .update(conversations)
          .set({
            assignedTeamId: assignedTeamId,
            updatedAt: timestamp
          })
          .where(eq(conversations.id, existingConversation.id));

        console.log('[LINE Follow] Updated existing conversation with team:', {
          conversationId: existingConversation.id,
          teamId: assignedTeamId
        });
      }
    }

    // 優化：統一查詢團隊資訊（避免 Step 10 和 Step 11 重複查詢）
    let teamInfo: { id: number; name: string } | null = null;
    if (assignedTeamId) {
      try {
        const teamResult = await drizzleDb
          .select({ id: teams.id, name: teams.name })
          .from(teams)
          .where(eq(teams.id, assignedTeamId))
          .get();
        if (teamResult) {
          teamInfo = teamResult;
        }
      } catch (teamQueryError) {
        log.warn('LINE Follow: Failed to fetch team info', {
          error: teamQueryError instanceof Error ? teamQueryError.message : String(teamQueryError)
        });
      }
    }

    // Step 8.5: 廣播自動指派事件到 WebSocket（實時更新前端 UI）
    if (assignedTeamId && existingCustomer) {
      // 確定對話 ID（新創建的或已存在的）
      let broadcastConversationId: string | null = null;

      if (!existingConversation) {
        // 新創建的對話需要重新查詢獲取 ID
        const newConv = await drizzleDb
          .select({ id: conversations.id })
          .from(conversations)
          .where(and(
            eq(conversations.customerId, existingCustomer.id),
            eq(conversations.assignedTeamId, assignedTeamId)
          ))
          .orderBy(desc(conversations.createdAt))
          .limit(1)
          .get();
        broadcastConversationId = newConv?.id || null;
      } else {
        broadcastConversationId = existingConversation.id;
      }

      if (broadcastConversationId) {
        try {
          const { WebSocketBroadcastService } = await import('@/services/websocket-broadcast-service');
          const broadcastService = new WebSocketBroadcastService(env);

          // 使用 broadcastConversationTransferred 以便前端 Reconciliation
          // 這會觸發前端的 'assigned' action，替換之前的 pending 對話
          await broadcastService.broadcastConversationTransferred({
            conversationId: broadcastConversationId,
            fromTeamId: null,
            toTeamId: assignedTeamId,
            toTeamName: teamInfo?.name,
            conversation: {
              id: broadcastConversationId,
              customerId: existingCustomer.id,
              customerName: displayName,
              platform: 'line',
              status: 'active',
              lastMessage: {
                content: '已加入',
                timestamp: nowMs()
              },
              unreadCount: 0,
              assignedTeamId: assignedTeamId,
              assignedTeam: teamInfo ? {
                id: teamInfo.id,
                name: teamInfo.name
              } : undefined,
              // Reconciliation 標記：讓前端知道這是 Webhook 確認的真實對話
              _liffMetadata: {
                isPending: false,
                lineUserId: userId, // 用於匹配和替換 pending 對話
                isWebhookConfirmation: true
              }
            } as any,
            transferredBy: {
              id: 'system',
              name: 'Auto-Assignment'
            },
            reason: 'QR Code Follow - Auto Assignment'
          });

          console.log('[LINE Follow] WebSocket broadcast sent for auto-assignment (with reconciliation):', {
            conversationId: broadcastConversationId,
            teamId: assignedTeamId,
            teamName: teamInfo?.name,
            lineUserId: userId.substring(0, 10) + '...'
          });
        } catch (broadcastError) {
          log.warn('LINE Follow: WebSocket broadcast failed (non-blocking)', {
            error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError),
            conversationId: broadcastConversationId,
            teamId: assignedTeamId
          });
          // 不要讓廣播失敗影響主流程
        }
      }
    }

    // Step 9: 記錄活動
    try {
      const activityService = new ActivityService(env.DB);
      await activityService.logActivity({
        userId: 'system',
        userName: 'Webhook Handler',
        userRole: 'system',
        action: 'customer_followed',
        resourceType: 'customer',
        resourceId: String(existingCustomer?.id || userId),
        details: {
          platform: 'line',
          platformUserId: userId,
          displayName,
          assignedTeamId,
          source: qrCodeToken ? 'qr_code' : 'direct',
          timestamp
        }
      });
      console.log('[LINE Follow] Activity logged');
    } catch (activityError) {
      log.warn('LINE Follow: Failed to log activity', {
        error: activityError instanceof Error ? activityError.message : String(activityError)
      });
    }

    console.log('[LINE Follow] Follow event processed successfully:', {
      userId: userId.substring(0, 10) + '...',
      customerId: existingCustomer?.id,
      teamId: assignedTeamId,
      source: qrCodeToken ? 'qr_code' : 'direct'
    });

    // Step 10: 觸發新客戶加入通知（使用已查詢的 teamInfo，避免重複查詢）
    try {
      const { triggerCustomerFollowedNotification } = await import('@/utils/notification-trigger');

      // 觸發通知給管理員或團隊成員
      await triggerCustomerFollowedNotification(env, {
        customerName: displayName,
        platform: 'LINE',
        source: qrCodeToken ? 'qr_code' : 'direct',
        teamId: assignedTeamId || undefined,
        teamName: teamInfo?.name,  //  優化：使用已查詢的 teamInfo
        conversationId: existingConversation?.id
      });

      console.log('[LINE Follow] Customer followed notification triggered');
    } catch (notificationError) {
      log.warn('LINE Follow: Failed to trigger customer followed notification', {
        error: notificationError instanceof Error ? notificationError.message : String(notificationError)
      });
      // 不要讓通知失敗影響主流程
    }

    // Step 11: Auto-Reply Welcome Message (replaces hardcoded welcome)
    if (event.replyToken && assignedTeamId && existingCustomer) {
      try {
        const { evaluateWelcome } = await import('@modules/auto-reply/services/auto-reply-engine');

        // Determine conversation ID for logging
        let welcomeConversationId = existingConversation?.id;
        if (!welcomeConversationId) {
          const newConv = await drizzleDb
            .select({ id: conversations.id })
            .from(conversations)
            .where(and(
              eq(conversations.customerId, existingCustomer.id),
              ne(conversations.status, 'closed')
            ))
            .limit(1)
            .get();
          welcomeConversationId = newConv?.id || '';
        }

        const welcomeResult = await evaluateWelcome(
          assignedTeamId,
          event.replyToken,
          welcomeConversationId,
          existingCustomer.id,
          userId,
          env
        );

        if (welcomeResult.matched) {
          console.log('[LINE Follow] Auto-reply welcome rule triggered', {
            ruleId: welcomeResult.ruleId,
            ruleName: welcomeResult.ruleName,
            replyMethod: welcomeResult.replyMethod,
          });
        } else {
          // Fallback: send default hardcoded welcome if no welcome rule configured
          const teamName = teamInfo?.name || '我們的團隊';
          const welcomeMessage = `歡迎加入 ${teamName}！\n\n我們很高興為您服務。如有任何問題，請隨時聯繫我們。`;

          const { sendLineReply, createTextMessage } = await import('@/utils/line');
          await sendLineReply(env.LINE_CHANNEL_ACCESS_TOKEN, event.replyToken, [createTextMessage(welcomeMessage)]);

          console.log('[LINE Follow] Default welcome message sent (no auto-reply rule)', {
            userId: userId.substring(0, 10) + '...',
            teamId: assignedTeamId,
          });
        }
      } catch (welcomeError) {
        log.warn('LINE Follow: Failed to send welcome message', {
          error: welcomeError instanceof Error ? welcomeError.message : String(welcomeError)
        });
        // 不要讓歡迎訊息失敗影響主流程
      }
    }

  } catch (error) {
    log.error('LINE Follow: Error processing follow event', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userIdPrefix: userId.slice(0, 8)
    });
    throw error;
  }
}

/**
 * 處理 LINE Unfollow 事件
 * 當用戶取消關注官方帳號時，更新好友狀態為 'blocked'
 */
export async function processLineUnfollowEvent(env: Bindings, event: LineEvent) {
  const userId = event.source.userId;

  console.log('[LINE Unfollow] Processing unfollow event:', {
    userId: userId?.substring(0, 10) + '...',
    timestamp: event.timestamp
  });

  if (!userId) {
    log.warn('LINE Unfollow: No userId in unfollow event');
    return;
  }

  try {
    const drizzleDb = createDbClient(env.DB);
    const timestamp = nowISO();

    // 查找現有客戶
    const existingCustomer = await drizzleDb
      .select()
      .from(customers)
      .where(and(
        eq(customers.platformUserId, userId),
        eq(customers.platform, 'line')
      ))
      .get();

    if (!existingCustomer) {
      console.log('[LINE Unfollow] Customer not found for unfollowed user:', userId.substring(0, 10) + '...');
      return;
    }

    // 更新客戶的最後更新時間
    await drizzleDb
      .update(customers)
      .set({
        updatedAt: timestamp
      })
      .where(eq(customers.id, existingCustomer.id));

    console.log('[LINE Unfollow] Customer unfollow recorded:', {
      customerId: existingCustomer.id,
      displayName: existingCustomer.displayName
    });

    // 記錄活動
    try {
      const activityService = new ActivityService(env.DB);
      await activityService.logActivity({
        userId: 'system',
        userName: 'Webhook Handler',
        userRole: 'system',
        action: 'customer_unfollowed',
        resourceType: 'customer',
        resourceId: String(existingCustomer.id),
        details: {
          platform: 'line',
          platformUserId: userId,
          displayName: existingCustomer.displayName,
          timestamp
        }
      });
      console.log('[LINE Unfollow] Activity logged');
    } catch (activityError) {
      log.warn('LINE Unfollow: Failed to log activity', {
        error: activityError instanceof Error ? activityError.message : String(activityError)
      });
    }

  } catch (error) {
    log.error('LINE Unfollow: Error processing unfollow event', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userIdPrefix: userId.slice(0, 8)
    });
    throw error;
  }
}
