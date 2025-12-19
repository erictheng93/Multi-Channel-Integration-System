// LIFF Handler - 處理 LINE LIFF 相關的 API
// 用於實現精確的 QR Code 團隊綁定

import { Hono } from 'hono';
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
      return c.json({ success: false, message: '缺少 token 參數' }, 400);
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
      return c.json({ success: false, message: 'QR Code 不存在' }, 404);
    }

    if (!qrCode.isActive) {
      return c.json({ success: false, message: 'QR Code 已停用' }, 400);
    }

    // 檢查是否過期
    if (qrCode.expiresAt && new Date() > new Date(qrCode.expiresAt)) {
      return c.json({ success: false, message: 'QR Code 已過期' }, 400);
    }

    // 檢查使用次數
    if (qrCode.maxUses && (qrCode.usageCount ?? 0) >= qrCode.maxUses) {
      return c.json({ success: false, message: 'QR Code 已達使用上限' }, 400);
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
    return c.json({ success: false, message: '伺服器錯誤' }, 500);
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
      return c.json({ success: false, message: '缺少必要參數' }, 400);
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
      return c.json({ success: false, message: 'QR Code 無效或已停用' }, 400);
    }

    // 檢查過期和使用次數
    if (qrCode.expiresAt && new Date() > new Date(qrCode.expiresAt)) {
      return c.json({ success: false, message: 'QR Code 已過期' }, 400);
    }

    if (qrCode.maxUses && (qrCode.usageCount ?? 0) >= qrCode.maxUses) {
      return c.json({ success: false, message: 'QR Code 已達使用上限' }, 400);
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
    return c.json({ success: false, message: '伺服器錯誤' }, 500);
  }
});

export default liffHandler;
