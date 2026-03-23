// Team Members Handler
// 團隊成員管理路由處理器

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { MemberService } from '@modules/teams/services/member-service';
import { AgentTeamsService } from '@modules/teams/services/agent-teams-service';
import {
  jwtAuth,
  requireManagerOrAdmin
} from '@/middleware/auth';
import { ActivityService, ACTIVITY_ACTIONS, RESOURCE_TYPES } from '@/modules/activities';
import { createDbClient } from '@/db/drizzle-factory';
import { agents } from '@/db/schema';
import { desc, sql, isNull } from 'drizzle-orm';
import { HTTP_STATUS } from '@/constants/http-status';
import { globalErrorHandler } from '@/core/error-handler';
import type {
  AddTeamMemberRequest,
  UpdateMemberStatusRequest,
  UpdateMemberRoleRequest,
  UpdateMemberRequest,
  BulkDeleteMembersRequest,
  BulkDeleteMembersResponse,
  BulkUpdateMembersRequest,
  BulkUpdateMembersResponse,
  BatchEditMembersRequest,
  BatchEditMembersResponse,
  BatchEditUndoTokenData
} from '../types/member-types';
import { nowISO, nowMs } from '@/utils/timestamp'

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
    // Filter out soft-deleted members
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
        lastActive: agents.lastLoginAt
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
        primaryTeamId: primaryTeam?.teamId || null,
        primaryTeamName: primaryTeam?.teamName
      };
    });

    return c.json({
      success: true,
      data: formattedMembers,
      timestamp: nowISO()
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
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
        targetName: member.displayName || member.email,
        memberEmail: member.email,
        memberRole: member.role
      }
    });

    return c.json({
      success: true,
      data: member,
      message: 'Team member added successfully',
      timestamp: nowISO()
    }, HTTP_STATUS.CREATED);

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * 更新成員狀態 (啟用/停用)
 * PUT /api/teams/members/:memberId/status
 */
