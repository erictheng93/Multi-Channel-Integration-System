// Team CRUD Operations, Stats, Transfer, Search, and Health
// Handles: GET/POST /, GET/PUT/DELETE /:id, GET /:id/stats, GET /stats/all,
// POST /transfer, GET /search/:query, GET /health, GET /info

import { Hono, type Context } from 'hono';
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('TeamCrud')

import { TeamService } from '@modules/teams/services/team-service';
import { TeamQRService } from '@modules/teams/services/qr-service';
import { generateTeamQRCode } from '@/services/liff-qrcode-service';
import { HTTP_STATUS } from '@/constants/http-status';
import type {
  TeamListRequest,
  TeamCreateRequest,
  TeamUpdateRequest,
  TeamTransferRequest,
  TeamStatsRequest
} from '../types/team-types';
import type { DbUser } from '@/types';
import type { Bindings } from '@/types';
import { ERROR_MESSAGES } from '@/utils/error-messages';
import { globalErrorHandler } from '@/core/error-handler';
import {
  jwtAuth,
  requireTeamAccess,
  requireTeamRole,
  requireManagerOrAdmin,
  requireAdmin
} from '@/middleware/auth';
import { requireIntId, getValidatedParam } from '@/middleware/param-validator';
import { nowISO } from '@/utils/timestamp';
import { ActivityCapture, ACTIVITY_ACTIONS, RESOURCE_TYPES } from '@modules/activities';

const app = new Hono<{ Bindings: Bindings }>();

type TeamStateInput = {
  id: number;
  name?: string | null;
  description?: string | null;
  qrCode?: string | null;
  isActive?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
};

function teamState(team: TeamStateInput) {
  return {
    id: team.id,
    name: team.name,
    description: team.description ?? null,
    qr_code: team.qrCode ?? null,
    is_active: team.isActive ? 1 : 0,
    created_at: team.createdAt,
    updated_at: team.updatedAt,
    deleted_at: team.deletedAt ?? null
  };
}

type ActivityActor = Pick<DbUser, 'id' | 'displayName' | 'email' | 'role'> & {
  username?: string;
};

function activityMeta(c: Context, user: ActivityActor) {
  return {
    userId: String(user.id),
    userName: user.displayName || user.email || user.username || String(user.id),
    userRole: user.role,
    ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
    userAgent: c.req.header('User-Agent')
  };
}

// ==================== Priority 1: STATIC routes ====================

app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: nowISO(),
    module: 'teams',
    version: '1.0.0'
  });
});

app.get('/info', (c) => {
  return c.json({
    success: true,
    data: {
      module: 'teams',
      version: '1.1.0',
      endpoints: [
        'GET /health - Health check',
        'GET /info - Module information',
        'GET / - List teams',
        'GET /members - Get all team members (admin/team only)',
        'GET /:id - Get team details',
        'POST / - Create team',
        'PUT /:id - Update team',
        'DELETE /:id - Delete team',
        'GET /:id/members - Get specific team members',
        'POST /:id/members - Add team member',
        'GET /:id/stats - Get team statistics'
      ]
    },
    timestamp: nowISO()
  });
});

// ==================== Priority 2: SPECIFIC routes ====================

