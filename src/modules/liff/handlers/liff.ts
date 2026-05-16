// LIFF Handler - 處理 LINE LIFF 相關的 API
// 用於實現精確的 QR Code 團隊綁定
// 注意：已移除舊的 token-based 系統，統一使用新 LIFF QR Code 系統

import { Hono } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import { globalErrorHandler } from '@/core/error-handler';
import type { Bindings } from '@/types';
import { createDbClient } from '@/db/drizzle-factory';
import { eq, and, ne } from 'drizzle-orm';
import { customers, conversations, teams } from '@/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { createContextLogger } from '@/utils/logger';
import { nowISO, nowMs } from '@/utils/timestamp'

const log = createContextLogger('LIFF');

const liffHandler = new Hono<{ Bindings: Bindings }>();

// ========================================
// LIFF Team QR Code System Endpoints
// 統一使用新 LIFF QR Code 系統 (team_liff_qr_codes + customer_team_assignments)
// ========================================

/**
 * GET /api/liff/health
 * Health check endpoint
 */
liffHandler.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    module: 'liff',
    version: '2.0.0',
    timestamp: nowISO()
  });
});

/**
 * GET /api/liff/config
 * 獲取 LIFF 配置供前端初始化使用
 */
liffHandler.get('/config', async (c) => {
  try {
    const liffId = c.env.LINE_LIFF_ID;
    const lineBotId = c.env.LINE_BOT_ID;

    if (!liffId) {
      log.error('LINE_LIFF_ID not configured');
      return c.json({
        success: false,
        error: 'LIFF ID 未配置，請聯繫系統管理員'
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    log.info('LIFF config retrieved', { liffId: liffId.substring(0, 10) });

    const defaultLineBotId = '@110xsqef';
    const resolvedLineBotId = lineBotId || defaultLineBotId;

    return c.json({
      success: true,
      data: {
        liffId: liffId,
        lineBotId: resolvedLineBotId,
        // 新增欄位 - 供 LIFF 前端動態配置使用
        lineOaId: resolvedLineBotId.replace('@', ''),
        apiEndpoint: c.env.BACKEND_URL || '',
        autoCloseDelay: 2000,
        version: '2.0.0'
      }
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * GET /api/liff/teams/:teamId
 * Get team information for LIFF page display
 */
liffHandler.get('/teams/:teamId', async (c) => {
  try {
    const teamIdParam = c.req.param('teamId');
    const teamId = parseInt(teamIdParam);

    if (isNaN(teamId)) {
      return c.json({ success: false, error: '無效的團隊 ID' }, HTTP_STATUS.BAD_REQUEST);
    }

    const db = createDbClient(c.env.DB);

    const team = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .get();

    if (!team) {
      return c.json({ success: false, error: '團隊不存在' }, HTTP_STATUS.NOT_FOUND);
    }

    return c.json({
      success: true,
      data: {
        id: team.id,
        name: team.name,
        description: team.description,
      }
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * POST /api/liff/assign-team
 * Record customer team assignment from LIFF page scan
 */
liffHandler.post('/assign-team', async (c) => {
  try {
    const body = await c.req.json();
    const { lineUserId, teamId, displayName, timestamp: assignTimestamp } = body;

    if (!lineUserId || !teamId) {
      return c.json({ success: false, error: '缺少必要參數: lineUserId 或 teamId' }, HTTP_STATUS.BAD_REQUEST);
    }

    const db = createDbClient(c.env.DB);

    // Check if team exists
    const team = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .get();

    if (!team) {
      return c.json({ success: false, error: '團隊不存在' }, HTTP_STATUS.NOT_FOUND);
    }

    // Check for existing assignment
    const { customerTeamAssignments } = await import('@/db/schema');
    const existingAssignment = await db
      .select()
      .from(customerTeamAssignments)
      .where(and(
        eq(customerTeamAssignments.platformUserId, lineUserId),
        eq(customerTeamAssignments.teamId, teamId)
      ))
      .get();

    if (existingAssignment) {
      log.info('Assignment already exists', { lineUserId, teamId });
      return c.json({
        success: true,
        data: {
          assignmentId: existingAssignment.id,
          teamName: team.name,
          message: '已經記錄過團隊分配'
        }
      });
    }

    // Create new assignment
    const assignmentId = uuidv4();
    await db
      .insert(customerTeamAssignments)
      .values({
        id: assignmentId,
        platformUserId: lineUserId,
        teamId: teamId,
        source: 'liff_qr',
        displayName: displayName || null,
        assignedAt: assignTimestamp || nowISO(),
        metadata: JSON.stringify({
          userAgent: c.req.header('user-agent'),
          timestamp: nowISO(),
        }),
      });

    // Update QR code scan count
    const { teamLiffQrCodes } = await import('@/db/schema');
    const qrCode = await db
      .select()
      .from(teamLiffQrCodes)
      .where(eq(teamLiffQrCodes.teamId, teamId))
      .get();

    if (qrCode) {
      await db
        .update(teamLiffQrCodes)
        .set({ scanCount: (qrCode.scanCount || 0) + 1 })
        .where(eq(teamLiffQrCodes.id, qrCode.id));
    }

    log.info('Team assignment created', { assignmentId, lineUserId, teamId });

    // ===  LIFF 預通知 WebSocket 廣播 ===
    // 在用戶加好友之前，通過 WebSocket 通知前端創建 "pending" 對話
    // 這將用戶感知延遲從 2-8 秒縮短到 < 500ms
    try {
      const { WebSocketBroadcastService } = await import('@/services/websocket-broadcast-service');
      const broadcastService = new WebSocketBroadcastService(c.env);

      const pendingConversationId = `pending-${assignmentId}`;
      const scannedAt = nowMs();

      await broadcastService.broadcastConversationTransferred({
        conversationId: pendingConversationId,
        fromTeamId: null,
        toTeamId: teamId,
        toTeamName: team.name,
        conversation: {
          id: pendingConversationId,
          customerName: displayName || 'LINE 用戶',
          platform: 'line',
          status: 'pending',
          lastMessage: {
            content: '正在加入...',
            timestamp: scannedAt
          },
          unreadCount: 0,
          assignedTeamId: teamId,
          assignedTeam: {
            id: teamId,
            name: team.name
          },
          // LIFF Metadata 用於前端識別和 Reconciliation
          _liffMetadata: {
            isPending: true,
            lineUserId: lineUserId,
            assignmentId: assignmentId,
            scannedAt: scannedAt
          }
        },
        transferredBy: {
          id: 'system',
          name: 'QR Code Scan'
        },
        reason: 'LIFF QR Code Pre-Assignment'
      });

      log.info('LIFF pre-notification sent', {
        assignmentId,
        teamId,
        pendingConversationId,
        lineUserId: lineUserId.substring(0, 10) + '...'
      });
    } catch (broadcastError) {
      // 非阻塞 - 廣播失敗不影響主流程
      log.warn('LIFF pre-notification failed (non-blocking)', {
        error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError),
        assignmentId,
        teamId
      });
    }

    return c.json({
      success: true,
      data: {
        assignmentId,
        teamName: team.name,
        message: '團隊分配記錄成功'
      }
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * POST /api/liff/welcome
 * Send welcome message to user (already a friend)
 */
liffHandler.post('/welcome', async (c) => {
  try {
    const body = await c.req.json();
    const { lineUserId, teamId } = body;

    if (!lineUserId || !teamId) {
      return c.json({ success: false, error: '缺少必要參數: lineUserId 或 teamId' }, HTTP_STATUS.BAD_REQUEST);
    }

    const db = createDbClient(c.env.DB);

    // Get team info
    const team = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .get();

    if (!team) {
      return c.json({ success: false, error: '團隊不存在' }, HTTP_STATUS.NOT_FOUND);
    }

    // ===  同步對話團隊指派 (修復舊用戶掃 QR Code 無法指派問題) ===
    // 當用戶已是 LINE OA 好友時，掃描 QR Code 不會觸發 follow webhook
    // 因此需要在 welcome API 中同步處理對話指派
    try {
      // 查詢客戶
      const customer = await db
        .select()
        .from(customers)
        .where(and(
          eq(customers.platformUserId, lineUserId),
          eq(customers.platform, 'line')
        ))
        .get();

      if (customer) {
        // 查詢現有對話 (排除已關閉的)
        const existingConversation = await db
          .select()
          .from(conversations)
          .where(and(
            eq(conversations.customerId, customer.id),
            ne(conversations.status, 'closed')
          ))
          .get();

        const timestamp = nowISO();

        if (existingConversation) {
          // 更新現有對話的團隊指派 (如果團隊不同)
          const oldTeamId = existingConversation.assignedTeamId;

          if (oldTeamId !== teamId) {
            await db
              .update(conversations)
              .set({
                assignedTeamId: teamId,
                updatedAt: timestamp
              })
              .where(eq(conversations.id, existingConversation.id));

            // WebSocket 廣播 - 通知前端對話已轉移
            const { WebSocketBroadcastService } = await import('@/services/websocket-broadcast-service');
            const broadcastService = new WebSocketBroadcastService(c.env);

            await broadcastService.broadcastConversationTransferred({
              conversationId: existingConversation.id,
              fromTeamId: oldTeamId,
              toTeamId: teamId,
              toTeamName: team.name,
              conversation: {
                id: existingConversation.id,
                customerId: customer.id,
                customerName: customer.displayName ?? undefined,
                platform: 'line',
                status: existingConversation.status,
                assignedTeamId: teamId,
              },
              transferredBy: { id: 'system', name: 'QR Code Scan' },
              reason: 'LIFF QR Code - Existing Friend Reassignment'
            });

            log.info('Conversation reassigned via welcome API', {
              conversationId: existingConversation.id,
              fromTeamId: oldTeamId,
              toTeamId: teamId,
              customerId: customer.id
            });
          } else {
            log.info('Conversation already assigned to correct team', {
              conversationId: existingConversation.id,
              teamId
            });
          }
        } else {
          // 建立新對話 (舊用戶但無現有對話的情況)
          const conversationId = uuidv4();
          await db
            .insert(conversations)
            .values({
              id: conversationId,
              customerId: customer.id,
              assignedTeamId: teamId,
              status: 'active',
              priority: 'normal',
              lastMessageAt: timestamp,
              createdAt: timestamp,
              updatedAt: timestamp
            });

          // WebSocket 廣播新對話
          const { WebSocketBroadcastService } = await import('@/services/websocket-broadcast-service');
          const broadcastService = new WebSocketBroadcastService(c.env);

          await broadcastService.broadcastConversationTransferred({
            conversationId,
            fromTeamId: null,
            toTeamId: teamId,
            toTeamName: team.name,
            conversation: {
              id: conversationId,
              customerId: customer.id,
              customerName: customer.displayName ?? undefined,
              platform: 'line',
              status: 'active',
              assignedTeamId: teamId,
            },
            transferredBy: { id: 'system', name: 'QR Code Scan' },
            reason: 'LIFF QR Code - New Conversation for Existing Friend'
          });

          log.info('New conversation created via welcome API', {
            conversationId,
            customerId: customer.id,
            teamId
          });
        }
      } else {
        // 客戶不存在 - 這通常不應該發生，因為用戶已是好友
        log.warn('Customer not found for welcome message', {
          lineUserId: lineUserId.substring(0, 10) + '...',
          teamId
        });
      }
    } catch (syncError) {
      // 非阻塞 - 同步失敗不影響發送歡迎訊息
      log.warn('Conversation sync failed (non-blocking)', {
        error: syncError instanceof Error ? syncError.message : String(syncError),
        lineUserId: lineUserId.substring(0, 10) + '...',
        teamId
      });
    }

    // Send welcome message via LINE API
    const channelAccessToken = c.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!channelAccessToken) {
      log.error('LINE_CHANNEL_ACCESS_TOKEN not configured');
      return c.json({ success: false, error: 'LINE 整合未配置' }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    const welcomeMessage = ` 歡迎加入 ${team.name}！\n\n我們很高興為您服務。如有任何問題，請隨時聯繫我們。`;

    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${channelAccessToken}`
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{
          type: 'text',
          text: welcomeMessage
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('LINE API error', { error: errorText });
      return c.json({ success: false, error: '發送歡迎消息失敗' }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    log.info('Welcome message sent', { lineUserId, teamId });

    return c.json({
      success: true,
      data: {
        message: '歡迎消息已發送'
      }
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

export default liffHandler;
