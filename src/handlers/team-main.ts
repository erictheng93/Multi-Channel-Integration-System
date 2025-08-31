// 團隊管理處理器 - 主要實現
import { Hono } from 'hono';
import type { Bindings } from '../types';
import { ERROR_MESSAGES } from '../utils/error-messages';
import { 
  createTeam, 
  getAllTeams, 
  getTeamById, 
  updateTeam, 
  deleteTeam, 
  getTeamMembers,
  getTeamStats
} from '../utils/team';
import { QRCodeService } from '../services/qrcode-service';
import { 
  jwtAuth, 
  requireTeamAccess,
  requireManagerOrAdmin,
  requireAdmin
} from '../middleware/auth';
// Removed unused drizzle imports

const teamHandler = new Hono<{ Bindings: Bindings }>();

// 獲取所有團隊
teamHandler.get('/', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const includeInactive = c.req.query('includeInactive') === 'true';
    
    // 非 admin/team 用戶只能看到自己的團隊
    if (user.role === 'agent' && user.teamId) {
      const team = await getTeamById(c.env.DB, user.teamId);
      return c.json({
        success: true,
        data: [team],
        timestamp: new Date().toISOString()
      });
    }

    const teams = await getAllTeams(c.env.DB, includeInactive);
    
    return c.json({
      success: true,
      data: teams,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get teams error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : ERROR_MESSAGES.FAILED_TO_GET_TEAMS,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 創建團隊（admin 和 manager）
teamHandler.post('/', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const { name, description } = await c.req.json();
    
    if (!name) {
      return c.json({ error: 'Team name is required' }, 400);
    }

    const team = await createTeam(c.env.DB, {
      name,
      description,
      isActive: true
    });

    return c.json({
      success: true,
      data: team,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Create team error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : ERROR_MESSAGES.FAILED_TO_CREATE_TEAM,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 獲取團隊詳情
teamHandler.get('/:id', jwtAuth, requireTeamAccess('id'), async (c) => {
  try {
    const teamId = parseInt(c.req.param('id'));
    const team = await getTeamById(c.env.DB, teamId);
    
    return c.json({
      success: true,
      data: team,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get team error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : ERROR_MESSAGES.FAILED_TO_GET_TEAM,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 更新團隊
teamHandler.put('/:id', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const user = c.get('user');
    const teamId = parseInt(c.req.param('id'));
    const updates = await c.req.json();
    
    // 檢查權限：team 角色只能更新自己的團隊
    if (user.role === 'team' && user.teamId !== teamId) {
      return c.json({
        success: false,
        error: 'Team leaders can only update their own team',
        timestamp: new Date().toISOString()
      }, 403);
    }
    
    const team = await updateTeam(c.env.DB, teamId, updates);
    
    return c.json({
      success: true,
      data: team,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Update team error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : ERROR_MESSAGES.FAILED_TO_UPDATE_TEAM,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 刪除團隊（軟刪除，僅 admin）
teamHandler.delete('/:id', jwtAuth, requireAdmin(), async (c) => {
  try {
    const teamId = parseInt(c.req.param('id'));
    await deleteTeam(c.env.DB, teamId);
    
    return c.json({
      success: true,
      message: 'Team deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Delete team error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : ERROR_MESSAGES.FAILED_TO_DELETE_TEAM,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 獲取團隊成員
teamHandler.get('/:id/members', jwtAuth, requireTeamAccess('id'), async (c) => {
  try {
    const teamId = parseInt(c.req.param('id'));
    const members = await getTeamMembers(c.env.DB, teamId);
    
    return c.json({
      success: true,
      data: members,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get team members error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : ERROR_MESSAGES.FAILED_TO_GET_TEAM_MEMBERS,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 獲取團隊統計
teamHandler.get('/:id/stats', jwtAuth, requireTeamAccess('id'), async (c) => {
  try {
    const teamId = parseInt(c.req.param('id'));
    const stats = await getTeamStats(c.env.DB, teamId);
    
    return c.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get team stats error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : ERROR_MESSAGES.FAILED_TO_GET_TEAM_STATS,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 生成團隊 QR Code (新版本)
teamHandler.post('/:id/qr-code', jwtAuth, requireTeamAccess('id'), async (c) => {
  try {
    const teamId = parseInt(c.req.param('id'));
    const { campaignName, expiresAt, maxUses } = await c.req.json().catch(() => ({}));
    
    const qrCodeInfo = await QRCodeService.generateTeamQRCode({
      teamId,
      campaignName,
      expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      maxUses
    });
    
    return c.json({
      success: true,
      data: qrCodeInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Generate QR code error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : ERROR_MESSAGES.FAILED_TO_GENERATE_QR_CODE,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 獲取團隊的所有 QR Code
teamHandler.get('/:id/qr-codes', jwtAuth, requireTeamAccess('id'), async (c) => {
  try {
    const teamId = parseInt(c.req.param('id'));
    const qrCodes = await QRCodeService.getTeamQRCodes(teamId);
    
    return c.json({
      success: true,
      data: qrCodes,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get QR codes error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : ERROR_MESSAGES.FAILED_TO_GET_QR_CODES,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

export default teamHandler;