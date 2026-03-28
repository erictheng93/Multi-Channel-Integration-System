// Team QR Code Management
// Handles: POST /:id/qr-code, GET /:id/qr-codes, GET /:id/qr-code/latest,
// GET /:id/qr-code/fast, POST /:id/qr-code-test,
// PUT /:id/qr-codes/:qrCodeId/deactivate,
// GET/POST /:id/qr-code/liff, GET /:id/qr-code/liff/stats

import { Hono } from 'hono';
import { TeamQRService } from '@modules/teams/services/qr-service';
import { generateTeamQRCode } from '@/services/liff-qrcode-service';
import { HTTP_STATUS } from '@/constants/http-status';
import type { Bindings } from '@/types';
import { globalErrorHandler } from '@/core/error-handler';
import {
  jwtAuth,
  requireTeamAccess,
  requireTeamRole,
  requireManagerOrAdmin
} from '@/middleware/auth';
import { requireIntId, getValidatedParam } from '@/middleware/param-validator';
import { createDbClient } from '@/db/drizzle-factory';
import { teams, qrCodes, teamLiffQrCodes } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { nowISO } from '@/utils/timestamp';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('TeamQR');

const app = new Hono<{ Bindings: Bindings }>();

// ==================== 4-segment routes (most specific first) ====================

