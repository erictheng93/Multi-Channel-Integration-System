// Teams Module Handlers
// 團隊模組請求處理器

import { Hono } from 'hono';
import { TeamService } from '@modules/teams/services/team-service';
import { TeamQRService } from '@modules/teams/services/qr-service';
import { TeamActivityService } from '@modules/teams/services/activity-service';
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
  requireManagerOrAdmin,
  requireAdmin
} from '@/middleware/auth';

const app = new Hono<{ Bindings: Bindings }>();

// 🔥 CORS Middleware - Add CORS headers to ALL responses
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin') || '';
  const allowedOrigins = [
    'https://multi-channel.imfinethankyouandyou.com',
    'http://localhost:3000',
    'https://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8787',
  ];

  await next();

  // Add CORS headers to response
  if (allowedOrigins.includes(origin) && origin) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
  }
});

// 🔥 CORS Preflight Handler - Handle OPTIONS requests
app.options('*', (c) => {
  const response = new Response(null, { status: 204 });

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  response.headers.set('Access-Control-Max-Age', '86400');

  // Prevent Cloudflare edge caching of OPTIONS responses
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
});

// 健康檢查端點
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    module: 'teams',
    version: '1.0.0'
  });
});

// 模組資訊端點
app.get('/info', (c) => {
  return c.json({
    success: true,
    data: {
      module: 'teams',
      version: '1.0.0',
      endpoints: [
        'GET /health - Health check',
        'GET /info - Module information',
        'GET / - List teams',
        'GET /:id - Get team details',
        'POST / - Create team',
        'PUT /:id - Update team',
        'DELETE /:id - Delete team',
        'GET /:id/members - Get team members',
        'POST /:id/members - Add team member',
        'GET /:id/stats - Get team statistics'
      ]
    },
    timestamp: new Date().toISOString()
  });
});

