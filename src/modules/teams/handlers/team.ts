// Teams Module Handlers
// ?��?模�?請�??��???

import { Hono } from 'hono';
import { TeamService } from '@modules/teams/services/team-service';
import { TeamQRService } from '@modules/teams/services/qr-service';
import { TeamActivityService } from '@modules/teams/services/activity-service';
import { AgentTeamsService } from '@modules/teams/services/agent-teams-service';
import { generateTeamQRCode } from '@/services/liff-qrcode-service';
import { ActivityService, ACTIVITY_ACTIONS, RESOURCE_TYPES } from '@/services/activity-service';
import { triggerTeamMemberChangeEvent } from '@/utils/notification-trigger';
import { HTTP_STATUS } from '@/constants/http-status';
import type {
  TeamListRequest,
  TeamCreateRequest,
  TeamUpdateRequest,
  TeamMemberAddRequest,
  TeamMemberUpdateRequest,
  TeamTransferRequest,
  TeamStatsRequest
} from '../types/team-types';
import type { Bindings } from '@/types';
import { ERROR_MESSAGES } from '@shared/utils/error-messages';
import {
  jwtAuth,
  requireTeamAccess,
  requireTeamRole,
  requireTeamPermission,
  requireManagerOrAdmin,
  requireAdmin
} from '@/middleware/auth';
import { createDbClient } from '@/db/drizzle-factory';
import { teams, qrCodes, teamLiffQrCodes, agents } from '@/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';

const app = new Hono<{ Bindings: Bindings }>();

// ??CORS ?��?已移??src/index.ts 統�?管�?
// 不�??�要模組�??��? CORS middleware

// ?�康檢查端�?
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    module: 'teams',
    version: '1.0.0'
  });
});

// 模�?資�?端�?
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
        'GET /members - Get all team members (admin/team only) ??NEW',
        'GET /:id - Get team details',
        'POST / - Create team',
        'PUT /:id - Update team',
        'DELETE /:id - Delete team',
        'GET /:id/members - Get specific team members',
        'POST /:id/members - Add team member',
        'GET /:id/stats - Get team statistics'
      ]
    },
    timestamp: new Date().toISOString()
  });
});

// ==================== ROUTE REGISTRATION (Proper Priority Order) ====================
// Routes MUST be registered in this order to avoid conflicts:
// 1. STATIC routes (no params): /health, /info
// 2. SPECIFIC routes: /stats/all, /transfer, /search/:query
// 3. PARAMETERIZED multi-segment: /:id/members, /:id/stats, /:id/qr-codes
// 4. PARAMETERIZED single: /:id (GET/PUT/DELETE)
// 5. WILDCARD: / (GET/POST) - MUST BE LAST!

