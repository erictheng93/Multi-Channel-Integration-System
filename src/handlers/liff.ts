// LIFF Handler - 處理 LINE LIFF 相關的 API
// 用於實現精確的 QR Code 團隊綁定

import { Hono } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import type { Bindings } from '../types';
import { createDbClient } from '../db/drizzle-factory';
import { eq, and, sql } from 'drizzle-orm';
import { qrCodes, customers, conversations, teams } from '../db/schema';
import { v4 as uuidv4 } from 'uuid';
import { createContextLogger } from '../utils/logger';

const log = createContextLogger('LIFF');

const liffHandler = new Hono<{ Bindings: Bindings }>();

/**
 * POST /api/liff/verify-token
 * 驗證 QR Code token 並返回團隊資訊
 */
liffHandler.post('/verify-token', async (c) => {
  try {
    const { token } = await c.req.json<{ token: string }>();

    if (!token) {
      return c.json({ success: false, message: '缺少 token 參數' }, HTTP_STATUS.BAD_REQUEST);
    }

    const db = createDbClient(c.env.DB);

    // 查詢 QR Code
    const qrCode = await db
      .select({
        id: qrCodes.id,
        teamId: qrCodes.teamId,
        lineUrl: qrCodes.lineUrl,
        isActive: qrCodes.isActive,
        expiresAt: qrCodes.expiresAt,
        maxUses: qrCodes.maxUses,
        usageCount: qrCodes.usageCount
      })
      .from(qrCodes)
      .where(eq(qrCodes.token, token))
      .get();

    if (!qrCode) {
      return c.json({ success: false, message: 'QR Code 不存在' }, HTTP_STATUS.NOT_FOUND);
    }

    if (!qrCode.isActive) {
      return c.json({ success: false, message: 'QR Code 已停用' }, HTTP_STATUS.BAD_REQUEST);
    }

    // 檢查是否過期
    if (qrCode.expiresAt && new Date() > new Date(qrCode.expiresAt)) {
      return c.json({ success: false, message: 'QR Code 已過期' }, HTTP_STATUS.BAD_REQUEST);
    }

    // 檢查使用次數
    if (qrCode.maxUses && (qrCode.usageCount ?? 0) >= qrCode.maxUses) {
      return c.json({ success: false, message: 'QR Code 已達使用上限' }, HTTP_STATUS.BAD_REQUEST);
    }

    // 獲取團隊名稱
    const team = await db
      .select({ name: teams.name })
      .from(teams)
      .where(eq(teams.id, qrCode.teamId))
      .get();

    log.info('LIFF token verified', { token: token.substring(0, 10), teamId: qrCode.teamId });

    return c.json({
      success: true,
      teamId: qrCode.teamId,
      teamName: team?.name || '',
      lineUrl: qrCode.lineUrl
    });

  } catch (error) {
    log.error('LIFF verify-token error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ success: false, message: '伺服器錯誤' }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * POST /api/liff/bind-team
 * 將 LINE 用戶綁定到團隊
 */
liffHandler.post('/bind-team', async (c) => {
  try {
    const body = await c.req.json<{
      token: string;
      lineUserId: string;
      displayName: string;
      pictureUrl?: string;
      accessToken?: string;
    }>();

    const { token, lineUserId, displayName, pictureUrl } = body;

    if (!token || !lineUserId) {
      return c.json({ success: false, message: '缺少必要參數' }, HTTP_STATUS.BAD_REQUEST);
    }

    const db = createDbClient(c.env.DB);
    const timestamp = new Date().toISOString();

    // 1. 驗證並獲取 QR Code
    const qrCode = await db
      .select()
      .from(qrCodes)
      .where(eq(qrCodes.token, token))
      .get();

    if (!qrCode || !qrCode.isActive) {
      return c.json({ success: false, message: 'QR Code 無效或已停用' }, HTTP_STATUS.BAD_REQUEST);
    }

    // 檢查過期和使用次數
    if (qrCode.expiresAt && new Date() > new Date(qrCode.expiresAt)) {
      return c.json({ success: false, message: 'QR Code 已過期' }, HTTP_STATUS.BAD_REQUEST);
    }

    if (qrCode.maxUses && (qrCode.usageCount ?? 0) >= qrCode.maxUses) {
      return c.json({ success: false, message: 'QR Code 已達使用上限' }, HTTP_STATUS.BAD_REQUEST);
    }

    const teamId = qrCode.teamId;

    // 2. 查找或創建客戶記錄
    let customer = await db
      .select()
      .from(customers)
      .where(and(
        eq(customers.platformUserId, lineUserId),
        eq(customers.platform, 'line')
      ))
      .get();

    if (!customer) {
      // 創建新客戶
      await db.insert(customers).values({
        platform: 'line',
        platformUserId: lineUserId,
        displayName: displayName || 'LINE User',
        avatarUrl: pictureUrl || null,
        sourceTeamId: teamId,
        metadata: JSON.stringify({
          boundAt: timestamp,
          boundViaLiff: true,
          qrCodeToken: token,
          teamId: teamId
        }),
        createdAt: timestamp,
        updatedAt: timestamp
      });

      // 重新查詢
      customer = await db
        .select()
        .from(customers)
        .where(and(
          eq(customers.platformUserId, lineUserId),
          eq(customers.platform, 'line')
        ))
        .get();

      log.info('LIFF: New customer created', { lineUserId: lineUserId.substring(0, 10), teamId });
    } else {
      // 更新現有客戶
      const existingMetadata = customer.metadata ? JSON.parse(customer.metadata as string) : {};
      
      await db
        .update(customers)
        .set({
          displayName: displayName || customer.displayName,
          avatarUrl: pictureUrl || customer.avatarUrl,
          sourceTeamId: teamId,
          metadata: JSON.stringify({
            ...existingMetadata,
            lastBoundAt: timestamp,
            boundViaLiff: true,
            qrCodeToken: token,
            teamId: teamId
          }),
          updatedAt: timestamp
        })
        .where(eq(customers.id, customer.id));

      log.info('LIFF: Customer updated', { customerId: customer.id, teamId });
    }

    // 3. 創建或更新對話
    if (customer) {
      const existingConversation = await db
        .select()
        .from(conversations)
        .where(and(
          eq(conversations.customerId, customer.id),
          sql`${conversations.status} != 'closed'`
        ))
        .get();

      if (!existingConversation) {
        // 創建新對話
        const conversationId = uuidv4();
        await db.insert(conversations).values({
          id: conversationId,
          customerId: customer.id,
          assignedTeamId: teamId,
          assignedUserId: null,
          status: 'active',
          priority: 'normal',
          internalNotes: JSON.stringify({
            autoAssigned: true,
            source: 'liff_qr_code',
            qrCodeToken: token,
            boundAt: timestamp
          }),
          lastMessageAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp
        });

        log.info('LIFF: Conversation created', { conversationId, customerId: customer.id, teamId });
      } else if (!existingConversation.assignedTeamId) {
        // 更新現有對話的團隊
        await db
          .update(conversations)
          .set({
            assignedTeamId: teamId,
            updatedAt: timestamp
          })
          .where(eq(conversations.id, existingConversation.id));

        log.info('LIFF: Conversation team updated', { conversationId: existingConversation.id, teamId });
      }
    }

    // 4. 增加 QR Code 使用次數
    await db
      .update(qrCodes)
      .set({
        usageCount: sql`${qrCodes.usageCount} + 1`,
        updatedAt: timestamp
      })
      .where(eq(qrCodes.id, qrCode.id));

    // 5. 獲取團隊名稱
    const team = await db
      .select({ name: teams.name })
      .from(teams)
      .where(eq(teams.id, teamId))
      .get();

    log.info('LIFF: User bound to team successfully', {
      lineUserId: lineUserId.substring(0, 10),
      teamId,
      teamName: team?.name
    });

    return c.json({
      success: true,
      message: '綁定成功',
      teamId,
      teamName: team?.name || '',
      customerId: customer?.id
    });

  } catch (error) {
    log.error('LIFF bind-team error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ success: false, message: '伺服器錯誤' }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// ========================================
// NEW: LIFF Team QR Code System Endpoints
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
    timestamp: new Date().toISOString()
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

    return c.json({
      success: true,
      data: {
        liffId: liffId,
        lineBotId: lineBotId || '@110xsqef'
      }
    });

  } catch (error) {
    log.error('Get LIFF config error', {
      error: error instanceof Error ? error.message : String(error)
    });
    return c.json({
      success: false,
      error: '伺服器錯誤'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
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
    log.error('Get team error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ success: false, error: '伺服器錯誤' }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
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
    const { customerTeamAssignments } = await import('../db/schema');
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
        assignedAt: assignTimestamp || new Date().toISOString(),
        metadata: JSON.stringify({
          userAgent: c.req.header('user-agent'),
          timestamp: new Date().toISOString(),
        }),
      });

    // Update QR code scan count
    const { teamLiffQrCodes } = await import('../db/schema');
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

    return c.json({
      success: true,
      data: {
        assignmentId,
        teamName: team.name,
        message: '團隊分配記錄成功'
      }
    });

  } catch (error) {
    log.error('Assign team error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ success: false, error: '伺服器錯誤' }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
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

    // Send welcome message via LINE API
    const channelAccessToken = c.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!channelAccessToken) {
      log.error('LINE_CHANNEL_ACCESS_TOKEN not configured');
      return c.json({ success: false, error: 'LINE 整合未配置' }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    const welcomeMessage = `🎉 歡迎加入 ${team.name}！\n\n我們很高興為您服務。如有任何問題，請隨時聯繫我們。`;

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
    log.error('Send welcome error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ success: false, error: '伺服器錯誤' }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

export default liffHandler;