membersHandler.put('/:memberId/status', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const user = c.get('user');
    const memberId = c.req.param('memberId')!;
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
    const existingMember = await memberService.getMember(memberId);
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
        targetName: existingMember?.displayName || existingMember?.email || memberId,
        changes: [{
          field: 'isActive',
          old: existingMember?.isActive ? 'active' : 'inactive',
          new: data.isActive ? 'active' : 'inactive',
        }],
        reason: data.reason
      }
    });

    return c.json({
      success: true,
      data: member,
      message: `Member ${data.isActive ? 'activated' : 'deactivated'} successfully`,
      timestamp: nowISO()
    });

  } catch (error) {
    if (error instanceof Error && error.message === 'Member not found') {
      return c.json({
        success: false,
        error: 'Member not found'
      }, HTTP_STATUS.NOT_FOUND);
    }

    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * 更新成員角色
 * PUT /api/teams/members/:memberId/role
 */
membersHandler.put('/:memberId/role', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const user = c.get('user');
    const memberId = c.req.param('memberId')!;
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
    const existingMember = await memberService.getMember(memberId);
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
        targetName: existingMember?.displayName || existingMember?.email || memberId,
        changes: [{
          field: 'role',
          old: existingMember?.role || '',
          new: data.role,
        }],
        reason: data.reason
      }
    });

    return c.json({
      success: true,
      data: member,
      message: 'Member role updated successfully',
      timestamp: nowISO()
    });

  } catch (error) {
    if (error instanceof Error && error.message === 'Member not found') {
      return c.json({
        success: false,
        error: 'Member not found'
      }, HTTP_STATUS.NOT_FOUND);
    }

    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * 更新成員完整信息
 * PUT /api/teams/members/:memberId
 */
membersHandler.put('/:memberId', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const user = c.get('user');
    const memberId = c.req.param('memberId')!;
    const data: UpdateMemberRequest = await c.req.json();

    const memberService = new MemberService(c.env.DB);
    const existingMember = await memberService.getMember(memberId);
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
        targetName: existingMember?.displayName || existingMember?.email || memberId,
        changes: Object.keys(data).map(field => ({
          field,
          old: String((existingMember as unknown as Record<string, unknown>)?.[field] ?? ''),
          new: String((data as unknown as Record<string, unknown>)[field] ?? ''),
        })),
      }
    });

    return c.json({
      success: true,
      data: member,
      message: 'Member updated successfully',
      timestamp: nowISO()
    });

  } catch (error) {
    if (error instanceof Error && error.message === 'Member not found') {
      return c.json({
        success: false,
        error: 'Member not found'
      }, HTTP_STATUS.NOT_FOUND);
    }

    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * 永久刪除成員 (Hard Delete)
 * DELETE /api/teams/members/:memberId
 *
 * 此操作不可撤銷。確認對話框由前端處理。
 */
membersHandler.delete('/:memberId', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const user = c.get('user');
    const memberId = c.req.param('memberId')!;

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

    // Hard delete member (permanent, cleans up all FK references)
    await memberService.deleteMember(memberId, String(user.id));

    // Log activity (non-blocking)
    try {
      const activityService = new ActivityService(c.env.DB);
      await activityService.logActivity({
        userId: String(user.id),
        userName: user.displayName || String(user.id),
        userRole: user.role,
        action: ACTIVITY_ACTIONS.USER_DELETE,
        resourceType: RESOURCE_TYPES.USER,
        resourceId: memberId,
        details: {
          targetName: member.displayName || member.email,
          memberEmail: member.email,
          memberRole: member.role
        }
      });
    } catch (activityError) {
      console.error('Failed to log delete activity:', activityError);
    }

    return c.json({
      success: true,
      message: 'Member permanently deleted',
      data: {
        deletedMemberId: memberId
      },
      timestamp: nowISO()
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * 批量永久刪除成員 (Hard Delete)
 * POST /api/teams/members/bulk-delete
 *
 * 此操作不可撤銷。確認對話框由前端處理。
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

    // Execute bulk hard delete
    const result = await memberService.bulkHardDeleteMembers(
      data.memberIds,
      String(user.id)
    );

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
      deletedCount: result.deleted.length
    };

    return c.json({
      success: true,
      data: response,
      message: `Successfully deleted ${result.deleted.length} member(s) permanently`,
      timestamp: nowISO()
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// NOTE: POST /restore endpoint removed — hard delete is permanent

/**
 * 批量更新成員 (角色和狀態)
 * POST /api/teams/members/bulk-update
 *
 * 支持批量更新成員的角色和/或狀態
 * - 用戶不能變更自己的角色或狀態
 * - 最多支持 50 個成員
 */
membersHandler.post('/bulk-update', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const user = c.get('user');
    const data: BulkUpdateMembersRequest = await c.req.json();

    // Validation: memberIds required
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
        error: `Cannot update more than ${MAX_BULK_SIZE} members at once`
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // Validation: at least one update field required
    if (!data.updates || (data.updates.role === undefined && data.updates.isActive === undefined)) {
      return c.json({
        success: false,
        error: 'At least one update field (role or isActive) is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // Validation: role value
    if (data.updates.role !== undefined && !['admin', 'agent'].includes(data.updates.role)) {
      return c.json({
        success: false,
        error: 'Invalid role value. Must be "admin" or "agent"'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const memberService = new MemberService(c.env.DB);

    // Execute bulk update
    const result = await memberService.bulkUpdateMembers(
      data.memberIds,
      data.updates,
      String(user.id)
    );

    // Log activity if any members were updated
    if (result.updated.length > 0) {
      const activityService = new ActivityService(c.env.DB);
      await activityService.logActivity({
        userId: String(user.id),
        userName: user.displayName || String(user.id),
        userRole: user.role,
        action: ACTIVITY_ACTIONS.USER_BULK_UPDATE,
        resourceType: RESOURCE_TYPES.USER,
        resourceId: result.updated.join(','),
        details: {
          updatedCount: result.updated.length,
          updatedMemberIds: result.updated,
          updates: data.updates,
          reason: data.reason
        }
      });
    }

    const response: BulkUpdateMembersResponse = {
      updated: result.updated,
      failed: result.failed,
      skipped: result.skipped,
      updatedCount: result.updated.length
    };

    return c.json({
      success: true,
      data: response,
      message: `Successfully updated ${result.updated.length} member(s)`,
      timestamp: nowISO()
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * 批量編輯成員 (個別變更)
 * POST /api/teams/members/batch-edit
 *
 * 支持每個成員有不同的 profile 和團隊變更
 * - Profile: displayName, email, role
 * - Teams: add/remove teams
 * - 返回 undo token 用於撤銷
 */
membersHandler.post('/batch-edit', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const user = c.get('user');
    const data: BatchEditMembersRequest = await c.req.json();

    // Validation: members required
    if (!data.members || !Array.isArray(data.members) || data.members.length === 0) {
      return c.json({
        success: false,
        error: 'members is required and must be a non-empty array'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // Check limit
    const MAX_BATCH_SIZE = 50;
    if (data.members.length > MAX_BATCH_SIZE) {
      return c.json({
        success: false,
        error: `Cannot edit more than ${MAX_BATCH_SIZE} members at once`
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // Validate each member has at least one change
    for (const member of data.members) {
      if (!member.memberId) {
        return c.json({
          success: false,
          error: 'Each member must have a memberId'
        }, HTTP_STATUS.BAD_REQUEST);
      }

      const hasProfileChange = member.profile &&
        (member.profile.displayName !== undefined ||
         member.profile.email !== undefined ||
         member.profile.role !== undefined);

      const hasTeamChange = member.teamChanges &&
        ((member.teamChanges.add && member.teamChanges.add.length > 0) ||
         (member.teamChanges.remove && member.teamChanges.remove.length > 0));

      if (!hasProfileChange && !hasTeamChange) {
        return c.json({
          success: false,
          error: `Member ${member.memberId} has no changes specified`
        }, HTTP_STATUS.BAD_REQUEST);
      }
    }

    const memberService = new MemberService(c.env.DB);

    // Execute batch edit
    const result = await memberService.batchEditMembers(
      data.members,
      String(user.id),
      c.env.DB
    );

    // Calculate success/failed counts
    const successCount = result.results.filter(r => r.success).length;
    const failedCount = result.results.filter(r => !r.success).length;

    // Generate undo token if there were successful edits
    let undoToken: string | undefined;
    let undoExpiresAt: string | undefined;

    if (successCount > 0 && result.originalData.length > 0) {
      undoToken = `batch-edit-${nowMs()}-${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date(Date.now() + 10 * 1000); // 10 seconds
      undoExpiresAt = expiresAt.toISOString();

      // Store undo data in KV
      const undoData: BatchEditUndoTokenData = {
        originalMembers: result.originalData,
        editedBy: String(user.id),
        editedAt: nowISO(),
        reason: data.reason
      };

      await c.env.SESSIONS.put(
        `undo:batch-edit:${undoToken}`,
        JSON.stringify(undoData),
        { expirationTtl: 60 } // 60 seconds TTL
      );
    }

    // Log activity if any members were updated
    if (successCount > 0) {
      const activityService = new ActivityService(c.env.DB);
      await activityService.logActivity({
        userId: String(user.id),
        userName: user.displayName || String(user.id),
        userRole: user.role,
        action: ACTIVITY_ACTIONS.USER_BULK_UPDATE,
        resourceType: RESOURCE_TYPES.USER,
        resourceId: result.results.filter(r => r.success).map(r => r.memberId).join(','),
        details: {
          updatedCount: successCount,
          failedCount,
          skippedCount: result.skipped.length,
          reason: data.reason
        }
      });
    }

    const response: BatchEditMembersResponse = {
      results: result.results,
      successCount,
      failedCount,
      skipped: result.skipped,
      undoToken,
      undoExpiresAt
    };

    return c.json({
      success: true,
      data: response,
      message: `Successfully edited ${successCount} member(s)`,
      timestamp: nowISO()
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * 撤銷批量編輯
 * POST /api/teams/members/batch-edit/undo
 */
membersHandler.post('/batch-edit/undo', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const user = c.get('user');
    const { undoToken } = await c.req.json();

    if (!undoToken) {
      return c.json({
        success: false,
        error: 'undoToken is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // Get undo data from KV
    const undoDataStr = await c.env.SESSIONS.get(`undo:batch-edit:${undoToken}`);
    if (!undoDataStr) {
      return c.json({
        success: false,
        error: 'Undo token expired or invalid'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const undoData: BatchEditUndoTokenData = JSON.parse(undoDataStr);

    // Verify the user who is undoing is the same who edited
    if (undoData.editedBy !== String(user.id)) {
      return c.json({
        success: false,
        error: 'Only the user who made the changes can undo them'
      }, HTTP_STATUS.FORBIDDEN);
    }

    const memberService = new MemberService(c.env.DB);

    // Restore original data
    const result = await memberService.batchEditMembers(
      undoData.originalMembers,
      String(user.id),
      c.env.DB
    );

    // Delete the undo token
    await c.env.SESSIONS.delete(`undo:batch-edit:${undoToken}`);

    const successCount = result.results.filter(r => r.success).length;

    // Log activity
    if (successCount > 0) {
      const activityService = new ActivityService(c.env.DB);
      await activityService.logActivity({
        userId: String(user.id),
        userName: user.displayName || String(user.id),
        userRole: user.role,
        action: ACTIVITY_ACTIONS.USER_BULK_UPDATE,
        resourceType: RESOURCE_TYPES.USER,
        resourceId: result.results.filter(r => r.success).map(r => r.memberId).join(','),
        details: {
          action: 'undo',
          restoredCount: successCount
        }
      });
    }

    return c.json({
      success: true,
      data: {
        restoredCount: successCount,
        results: result.results
      },
      message: `Successfully restored ${successCount} member(s)`,
      timestamp: nowISO()
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

export default membersHandler;
