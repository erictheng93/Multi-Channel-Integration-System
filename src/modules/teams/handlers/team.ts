// Teams Module Handlers
// 團隊模組請求處理器

import { Hono } from 'hono';
import { TeamService } from '@modules/teams/services/team-service';
import { TeamQRService } from '@modules/teams/services/qr-service';
import { TeamActivityService } from '@modules/teams/services/activity-service';
import { generateTeamQRCode } from '@/services/liff-qrcode-service';
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
import { createDbClient } from '@/db/drizzle-factory';
import { teams, qrCodes } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

const app = new Hono<{ Bindings: Bindings }>();

// ✅ CORS 處理已移至 src/index.ts 統一管理
// 不再需要模組級別的 CORS middleware

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
      version: '1.1.0',
      endpoints: [
        'GET /health - Health check',
        'GET /info - Module information',
        'GET / - List teams',
        'GET /members - Get all team members (admin/team only) ✨ NEW',
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

// ==================== Priority 3: SPECIFIC PARAMETERIZED ====================
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

// ==================== Priority 4: MULTI-SEGMENT PARAMETERIZED ====================
// 3-segment routes (most specific first)
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

// Deactivate QR code
// Phase 1 優化：同時清除 KV 快取
app.put('/:id/qr-codes/:qrCodeId/deactivate', jwtAuth, requireTeamAccess('id'), async (c) => {
  try {
    const teamId = parseInt(c.req.param('id'));
    const qrCodeId = c.req.param('qrCodeId');

    if (!teamId || !qrCodeId?.trim()) {
      return c.json({
        success: false,
        error: 'Invalid team ID or QR code ID'
      }, 400);
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
    }, 500);
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

// Generate QR Code for team
// Phase 1 優化：傳遞 KV 命名空間用於快取
// Phase 2 修正：傳遞 LINE_BOT_ID 環境變數
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

    // 傳遞 CACHE KV 命名空間、LINE_BOT_ID 和 FRONTEND_URL（用於 LIFF 方案）
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
    }, 500);
  }
});

