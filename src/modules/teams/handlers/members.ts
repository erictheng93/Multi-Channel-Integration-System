// Team Members Handler
// 團隊成員管理路由處理器

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { MemberService } from '@modules/teams/services/member-service';
import { AgentTeamsService } from '@modules/teams/services/agent-teams-service';
import {
  jwtAuth,
  requireAdmin,
  requireManagerOrAdmin
} from '@/middleware/auth';
import { ActivityService, ACTIVITY_ACTIONS, RESOURCE_TYPES } from '@/services/activity-service';
import { createDbClient } from '@/db/drizzle-factory';
import { agents } from '@/db/schema';
import { desc, sql, isNull } from 'drizzle-orm';
import { HTTP_STATUS } from '@/constants/http-status';
import type {
  AddTeamMemberRequest,
  UpdateMemberStatusRequest,
  UpdateMemberRoleRequest,
  UpdateMemberRequest,
  DeleteMemberRequest,
  BulkDeleteMembersRequest,
  BulkDeleteMembersResponse,
  RestoreMembersRequest,
  RestoreMembersResponse,
  UndoTokenData
} from '../types/member-types';

const membersHandler = new Hono<{ Bindings: Bindings }>();

/**
 * 獲取所有團隊成員列表 (僅限 Admin)
 * GET /api/teams/members
 * Now includes multi-team membership information
 */
