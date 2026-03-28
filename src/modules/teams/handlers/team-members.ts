// Team Member Management
// Handles: GET/POST /:id/members, POST /:id/members/batch,
// POST /:id/members/bulk-remove, PUT/DELETE /:id/members/:agentId

import { Hono } from 'hono';
import { createContextLogger } from '@/utils/logger';
const log = createContextLogger('TeamMembers');

import { TeamService } from '@modules/teams/services/team-service';
import { AgentTeamsService } from '@modules/teams/services/agent-teams-service';
import { ActivityService, ACTIVITY_ACTIONS, RESOURCE_TYPES } from '@/modules/activities';
import { triggerTeamMemberChangeEvent } from '@/utils/notification-trigger';
import { HTTP_STATUS } from '@/constants/http-status';
import type {
  TeamMemberAddRequest,
  TeamMemberUpdateRequest
} from '../types/team-types';
import type { Bindings } from '@/types';
import { globalErrorHandler } from '@/core/error-handler';
import {
  jwtAuth,
  requireTeamAccess,
  requireTeamRole
} from '@/middleware/auth';
import { requireIntId, getValidatedParam } from '@/middleware/param-validator';
import { createDbClient } from '@/db/drizzle-factory';
import { teams, agents } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { nowISO } from '@/utils/timestamp';

const app = new Hono<{ Bindings: Bindings }>();

// ==================== 3-segment routes (most specific first) ====================
// Static segment routes MUST come BEFORE dynamic parameter routes!
// Order: bulk-remove, batch -> :agentId

// Bulk remove members from team (requires 'lead' role in team)
app.post('/:id/members/bulk-remove', jwtAuth, requireTeamRole('lead'), requireIntId(), async (c) => {
  try {
    const teamId = getValidatedParam<number>(c, 'id');
    const body = await c.req.json() as { agentIds: string[] };

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
      timestamp: nowISO()
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// Batch add members to team (requires 'lead' role in team)
app.post('/:id/members/batch', jwtAuth, requireTeamRole('lead'), requireIntId(), async (c) => {
  try {
    const user = c.get('user');
    const teamId = getValidatedParam<number>(c, 'id');
    const body = await c.req.json() as {
      agentIds: string[];
      roleInTeam?: 'member' | 'lead' | 'supervisor';
    };

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

    // Batch add members (2-3 DB queries vs 6*N before)
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
        teamName: teamInfo?.name || String(teamId),
        agentIds: result.added,
        skipped: result.skipped,
        roleInTeam,
        batchOperation: true
      }
    }).catch(err => log.error('Activity log failed', {}, err as Error));

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
      )).catch(err => log.error('WebSocket broadcasts failed', {}, err as Error));
    }

    return c.json({
      success: true,
      data: {
        added: result.added,
        skipped: result.skipped,
        errors: result.errors,
        addedCount: result.added.length
      },
      timestamp: nowISO()
    }, result.added.length > 0 ? HTTP_STATUS.CREATED : HTTP_STATUS.OK);
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// Update team member (requires 'lead' role in team)
app.put('/:id/members/:agentId', jwtAuth, requireTeamRole('lead'), requireIntId(), async (c) => {
  try {
    const teamId = getValidatedParam<number>(c, 'id');
    const agentId = c.req.param('agentId');
    const body = await c.req.json() as TeamMemberUpdateRequest;

    if (!agentId?.trim()) {
      return c.json({
        success: false,
        error: 'Invalid agent ID'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const teamService = new TeamService(c.env.DB);
    const member = await teamService.updateMember(teamId, agentId, body);

    return c.json({ success: true, data: member });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// Remove member from team (requires 'lead' role in team)
app.delete('/:id/members/:agentId', jwtAuth, requireTeamRole('lead'), requireIntId(), async (c) => {
  try {
    const teamId = getValidatedParam<number>(c, 'id');
    const agentId = c.req.param('agentId');

    if (!agentId?.trim()) {
      return c.json({
        success: false,
        error: 'Invalid agent ID'
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
    return globalErrorHandler.handleError(c, error);
  }
});

// ==================== 2-segment routes ====================

// Get team members (specific team)
app.get('/:id/members', jwtAuth, requireTeamAccess('id'), requireIntId(), async (c) => {
  try {
    const teamId = getValidatedParam<number>(c, 'id');

    const teamService = new TeamService(c.env.DB);
    const members = await teamService.getMembers(teamId);

    return c.json({ success: true, data: members });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// Add member to team (requires 'lead' role in team)
app.post('/:id/members', jwtAuth, requireTeamRole('lead'), requireIntId(), async (c) => {
  try {
    const teamId = getValidatedParam<number>(c, 'id');
    const body = await c.req.json() as TeamMemberAddRequest;

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
    return globalErrorHandler.handleError(c, error);
  }
});

export default app;