// ==================== Priority 1: STATIC routes (already correctly positioned above) ====================

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
    console.error('Get all teams stats error:', error);
    return c.json({
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_GET_TEAM_STATS
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// Transfer members between teams
app.post('/transfer', async (c) => {
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
    console.error('Transfer members error:', error);
    return c.json({
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_TRANSFER_CONVERSATION
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// ==================== Priority 3: SPECIFIC PARAMETERIZED ====================
// Search teams
app.get('/search/:query', async (c) => {
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
    console.error('Search teams error:', error);
    return c.json({
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_GET_TEAMS
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// ==================== Priority 4: MULTI-SEGMENT PARAMETERIZED ====================
// 3-segment routes (most specific first)
// ⚠️ IMPORTANT: Static segment routes MUST come BEFORE dynamic parameter routes!
// Order: bulk-remove, batch → :agentId

// 🆕 Bulk remove members from team (requires 'lead' role in team)
app.post('/:id/members/bulk-remove', jwtAuth, requireTeamRole('lead'), async (c) => {
  try {
    const teamId = parseInt(c.req.param('id'));
    const body = await c.req.json() as { agentIds: string[] };

    if (!teamId || isNaN(teamId)) {
      return c.json({
        success: false,
        error: 'Invalid team ID'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!body.agentIds || !Array.isArray(body.agentIds) || body.agentIds.length === 0) {
      return c.json({
        success: false,
        error: 'agentIds array is required and cannot be empty'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // Limit to 50 members per request
    if (body.agentIds.length > 50) {
      return c.json({
        success: false,
        error: 'Cannot remove more than 50 members at once'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const teamService = new TeamService(c.env.DB);
    const result = await teamService.bulkRemoveMembers(teamId, body.agentIds);

    return c.json({
      success: true,
      data: {
        removed: result.removed,
        failed: result.failed,
        removedCount: result.removed.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Bulk remove team members error:', error);
    return c.json({
      success: false,
      error: 'Failed to bulk remove team members'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// 🚀 Phase 2: Batch add members to team (requires 'lead' role in team)
// 優化：1 API 請求 + 2-3 DB 查詢 (vs 原本 N API 請求 + 6*N DB 查詢)
app.post('/:id/members/batch', jwtAuth, requireTeamRole('lead'), async (c) => {
  try {
    const user = c.get('user');
    const teamId = parseInt(c.req.param('id'));
    const body = await c.req.json() as {
      agentIds: string[];
      roleInTeam?: 'member' | 'lead' | 'supervisor';
    };

    // Validation
    if (!teamId || isNaN(teamId)) {
      return c.json({
        success: false,
        error: 'Invalid team ID'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!body.agentIds || !Array.isArray(body.agentIds) || body.agentIds.length === 0) {
      return c.json({
        success: false,
        error: 'agentIds array is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (body.agentIds.length > 50) {
      return c.json({
        success: false,
        error: 'Cannot add more than 50 members at once'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const roleInTeam = body.roleInTeam || 'member';
    if (!['member', 'lead', 'supervisor'].includes(roleInTeam)) {
      return c.json({
        success: false,
        error: 'Invalid roleInTeam'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const db = createDbClient(c.env.DB);
    const agentTeamsService = new AgentTeamsService(c.env.DB);

    // Get team name for response and activity logging
    const teamInfo = await db
      .select({ name: teams.name })
      .from(teams)
      .where(eq(teams.id, teamId))
      .get();

    if (!teamInfo) {
      return c.json({
        success: false,
        error: 'Team not found'
      }, HTTP_STATUS.NOT_FOUND);
    }

    // 🚀 Batch add members (2-3 DB queries vs 6*N before)
    const result = await agentTeamsService.addMembersToTeam(teamId, body.agentIds, roleInTeam);

    // Activity log (non-blocking)
    const activityService = new ActivityService(c.env.DB);
    activityService.logActivity({
      userId: String(user.id),
      userName: user.displayName || String(user.id),
      userRole: user.role,
      action: ACTIVITY_ACTIONS.MEMBER_ADD,
      resourceType: RESOURCE_TYPES.TEAM,
      resourceId: String(teamId),
      details: {
        agentIds: result.added,
        skipped: result.skipped,
        roleInTeam,
        batchOperation: true
      }
    }).catch(err => console.error('Activity log failed:', err));

    // WebSocket broadcasts for added members (non-blocking)
    if (result.added.length > 0) {
      // Get agent names for broadcasts
      const agentInfos = await db
        .select({ id: agents.id, displayName: agents.displayName })
        .from(agents)
        .where(inArray(agents.id, result.added));

      const agentNameMap = new Map(agentInfos.map(a => [a.id, a.displayName || a.id]));
      const memberCount = await agentTeamsService.getTeamMemberCount(teamId);

      // Trigger broadcasts for each added member (parallel, non-blocking)
      Promise.allSettled(result.added.map(agentId =>
        triggerTeamMemberChangeEvent(c.env, {
          type: 'added',
          teamId,
          teamName: teamInfo.name,
          agentId,
          agentName: agentNameMap.get(agentId),
          memberCount,
          changedBy: user.displayName || String(user.id)
        })
      )).catch(err => console.error('WebSocket broadcasts failed:', err));
    }

    return c.json({
      success: true,
      data: {
        added: result.added,
        skipped: result.skipped,
        errors: result.errors,
        addedCount: result.added.length
      },
      timestamp: new Date().toISOString()
    }, result.added.length > 0 ? HTTP_STATUS.CREATED : HTTP_STATUS.OK);
  } catch (error) {
    console.error('Batch add members error:', error);
    return c.json({
      success: false,
      error: 'Failed to batch add members'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// Update team member (🚀 Phase 2: requires 'lead' role in team)
app.put('/:id/members/:agentId', jwtAuth, requireTeamRole('lead'), async (c) => {
  try {
    const user = c.get('user');
    const teamId = parseInt(c.req.param('id'));
    const agentId = c.req.param('agentId');
    const body = await c.req.json() as TeamMemberUpdateRequest;

    if (!teamId || !agentId?.trim()) {
      return c.json({
        success: false,
        error: 'Invalid team ID or agent ID'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const teamService = new TeamService(c.env.DB);
    const member = await teamService.updateMember(teamId, agentId, body);

    return c.json({ success: true, data: member });
  } catch (error) {
    console.error('Update team member error:', error);
    return c.json({
      success: false,
      error: 'Failed to update team member'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// Remove member from team (🚀 Phase 2: requires 'lead' role in team)
app.delete('/:id/members/:agentId', jwtAuth, requireTeamRole('lead'), async (c) => {
  try {
    const user = c.get('user');
    const teamId = parseInt(c.req.param('id'));
    const agentId = c.req.param('agentId');

    if (!teamId || !agentId?.trim()) {
      return c.json({
        success: false,
        error: 'Invalid team ID or agent ID'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const teamService = new TeamService(c.env.DB);
    const success = await teamService.removeMember(teamId, agentId);

    if (!success) {
      return c.json({
        success: false,
        error: 'Failed to remove team member'
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Remove team member error:', error);
    return c.json({
      success: false,
      error: 'Failed to remove team member'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// Deactivate QR code
// Phase 1 ?��?：�??��???KV 快�?
// 🚀 Phase 2 RBAC: requires 'supervisor' role in team
app.put('/:id/qr-codes/:qrCodeId/deactivate', jwtAuth, requireTeamRole('supervisor'), async (c) => {
  try {
    const teamId = parseInt(c.req.param('id'));
    const qrCodeId = c.req.param('qrCodeId');

    if (!teamId || !qrCodeId?.trim()) {
      return c.json({
        success: false,
        error: 'Invalid team ID or QR code ID'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const qrService = new TeamQRService(c.env.DB, c.env.CACHE, c.env.LINE_BOT_ID, c.env.FRONTEND_URL);
    await qrService.deactivateQRCode(teamId, qrCodeId);

    return c.json({
      success: true,
      message: 'QR code deactivated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Deactivate QR code error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to deactivate QR code',
      timestamp: new Date().toISOString()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// 2-segment routes
// Get team members (specific team)
app.get('/:id/members', jwtAuth, requireTeamAccess('id'), async (c) => {
  try {
    const teamId = parseInt(c.req.param('id'));

    if (!teamId || isNaN(teamId)) {
      return c.json({
        success: false,
        error: 'Invalid team ID - must be a number'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const teamService = new TeamService(c.env.DB);
    const members = await teamService.getMembers(teamId);

    return c.json({ success: true, data: members });
  } catch (error) {
    console.error('Get team members error:', error);
    return c.json({
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_GET_TEAM_MEMBERS
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// Add member to team (🚀 Phase 2: requires 'lead' role in team)
app.post('/:id/members', jwtAuth, requireTeamRole('lead'), async (c) => {
  try {
    const user = c.get('user');
    const teamId = parseInt(c.req.param('id'));
    const body = await c.req.json() as TeamMemberAddRequest;

    if (!teamId) {
      return c.json({
        success: false,
        error: 'Invalid team ID'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!body.agentId?.trim()) {
      return c.json({
        success: false,
        error: 'Agent ID is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const teamService = new TeamService(c.env.DB);
    const member = await teamService.addMember(teamId, body);

    return c.json({
      success: true,
      data: member
    }, HTTP_STATUS.CREATED);
  } catch (error) {
    console.error('Add team member error:', error);
    return c.json({
      success: false,
      error: 'Failed to add team member'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// Generate QR Code for team
// Phase 1 ?��?：傳??KV ?��?空�??�於快�?
// Phase 2 修正：傳??LINE_BOT_ID ?��?變數
// 🚀 Phase 2 RBAC: requires 'supervisor' role in team
app.post('/:id/qr-code', jwtAuth, requireTeamRole('supervisor'), async (c) => {
  try {
    const teamId = parseInt(c.req.param('id'));
    const { campaignName, description, expiresAt, maxUses } = await c.req.json().catch(() => ({}));

    if (!teamId) {
      return c.json({
        success: false,
        error: 'Invalid team ID'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // ?��? CACHE KV ?��?空�??�LINE_BOT_ID ??FRONTEND_URL（用??LIFF ?��?�?
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
      timestamp: new Date().toISOString()
    }, HTTP_STATUS.CREATED);
  } catch (error) {
    console.error('Generate QR code error:', error);
    return c.json({
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_GENERATE_QR_CODE,
      timestamp: new Date().toISOString()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// Get team QR codes
app.get('/:id/qr-codes', jwtAuth, requireTeamAccess('id'), async (c) => {
  try {
    const teamId = parseInt(c.req.param('id'));

    if (!teamId) {
      return c.json({
        success: false,
        error: 'Invalid team ID'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const qrService = new TeamQRService(c.env.DB, c.env.CACHE, c.env.LINE_BOT_ID, c.env.FRONTEND_URL);
    const qrCodes = await qrService.getTeamQRCodes(teamId);

    return c.json({
      success: true,
      data: qrCodes,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get QR codes error:', error);
    return c.json({
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_GET_QR_CODES,
      timestamp: new Date().toISOString()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// ?? Phase 1: 快速獲?��???QR �?(?�於?��??��?)
// ?? Phase 3 ?��?: ?��?�?teams.qrCode 讀?��?實現?��??�步機制
app.get('/:id/qr-code/latest', jwtAuth, requireTeamAccess('id'), async (c) => {
  try {
    const teamId = parseInt(c.req.param('id'));

    if (!teamId) {
      return c.json({
        success: false,
        error: 'Invalid team ID'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const drizzleDb = createDbClient(c.env.DB);

    // ?? Step 1: ?��?�?teams.qrCode ?�接讀??(Optimal Path - 50x ?��?)
    const teamData = await drizzleDb
      .select({ qrCode: teams.qrCode })
      .from(teams)
      .where(eq(teams.id, teamId))
      .get();

    if (teamData?.qrCode) {
      console.log(`??[QR Latest] Optimal path: �?teams.qrCode 讀??(teamId=${teamId})`);
      // �?qrCode URL ?�斷 lineUrl (?��?: https://line.me/R/ti/p/@{botId}?token={token})
      const lineUrl = teamData.qrCode.includes('line.me')
        ? teamData.qrCode.replace('api.qrserver.com/v1/create-qr-code/?data=', '')
        : `https://line.me/R/ti/p/@${c.env.LINE_BOT_ID || 'unknown'}`;

      return c.json({
        success: true,
        data: {
          qrCode: teamData.qrCode,
          lineUrl: lineUrl,
          fromCache: false // �?DB 讀?��?不是 KV 快�?
        },
        timestamp: new Date().toISOString()
      });
    }

    // ?? Step 2: Fallback - �?qr_codes 表查�?(?�容?��?�?
    console.log(`?? [QR Latest] Fallback: teams.qrCode ?�空，使??qrService (teamId=${teamId})`);

    const qrService = new TeamQRService(c.env.DB, c.env.CACHE, c.env.LINE_BOT_ID, c.env.FRONTEND_URL);
    const result = await qrService.getLatestQRCodeFast(teamId);

    if (!result) {
      return c.json({
        success: false,
        error: 'No QR code found for this team'
      }, HTTP_STATUS.NOT_FOUND);
    }

    // ?? Step 3: ?�步?�步??teams.qrCode (?��??�步機制)
    c.executionCtx.waitUntil(
      drizzleDb
        .update(teams)
        .set({
          qrCode: result.qrCodeImageUrl,
          updatedAt: new Date().toISOString()
        })
        .where(eq(teams.id, teamId))
        .then(() => {
          console.log(`??[QR Latest] 已�?步到 teams.qrCode: teamId=${teamId}`);
        })
        .catch(err => {
          console.error(`??[QR Latest] ?�步失�?: teamId=${teamId}`, err);
        })
    );

    return c.json({
      success: true,
      data: {
        qrCode: result.qrCodeImageUrl,
        lineUrl: result.lineUrl,
        fromCache: result.fromCache
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get latest QR code error:', error);
    return c.json({
      success: false,
      error: 'Failed to get QR code',
      timestamp: new Date().toISOString()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// ?? Phase 3: 極速查詢端�?- ?��?�?teams.qrCode 讀??(?��??�步?��?)
app.get('/:id/qr-code/fast', jwtAuth, requireTeamAccess('id'), async (c) => {
  try {
    const teamId = parseInt(c.req.param('id'));

    if (!teamId) {
      return c.json({
        success: false,
        error: 'Invalid team ID'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const drizzleDb = createDbClient(c.env.DB);

    // Step 1: ?��?�?teams 表直?��???(?��?)
    const teamData = await drizzleDb
      .select({ qrCode: teams.qrCode })
      .from(teams)
      .where(eq(teams.id, teamId))
      .get();

    if (teamData?.qrCode) {
      console.log(`??[Fast QR Query] �?teams 表直?��??? teamId=${teamId}`);
      return c.json({
        success: true,
        data: {
          qrCode: teamData.qrCode,
          source: 'teams_table',  // 資�?來�?標�?
          performance: 'optimal'   // ?�能標�?
        },
        timestamp: new Date().toISOString()
      });
    }

    // Step 2: Fallback - �?qr_codes 表查詢並?�步??teams �?
    console.log(`?? [Fast QR Query] teams.qrCode ?�空，�? qr_codes 表查�? teamId=${teamId}`);

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
      // ?�步?�步??teams �?(不阻塞響??
      c.executionCtx.waitUntil(
        drizzleDb
          .update(teams)
          .set({
            qrCode: latestQR.qrCodeImageUrl,
            updatedAt: new Date().toISOString()
          })
          .where(eq(teams.id, teamId))
          .then(() => {
            console.log(`??[Fast QR Query] 已�?步到 teams.qrCode: teamId=${teamId}`);
          })
          .catch(err => {
            console.error(`??[Fast QR Query] ?�步失�?: teamId=${teamId}`, err);
          })
      );

      return c.json({
        success: true,
        data: {
          qrCode: latestQR.qrCodeImageUrl,
          lineUrl: latestQR.lineUrl,
          source: 'qr_codes_table',  // 資�?來�?標�?
          performance: 'fallback'     // ?�能標�?
        },
        timestamp: new Date().toISOString()
      });
    }

    // Step 3: 沒�??�到任�? QR Code
    return c.json({
      success: false,
      error: 'No QR code found for this team',
      timestamp: new Date().toISOString()
    }, HTTP_STATUS.NOT_FOUND);

  } catch (error) {
    console.error('Fast QR code query error:', error);
    return c.json({
      success: false,
      error: 'Failed to get QR code',
      timestamp: new Date().toISOString()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
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

// ==================== LIFF QR Code API Endpoints ====================

// Get team LIFF QR Code
app.get('/:id/qr-code/liff', jwtAuth, requireTeamAccess('id'), async (c) => {
  try {
    const teamId = parseInt(c.req.param('id'));

    if (!teamId || isNaN(teamId)) {
      return c.json({
        success: false,
        error: 'Invalid team ID'
      }, HTTP_STATUS.BAD_REQUEST);
    }

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
    console.error('Get LIFF QR code error:', error);
    return c.json({
      success: false,
      error: 'Failed to get LIFF QR code'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// Generate or regenerate team LIFF QR Code
app.post('/:id/qr-code/liff', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const teamId = parseInt(c.req.param('id'));

    if (!teamId || isNaN(teamId)) {
      return c.json({
        success: false,
        error: 'Invalid team ID'
      }, HTTP_STATUS.BAD_REQUEST);
    }

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
    console.error('Generate LIFF QR code error:', error);
    return c.json({
      success: false,
      error: 'Failed to generate LIFF QR code'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// Get LIFF QR Code statistics
app.get('/:id/qr-code/liff/stats', jwtAuth, requireTeamAccess('id'), async (c) => {
  try {
    const teamId = parseInt(c.req.param('id'));

    if (!teamId || isNaN(teamId)) {
      return c.json({
        success: false,
        error: 'Invalid team ID'
      }, HTTP_STATUS.BAD_REQUEST);
    }

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
    console.error('Get LIFF QR code stats error:', error);
    return c.json({
      success: false,
      error: 'Failed to get LIFF QR code statistics'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// ==================== End of LIFF QR Code API Endpoints ====================

// Get team statistics
app.get('/:id/stats', jwtAuth, requireTeamAccess('id'), async (c) => {
  try {
    const teamId = parseInt(c.req.param('id'));

    if (!teamId) {
      return c.json({
        success: false,
        error: 'Invalid team ID'
      }, HTTP_STATUS.BAD_REQUEST);
    }

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
    console.error('Get team stats error:', error);
    return c.json({
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_GET_TEAM_STATS
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// ==================== Priority 5: SINGLE PARAMETERIZED (:id only) ====================
// Get single team by ID
app.get('/:id', jwtAuth, requireTeamAccess('id'), async (c) => {
  try {
    const teamId = parseInt(c.req.param('id'));
    if (!teamId) {
      return c.json({
        success: false,
        error: 'Invalid team ID'
      }, HTTP_STATUS.BAD_REQUEST);
    }

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
    console.error('Get team error:', error);
    return c.json({
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_GET_TEAM
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// Update team (🚀 Phase 2 RBAC: requires 'supervisor' role in team)
app.put('/:id', jwtAuth, requireTeamRole('supervisor'), async (c) => {
  try {
    const user = c.get('user');
    const teamId = parseInt(c.req.param('id'));
    const body = await c.req.json() as TeamUpdateRequest;

    if (!teamId) {
      return c.json({
        success: false,
        error: 'Invalid team ID'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const teamService = new TeamService(c.env.DB);
    const team = await teamService.updateTeam(teamId, body);

    // Log activity
    const activityService = new TeamActivityService(c.env.DB);
    await activityService.logTeamUpdate({
      userId: user.id.toString(),
      userName: user.displayName || user.email,
      userRole: user.role,
      teamId: teamId,
      teamName: team.name,
      updates: body
    });

    return c.json({
      success: true,
      data: team,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Update team error:', error);

    // Handle team not found
    if (error instanceof Error && error.message === 'Team not found after update') {
      return c.json({
        success: false,
        error: 'Team not found',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.NOT_FOUND);
    }

    return c.json({
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_UPDATE_TEAM,
      timestamp: new Date().toISOString()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// Delete team (hard delete - permanently removes from database)
app.delete('/:id', jwtAuth, requireAdmin(), async (c) => {
  try {
    const teamId = parseInt(c.req.param('id'));

    if (!teamId) {
      return c.json({
        success: false,
        error: 'Invalid team ID'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const teamService = new TeamService(c.env.DB);

    // ?�獲?��??�信?�以便�???
    const teamInfo = await teamService.getTeam(teamId);
    if (!teamInfo) {
      return c.json({
        success: false,
        error: 'Team not found',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.NOT_FOUND);
    }

    const success = await teamService.deleteTeam(teamId);

    if (!success) {
      return c.json({
        success: false,
        error: ERROR_MESSAGES.FAILED_TO_DELETE_TEAM,
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    // Log activity
    const user = c.get('user');
    const activityService = new TeamActivityService(c.env.DB);
    await activityService.logTeamDelete({
      userId: user.id.toString(),
      userName: user.displayName || user.email,
      userRole: user.role,
      teamId: teamId,
      teamName: teamInfo.name
    });

    return c.json({
      success: true,
      message: 'Team deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Delete team error:', error);
    return c.json({
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_DELETE_TEAM,
      timestamp: new Date().toISOString()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// ==================== Priority 6: WILDCARD (LAST!) ====================
// List teams
app.get('/', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const includeInactive = c.req.query('includeInactive') === 'true';

    // ??admin/team ?�戶?�能?�到?�己?��???
    if (user.role === 'agent' && user.teamId) {
      const teamService = new TeamService(c.env.DB);
      const team = await teamService.getTeam(user.teamId);
      return c.json({
        success: true,
        data: [team],
        timestamp: new Date().toISOString()
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

    // 診斷?��?
    console.log('?? Teams List Result:', {
      teamsCount: result.teams?.length || 0,
      teams: result.teams,
      pagination: result.pagination,
      user: { id: user.id, role: user.role, teamId: user.teamId }
    });

    return c.json({
      success: true,
      data: result.teams,  // ??修復：使??data 字段?��???teams
      pagination: result.pagination,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('List teams error:', error);
    return c.json({
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_GET_TEAMS,
      timestamp: new Date().toISOString()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
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

    // Phase 3 ?��?：並行執行活?�日誌�? QR 碼�???
    // QR code generation runs in parallel with activity logging (~30-50ms overhead)
    const user = c.get('user');
    const activityService = new TeamActivityService(c.env.DB);
    // ?�� 修正：傳??LINE_BOT_ID ??FRONTEND_URL 以�??�正確�? LIFF URL
    const qrService = new TeamQRService(c.env.DB, c.env.CACHE, c.env.LINE_BOT_ID, c.env.FRONTEND_URL);

    // Run activity logging and QR generation in parallel
    const [, qrResult, liffQrResult] = await Promise.all([
      // Task 1: Log activity (existing)
      activityService.logTeamCreate({
        userId: user.id.toString(),
        userName: user.displayName || user.email,
        userRole: user.role,
        teamId: team.id,
        teamName: team.name,
        ...(team.description && { description: team.description })
      }),
      // Task 2: Pre-generate QR code (existing - Phase 3)
      qrService.generateTeamQRCode({
        teamId: team.id,
        campaignName: `${team.name} - ?�設 QR 碼`,
        description: `?��? ${team.name} ?��?�?QR 碼`
      }).catch(err => {
        // QR generation failure should not fail team creation
        console.error(`[Phase 3] QR generation failed for team ${team.id}:`, err);
        return null;
      }),
      // Task 3: Generate LIFF QR code (NEW - LIFF Team QR Code System)
      generateTeamQRCode(team.id, team.name, c.env).catch(err => {
        // LIFF QR generation failure should not fail team creation
        console.error(`[LIFF QR] Generation failed for team ${team.id}:`, err);
        return { success: false, error: err.message };
      })
    ]);

    // Attach QR code to team response if generated successfully
    const teamWithQR = {
      ...team,
      // Legacy QR code (existing system)
      ...(qrResult ? {
        qrCode: qrResult.qrCode,
        lineUrl: qrResult.lineUrl
      } : {}),
      // LIFF QR code (new system)
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
      timestamp: new Date().toISOString()
    }, HTTP_STATUS.CREATED);
  } catch (error) {
    console.error('Create team error:', error);

    // Handle specific errors
    if (error instanceof Error && error.message === 'DUPLICATE_QR_CODE') {
      return c.json({
        success: false,
        error: 'QR code already exists',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.CONFLICT);
    }

    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return c.json({
        success: false,
        error: 'Invalid JSON',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    return c.json({
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_CREATE_TEAM,
      timestamp: new Date().toISOString()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

export default app;
