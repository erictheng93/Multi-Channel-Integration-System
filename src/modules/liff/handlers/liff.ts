// LIFF Handler - 處理 LINE LIFF 相關的 API
// 用於實現精確的 QR Code 團隊綁定
// 注意：已移除舊的 token-based 系統，統一使用新 LIFF QR Code 系統

import { Hono, type Context, type Next } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import { globalErrorHandler } from '@/core/error-handler';
import type { Bindings } from '@/types';
import { createDbClient } from '@/db/drizzle-factory';
import { eq, and, isNull } from 'drizzle-orm';
import { customers, conversations, teams } from '@/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { createContextLogger } from '@/utils/logger';
import { nowISO, nowMs } from '@/utils/timestamp'
import { findCustomerConversation, getReopenStatus } from '@/services/customer-conversation-lookup';
import { verifyLiffIdToken } from './line-id-token';

const log = createContextLogger('LIFF');

/** Body teamId as a positive integer; strings like "01" would otherwise match team 1 in SQLite. */
function parseTeamId(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  return typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : null;
}

const activeTeam = (teamId: number) => and(eq(teams.id, teamId), eq(teams.isActive, true), isNull(teams.deletedAt));

const WELCOME_WINDOW_MS = 300_000;
// ponytail: one RateLimiterDO shard for every welcome; shard by user if LIFF traffic ever needs it.
const WELCOME_LIMITER_SHARD = 'ratelimit:liff-welcome';

/**
 * Claims ('check') or releases ('reset') the one welcome push a LINE user may trigger per
 * 5 minutes, whatever the team. The DO serialises requests, so a burst of concurrent calls
 * claims once, which a KV get/put race cannot guarantee. Fails closed: every push spends
 * OA quota, so 'unavailable' (DO threw or returned anything but 200/429) must not push either,
 * but unlike 'denied' it is retryable. Without the binding (tests, local) only the KV marker dedupes.
 */
async function welcomeLimiter(
  env: Bindings,
  lineUserId: string,
  action: 'check' | 'reset'
): Promise<'allowed' | 'denied' | 'unavailable'> {
  const ns = env.RATE_LIMITER;
  if (!ns) {
    return 'allowed';
  }
  try {
    const res = await ns.get(ns.idFromName(WELCOME_LIMITER_SHARD)).fetch('https://rate-limiter.internal/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        clientId: `liff-welcome:${lineUserId}`,
        config: { maxRequests: 1, windowMs: WELCOME_WINDOW_MS },
      }),
    });
    if (res.ok) {return 'allowed';}
    if (res.status === HTTP_STATUS.TOO_MANY_REQUESTS) {return 'denied';}
    log.warn('Welcome limiter unavailable; skipping push', { status: res.status });
    return 'unavailable';
  } catch (error) {
    log.warn('Welcome limiter unavailable; skipping push', {
      error: error instanceof Error ? error.message : String(error)
    });
    return 'unavailable';
  }
}

// Per-IP cap on the anonymous endpoints that call LINE to verify an ID token. Same RateLimiterDO pattern as
// the welcome limiter (no alarms of its own). Fails open: the token check below still gates every request.
const LIFF_IP_LIMIT = { maxRequests: 30, windowMs: 60_000 };
const LIFF_IP_LIMITER_SHARD = 'ratelimit:liff-ip';

