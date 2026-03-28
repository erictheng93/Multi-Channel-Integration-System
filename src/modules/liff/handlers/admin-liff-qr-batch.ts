/**
 * 管理员批量生成 LIFF QR Code Handler
 *
 * 用途：为所有没有 LIFF QR Code 的团队批量生成
 * 权限：仅管理员可访问
 */

import { Hono } from 'hono';
import { globalErrorHandler } from '@/core/error-handler';
import { createDbClient } from '@/db/drizzle-factory';
import { teams, teamLiffQrCodes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateTeamQRCode } from '@/services/liff-qrcode-service';
import { jwtAuth, requireAdmin } from '@/middleware/auth';
import type { Bindings } from '@/types';
import { nowISO } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('LiffQRBatch');

const app = new Hono<{ Bindings: Bindings }>();

/**
 * 批量生成 LIFF QR Code
 * POST /api/admin/liff-qr/batch-generate
 *
 * 功能：
 * 1. 查找所有活跃团队
 * 2. 筛选出没有 LIFF QR Code 的团队
 * 3. 批量生成 LIFF QR Code
 * 4. 返回生成结果统计
 */
app.post('/batch-generate', jwtAuth, requireAdmin(), async (c) => {
  try {
    const db = createDbClient(c.env.DB);

    log.info('[Batch LIFF QR] 开始批量生成...');

    // Step 1: 查找所有活跃团队
    const allTeams = await db
      .select()
      .from(teams)
      .where(eq(teams.isActive, true))
      .all();

    log.info(`[Batch LIFF QR] 找到 ${allTeams.length} 个活跃团队`);

    // Step 2: 查找已有 LIFF QR Code 的团队
    const existingLiffQRs = await db
      .select()
      .from(teamLiffQrCodes)
      .all();

    const teamsWithLiffQR = new Set(existingLiffQRs.map(qr => qr.teamId));

    log.info(`[Batch LIFF QR] 其中 ${teamsWithLiffQR.size} 个已有 LIFF QR Code`);

    // Step 3: 筛选出没有 LIFF QR Code 的团队
    const teamsWithoutLiffQR = allTeams.filter(team => !teamsWithLiffQR.has(team.id));

    log.info(`[Batch LIFF QR] 需要生成 ${teamsWithoutLiffQR.length} 个 LIFF QR Code`);

    if (teamsWithoutLiffQR.length === 0) {
      return c.json({
        success: true,
        data: {
          total: 0,
          success: 0,
          failed: 0,
          message: '所有团队都已有 LIFF QR Code',
          errors: []
        },
        timestamp: nowISO()
      });
    }

    // Step 4: 批量生成 LIFF QR Code
    const results = {
      total: teamsWithoutLiffQR.length,
      success: 0,
      failed: 0,
      errors: [] as Array<{
        teamId: number;
        teamName: string;
        error: string;
      }>
    };

    for (const team of teamsWithoutLiffQR) {
      try {
        log.info(`[Batch LIFF QR] 正在为团队 ${team.name} (ID: ${team.id}) 生成...`);

        const result = await generateTeamQRCode(team.id, team.name, c.env);

        if (result.success) {
          results.success++;
          log.info(`[Batch LIFF QR] 团队 ${team.name} (ID: ${team.id}) 生成成功`);
        } else {
          results.failed++;
          results.errors.push({
            teamId: team.id,
            teamName: team.name,
            error: result.error || 'Unknown error'
          });
          log.error(`[Batch LIFF QR] 团队 ${team.name} (ID: ${team.id}) 生成失败: ${result.error}`);
        }
      } catch (error) {
        results.failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push({
          teamId: team.id,
          teamName: team.name,
          error: errorMsg
        });
        log.error(`[Batch LIFF QR] 团队 ${team.name} (ID: ${team.id}) 生成异常: ${errorMsg}`);
      }
    }

    log.info(`[Batch LIFF QR] 批量生成完成！成功: ${results.success}, 失败: ${results.failed}`);

    return c.json({
      success: true,
      data: results,
      timestamp: nowISO()
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * 查看批量生成状态
 * GET /api/admin/liff-qr/status
 *
 * 功能：
 * - 显示所有团队的 LIFF QR Code 状态
 * - 统计有/无 LIFF QR Code 的团队数量
 */
app.get('/status', jwtAuth, requireAdmin(), async (c) => {
  try {
    const db = createDbClient(c.env.DB);

    // 查找所有活跃团队
    const allTeams = await db
      .select()
      .from(teams)
      .where(eq(teams.isActive, true))
      .all();

    // 查找已有 LIFF QR Code 的团队
    const existingLiffQRs = await db
      .select()
      .from(teamLiffQrCodes)
      .all();

    const teamsWithLiffQR = new Set(existingLiffQRs.map(qr => qr.teamId));

    const status = {
      totalTeams: allTeams.length,
      teamsWithLiffQR: teamsWithLiffQR.size,
      teamsWithoutLiffQR: allTeams.length - teamsWithLiffQR.size,
      coverage: ((teamsWithLiffQR.size / allTeams.length) * 100).toFixed(2) + '%',
      teams: allTeams.map(team => ({
        id: team.id,
        name: team.name,
        hasLiffQR: teamsWithLiffQR.has(team.id)
      }))
    };

    return c.json({
      success: true,
      data: status,
      timestamp: nowISO()
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

export default app;