membersHandler.get('/', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    // 檢查權限 - 只有 admin 角色可以查看所有成員
    if (user.role !== 'admin') {
      return c.json({
        success: false,
        error: 'Insufficient permissions to view team members'
      }, HTTP_STATUS.FORBIDDEN);
    }

    // 使用直接的數據庫查詢來獲取所有成員
    // 🔑 Filter out soft-deleted members
    const db = createDbClient(c.env.DB);
    const members = await db
      .select({
        id: agents.id,
        loginId: agents.displayName,
        email: agents.email,
        name: agents.displayName,
        role: agents.role,
        group: sql`''`.as('group'),
        isActive: agents.isActive,
        status: sql`CASE WHEN ${agents.isActive} = 1 THEN 'active' ELSE 'inactive' END`.as('status'),
        createdAt: agents.createdAt,
        lastActive: agents.lastLoginAt,
        teamId: agents.teamId // Legacy: primary team for backward compatibility
      })
      .from(agents)
      .where(isNull(agents.deletedAt))
      .orderBy(desc(agents.createdAt));

    // Fetch multi-team membership information
    const agentTeamsService = new AgentTeamsService(c.env.DB);
    const allAgentTeams = await agentTeamsService.getAllAgentsWithTeams();

    const formattedMembers = members.map((member: any) => {
      const agentTeamList = allAgentTeams.get(member.id) || [];
      const primaryTeam = agentTeamList.find(t => t.isPrimary);

      return {
        ...member,
        createdAt: member.createdAt ? new Date(member.createdAt) : new Date(),
        lastActive: member.lastActive ? new Date(member.lastActive) : undefined,
        // New: multi-team support
        teams: agentTeamList.map(t => ({
          teamId: t.teamId,
          teamName: t.teamName,
          roleInTeam: t.roleInTeam,
          isPrimary: t.isPrimary,
          joinedAt: t.joinedAt
        })),
        teamCount: agentTeamList.length,
        primaryTeamId: primaryTeam?.teamId || member.teamId,
        primaryTeamName: primaryTeam?.teamName
      };
    });

    return c.json({
      success: true,
      data: formattedMembers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get all members error:', error);
    return c.json({
      success: false,
      error: 'Failed to get team members',
      timestamp: new Date().toISOString()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * 添加團隊成員
 * POST /api/teams/members
 */
membersHandler.post('/', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const user = c.get('user');
    const data: AddTeamMemberRequest = await c.req.json();

    // Validation
    if (!data.email || !data.password || !data.displayName) {
      return c.json({
        success: false,
        error: 'Missing required fields: email, password, displayName'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const memberService = new MemberService(c.env.DB);

    // Check if member already exists
    const exists = await memberService.memberExists(data.email);
    if (exists) {
      return c.json({
        success: false,
        error: 'Member with this email already exists'
      }, HTTP_STATUS.CONFLICT);
    }

    // Create member
    const member = await memberService.addMember(data, String(user.id));

    // Log activity
    const activityService = new ActivityService(c.env.DB);
    await activityService.logActivity({
      userId: String(user.id),
      userName: user.displayName || String(user.id),
      userRole: user.role,
      action: ACTIVITY_ACTIONS.USER_CREATE,
      resourceType: RESOURCE_TYPES.USER,
      resourceId: member.id,
      details: {
        memberEmail: member.email,
        memberRole: member.role
      }
    });

    return c.json({
      success: true,
      data: member,
      message: 'Team member added successfully',
      timestamp: new Date().toISOString()
    }, HTTP_STATUS.CREATED);

  } catch (error) {
    console.error('Add team member error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add team member'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * 更新成員狀態 (啟用/停用)
 * PUT /api/teams/members/:memberId/status
 */
membersHandler.put('/:memberId/status', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const user = c.get('user');
    const memberId = c.req.param('memberId');
    const data: UpdateMemberStatusRequest = await c.req.json();

    if (data.isActive === undefined) {
      return c.json({
        success: false,
        error: 'isActive field is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // Cannot deactivate yourself
    if (memberId === user.id) {
      return c.json({
        success: false,
        error: 'Cannot change your own status'
      }, HTTP_STATUS.FORBIDDEN);
    }

    const memberService = new MemberService(c.env.DB);
    const member = await memberService.updateMemberStatus(memberId, data, String(user.id));

    // Log activity
    const activityService = new ActivityService(c.env.DB);
    await activityService.logActivity({
      userId: String(user.id),
      userName: user.displayName || String(user.id),
      userRole: user.role,
      action: ACTIVITY_ACTIONS.USER_UPDATE,
      resourceType: RESOURCE_TYPES.USER,
      resourceId: memberId,
      details: {
        field: 'status',
        newValue: data.isActive ? 'active' : 'inactive',
        reason: data.reason
      }
    });

    return c.json({
      success: true,
      data: member,
      message: `Member ${data.isActive ? 'activated' : 'deactivated'} successfully`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Update member status error:', error);

    if (error instanceof Error && error.message === 'Member not found') {
      return c.json({
        success: false,
        error: 'Member not found'
      }, HTTP_STATUS.NOT_FOUND);
    }

    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update member status'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * 更新成員角色
 * PUT /api/teams/members/:memberId/role
 */
membersHandler.put('/:memberId/role', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const user = c.get('user');
    const memberId = c.req.param('memberId');
    const data: UpdateMemberRoleRequest = await c.req.json();

    if (!data.role) {
      return c.json({
        success: false,
        error: 'role field is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // Cannot change your own role
    if (memberId === user.id) {
      return c.json({
        success: false,
        error: 'Cannot change your own role'
      }, HTTP_STATUS.FORBIDDEN);
    }

    const memberService = new MemberService(c.env.DB);
    const member = await memberService.updateMemberRole(memberId, data, String(user.id));

    // Log activity
    const activityService = new ActivityService(c.env.DB);
    await activityService.logActivity({
      userId: String(user.id),
      userName: user.displayName || String(user.id),
      userRole: user.role,
      action: ACTIVITY_ACTIONS.USER_UPDATE,
      resourceType: RESOURCE_TYPES.USER,
      resourceId: memberId,
      details: {
        field: 'role',
        newValue: data.role,
        reason: data.reason
      }
    });

    return c.json({
      success: true,
      data: member,
      message: 'Member role updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Update member role error:', error);

    if (error instanceof Error && error.message === 'Member not found') {
      return c.json({
        success: false,
        error: 'Member not found'
      }, HTTP_STATUS.NOT_FOUND);
    }

    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update member role'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * 更新成員完整信息
 * PUT /api/teams/members/:memberId
 */
membersHandler.put('/:memberId', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const user = c.get('user');
    const memberId = c.req.param('memberId');
    const data: UpdateMemberRequest = await c.req.json();

    const memberService = new MemberService(c.env.DB);
    const member = await memberService.updateMember(memberId, data, String(user.id));

    // Log activity
    const activityService = new ActivityService(c.env.DB);
    await activityService.logActivity({
      userId: String(user.id),
      userName: user.displayName || String(user.id),
      userRole: user.role,
      action: ACTIVITY_ACTIONS.USER_UPDATE,
      resourceType: RESOURCE_TYPES.USER,
      resourceId: memberId,
      details: {
        updatedFields: Object.keys(data)
      }
    });

    return c.json({
      success: true,
      data: member,
      message: 'Member updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Update member error:', error);

    if (error instanceof Error && error.message === 'Member not found') {
      return c.json({
        success: false,
        error: 'Member not found'
      }, HTTP_STATUS.NOT_FOUND);
    }

    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update member'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * 刪除成員 (軟刪除)
 * DELETE /api/teams/members/:memberId
 */
membersHandler.delete('/:memberId', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const user = c.get('user');
    const memberId = c.req.param('memberId');

    // Cannot delete yourself
    if (memberId === user.id) {
      return c.json({
        success: false,
        error: 'Cannot delete your own account'
      }, HTTP_STATUS.FORBIDDEN);
    }

    const memberService = new MemberService(c.env.DB);

    // Check if member exists
    const member = await memberService.getMember(memberId);
    if (!member) {
      return c.json({
        success: false,
        error: 'Member not found'
      }, HTTP_STATUS.NOT_FOUND);
    }

    // Soft delete member
    await memberService.deleteMember(memberId, String(user.id));

    // Log activity
    const activityService = new ActivityService(c.env.DB);
    await activityService.logActivity({
      userId: String(user.id),
      userName: user.displayName || String(user.id),
      userRole: user.role,
      action: ACTIVITY_ACTIONS.USER_DELETE,
      resourceType: RESOURCE_TYPES.USER,
      resourceId: memberId,
      details: {
        memberEmail: member.email,
        memberRole: member.role
      }
    });

    return c.json({
      success: true,
      message: 'Member deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Delete member error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete member'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * 批量刪除成員 (軟刪除)
 * POST /api/teams/members/bulk-delete
 *
 * 支持 Undo 功能：
 * - 生成 undoToken，存儲在 KV 中 (30 秒 TTL)
 * - 前端可使用此 token 在 10 秒內調用 restore 端點恢復
 */
membersHandler.post('/bulk-delete', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const user = c.get('user');
    const data: BulkDeleteMembersRequest = await c.req.json();

    // Validation
    if (!data.memberIds || !Array.isArray(data.memberIds) || data.memberIds.length === 0) {
      return c.json({
        success: false,
        error: 'memberIds is required and must be a non-empty array'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // Check limit
    const MAX_BULK_SIZE = 50;
    if (data.memberIds.length > MAX_BULK_SIZE) {
      return c.json({
        success: false,
        error: `Cannot delete more than ${MAX_BULK_SIZE} members at once`
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // Cannot delete yourself
    if (data.memberIds.includes(String(user.id))) {
      return c.json({
        success: false,
        error: 'Cannot delete your own account'
      }, HTTP_STATUS.FORBIDDEN);
    }

    const memberService = new MemberService(c.env.DB);

    // Execute bulk soft delete
    const result = await memberService.bulkSoftDeleteMembers(
      data.memberIds,
      String(user.id)
    );

    // Generate undo token if any members were deleted
    let undoToken = '';
    let undoExpiresAt = '';

    if (result.deleted.length > 0) {
      undoToken = `undo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date(Date.now() + 30 * 1000); // 30 seconds TTL
      undoExpiresAt = expiresAt.toISOString();

      // Store undo data in KV
      const undoData: UndoTokenData = {
        memberIds: result.deleted,
        deletedBy: String(user.id),
        deletedAt: new Date().toISOString(),
        reason: data.reason
      };

      await c.env.KV.put(
        `undo:members:${undoToken}`,
        JSON.stringify(undoData),
        { expirationTtl: 30 } // 30 seconds TTL
      );
    }

    // Log activity
    if (result.deleted.length > 0) {
      const activityService = new ActivityService(c.env.DB);
      await activityService.logActivity({
        userId: String(user.id),
        userName: user.displayName || String(user.id),
        userRole: user.role,
        action: ACTIVITY_ACTIONS.USER_BULK_DELETE,
        resourceType: RESOURCE_TYPES.USER,
        resourceId: result.deleted.join(','),
        details: {
          deletedCount: result.deleted.length,
          deletedMemberIds: result.deleted,
          reason: data.reason
        }
      });
    }

    const response: BulkDeleteMembersResponse = {
      deleted: result.deleted,
      failed: result.failed,
      undoToken,
      undoExpiresAt,
      deletedCount: result.deleted.length
    };

    return c.json({
      success: true,
      data: response,
      message: `Successfully deleted ${result.deleted.length} member(s)`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Bulk delete members error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to bulk delete members'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * 恢復已刪除的成員
 * POST /api/teams/members/restore
 *
 * 支持兩種模式：
 * 1. undoToken: 使用 KV 中存儲的 token 獲取成員 ID
 * 2. memberIds: 直接指定要恢復的成員 ID
 */
membersHandler.post('/restore', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const user = c.get('user');
    const data: RestoreMembersRequest = await c.req.json();

    let memberIdsToRestore: string[] = [];

    // Mode 1: Use undo token
    if (data.undoToken) {
      const undoDataStr = await c.env.KV.get(`undo:members:${data.undoToken}`);

      if (!undoDataStr) {
        return c.json({
          success: false,
          error: 'Undo token expired or invalid'
        }, HTTP_STATUS.BAD_REQUEST);
      }

      const undoData: UndoTokenData = JSON.parse(undoDataStr);
      memberIdsToRestore = undoData.memberIds;

      // Delete the token after use
      await c.env.KV.delete(`undo:members:${data.undoToken}`);
    }
    // Mode 2: Direct member IDs
    else if (data.memberIds && Array.isArray(data.memberIds) && data.memberIds.length > 0) {
      memberIdsToRestore = data.memberIds;
    }
    else {
      return c.json({
        success: false,
        error: 'Either undoToken or memberIds is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const memberService = new MemberService(c.env.DB);

    // Execute bulk restore
    const result = await memberService.bulkRestoreMembers(memberIdsToRestore);

    // Log activity
    if (result.restored.length > 0) {
      const activityService = new ActivityService(c.env.DB);
      await activityService.logActivity({
        userId: String(user.id),
        userName: user.displayName || String(user.id),
        userRole: user.role,
        action: ACTIVITY_ACTIONS.USER_RESTORE,
        resourceType: RESOURCE_TYPES.USER,
        resourceId: result.restored.map(m => m.id).join(','),
        details: {
          restoredCount: result.restored.length,
          restoredMemberIds: result.restored.map(m => m.id),
          restoredMemberEmails: result.restored.map(m => m.email)
        }
      });
    }

    const response: RestoreMembersResponse = {
      restored: result.restored,
      failed: result.failed,
      restoredCount: result.restored.length
    };

    return c.json({
      success: true,
      data: response,
      message: `Successfully restored ${result.restored.length} member(s)`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Restore members error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to restore members'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

export default membersHandler;
