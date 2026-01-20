// Agent Teams Handler
// 客服人員多團隊管理路由處理器
// Allows agents to belong to unlimited teams

import { Hono } from 'hono';
import { eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import type { Bindings } from '@/types';
import { AgentTeamsService } from '@modules/teams/services/agent-teams-service';
import { jwtAuth, requireManagerOrAdmin, requireTeamRole } from '@/middleware/auth';
import { ActivityService, ACTIVITY_ACTIONS, RESOURCE_TYPES } from '@/services/activity-service';
import { triggerAgentRemovedFromTeamNotification, triggerTeamMemberChangeEvent } from '@/utils/notification-trigger';
import { teams, conversations, agents } from '@/db/schema';
import { HTTP_STATUS } from '@/constants/http-status';

const agentTeamsHandler = new Hono<{ Bindings: Bindings }>();

// ============================================================
// IMPORTANT: Route Registration Order
// Static routes MUST be registered BEFORE parameterized routes
// to prevent route interception (e.g., "team" being treated as :agentId)
// ============================================================

/**
 * 獲取團隊的所有成員（包含多團隊資訊）
 * GET /api/teams/agent-teams/team/:teamId/members
 * NOTE: This route MUST be registered before /:agentId to prevent interception
 */
agentTeamsHandler.get('/team/:teamId/members', jwtAuth, async (c) => {
  try {
    const teamId = parseInt(c.req.param('teamId'), 10);

    if (isNaN(teamId)) {
      return c.json({
        success: false,
        error: 'Invalid teamId'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const service = new AgentTeamsService(c.env.DB);
    const members = await service.getTeamMembers(teamId);

    return c.json({
      success: true,
      data: members,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get team members error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get team members'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * 獲取客服所屬的所有團隊
 * GET /api/teams/agent-teams/:agentId
 */
agentTeamsHandler.get('/:agentId', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const agentId = c.req.param('agentId');

    // Agents can view their own teams, admins can view anyone's teams
    if (user.role !== 'admin' && user.id !== agentId) {
      return c.json({
        success: false,
        error: 'Insufficient permissions to view agent teams'
      }, HTTP_STATUS.FORBIDDEN);
    }

    const service = new AgentTeamsService(c.env.DB);
    const teams = await service.getAgentTeams(agentId);

    return c.json({
      success: true,
      data: teams,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get agent teams error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get agent teams'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * 將客服加入團隊
 * POST /api/teams/agent-teams/:agentId/join
 */
agentTeamsHandler.post('/:agentId/join', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const user = c.get('user');
    const agentId = c.req.param('agentId');
    const { teamId, roleInTeam, isPrimary } = await c.req.json();

    if (!teamId) {
      return c.json({
        success: false,
        error: 'teamId is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const service = new AgentTeamsService(c.env.DB);

    // Check if already a member
    const existingMembership = await service.getAgentTeamMembership(agentId, teamId);
    if (existingMembership) {
      return c.json({
        success: false,
        error: 'Agent is already a member of this team'
      }, HTTP_STATUS.CONFLICT);
    }

    const db = drizzle(c.env.DB);

    // Get team info for broadcasting
    const [teamInfo] = await db
      .select({ name: teams.name })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    const teamName = teamInfo?.name || `Team ${teamId}`;

    // Get agent info for broadcasting
    const [agentInfo] = await db
      .select({ displayName: agents.displayName })
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    const agentName = agentInfo?.displayName || agentId;

    // Add to team
    const membership = await service.addAgentToTeam({
      agentId,
      teamId,
      roleInTeam: roleInTeam || 'member',
      isPrimary: isPrimary || false
    });

    // Get updated member count for broadcasting
    const teamMembers = await service.getTeamMembers(teamId);
    const memberCount = teamMembers.length;

    // Log activity
    const activityService = new ActivityService(c.env.DB);
    await activityService.logActivity({
      userId: String(user.id),
      userName: user.displayName || String(user.id),
      userRole: user.role,
      action: ACTIVITY_ACTIONS.MEMBER_ADD,
      resourceType: RESOURCE_TYPES.TEAM,
      resourceId: String(teamId),
      details: {
        agentId,
        roleInTeam: membership.roleInTeam,
        isPrimary: membership.isPrimary
      }
    });

    // 🆕 Broadcast team member added event for real-time UI updates
    await triggerTeamMemberChangeEvent(c.env, {
      type: 'added',
      teamId,
      teamName,
      agentId,
      agentName,
      memberCount,
      changedBy: user.displayName || String(user.id)
    });

    console.log('✅ Agent added to team with broadcast:', {
      agentId,
      teamId,
      teamName,
      memberCount
    });

    return c.json({
      success: true,
      data: membership,
      message: 'Agent added to team successfully',
      timestamp: new Date().toISOString()
    }, HTTP_STATUS.CREATED);
  } catch (error) {
    console.error('Add agent to team error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add agent to team'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * 批量將客服加入多個團隊
 * POST /api/teams/agent-teams/:agentId/join-multiple
 *
 * 🚀 Phase 3 優化:
 * - Service 層使用批量 DB 操作 (2*N 查詢 → 2 查詢)
 * - 批量獲取團隊資訊和 memberCount (1 次查詢)
 * - 並行廣播所有 WebSocket 事件
 */
agentTeamsHandler.post('/:agentId/join-multiple', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const user = c.get('user');
    const agentId = c.req.param('agentId');
    const { teamIds, roleInTeam } = await c.req.json();

    if (!teamIds || !Array.isArray(teamIds) || teamIds.length === 0) {
      return c.json({
        success: false,
        error: 'teamIds array is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const db = drizzle(c.env.DB);
    const service = new AgentTeamsService(c.env.DB);

    // 🚀 Phase 3: 使用批量 DB 操作
    const results = await service.addAgentToMultipleTeams(agentId, teamIds, roleInTeam || 'member');

    // Log activity
    const activityService = new ActivityService(c.env.DB);
    await activityService.logActivity({
      userId: String(user.id),
      userName: user.displayName || String(user.id),
      userRole: user.role,
      action: ACTIVITY_ACTIONS.MEMBER_ADD,
      resourceType: RESOURCE_TYPES.USER,
      resourceId: agentId,
      details: {
        teamIds: results.added,
        skipped: results.skipped,
        roleInTeam
      }
    });

    // 🚀 Phase 3: 批量 WebSocket 廣播
    if (results.added.length > 0) {
      try {
        // 批量獲取團隊資訊 (1 次查詢)
        const teamInfos = await db
          .select({ id: teams.id, name: teams.name })
          .from(teams)
          .where(inArray(teams.id, results.added));

        const teamNameMap = new Map(teamInfos.map(t => [t.id, t.name]));

        // 批量獲取 agent 名稱 (1 次查詢)
        const [agentInfo] = await db
          .select({ displayName: agents.displayName })
          .from(agents)
          .where(eq(agents.id, agentId))
          .limit(1);

        const agentName = agentInfo?.displayName || agentId;

        // 批量獲取 memberCount (1 次查詢)
        const memberCounts = await service.getTeamMemberCounts(results.added);

        // 並行廣播所有 WebSocket 事件
        const broadcastPromises = results.added.map(teamId =>
          triggerTeamMemberChangeEvent(c.env, {
            type: 'added',
            teamId,
            teamName: teamNameMap.get(teamId) || `Team ${teamId}`,
            agentId,
            agentName,
            memberCount: memberCounts.get(teamId) || 0,
            changedBy: user.displayName || String(user.id)
          })
        );

        // 不阻塞響應，並行執行廣播
        Promise.allSettled(broadcastPromises).then(broadcastResults => {
          const failed = broadcastResults.filter(r => r.status === 'rejected').length;
          if (failed > 0) {
            console.warn(`⚠️ [join-multiple] ${failed}/${results.added.length} WebSocket broadcasts failed`);
          } else {
            console.log(`✅ [join-multiple] All ${results.added.length} WebSocket broadcasts succeeded`);
          }
        });

      } catch (broadcastError) {
        // 廣播失敗不影響主要操作
        console.warn('⚠️ [join-multiple] WebSocket broadcast error:', broadcastError);
      }
    }

    console.log('✅ Agent added to multiple teams with batch optimization:', {
      agentId,
      added: results.added.length,
      skipped: results.skipped.length,
      errors: results.errors.length
    });

    return c.json({
      success: true,
      data: results,
      message: `Agent added to ${results.added.length} teams`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Add agent to multiple teams error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add agent to teams'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * 從團隊移除客服
 * DELETE /api/teams/agent-teams/:agentId/leave/:teamId
 *
 * 🆕 移出後會：
 * 1. 發送 WebSocket 通知給被移出的客服
 * 2. 前端收到通知後刷新對話列表
 * 3. 如果客服正在查看該團隊的對話，前端會強制關閉
 */
// 🚀 Phase 2 RBAC: requires 'lead' role in the target team
agentTeamsHandler.delete('/:agentId/leave/:teamId', jwtAuth, requireTeamRole('lead', 'teamId'), async (c) => {
  try {
    const user = c.get('user');
    const agentId = c.req.param('agentId');
    const teamId = parseInt(c.req.param('teamId'), 10);

    if (isNaN(teamId)) {
      return c.json({
        success: false,
        error: 'Invalid teamId'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const db = drizzle(c.env.DB);

    // 🆕 Step 1: Get team name for notification
    const [teamInfo] = await db
      .select({ name: teams.name })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    const teamName = teamInfo?.name || `Team ${teamId}`;

    // 🆕 Step 2: Get affected conversation IDs (conversations assigned to this team)
    // These are the conversations the agent will no longer be able to see
    const affectedConversations = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.assignedTeamId, teamId));

    const affectedConversationIds = affectedConversations.map(c => c.id);

    // Get agent info for broadcasting
    const [agentInfo] = await db
      .select({ displayName: agents.displayName })
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    const agentName = agentInfo?.displayName || agentId;

    // Step 3: Remove agent from team
    const service = new AgentTeamsService(c.env.DB);
    await service.removeAgentFromTeam(agentId, teamId);

    // Get updated member count for broadcasting
    const teamMembers = await service.getTeamMembers(teamId);
    const memberCount = teamMembers.length;

    // Step 4: Log activity
    const activityService = new ActivityService(c.env.DB);
    await activityService.logActivity({
      userId: String(user.id),
      userName: user.displayName || String(user.id),
      userRole: user.role,
      action: ACTIVITY_ACTIONS.MEMBER_REMOVE,
      resourceType: RESOURCE_TYPES.TEAM,
      resourceId: String(teamId),
      details: {
        agentId,
        teamName,
        affectedConversationCount: affectedConversationIds.length
      }
    });

    // 🆕 Step 5: Send WebSocket notification to the removed agent
    // This triggers: 1) Toast notification 2) Conversation list refresh 3) Force close if viewing affected conversation
    await triggerAgentRemovedFromTeamNotification(c.env, {
      agentId,
      teamId,
      teamName,
      removedBy: user.displayName || String(user.id),
      affectedConversationIds
    });

    // 🆕 Step 6: Broadcast team member removed event for real-time UI updates
    await triggerTeamMemberChangeEvent(c.env, {
      type: 'removed',
      teamId,
      teamName,
      agentId,
      agentName,
      memberCount,
      changedBy: user.displayName || String(user.id)
    });

    console.log('✅ Agent removed from team with notification and broadcast:', {
      agentId,
      teamId,
      teamName,
      memberCount,
      removedBy: user.displayName,
      affectedConversationCount: affectedConversationIds.length
    });

    return c.json({
      success: true,
      message: 'Agent removed from team successfully',
      data: {
        teamName,
        affectedConversationCount: affectedConversationIds.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Remove agent from team error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove agent from team'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * 更新客服在團隊中的角色
 * PUT /api/teams/agent-teams/:agentId/role/:teamId
 * 🚀 Phase 2 RBAC: requires 'lead' role in the target team
 */
agentTeamsHandler.put('/:agentId/role/:teamId', jwtAuth, requireTeamRole('lead', 'teamId'), async (c) => {
  try {
    const user = c.get('user');
    const agentId = c.req.param('agentId');
    const teamId = parseInt(c.req.param('teamId'), 10);
    const { roleInTeam, isPrimary } = await c.req.json();

    if (isNaN(teamId)) {
      return c.json({
        success: false,
        error: 'Invalid teamId'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const service = new AgentTeamsService(c.env.DB);
    const updated = await service.updateAgentTeamRole(agentId, teamId, { roleInTeam, isPrimary });

    // Log activity
    const activityService = new ActivityService(c.env.DB);
    await activityService.logActivity({
      userId: String(user.id),
      userName: user.displayName || String(user.id),
      userRole: user.role,
      action: ACTIVITY_ACTIONS.USER_UPDATE,
      resourceType: RESOURCE_TYPES.TEAM,
      resourceId: String(teamId),
      details: {
        agentId,
        roleInTeam: updated.roleInTeam,
        isPrimary: updated.isPrimary
      }
    });

    return c.json({
      success: true,
      data: updated,
      message: 'Agent team role updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Update agent team role error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update agent team role'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * 設定主要團隊
 * PUT /api/teams/agent-teams/:agentId/primary/:teamId
 * 🚀 Phase 2 RBAC: requires 'lead' role in the target team
 */
agentTeamsHandler.put('/:agentId/primary/:teamId', jwtAuth, requireTeamRole('lead', 'teamId'), async (c) => {
  try {
    const user = c.get('user');
    const agentId = c.req.param('agentId');
    const teamId = parseInt(c.req.param('teamId'), 10);

    if (isNaN(teamId)) {
      return c.json({
        success: false,
        error: 'Invalid teamId'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const service = new AgentTeamsService(c.env.DB);
    await service.setPrimaryTeam(agentId, teamId);

    // Log activity
    const activityService = new ActivityService(c.env.DB);
    await activityService.logActivity({
      userId: String(user.id),
      userName: user.displayName || String(user.id),
      userRole: user.role,
      action: ACTIVITY_ACTIONS.USER_UPDATE,
      resourceType: RESOURCE_TYPES.USER,
      resourceId: agentId,
      details: {
        primaryTeamId: teamId
      }
    });

    return c.json({
      success: true,
      message: 'Primary team set successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Set primary team error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set primary team'
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

export default agentTeamsHandler;