// Get all teams statistics
app.get('/stats/all', jwtAuth, requireAdmin(), async (c) => {
  try {
    const dateFromParam = c.req.query('dateFrom');
    const dateToParam = c.req.query('dateTo');
    const params: TeamStatsRequest = {
      ...(dateFromParam && { dateFrom: dateFromParam }),
      ...(dateToParam && { dateTo: dateToParam }),
      includeMembers: c.req.query('includeMembers') === 'true'
    };

    const teamService = new TeamService(c.env.DB);
    const stats = await teamService.getAllTeamsStats(params);

    return c.json({ success: true, data: stats });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// Transfer members between teams - admin only
app.post('/transfer', jwtAuth, requireAdmin(), async (c) => {
  try {
    const body = await c.req.json() as TeamTransferRequest;

    if (!body.fromTeamId || !body.toTeamId || !body.agentIds?.length) {
      return c.json({
        success: false,
        error: 'From team ID, to team ID, and agent IDs are required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const teamService = new TeamService(c.env.DB);
    const result = await teamService.transferMembers(body);

    return c.json({ success: true, data: result });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// ==================== Priority 3: SPECIFIC PARAMETERIZED ====================

// Search teams - requires authentication
app.get('/search/:query', jwtAuth, async (c) => {
  try {
    const query = c.req.param('query');

    if (!query?.trim()) {
      return c.json({
        success: false,
        error: 'Search query is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const teamService = new TeamService(c.env.DB);
    const teams = await teamService.searchTeams(query);

    return c.json({ success: true, data: teams });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// ==================== Priority 4: MULTI-SEGMENT (/:id/stats) ====================

// Get team statistics
app.get('/:id/stats', jwtAuth, requireTeamAccess('id'), requireIntId(), async (c) => {
  try {
    const teamId = getValidatedParam<number>(c, 'id');
    const dateFromParam = c.req.query('dateFrom');
    const dateToParam = c.req.query('dateTo');
    const params: TeamStatsRequest = {
      ...(dateFromParam && { dateFrom: dateFromParam }),
      ...(dateToParam && { dateTo: dateToParam }),
      includeMembers: c.req.query('includeMembers') === 'true'
    };

    const teamService = new TeamService(c.env.DB);
    const stats = await teamService.getTeamStats(teamId, params);

    return c.json({ success: true, data: stats });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// ==================== Priority 5: SINGLE PARAMETERIZED (:id only) ====================

// Get single team by ID
app.get('/:id', jwtAuth, requireTeamAccess('id'), requireIntId(), async (c) => {
  try {
    const teamId = getValidatedParam<number>(c, 'id');
    const teamService = new TeamService(c.env.DB);
    const team = await teamService.getTeam(teamId);

    if (!team) {
      return c.json({
        success: false,
        error: ERROR_MESSAGES.TEAM_NOT_FOUND
      }, HTTP_STATUS.NOT_FOUND);
    }

    return c.json({ success: true, data: team });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// Update team (requires 'supervisor' role in team)
app.put('/:id', jwtAuth, requireTeamRole('supervisor'), requireIntId(), async (c) => {
  try {
    const user = c.get('user');
    const teamId = getValidatedParam<number>(c, 'id');
    const body = await c.req.json() as TeamUpdateRequest;
    const teamService = new TeamService(c.env.DB);
    const existingTeam = await teamService.getTeam(teamId);
    if (!existingTeam) {
      return c.json({
        success: false,
        error: 'Team not found',
        timestamp: nowISO()
      }, HTTP_STATUS.NOT_FOUND);
    }
    const team = await teamService.updateTeam(teamId, body);

    const capture = new ActivityCapture(c.env.DB);
    await capture.logOnly(
      capture.buildReversibleLog({
        request: {
          ...activityMeta(c, user),
          action: ACTIVITY_ACTIONS.TEAM_UPDATE,
          resourceType: RESOURCE_TYPES.TEAM,
          resourceId: String(teamId),
          details: { teamName: team.name, updates: body }
        },
        restoreHandler: 'team.update',
        previousState: teamState(existingTeam),
        newState: teamState(team)
      })
    );

    return c.json({
      success: true,
      data: team,
      timestamp: nowISO()
    });
  } catch (error) {
    // Handle team not found
    if (error instanceof Error && error.message === 'Team not found after update') {
      return c.json({
        success: false,
        error: 'Team not found',
        timestamp: nowISO()
      }, HTTP_STATUS.NOT_FOUND);
    }

    return globalErrorHandler.handleError(c, error);
  }
});

// Delete team (hard delete - permanently removes from database)
app.delete('/:id', jwtAuth, requireAdmin(), requireIntId(), async (c) => {
  try {
    const teamId = getValidatedParam<number>(c, 'id');
    const teamService = new TeamService(c.env.DB);

    const teamInfo = await teamService.getTeam(teamId);
    if (!teamInfo) {
      return c.json({
        success: false,
        error: 'Team not found',
        timestamp: nowISO()
      }, HTTP_STATUS.NOT_FOUND);
    }

    const user = c.get('user');
    const timestamp = nowISO();
    const previousState = teamState(teamInfo);
    const newState = {
      ...previousState,
      deleted_at: timestamp,
      updated_at: timestamp
    };
    const capture = new ActivityCapture(c.env.DB);
    await c.env.DB.batch([
      capture.buildReversibleLog({
        request: {
          ...activityMeta(c, user),
          action: ACTIVITY_ACTIONS.TEAM_DELETE,
          resourceType: RESOURCE_TYPES.TEAM,
          resourceId: String(teamId),
          details: { teamName: teamInfo.name }
        },
        restoreHandler: 'team.delete',
        previousState,
        newState
      }),
      c.env.DB
        .prepare(
          `UPDATE teams
           SET deleted_at = ?,
               updated_at = ?
           WHERE id = ?`
        )
        .bind(timestamp, timestamp, teamId)
    ]);

    return c.json({
      success: true,
      message: 'Team deleted successfully',
      timestamp: nowISO()
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// ==================== Priority 6: WILDCARD (LAST!) ====================

// List teams
app.get('/', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const includeInactive = c.req.query('includeInactive') === 'true';

    if (user.role === 'agent' && user.primaryTeamId) {
      const teamService = new TeamService(c.env.DB);
      const team = await teamService.getTeam(user.primaryTeamId);
      return c.json({
        success: true,
        data: [team],
        timestamp: nowISO()
      });
    }

    const teamService = new TeamService(c.env.DB);
    const searchParam = c.req.query('search');
    const params: TeamListRequest = {
      page: parseInt(c.req.query('page') || '1'),
      limit: parseInt(c.req.query('limit') || '20'),
      includeInactive,
      ...(searchParam && { search: searchParam })
    };

    const result = await teamService.listTeams(params);

    log.info('Teams List Result:', {
      teamsCount: result.teams?.length || 0,
      teams: result.teams,
      pagination: result.pagination,
      user: { id: user.id, role: user.role, teamId: user.primaryTeamId }
    });

    return c.json({
      success: true,
      data: result.teams,
      pagination: result.pagination,
      timestamp: nowISO()
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// Create new team
app.post('/', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const body = await c.req.json() as TeamCreateRequest;

    if (!body.name?.trim()) {
      return c.json({
        success: false,
        error: 'Team name is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const teamService = new TeamService(c.env.DB);
    const team = await teamService.createTeam(body);

    const user = c.get('user');
    const capture = new ActivityCapture(c.env.DB);
    await capture.logOnly(
      capture.buildReversibleLog({
        request: {
          ...activityMeta(c, user),
          action: ACTIVITY_ACTIONS.TEAM_CREATE,
          resourceType: RESOURCE_TYPES.TEAM,
          resourceId: String(team.id),
          details: { teamName: team.name, ...(team.description && { description: team.description }) }
        },
        restoreHandler: 'team.create',
        previousState: {
          id: team.id,
          deleted_at: null
        },
        newState: teamState(team)
      })
    );

    const qrService = new TeamQRService(c.env.DB, c.env.CACHE, c.env.LINE_BOT_ID, c.env.FRONTEND_URL);

    // Run QR generation in parallel
    const [qrResult, liffQrResult] = await Promise.all([
      // Task 2: Pre-generate QR code
      qrService.generateTeamQRCode({
        teamId: team.id,
        campaignName: `${team.name} - \u9810\u8A2D QR \u78BC`,
        description: `\u5718\u968A ${team.name} \u81EA\u52D5\u751F\u6210QR \u78BC`
      }).catch(err => {
        log.error(`QR generation failed for team ${team.id}`, {}, err as Error);
        return null;
      }),
      // Task 3: Generate LIFF QR code
      generateTeamQRCode(team.id, team.name, c.env).catch(err => {
        log.error(`LIFF QR generation failed for team ${team.id}`, {}, err as Error);
        return { success: false, error: err.message };
      })
    ]);

    // Attach QR code to team response if generated successfully
    const teamWithQR = {
      ...team,
      ...(qrResult ? {
        qrCode: qrResult.qrCode,
        lineUrl: qrResult.lineUrl
      } : {}),
      ...(liffQrResult?.success && 'qrCodeId' in liffQrResult ? {
        liffQrCode: {
          id: liffQrResult.qrCodeId,
          liffUrl: liffQrResult.liffUrl,
          qrCodeUrl: liffQrResult.qrCodeUrl
        }
      } : {})
    };

    return c.json({
      success: true,
      data: teamWithQR,
      timestamp: nowISO()
    }, HTTP_STATUS.CREATED);
  } catch (error) {
    if (error instanceof Error && error.message === 'DUPLICATE_QR_CODE') {
      return c.json({
        success: false,
        error: 'QR code already exists',
        timestamp: nowISO()
      }, HTTP_STATUS.CONFLICT);
    }

    if (error instanceof SyntaxError) {
      return c.json({
        success: false,
        error: 'Invalid JSON',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    return globalErrorHandler.handleError(c, error);
  }
});

export default app;