// List teams with pagination and search
app.get('/', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const includeInactive = c.req.query('includeInactive') === 'true';

    // 非 admin/team 用戶只能看到自己的團隊
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
    return c.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('List teams error:', error);
    return c.json({
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_GET_TEAMS,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Get single team by ID
app.get('/:id', jwtAuth, requireTeamAccess('id'), async (c) => {
  try {
    const teamId = parseInt(c.req.param('id'));
    if (!teamId) {
      return c.json({
        success: false,
        error: 'Invalid team ID'
      }, 400);
    }

    const teamService = new TeamService(c.env.DB);
    const team = await teamService.getTeam(teamId);

    if (!team) {
      return c.json({
        success: false,
        error: ERROR_MESSAGES.TEAM_NOT_FOUND
      }, 404);
    }

    return c.json({ success: true, data: team });
  } catch (error) {
    console.error('Get team error:', error);
    return c.json({
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_GET_TEAM
    }, 500);
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
      }, 400);
    }

    const teamService = new TeamService(c.env.DB);
    const team = await teamService.createTeam(body);

    // Log activity
    const user = c.get('user');
    const activityService = new TeamActivityService(c.env.DB);
    await activityService.logTeamCreate({
      userId: user.id.toString(),
      userName: user.displayName || user.email,
      userRole: user.role,
      teamId: team.id,
      teamName: team.name,
      ...(team.description && { description: team.description })
    });

    return c.json({
      success: true,
      data: team,
      timestamp: new Date().toISOString()
    }, 201);
  } catch (error) {
    console.error('Create team error:', error);
    return c.json({
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_CREATE_TEAM,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Update team
app.put('/:id', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const user = c.get('user');
    const teamId = parseInt(c.req.param('id'));
    const body = await c.req.json() as TeamUpdateRequest;

    if (!teamId) {
      return c.json({
        success: false,
        error: 'Invalid team ID'
      }, 400);
    }

    // 檢查權限：team 角色只能更新自己的團隊
    if (user.role === 'team' && user.teamId !== teamId) {
      return c.json({
        success: false,
        error: 'Team leaders can only update their own team',
        timestamp: new Date().toISOString()
      }, 403);
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
    return c.json({
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_UPDATE_TEAM,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Delete team (soft delete)
app.delete('/:id', jwtAuth, requireAdmin(), async (c) => {
  try {
    const teamId = parseInt(c.req.param('id'));

    if (!teamId) {
      return c.json({
        success: false,
        error: 'Invalid team ID'
      }, 400);
    }

    const teamService = new TeamService(c.env.DB);

    // 先獲取團隊信息以便記錄
    const teamInfo = await teamService.getTeam(teamId);
    if (!teamInfo) {
      return c.json({
        success: false,
        error: 'Team not found',
        timestamp: new Date().toISOString()
      }, 404);
    }

    const success = await teamService.deleteTeam(teamId);

    if (!success) {
      return c.json({
        success: false,
        error: ERROR_MESSAGES.FAILED_TO_DELETE_TEAM,
        timestamp: new Date().toISOString()
      }, 500);
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
    }, 500);
  }
});

// Search teams
app.get('/search/:query', async (c) => {
  try {
    const query = c.req.param('query');

    if (!query?.trim()) {
      return c.json({
        success: false,
        error: 'Search query is required'
      }, 400);
    }

    const teamService = new TeamService(c.env.DB);
    const teams = await teamService.searchTeams(query);

    return c.json({ success: true, data: teams });
  } catch (error) {
    console.error('Search teams error:', error);
    return c.json({
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_GET_TEAMS
    }, 500);
  }
});

// Get team members
app.get('/:id/members', jwtAuth, requireTeamAccess('id'), async (c) => {
  try {
    const teamId = parseInt(c.req.param('id'));

    if (!teamId) {
      return c.json({
        success: false,
        error: 'Invalid team ID'
      }, 400);
    }

    const teamService = new TeamService(c.env.DB);
    const members = await teamService.getMembers(teamId);

    return c.json({ success: true, data: members });
  } catch (error) {
    console.error('Get team members error:', error);
    return c.json({
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_GET_TEAM_MEMBERS
    }, 500);
  }
});

// Add member to team
app.post('/:id/members', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const user = c.get('user');
    const teamId = parseInt(c.req.param('id'));
    const body = await c.req.json() as TeamMemberAddRequest;

    if (!teamId) {
      return c.json({
        success: false,
        error: 'Invalid team ID'
      }, 400);
    }

    if (!body.agentId?.trim()) {
      return c.json({
        success: false,
        error: 'Agent ID is required'
      }, 400);
    }

    // Team 角色只能新增成員到自己的團隊
    if (user.role === 'team' && user.teamId !== teamId) {
      return c.json({
        success: false,
        error: 'Team leaders can only add members to their own team',
        timestamp: new Date().toISOString()
      }, 403);
    }

    const teamService = new TeamService(c.env.DB);
    const member = await teamService.addMember(teamId, body);

    return c.json({
      success: true,
      data: member
    }, 201);
  } catch (error) {
    console.error('Add team member error:', error);
    return c.json({
      success: false,
      error: 'Failed to add team member'
    }, 500);
  }
});

// Update team member
app.put('/:id/members/:agentId', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const user = c.get('user');
    const teamId = parseInt(c.req.param('id'));
    const agentId = c.req.param('agentId');
    const body = await c.req.json() as TeamMemberUpdateRequest;

    if (!teamId || !agentId?.trim()) {
      return c.json({
        success: false,
        error: 'Invalid team ID or agent ID'
      }, 400);
    }

    // Team 角色只能更新自己團隊的成員
    if (user.role === 'team' && user.teamId !== teamId) {
      return c.json({
        success: false,
        error: 'Team leaders can only update members in their own team',
        timestamp: new Date().toISOString()
      }, 403);
    }

    const teamService = new TeamService(c.env.DB);
    const member = await teamService.updateMember(teamId, agentId, body);

    return c.json({ success: true, data: member });
  } catch (error) {
    console.error('Update team member error:', error);
    return c.json({
      success: false,
      error: 'Failed to update team member'
    }, 500);
  }
});

// Remove member from team
app.delete('/:id/members/:agentId', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const user = c.get('user');
    const teamId = parseInt(c.req.param('id'));
    const agentId = c.req.param('agentId');

    if (!teamId || !agentId?.trim()) {
      return c.json({
        success: false,
        error: 'Invalid team ID or agent ID'
      }, 400);
    }

    // Team 角色只能移除自己團隊的成員
    if (user.role === 'team' && user.teamId !== teamId) {
      return c.json({
        success: false,
        error: 'Team leaders can only remove members from their own team',
        timestamp: new Date().toISOString()
      }, 403);
    }

    const teamService = new TeamService(c.env.DB);
    const success = await teamService.removeMember(teamId, agentId);

    if (!success) {
      return c.json({
        success: false,
        error: 'Failed to remove team member'
      }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Remove team member error:', error);
    return c.json({
      success: false,
      error: 'Failed to remove team member'
    }, 500);
  }
});

// Generate QR Code for team
app.post('/:id/qr-code', jwtAuth, requireTeamAccess('id'), async (c) => {
  try {
    const teamId = parseInt(c.req.param('id'));
    const { campaignName, description, expiresAt, maxUses } = await c.req.json().catch(() => ({}));

    if (!teamId) {
      return c.json({
        success: false,
        error: 'Invalid team ID'
      }, 400);
    }

    const qrService = new TeamQRService(c.env.DB);
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
    }, 201);
  } catch (error) {
    console.error('Generate QR code error:', error);
    return c.json({
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_GENERATE_QR_CODE,
      timestamp: new Date().toISOString()
    }, 500);
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
      }, 400);
    }

    const qrService = new TeamQRService(c.env.DB);
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
    }, 500);
  }
});

// Test QR code generation
app.post('/:id/qr-code-test', async (c) => {
  try {
    const qrService = new TeamQRService(c.env.DB);
    const testQR = await qrService.generateTestQRCode();

    return c.json({
      success: true,
      data: testQR
    });
  } catch (error) {
    return c.json({
      success: false,
      error: 'Test failed'
    }, 500);
  }
});

// Get team statistics
app.get('/:id/stats', jwtAuth, requireTeamAccess('id'), async (c) => {
  try {
    const teamId = parseInt(c.req.param('id'));

    if (!teamId) {
      return c.json({
        success: false,
        error: 'Invalid team ID'
      }, 400);
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
    }, 500);
  }
});

// Get all teams statistics
app.get('/stats/all', async (c) => {
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
    }, 500);
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
      }, 400);
    }

    const teamService = new TeamService(c.env.DB);
    const result = await teamService.transferMembers(body);

    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('Transfer members error:', error);
    return c.json({
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_TRANSFER_CONVERSATION
    }, 500);
  }
});

export default app;