async function liffIpRateLimit(c: Context<{ Bindings: Bindings }>, next: Next) {
  const ns = c.env.RATE_LIMITER;
  const ip = c.req.header('CF-Connecting-IP');
  if (ns && ip) {
    try {
      const res = await ns.get(ns.idFromName(LIFF_IP_LIMITER_SHARD)).fetch('https://rate-limiter.internal/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', clientId: `liff-ip:${ip}`, config: LIFF_IP_LIMIT }),
      });
      if (res.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
        return c.json({ success: false, error: '請求過於頻繁，請稍後再試' }, HTTP_STATUS.TOO_MANY_REQUESTS);
      }
    } catch (error) {
      log.warn('LIFF IP limiter unavailable; allowing request', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return next();
}

const liffHandler = new Hono<{ Bindings: Bindings }>();
liffHandler.use('/assign-team', liffIpRateLimit);
liffHandler.use('/welcome', liffIpRateLimit);

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
      .where(activeTeam(teamId))
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
    const { displayName } = body;
    const teamId = parseTeamId(body.teamId);

    // Identity comes from the LINE-verified ID token, never from the body.
    const lineUserId = await verifyLiffIdToken(body.idToken, c.env.LINE_LIFF_ID);
    if (!lineUserId) {
      return c.json({ success: false, error: 'LINE 身分驗證失敗' }, HTTP_STATUS.UNAUTHORIZED);
    }
    if (!teamId) {
      return c.json({ success: false, error: '缺少必要參數: teamId' }, HTTP_STATUS.BAD_REQUEST);
    }

    const db = createDbClient(c.env.DB);

    // Check if team exists
    const team = await db
      .select()
      .from(teams)
      .where(activeTeam(teamId))
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
        assignedAt: nowISO(),
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
    const teamId = parseTeamId(body.teamId);

    const lineUserId = await verifyLiffIdToken(body.idToken, c.env.LINE_LIFF_ID);
    if (!lineUserId) {
      return c.json({ success: false, error: 'LINE 身分驗證失敗' }, HTTP_STATUS.UNAUTHORIZED);
    }
    if (!teamId) {
      return c.json({ success: false, error: '缺少必要參數: teamId' }, HTTP_STATUS.BAD_REQUEST);
    }

    const db = createDbClient(c.env.DB);

    // Get team info
    const team = await db
      .select()
      .from(teams)
      .where(activeTeam(teamId))
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
        // 查詢現有對話（含已結案，避免重複建立）
        const existingConversation = await findCustomerConversation(db, customer.id); // 一位客戶一個對話（含已結案）

        const timestamp = nowISO();

        if (existingConversation) {
          // 更新現有對話的團隊指派 (如果團隊不同)
          const oldTeamId = existingConversation.assignedTeamId;
          // 已結案的對話因客戶再次掃碼而重新開啟（團隊一定存在）
          const reopenedStatus = getReopenStatus(existingConversation.status, true);

          if (reopenedStatus) {
            await db
              .update(conversations)
              .set({
                assignedTeamId: teamId,
                status: reopenedStatus,
                closedAt: null,
                updatedAt: timestamp
              })
              .where(eq(conversations.id, existingConversation.id));
            existingConversation.status = reopenedStatus;
            try {
              const { WebSocketBroadcastService } = await import('@/services/websocket-broadcast-service');
              await new WebSocketBroadcastService(c.env).broadcastConversationEvent({
                type: 'conversation_status_changed',
                conversationId: existingConversation.id,
                data: { status: reopenedStatus, timestamp },
                priority: 'normal'
              });
            } catch (broadcastError) {
              log.warn('LIFF welcome: reopen broadcast failed, continuing', {
                error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError)
              });
            }
          }

          if (oldTeamId !== teamId) {
            if (!reopenedStatus) {
              await db
                .update(conversations)
                .set({
                  assignedTeamId: teamId,
                  updatedAt: timestamp
                })
                .where(eq(conversations.id, existingConversation.id));
            }

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

    // Dedupe pushes: at most one welcome per verified user per 5 minutes, across teams,
    // so cycling teamId cannot multiply quota-counted pushes.
    const dedupeKey = `liff:welcome:${lineUserId}`;
    const claim = await c.env.CACHE.get(dedupeKey) ? 'denied' : await welcomeLimiter(c.env, lineUserId, 'check');
    if (claim === 'denied') {
      return c.json({ success: true, data: { message: '歡迎消息已發送' } });
    }
    if (claim === 'unavailable') {
      return c.json({ success: false, error: '歡迎消息暫時無法發送，請稍後再試' }, HTTP_STATUS.SERVICE_UNAVAILABLE);
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
      await welcomeLimiter(c.env, lineUserId, 'reset'); // a failed push stays retryable
      return c.json({ success: false, error: '發送歡迎消息失敗' }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    // Marker is written only after a successful push so failed attempts stay retryable.
    // The push is irreversible: a KV failure here must not turn into a 500 that invites a duplicate retry.
    try {
      await c.env.CACHE.put(dedupeKey, '1', { expirationTtl: 300 });
    } catch (markerError) {
      log.warn('Welcome dedupe marker write failed (push already sent)', {
        error: markerError instanceof Error ? markerError.message : String(markerError)
      });
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
