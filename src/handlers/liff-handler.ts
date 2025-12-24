// LIFF Handler - LINE Front-end Framework API 支持
// 提供 LIFF 页面所需的配置和绑定接口

import { Context } from 'hono';
import { eq, and } from 'drizzle-orm';
import { createDbClient } from '../db/drizzle-factory';
import { qrCodes, teams, customers, conversations } from '../db/schema';
import type { Bindings } from '../types';
import {
  successResponse,
  errorResponse,
  handleApiError
} from '../utils/api-response';
import { createContextLogger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const log = createContextLogger('LIFF-Handler');

export const liffHandler = {
  /**
   * 获取 LIFF 配置
   * GET /api/liff/config
   *
   * 返回 LIFF ID，供前端初始化使用
   */
  async getConfig(c: Context<{ Bindings: Bindings }>) {
    try {
      const liffId = c.env.LINE_LIFF_ID;

      if (!liffId) {
        log.error('LIFF ID not configured in environment variables');
        return errorResponse(c, 'LIFF ID 未配置，請聯繫系統管理員', 500);
      }

      return successResponse(c, {
        liffId,
        lineBotId: c.env.LINE_BOT_ID || '@your_bot_id'
      });
    } catch (error) {
      return handleApiError(error, c);
    }
  },

  /**
   * 获取团队信息
   * GET /api/qrcode/team-info?token=xxx
   *
   * 根据 QR code token 返回团队基本信息
   */
  async getTeamInfo(c: Context<{ Bindings: Bindings }>) {
    try {
      const token = c.req.query('token');

      if (!token) {
        return errorResponse(c, '缺少團隊追蹤碼', 400);
      }

      const db = createDbClient(c.env.DB);

      // 从数据库查询 QR code
      const qrCode = await db
        .select()
        .from(qrCodes)
        .where(eq(qrCodes.token, token))
        .get();

      if (!qrCode) {
        log.warn('QR code not found', { token: token.substring(0, 10) });
        return errorResponse(c, '無效的團隊追蹤碼', 404);
      }

      // 检查是否已过期
      if (qrCode.expiresAt && new Date() > new Date(qrCode.expiresAt)) {
        log.warn('QR code expired', { token: token.substring(0, 10), expiresAt: qrCode.expiresAt });
        return errorResponse(c, '此 QR Code 已過期', 410);
      }

      // 检查是否已停用
      if (!qrCode.isActive) {
        log.warn('QR code inactive', { token: token.substring(0, 10) });
        return errorResponse(c, '此 QR Code 已停用', 410);
      }

      // 检查使用次数限制
      if (qrCode.maxUses && (qrCode.usageCount ?? 0) >= qrCode.maxUses) {
        log.warn('QR code max uses reached', {
          token: token.substring(0, 10),
          usageCount: qrCode.usageCount,
          maxUses: qrCode.maxUses
        });
        return errorResponse(c, '此 QR Code 已達使用上限', 410);
      }

      // 获取团队信息
      const team = await db
        .select()
        .from(teams)
        .where(eq(teams.id, qrCode.teamId))
        .get();

      if (!team) {
        log.error('Team not found', { teamId: qrCode.teamId });
        return errorResponse(c, '找不到對應的團隊', 404);
      }

      return successResponse(c, {
        teamId: team.id,
        teamName: team.name,
        description: team.description || '歡迎加入我們的團隊',
        avatarUrl: team.qrCode || null,
        campaignName: qrCode.campaignName || null
      });

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  /**
   * 绑定用户到团队
   * POST /api/qrcode/bind
   * Body: { token, userId, displayName, pictureUrl }
   *
   * 执行以下操作：
   * 1. 验证 QR code token
   * 2. 创建或更新客户记录
   * 3. 创建或更新对话记录，指派到团队
   * 4. 增加 QR code 使用次数
   * 5. 记录扫描事件
   */
  async bindUser(c: Context<{ Bindings: Bindings }>) {
    try {
      const body = await c.req.json();
      const { token, userId, displayName, pictureUrl } = body;

      // 参数验证
      if (!token || !userId) {
        return errorResponse(c, '缺少必要參數: token 或 userId', 400);
      }

      const db = createDbClient(c.env.DB);

      // Step 1: 验证 QR code
      const qrCode = await db
        .select()
        .from(qrCodes)
        .where(eq(qrCodes.token, token))
        .get();

      if (!qrCode || !qrCode.isActive) {
        log.warn('Invalid or inactive QR code', { token: token.substring(0, 10) });
        return errorResponse(c, '無效或已停用的 QR Code', 400);
      }

      // 检查过期
      if (qrCode.expiresAt && new Date() > new Date(qrCode.expiresAt)) {
        return errorResponse(c, '此 QR Code 已過期', 410);
      }

      // 检查使用次数
      if (qrCode.maxUses && (qrCode.usageCount ?? 0) >= qrCode.maxUses) {
        return errorResponse(c, '此 QR Code 已達使用上限', 410);
      }

      const timestamp = new Date().toISOString();

      // Step 2: 创建或更新客户记录
      let customer = await db
        .select()
        .from(customers)
        .where(and(
          eq(customers.platform, 'line'),
          eq(customers.platformUserId, userId)
        ))
        .get();

      if (!customer) {
        // 创建新客户
        log.info('Creating new customer', { userId: userId.substring(0, 10), teamId: qrCode.teamId });

        await db
          .insert(customers)
          .values({
            platform: 'line',
            platformUserId: userId,
            displayName: displayName || 'LINE User',
            avatarUrl: pictureUrl || null,
            sourceTeamId: qrCode.teamId,
            metadata: JSON.stringify({
              qrCodeToken: token,
              campaignName: qrCode.campaignName,
              joinedViaLIFF: true,
              joinedAt: timestamp
            }),
            createdAt: timestamp,
            updatedAt: timestamp
          });

        // 重新查询客户
        customer = await db
          .select()
          .from(customers)
          .where(and(
            eq(customers.platform, 'line'),
            eq(customers.platformUserId, userId)
          ))
          .get();

        if (!customer) {
          log.error('Failed to create customer', { userId: userId.substring(0, 10) });
          return errorResponse(c, '創建客戶記錄失敗', 500);
        }

        log.info('Customer created successfully', { customerId: customer.id });

      } else {
        // 更新现有客户的来源团队（如果尚未设置）
        if (!customer.sourceTeamId) {
          log.info('Updating existing customer source team', {
            customerId: customer.id,
            teamId: qrCode.teamId
          });

          await db
            .update(customers)
            .set({
              sourceTeamId: qrCode.teamId,
              displayName: displayName || customer.displayName,
              avatarUrl: pictureUrl || customer.avatarUrl,
              metadata: JSON.stringify({
                ...(customer.metadata ? JSON.parse(customer.metadata as string) : {}),
                qrCodeToken: token,
                campaignName: qrCode.campaignName,
                joinedViaLIFF: true,
                lastJoinedAt: timestamp
              }),
              updatedAt: timestamp
            })
            .where(eq(customers.id, customer.id));
        }

        log.info('Using existing customer', { customerId: customer.id });
      }

      // Step 3: 创建或更新对话记录
      let conversation = await db
        .select()
        .from(conversations)
        .where(and(
          eq(conversations.customerId, customer.id),
          eq(conversations.status, 'active')
        ))
        .get();

      if (!conversation) {
        // 创建新对话，直接指派到团队
        const conversationId = uuidv4();
        log.info('Creating new conversation', {
          conversationId,
          customerId: customer.id,
          teamId: qrCode.teamId
        });

        await db
          .insert(conversations)
          .values({
            id: conversationId,
            customerId: customer.id,
            assignedTeamId: qrCode.teamId,
            assignedUserId: null,
            status: 'active',
            priority: 'normal',
            internalNotes: JSON.stringify({
              autoAssigned: true,
              source: 'liff_qr_code',
              token: token,
              campaignName: qrCode.campaignName,
              assignedAt: timestamp
            }),
            lastMessageAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp
          });

        log.info('Conversation created with team assignment', {
          conversationId,
          teamId: qrCode.teamId
        });

      } else if (!conversation.assignedTeamId) {
        // 更新现有对话的团队指派
        log.info('Updating existing conversation team assignment', {
          conversationId: conversation.id,
          teamId: qrCode.teamId
        });

        await db
          .update(conversations)
          .set({
            assignedTeamId: qrCode.teamId,
            updatedAt: timestamp
          })
          .where(eq(conversations.id, conversation.id));

        log.info('Conversation team assignment updated', {
          conversationId: conversation.id
        });
      } else {
        log.info('Conversation already has team assignment', {
          conversationId: conversation.id,
          teamId: conversation.assignedTeamId
        });
      }

      // Step 4: 增加 QR code 使用次数
      await db
        .update(qrCodes)
        .set({
          usageCount: (qrCode.usageCount || 0) + 1,
          updatedAt: timestamp
        })
        .where(eq(qrCodes.id, qrCode.id));

      log.info('QR code usage count incremented', {
        qrCodeId: qrCode.id,
        newCount: (qrCode.usageCount || 0) + 1
      });

      // Step 5: 记录扫描事件到 KV (用于追踪和分析)
      if (c.env.KV_CACHE) {
        try {
          const scanRecord = {
            qrCodeId: qrCode.id,
            teamId: qrCode.teamId,
            userId,
            customerId: customer.id,
            displayName,
            scannedAt: timestamp,
            bindSuccess: true
          };

          await c.env.KV_CACHE.put(
            `qr:scan:${qrCode.id}:${userId}`,
            JSON.stringify(scanRecord),
            { expirationTtl: 30 * 24 * 60 * 60 } // 保留 30 天
          );

          log.debug('Scan record saved to KV', { userId: userId.substring(0, 10) });
        } catch (kvError) {
          log.warn('Failed to save scan record to KV', {
            error: kvError instanceof Error ? kvError.message : String(kvError)
          });
          // KV 失败不影响主流程
        }
      }

      // 获取团队名称用于响应
      const team = await db
        .select()
        .from(teams)
        .where(eq(teams.id, qrCode.teamId))
        .get();

      log.info('User successfully bound to team', {
        userId: userId.substring(0, 10),
        customerId: customer.id,
        teamId: qrCode.teamId,
        teamName: team?.name
      });

      return successResponse(c, {
        success: true,
        customerId: customer.id,
        teamId: qrCode.teamId,
        teamName: team?.name || '未知團隊',
        message: `成功加入「${team?.name || '未知團隊'}」`
      });

    } catch (error) {
      log.error('Bind user error', {
        error: error instanceof Error ? error.message : String(error)
      });
      return handleApiError(error, c);
    }
  }
};

// Hono Router 导出
import { Hono } from 'hono';

export const liffRouter = new Hono<{ Bindings: Bindings }>();

// Health check
liffRouter.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    module: 'liff',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// LIFF 配置
liffRouter.get('/config', (c) => liffHandler.getConfig(c));

// 团队信息查询
liffRouter.get('/team-info', (c) => liffHandler.getTeamInfo(c));

// 用户绑定
liffRouter.post('/bind', (c) => liffHandler.bindUser(c));

// ========================================
// NEW: LIFF Team QR Code System Endpoints
// ========================================

/**
 * POST /api/liff/assign-team
 * Record customer team assignment from LIFF page scan
 * Called BEFORE user becomes friend
 */
liffRouter.post('/assign-team', async (c) => {
  try {
    const body = await c.req.json();
    const { lineUserId, teamId, displayName, timestamp } = body;

    if (!lineUserId || !teamId) {
      return errorResponse(c, '缺少必要參數: lineUserId 或 teamId', 400);
    }

    const db = createDbClient(c.env.DB);

    // Check if team exists
    const team = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .get();

    if (!team) {
      return errorResponse(c, '團隊不存在', 404);
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
      return successResponse(c, {
        assignmentId: existingAssignment.id,
        teamName: team.name,
        message: '已經記錄過團隊分配'
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
        assignedAt: timestamp || new Date().toISOString(),
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

    return successResponse(c, {
      assignmentId,
      teamName: team.name,
      message: '團隊分配記錄成功'
    });

  } catch (error) {
    log.error('Assign team error', { error: error instanceof Error ? error.message : String(error) });
    return handleApiError(error, c);
  }
});

/**
 * GET /api/liff/teams/:teamId
 * Get team information for LIFF page display
 */
liffRouter.get('/teams/:teamId', async (c) => {
  try {
    const teamIdParam = c.req.param('teamId');
    const teamId = parseInt(teamIdParam);

    if (isNaN(teamId)) {
      return errorResponse(c, '無效的團隊 ID', 400);
    }

    const db = createDbClient(c.env.DB);

    const team = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .get();

    if (!team) {
      return errorResponse(c, '團隊不存在', 404);
    }

    return successResponse(c, {
      id: team.id,
      name: team.name,
      description: team.description,
    });

  } catch (error) {
    log.error('Get team error', { error: error instanceof Error ? error.message : String(error) });
    return handleApiError(error, c);
  }
});

/**
 * POST /api/liff/welcome
 * Send welcome message to user (already a friend)
 */
liffRouter.post('/welcome', async (c) => {
  try {
    const body = await c.req.json();
    const { lineUserId, teamId } = body;

    if (!lineUserId || !teamId) {
      return errorResponse(c, '缺少必要參數: lineUserId 或 teamId', 400);
    }

    const db = createDbClient(c.env.DB);

    // Get team info
    const team = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .get();

    if (!team) {
      return errorResponse(c, '團隊不存在', 404);
    }

    // Send welcome message via LINE API
    const channelAccessToken = c.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!channelAccessToken) {
      log.error('LINE_CHANNEL_ACCESS_TOKEN not configured');
      return errorResponse(c, 'LINE 整合未配置', 500);
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
      return errorResponse(c, '發送歡迎消息失敗', 500);
    }

    log.info('Welcome message sent', { lineUserId, teamId });

    return successResponse(c, {
      message: '歡迎消息已發送'
    });

  } catch (error) {
    log.error('Send welcome error', { error: error instanceof Error ? error.message : String(error) });
    return handleApiError(error, c);
  }
});

export default liffRouter;
