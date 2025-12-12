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
import { desc, sql } from 'drizzle-orm';
import type {
  AddTeamMemberRequest,
  UpdateMemberStatusRequest,
  UpdateMemberRoleRequest,
  UpdateMemberRequest,
  DeleteMemberRequest
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
      }, 403);
    }

    // 使用直接的數據庫查詢來獲取所有成員
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
      .orderBy(desc(agents.lastLoginAt), desc(agents.createdAt));

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
    }, 500);
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
      }, 400);
    }

    const memberService = new MemberService(c.env.DB);

    // Check if member already exists
    const exists = await memberService.memberExists(data.email);
    if (exists) {
      return c.json({
        success: false,
        error: 'Member with this email already exists'
      }, 409);
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
    }, 201);

  } catch (error) {
    console.error('Add team member error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add team member'
    }, 500);
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
      }, 400);
    }

    // Cannot deactivate yourself
    if (memberId === user.id) {
      return c.json({
        success: false,
        error: 'Cannot change your own status'
      }, 403);
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
      }, 404);
    }

    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update member status'
    }, 500);
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
      }, 400);
    }

    // Cannot change your own role
    if (memberId === user.id) {
      return c.json({
        success: false,
        error: 'Cannot change your own role'
      }, 403);
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
      }, 404);
    }

    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update member role'
    }, 500);
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
      }, 404);
    }

    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update member'
    }, 500);
  }
});

/**
 * 刪除成員
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
      }, 403);
    }

    const memberService = new MemberService(c.env.DB);

    // Check if member exists
    const member = await memberService.getMember(memberId);
    if (!member) {
      return c.json({
        success: false,
        error: 'Member not found'
      }, 404);
    }

    // Delete member
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
    }, 500);
  }
});

export default membersHandler;