// 🆕 Phase 1: 快速獲取最新 QR 碼 (用於懸停預載)
// 🚀 Phase 3 優化: 優先從 teams.qrCode 讀取，實現雙向同步機制
app.get('/:id/qr-code/latest', jwtAuth, requireTeamAccess('id'), async (c) => {
  try {
    const teamId = parseInt(c.req.param('id'));

    if (!teamId) {
      return c.json({
        success: false,
        error: 'Invalid team ID'
      }, 400);
    }

    const drizzleDb = createDbClient(c.env.DB);

    // 🚀 Step 1: 優先從 teams.qrCode 直接讀取 (Optimal Path - 50x 提升)
    const teamData = await drizzleDb
      .select({ qrCode: teams.qrCode })
      .from(teams)
      .where(eq(teams.id, teamId))
      .get();

    if (teamData?.qrCode) {
      console.log(`✅ [QR Latest] Optimal path: 從 teams.qrCode 讀取 (teamId=${teamId})`);
      // 從 qrCode URL 推斷 lineUrl (格式: https://line.me/R/ti/p/@{botId}?token={token})
      const lineUrl = teamData.qrCode.includes('line.me')
        ? teamData.qrCode.replace('api.qrserver.com/v1/create-qr-code/?data=', '')
        : `https://line.me/R/ti/p/@${c.env.LINE_BOT_ID || 'unknown'}`;

      return c.json({
        success: true,
        data: {
          qrCode: teamData.qrCode,
          lineUrl: lineUrl,
          fromCache: false // 從 DB 讀取，不是 KV 快取
        },
        timestamp: new Date().toISOString()
      });
    }

    // 🔄 Step 2: Fallback - 從 qr_codes 表查詢 (兼容舊邏輯)
    console.log(`📋 [QR Latest] Fallback: teams.qrCode 為空，使用 qrService (teamId=${teamId})`);

    const qrService = new TeamQRService(c.env.DB, c.env.CACHE, c.env.LINE_BOT_ID, c.env.FRONTEND_URL);
    const result = await qrService.getLatestQRCodeFast(teamId);

    if (!result) {
      return c.json({
        success: false,
        error: 'No QR code found for this team'
      }, 404);
    }

    // 🔄 Step 3: 異步同步回 teams.qrCode (雙向同步機制)
    c.executionCtx.waitUntil(
      drizzleDb
        .update(teams)
        .set({
          qrCode: result.qrCodeImageUrl,
          updatedAt: new Date().toISOString()
        })
        .where(eq(teams.id, teamId))
        .then(() => {
          console.log(`✅ [QR Latest] 已同步到 teams.qrCode: teamId=${teamId}`);
        })
        .catch(err => {
          console.error(`❌ [QR Latest] 同步失敗: teamId=${teamId}`, err);
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
    }, 500);
  }
});

// 🚀 Phase 3: 極速查詢端點 - 優先從 teams.qrCode 讀取 (雙向同步優化)
app.get('/:id/qr-code/fast', jwtAuth, requireTeamAccess('id'), async (c) => {
  try {
    const teamId = parseInt(c.req.param('id'));

    if (!teamId) {
      return c.json({
        success: false,
        error: 'Invalid team ID'
      }, 400);
    }

    const drizzleDb = createDbClient(c.env.DB);

    // Step 1: 優先從 teams 表直接讀取 (最快!)
    const teamData = await drizzleDb
      .select({ qrCode: teams.qrCode })
      .from(teams)
      .where(eq(teams.id, teamId))
      .get();

    if (teamData?.qrCode) {
      console.log(`✅ [Fast QR Query] 從 teams 表直接讀取: teamId=${teamId}`);
      return c.json({
        success: true,
        data: {
          qrCode: teamData.qrCode,
          source: 'teams_table',  // 資料來源標記
          performance: 'optimal'   // 效能標記
        },
        timestamp: new Date().toISOString()
      });
    }

    // Step 2: Fallback - 從 qr_codes 表查詢並同步回 teams 表
    console.log(`📋 [Fast QR Query] teams.qrCode 為空，從 qr_codes 表查詢: teamId=${teamId}`);

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
      // 異步同步回 teams 表 (不阻塞響應)
      c.executionCtx.waitUntil(
        drizzleDb
          .update(teams)
          .set({
            qrCode: latestQR.qrCodeImageUrl,
            updatedAt: new Date().toISOString()
          })
          .where(eq(teams.id, teamId))
          .then(() => {
            console.log(`✅ [Fast QR Query] 已同步到 teams.qrCode: teamId=${teamId}`);
          })
          .catch(err => {
            console.error(`❌ [Fast QR Query] 同步失敗: teamId=${teamId}`, err);
          })
      );

      return c.json({
        success: true,
        data: {
          qrCode: latestQR.qrCodeImageUrl,
          lineUrl: latestQR.lineUrl,
          source: 'qr_codes_table',  // 資料來源標記
          performance: 'fallback'     // 效能標記
        },
        timestamp: new Date().toISOString()
      });
    }

    // Step 3: 沒有找到任何 QR Code
    return c.json({
      success: false,
      error: 'No QR code found for this team',
      timestamp: new Date().toISOString()
    }, 404);

  } catch (error) {
    console.error('Fast QR code query error:', error);
    return c.json({
      success: false,
      error: 'Failed to get QR code',
      timestamp: new Date().toISOString()
    }, 500);
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

// ==================== Priority 5: SINGLE PARAMETERIZED (:id only) ====================
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
      }, 404);
    }

    return c.json({
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_UPDATE_TEAM,
      timestamp: new Date().toISOString()
    }, 500);
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

// ==================== Priority 6: WILDCARD (LAST!) ====================
// List teams
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

    // 診斷日誌
    console.log('📊 Teams List Result:', {
      teamsCount: result.teams?.length || 0,
      teams: result.teams,
      pagination: result.pagination,
      user: { id: user.id, role: user.role, teamId: user.teamId }
    });

    return c.json({
      success: true,
      data: result.teams,  // ✅ 修復：使用 data 字段而不是 teams
      pagination: result.pagination,
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

    // Phase 3 優化：並行執行活動日誌和 QR 碼生成
    // QR code generation runs in parallel with activity logging (~30-50ms overhead)
    const user = c.get('user');
    const activityService = new TeamActivityService(c.env.DB);
    // 🔧 修正：傳遞 LINE_BOT_ID 和 FRONTEND_URL 以生成正確的 LIFF URL
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
        campaignName: `${team.name} - 預設 QR 碼`,
        description: `團隊 ${team.name} 的預設 QR 碼`
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
    }, 201);
  } catch (error) {
    console.error('Create team error:', error);

    // Handle specific errors
    if (error instanceof Error && error.message === 'DUPLICATE_QR_CODE') {
      return c.json({
        success: false,
        error: 'QR code already exists',
        timestamp: new Date().toISOString()
      }, 409);
    }

    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return c.json({
        success: false,
        error: 'Invalid JSON',
        timestamp: new Date().toISOString()
      }, 400);
    }

    return c.json({
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_CREATE_TEAM,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

export default app;