// Get LIFF QR Code statistics
app.get('/:id/qr-code/liff/stats', jwtAuth, requireTeamAccess('id'), requireIntId(), async (c) => {
  try {
    const teamId = getValidatedParam<number>(c, 'id');
    const db = createDbClient(c.env.DB);

    const liffQrCode = await db
      .select()
      .from(teamLiffQrCodes)
      .where(eq(teamLiffQrCodes.teamId, teamId))
      .get();

    if (!liffQrCode) {
      return c.json({
        success: false,
        error: 'No LIFF QR code found for this team'
      }, HTTP_STATUS.NOT_FOUND);
    }

    // Get customer team assignments count (from Migration 0031)
    const { customerTeamAssignments } = await import('@/db/schema');
    const assignments = await db
      .select()
      .from(customerTeamAssignments)
      .where(eq(customerTeamAssignments.teamId, teamId))
      .all();

    return c.json({
      success: true,
      data: {
        scanCount: liffQrCode.scanCount || 0,
        assignmentCount: assignments.length,
        createdAt: liffQrCode.createdAt,
        lastScannedAt: liffQrCode.updatedAt,
        isActive: liffQrCode.isActive
      }
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// Deactivate QR code (requires 'supervisor' role in team)
app.put('/:id/qr-codes/:qrCodeId/deactivate', jwtAuth, requireTeamRole('supervisor'), requireIntId(), async (c) => {
  try {
    const teamId = getValidatedParam<number>(c, 'id');
    const qrCodeId = c.req.param('qrCodeId');

    if (!qrCodeId?.trim()) {
      return c.json({
        success: false,
        error: 'Invalid QR code ID'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const qrService = new TeamQRService(c.env.DB, c.env.CACHE, c.env.LINE_BOT_ID, c.env.FRONTEND_URL);
    await qrService.deactivateQRCode(teamId, qrCodeId);

    return c.json({
      success: true,
      message: 'QR code deactivated successfully',
      timestamp: nowISO()
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// ==================== 3-segment routes ====================

// Get team LIFF QR Code
app.get('/:id/qr-code/liff', jwtAuth, requireTeamAccess('id'), requireIntId(), async (c) => {
  try {
    const teamId = getValidatedParam<number>(c, 'id');
    const db = createDbClient(c.env.DB);

    const liffQrCode = await db
      .select()
      .from(teamLiffQrCodes)
      .where(eq(teamLiffQrCodes.teamId, teamId))
      .get();

    if (!liffQrCode) {
      return c.json({
        success: false,
        error: 'No LIFF QR code found for this team'
      }, HTTP_STATUS.NOT_FOUND);
    }

    return c.json({
      success: true,
      data: {
        id: liffQrCode.id,
        liffUrl: liffQrCode.liffUrl,
        qrCodeUrl: liffQrCode.qrCodeUrl,
        scanCount: liffQrCode.scanCount || 0,
        isActive: liffQrCode.isActive,
        createdAt: liffQrCode.createdAt,
        updatedAt: liffQrCode.updatedAt
      }
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// Generate or regenerate team LIFF QR Code
app.post('/:id/qr-code/liff', jwtAuth, requireManagerOrAdmin(), requireIntId(), async (c) => {
  try {
    const teamId = getValidatedParam<number>(c, 'id');
    // Get team name
    const db = createDbClient(c.env.DB);
    const team = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .get();

    if (!team) {
      return c.json({
        success: false,
        error: 'Team not found'
      }, HTTP_STATUS.NOT_FOUND);
    }

    // Generate or regenerate LIFF QR Code
    const result = await generateTeamQRCode(teamId, team.name, c.env);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error || 'Failed to generate LIFF QR code'
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    return c.json({
      success: true,
      data: {
        id: result.qrCodeId,
        liffUrl: result.liffUrl,
        qrCodeUrl: result.qrCodeUrl,
        scanCount: 0,
        isActive: true
      }
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// Get latest QR code (fast read from teams.qrCode with fallback)
app.get('/:id/qr-code/latest', jwtAuth, requireTeamAccess('id'), requireIntId(), async (c) => {
  try {
    const teamId = getValidatedParam<number>(c, 'id');

    const drizzleDb = createDbClient(c.env.DB);

    // Step 1: Read from teams.qrCode directly (Optimal Path - 50x faster)
    const teamData = await drizzleDb
      .select({ qrCode: teams.qrCode })
      .from(teams)
      .where(eq(teams.id, teamId))
      .get();

    if (teamData?.qrCode) {
      log.info(`[QR Latest] Optimal path: from teams.qrCode (teamId=${teamId})`);
      const lineUrl = teamData.qrCode.includes('line.me')
        ? teamData.qrCode.replace('api.qrserver.com/v1/create-qr-code/?data=', '')
        : `https://line.me/R/ti/p/@${c.env.LINE_BOT_ID || 'unknown'}`;

      return c.json({
        success: true,
        data: {
          qrCode: teamData.qrCode,
          lineUrl: lineUrl,
          fromCache: false
        },
        timestamp: nowISO()
      });
    }

    // Step 2: Fallback - query from qr_codes table
    log.info(`[QR Latest] Fallback: teams.qrCode is empty, using qrService (teamId=${teamId})`);

    const qrService = new TeamQRService(c.env.DB, c.env.CACHE, c.env.LINE_BOT_ID, c.env.FRONTEND_URL);
    const result = await qrService.getLatestQRCodeFast(teamId);

    if (!result) {
      return c.json({
        success: false,
        error: 'No QR code found for this team'
      }, HTTP_STATUS.NOT_FOUND);
    }

    // Step 3: Async sync to teams.qrCode
    c.executionCtx.waitUntil(
      drizzleDb
        .update(teams)
        .set({
          qrCode: result.qrCodeImageUrl,
          updatedAt: nowISO()
        })
        .where(eq(teams.id, teamId))
        .then(() => {
          log.info(`[QR Latest] Synced to teams.qrCode: teamId=${teamId}`);
        })
        .catch(err => {
          log.error(`[QR Latest] Sync failed: teamId=${teamId}`, {}, err instanceof Error ? err : new Error(String(err)));
        })
    );

    return c.json({
      success: true,
      data: {
        qrCode: result.qrCodeImageUrl,
        lineUrl: result.lineUrl,
        fromCache: result.fromCache
      },
      timestamp: nowISO()
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// Fast QR query - reads directly from teams.qrCode (with async sync fallback)
app.get('/:id/qr-code/fast', jwtAuth, requireTeamAccess('id'), requireIntId(), async (c) => {
  try {
    const teamId = getValidatedParam<number>(c, 'id');
    const drizzleDb = createDbClient(c.env.DB);

    // Step 1: Read directly from teams table (fastest)
    const teamData = await drizzleDb
      .select({ qrCode: teams.qrCode })
      .from(teams)
      .where(eq(teams.id, teamId))
      .get();

    if (teamData?.qrCode) {
      log.info(`[Fast QR Query] Direct read from teams table teamId=${teamId}`);
      return c.json({
        success: true,
        data: {
          qrCode: teamData.qrCode,
          source: 'teams_table',
          performance: 'optimal'
        },
        timestamp: nowISO()
      });
    }

    // Step 2: Fallback - query from qr_codes table and sync to teams
    log.info(`[Fast QR Query] teams.qrCode is empty, querying qr_codes table teamId=${teamId}`);

    const latestQR = await drizzleDb
      .select()
      .from(qrCodes)
      .where(
        and(
          eq(qrCodes.teamId, teamId),
          eq(qrCodes.isActive, true)
        )
      )
      .orderBy(desc(qrCodes.createdAt))
      .limit(1)
      .get();

    if (latestQR) {
      // Async sync to teams table (non-blocking)
      c.executionCtx.waitUntil(
        drizzleDb
          .update(teams)
          .set({
            qrCode: latestQR.qrCodeImageUrl,
            updatedAt: nowISO()
          })
          .where(eq(teams.id, teamId))
          .then(() => {
            log.info(`[Fast QR Query] Synced to teams.qrCode: teamId=${teamId}`);
          })
          .catch(err => {
            log.error(`[Fast QR Query] Sync failed: teamId=${teamId}`, {}, err instanceof Error ? err : new Error(String(err)));
          })
      );

      return c.json({
        success: true,
        data: {
          qrCode: latestQR.qrCodeImageUrl,
          lineUrl: latestQR.lineUrl,
          source: 'qr_codes_table',
          performance: 'fallback'
        },
        timestamp: nowISO()
      });
    }

    // Step 3: No QR Code found
    return c.json({
      success: false,
      error: 'No QR code found for this team',
      timestamp: nowISO()
    }, HTTP_STATUS.NOT_FOUND);

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// ==================== 2-segment routes ====================

// Generate QR Code for team (requires 'supervisor' role in team)
app.post('/:id/qr-code', jwtAuth, requireTeamRole('supervisor'), requireIntId(), async (c) => {
  try {
    const teamId = getValidatedParam<number>(c, 'id');
    const { campaignName, description, expiresAt, maxUses } = await c.req.json().catch(() => ({}));

    const qrService = new TeamQRService(c.env.DB, c.env.CACHE, c.env.LINE_BOT_ID, c.env.FRONTEND_URL);
    const qrCodeParams: any = {
      teamId,
      campaignName,
      description,
      maxUses,
      metadata: {
        description,
        teamId
      }
    };

    if (expiresAt) {
      qrCodeParams.expiresAt = new Date(expiresAt);
    }

    const qrCode = await qrService.generateTeamQRCode(qrCodeParams);

    return c.json({
      success: true,
      data: qrCode,
      timestamp: nowISO()
    }, HTTP_STATUS.CREATED);
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// Get team QR codes
app.get('/:id/qr-codes', jwtAuth, requireTeamAccess('id'), requireIntId(), async (c) => {
  try {
    const teamId = getValidatedParam<number>(c, 'id');

    const qrService = new TeamQRService(c.env.DB, c.env.CACHE, c.env.LINE_BOT_ID, c.env.FRONTEND_URL);
    const qrCodes = await qrService.getTeamQRCodes(teamId);

    return c.json({
      success: true,
      data: qrCodes,
      timestamp: nowISO()
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// Test QR code generation
app.post('/:id/qr-code-test', async (c) => {
  try {
    const qrService = new TeamQRService(c.env.DB, c.env.CACHE, c.env.LINE_BOT_ID, c.env.FRONTEND_URL);
    const testQR = await qrService.generateTestQRCode();

    return c.json({
      success: true,
      data: testQR
    });
  } catch (error) {
    return c.json({
      success: false,
      error: 'Test failed'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

export default app;
