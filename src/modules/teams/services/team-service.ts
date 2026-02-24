// Team Service
// 團隊服務層

import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, desc, and, count, or, like, sql, inArray } from 'drizzle-orm';
import { teams, agents, agentTeams, conversations, messages, qrCodes, qrCodeScans, customers } from '@/db/schema';
import type {
  Team,
  NewTeam,
  TeamWithStats,
  TeamListRequest,
  TeamListResponse,
  TeamCreateRequest,
  TeamUpdateRequest,
  TeamServiceInterface,
  TeamStats,
  TeamStatsRequest,
  TeamMember,
  TeamMemberAddRequest,
  TeamMemberUpdateRequest,
  TeamQRCodeResponse,
  TeamTransferRequest,
  TeamTransferResponse
} from '../types/team-types';
import { nowISO } from '@/utils/timestamp'

export class TeamService implements TeamServiceInterface {
  private db: DrizzleD1Database;

  constructor(database: D1Database) {
    this.db = drizzle(database);
  }

  // Create new team
  async createTeam(data: TeamCreateRequest): Promise<Team> {
    // Check for duplicate QR code if provided
    if (data.qrCode) {
      const existingTeam = await this.db
        .select()
        .from(teams)
        .where(eq(teams.qrCode, data.qrCode))
        .limit(1);

      if (existingTeam.length > 0) {
        throw new Error('DUPLICATE_QR_CODE');
      }
    }

    const teamData: NewTeam = {
      name: data.name,
      description: data.description || null,
      qrCode: data.qrCode || null,
      isActive: data.isActive ?? true,
      createdAt: nowISO(),
      updatedAt: nowISO()
    };

    await this.db.insert(teams).values(teamData);

    // Get the created team (SQLite returns lastInsertRowId)
    const result = await this.db
      .select()
      .from(teams)
      .where(eq(teams.name, teamData.name))
      .orderBy(desc(teams.createdAt))
      .limit(1);

    const team = result[0];
    if (!team) {
      throw new Error('Failed to create team');
    }

    return team;
  }

  // Get team by ID with stats
  async getTeam(id: number): Promise<TeamWithStats | null> {
    const [team] = await this.db
      .select()
      .from(teams)
      .where(eq(teams.id, id))
      .limit(1);

    if (!team) return null;

    // 🔧 Fix: Get member count from agent_teams table (supports multi-team architecture)
    // Exclude soft-deleted agents (deletedAt IS NULL)
    const memberCountResult = await this.db
      .select({ memberCount: count() })
      .from(agentTeams)
      .innerJoin(agents, eq(agentTeams.agentId, agents.id))
      .where(and(eq(agentTeams.teamId, id), sql`${agents.deletedAt} IS NULL`));
    const memberCount = memberCountResult[0]?.memberCount || 0;

    // 🔧 Fix: Get active members count via agent_teams join
    // Exclude soft-deleted agents (deletedAt IS NULL)
    const activeMembersResult = await this.db
      .select({ activeMembers: count() })
      .from(agentTeams)
      .innerJoin(agents, eq(agentTeams.agentId, agents.id))
      .where(and(eq(agentTeams.teamId, id), eq(agents.isActive, true), sql`${agents.deletedAt} IS NULL`));
    const activeMembers = activeMembersResult[0]?.activeMembers || 0;

    // Get conversation count
    const conversationCountResult = await this.db
      .select({ conversationCount: count() })
      .from(conversations)
      .where(eq(conversations.assignedTeamId, id));
    const conversationCount = conversationCountResult[0]?.conversationCount || 0;

    return {
      ...team,
      memberCount,
      activeMembers,
      conversationCount,
      qrCodeScans: 0 // Would need QR scan tracking table
    };
  }

  // Update team
  async updateTeam(id: number, data: TeamUpdateRequest): Promise<Team> {
    const updateData = {
      ...data,
      updatedAt: nowISO()
    };

    await this.db
      .update(teams)
      .set(updateData)
      .where(eq(teams.id, id));

    const result = await this.db
      .select()
      .from(teams)
      .where(eq(teams.id, id))
      .limit(1);

    if (!result[0]) {
      throw new Error('Team not found after update');
    }

    return result[0];
  }

  // Delete team (hard delete - permanently removes from database)
  async deleteTeam(id: number): Promise<boolean> {
    try {
      // Step 1: Remove team memberships from agent_teams
      // (agent_teams has ON DELETE CASCADE on teamId, but we do it explicitly for clarity)
      await this.db
        .delete(agentTeams)
        .where(eq(agentTeams.teamId, id));

      // Step 2: Delete associated QR codes
      // Note: qr_code_scans has FK to qr_codes, need to handle carefully
      const teamQRCodes = await this.db
        .select({ id: qrCodes.id })
        .from(qrCodes)
        .where(eq(qrCodes.teamId, id));

      if (teamQRCodes.length > 0) {
        const qrCodeIds = teamQRCodes.map(qr => qr.id);
        // Delete scans first (FK constraint)
        await this.db
          .delete(qrCodeScans)
          .where(inArray(qrCodeScans.qrCodeId, qrCodeIds));
        // Then delete QR codes
        await this.db
          .delete(qrCodes)
          .where(eq(qrCodes.teamId, id));
      }

      // Step 3: Update conversations to remove team assignment
      await this.db
        .update(conversations)
        .set({
          assignedTeamId: null,
          updatedAt: nowISO()
        })
        .where(eq(conversations.assignedTeamId, id));

      // Step 4: Update customers to remove source team
      await this.db
        .update(customers)
        .set({
          sourceTeamId: null,
          updatedAt: nowISO()
        })
        .where(eq(customers.sourceTeamId, id));

      // Step 5: Hard delete the team (agent_teams will cascade automatically)
      await this.db
        .delete(teams)
        .where(eq(teams.id, id));

      console.log(`🗑️ [Team Delete] Team ${id} permanently deleted with all associations cleaned up`);
      return true;
    } catch (error) {
      console.error('Delete team error:', error);
      return false;
    }
  }


  // List teams with pagination
  async listTeams(params: TeamListRequest): Promise<TeamListResponse> {
    const {
      page = 1,
      limit = 20,
      includeInactive = false,
      search
    } = params;

    const offset = (page - 1) * Math.min(limit, 100);
    const actualLimit = Math.min(limit, 100);

    // Build where conditions
    const whereConditions = [];
    if (!includeInactive) {
      whereConditions.push(eq(teams.isActive, true));
    }
    if (search) {
      whereConditions.push(
        or(
          like(teams.name, `%${search}%`),
          like(teams.description, `%${search}%`)
        )
      );
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Optimized: Get teams with all stats in a single query
    // 🔧 Fix: Use agent_teams table for member count (supports multi-team architecture)
    const teamList = await this.db
      .select({
        team: teams,
        memberCount: sql<number>`COALESCE(COUNT(DISTINCT CASE WHEN ${agents.deletedAt} IS NULL THEN ${agentTeams.agentId} END), 0)`,
        activeMembers: sql<number>`COALESCE(COUNT(DISTINCT CASE WHEN ${agents.isActive} = 1 AND ${agents.deletedAt} IS NULL THEN ${agentTeams.agentId} END), 0)`,
        conversationCount: sql<number>`COALESCE(COUNT(DISTINCT ${conversations.id}), 0)`
      })
      .from(teams)
      .leftJoin(agentTeams, eq(teams.id, agentTeams.teamId))
      .leftJoin(agents, eq(agentTeams.agentId, agents.id))
      .leftJoin(conversations, eq(teams.id, conversations.assignedTeamId))
      .where(whereClause)
      .groupBy(teams.id)
      .orderBy(desc(teams.createdAt))
      .limit(actualLimit)
      .offset(offset);

    // Get total count
    const totalResult = await this.db
      .select({ total: count() })
      .from(teams)
      .where(whereClause);
    const total = totalResult[0]?.total || 0;

    // No more N+1 queries! Map directly without async
    const teamsWithStats: TeamWithStats[] = teamList.map((row) => ({
      ...row.team,
      memberCount: row.memberCount,
      activeMembers: row.activeMembers,
      conversationCount: row.conversationCount,
      qrCodeScans: 0
    }));

    return {
      teams: teamsWithStats,
      pagination: {
        page,
        limit: actualLimit,
        total,
        totalPages: Math.ceil(total / actualLimit)
      }
    };
  }

  // Search teams
  async searchTeams(query: string): Promise<Team[]> {
    return this.db
      .select()
      .from(teams)
      .where(
        and(
          eq(teams.isActive, true),
          or(
            like(teams.name, `%${query}%`),
            like(teams.description, `%${query}%`)
          )
        )
      )
      .limit(20);
  }

  // Add member to team (via agent_teams junction table)
  async addMember(teamId: number, request: TeamMemberAddRequest): Promise<TeamMember> {
    const now = nowISO();

    // Check if membership already exists
    const [existing] = await this.db
      .select({ id: agentTeams.id })
      .from(agentTeams)
      .where(and(
        eq(agentTeams.agentId, request.agentId),
        eq(agentTeams.teamId, teamId)
      ))
      .limit(1);

    if (!existing) {
      // Check if agent has any teams — if not, this becomes primary
      const [existingTeam] = await this.db
        .select({ id: agentTeams.id })
        .from(agentTeams)
        .where(eq(agentTeams.agentId, request.agentId))
        .limit(1);

      const isPrimary = !existingTeam;

      await this.db
        .insert(agentTeams)
        .values({
          agentId: request.agentId,
          teamId,
          roleInTeam: 'member',
          isPrimary,
          joinedAt: now,
          createdAt: now
        });
    }

    const result = await this.db
      .select()
      .from(agents)
      .where(eq(agents.id, request.agentId))
      .limit(1);

    const agent = result[0];
    if (!agent) {
      throw new Error('Agent not found after adding to team');
    }

    return {
      id: agent.id,
      name: agent.displayName,
      displayName: agent.displayName,
      loginId: agent.email || agent.id,
      email: agent.email,
      role: agent.role,
      status: agent.isActive ? 'active' : 'inactive',
      isActive: agent.isActive,
      lastActive: agent.lastActive,
      joinedAt: now,
      createdAt: agent.createdAt ?? undefined,
      updatedAt: (agent.updatedAt || agent.createdAt) ?? undefined
    };
  }

  // Remove member from team (via agent_teams junction table)
  async removeMember(teamId: number, agentId: string): Promise<boolean> {
    try {
      // Check if this is the agent's primary team
      const [membership] = await this.db
        .select({ isPrimary: agentTeams.isPrimary })
        .from(agentTeams)
        .where(and(
          eq(agentTeams.agentId, agentId),
          eq(agentTeams.teamId, teamId)
        ))
        .limit(1);

      // Delete the membership
      await this.db
        .delete(agentTeams)
        .where(and(
          eq(agentTeams.agentId, agentId),
          eq(agentTeams.teamId, teamId)
        ));

      // If this was the primary team, promote next team as primary
      if (membership?.isPrimary) {
        const [nextTeam] = await this.db
          .select({ teamId: agentTeams.teamId })
          .from(agentTeams)
          .where(eq(agentTeams.agentId, agentId))
          .limit(1);

        if (nextTeam) {
          await this.db
            .update(agentTeams)
            .set({ isPrimary: true })
            .where(and(
              eq(agentTeams.agentId, agentId),
              eq(agentTeams.teamId, nextTeam.teamId)
            ));
        }
      }

      return true;
    } catch (error) {
      console.error('Remove team member error:', error);
      return false;
    }
  }

  // 🆕 Bulk remove members from team (via agent_teams junction table)
  async bulkRemoveMembers(teamId: number, agentIds: string[]): Promise<{
    removed: string[];
    failed: { agentId: string; error: string }[];
  }> {
    const removed: string[] = [];
    const failed: { agentId: string; error: string }[] = [];

    if (agentIds.length === 0) {
      return { removed, failed };
    }

    // Limit to 50 members per batch
    const idsToProcess = agentIds.slice(0, 50);

    try {
      // Verify which agents belong to this team via agent_teams
      const validMemberships = await this.db
        .select({ agentId: agentTeams.agentId })
        .from(agentTeams)
        .where(
          and(
            inArray(agentTeams.agentId, idsToProcess),
            eq(agentTeams.teamId, teamId)
          )
        );

      const validAgentIds = validMemberships.map(m => m.agentId);
      const invalidAgentIds = idsToProcess.filter(id => !validAgentIds.includes(id));

      // Mark invalid agents as failed
      invalidAgentIds.forEach(agentId => {
        failed.push({
          agentId,
          error: `Agent not found in team (teamId: ${teamId})`
        });
      });

      // Batch delete from agent_teams
      if (validAgentIds.length > 0) {
        await this.db
          .delete(agentTeams)
          .where(and(
            inArray(agentTeams.agentId, validAgentIds),
            eq(agentTeams.teamId, teamId)
          ));

        removed.push(...validAgentIds);
        console.log(`📦 [Team Bulk Remove] Removed ${validAgentIds.length} members from team ${teamId}`);
      }

      return { removed, failed };
    } catch (error) {
      console.error('Bulk remove team members error:', error);
      // If batch operation fails, mark all as failed
      idsToProcess.forEach(agentId => {
        if (!removed.includes(agentId)) {
          failed.push({
            agentId,
            error: `Removal failed: ${error instanceof Error ? error.message : String(error)}`
          });
        }
      });
      return { removed, failed };
    }
  }

  // Update team member
  async updateMember(_teamId: number, agentId: string, request: TeamMemberUpdateRequest): Promise<TeamMember> {
    const updateData: any = {
      updatedAt: nowISO()
    };

    if (request.role) updateData.role = request.role;
    if (typeof request.isActive === 'boolean') updateData.isActive = request.isActive;

    await this.db
      .update(agents)
      .set(updateData)
      .where(eq(agents.id, agentId));

    const result = await this.db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    const agent = result[0];
    if (!agent) {
      throw new Error('Agent not found after update');
    }

    return {
      id: agent.id,
      name: agent.displayName, // ✅ Map displayName to name
      displayName: agent.displayName,
      loginId: agent.email || agent.id, // ✅ Add loginId
      email: agent.email,
      role: agent.role,
      status: agent.isActive ? 'active' : 'inactive', // ✅ Add status
      isActive: agent.isActive,
      lastActive: agent.lastActive,
      joinedAt: agent.createdAt,
      createdAt: agent.createdAt ?? undefined,
      updatedAt: (agent.updatedAt || agent.createdAt) ?? undefined
    };
  }

  // Get team members
  // 🔧 Fix: Use agent_teams table to get members (supports multi-team architecture)
  async getMembers(teamId: number): Promise<TeamMember[]> {
    const memberships = await this.db
      .select({
        agent: agents,
        roleInTeam: agentTeams.roleInTeam,
        joinedAt: agentTeams.joinedAt
      })
      .from(agentTeams)
      .innerJoin(agents, eq(agentTeams.agentId, agents.id))
      .where(eq(agentTeams.teamId, teamId))
      .orderBy(agents.displayName);

    return memberships.map(({ agent, roleInTeam, joinedAt }) => ({
      id: agent.id,
      name: agent.displayName, // ✅ Map displayName to name for frontend compatibility
      displayName: agent.displayName, // Keep for backward compatibility
      loginId: agent.email || agent.id, // ✅ Add loginId field (fallback to id if no email)
      email: agent.email,
      role: agent.role,
      roleInTeam: roleInTeam || 'member', // 🆕 Include team-specific role
      status: agent.isActive ? 'active' : 'inactive', // ✅ Add status field for frontend
      isActive: agent.isActive,
      lastActive: agent.lastActive,
      joinedAt: joinedAt || agent.createdAt,
      createdAt: agent.createdAt ?? undefined,
      updatedAt: (agent.updatedAt || agent.createdAt) ?? undefined
    }));
  }

  // Generate QR Code
  async generateQRCode(teamId: number): Promise<TeamQRCodeResponse> {
    const qrCode = crypto.randomUUID(); // Simple QR code generation

    await this.db
      .update(teams)
      .set({
        qrCode,
        updatedAt: nowISO()
      })
      .where(eq(teams.id, teamId));

    return {
      teamId,
      qrCode,
      generatedAt: nowISO(),
      scanCount: 0
    };
  }

  // Get QR Code
  async getQRCode(teamId: number): Promise<TeamQRCodeResponse | null> {
    const [team] = await this.db
      .select({ qrCode: teams.qrCode, updatedAt: teams.updatedAt })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team || !team.qrCode) return null;

    return {
      teamId,
      qrCode: team.qrCode,
      generatedAt: team.updatedAt || nowISO(),
      scanCount: 0
    };
  }

  // Get team statistics
  async getTeamStats(teamId: number, params?: TeamStatsRequest): Promise<TeamStats> {
    const team = await this.getTeam(teamId);
    if (!team) throw new Error('Team not found');

    // Get message counts
    const messagesCountResult = await this.db
      .select({ messagesCount: count() })
      .from(messages)
      .leftJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(eq(conversations.assignedTeamId, teamId));
    const messagesCount = messagesCountResult[0]?.messagesCount || 0;

    return {
      teamId,
      teamName: team.name,
      totalMembers: team.memberCount || 0,
      activeMembers: team.activeMembers || 0,
      conversationsHandled: team.conversationCount || 0,
      messagesCount,
      avgResponseTime: 0, // Would need message timing analysis
      qrCodeScans: 0,
      period: {
        from: params?.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        to: params?.dateTo || nowISO()
      }
    };
  }

  // Get all teams statistics
  async getAllTeamsStats(params?: TeamStatsRequest): Promise<TeamStats[]> {
    const { teams: teamList } = await this.listTeams({ includeInactive: false });

    return Promise.all(
      teamList.map(team => this.getTeamStats(team.id, params))
    );
  }

  // Transfer members between teams (via agent_teams junction table)
  async transferMembers(request: TeamTransferRequest): Promise<TeamTransferResponse> {
    try {
      const now = nowISO();

      // Verify which agents belong to the source team via agent_teams
      const validMemberships = await this.db
        .select({ agentId: agentTeams.agentId, isPrimary: agentTeams.isPrimary })
        .from(agentTeams)
        .where(
          and(
            inArray(agentTeams.agentId, request.agentIds),
            eq(agentTeams.teamId, request.fromTeamId)
          )
        );

      const validAgentIds = validMemberships.map(m => m.agentId);
      const invalidAgentIds = request.agentIds.filter(id => !validAgentIds.includes(id));

      // Transfer: delete old memberships, insert new ones
      if (validAgentIds.length > 0) {
        // Track which were primary in the old team
        const primaryAgentIds = new Set(
          validMemberships.filter(m => m.isPrimary).map(m => m.agentId)
        );

        // Delete old team memberships
        await this.db
          .delete(agentTeams)
          .where(and(
            inArray(agentTeams.agentId, validAgentIds),
            eq(agentTeams.teamId, request.fromTeamId)
          ));

        // Insert new team memberships (preserve isPrimary status)
        const newMemberships = validAgentIds.map(agentId => ({
          agentId,
          teamId: request.toTeamId,
          roleInTeam: 'member' as const,
          isPrimary: primaryAgentIds.has(agentId),
          joinedAt: now,
          createdAt: now
        }));

        await this.db
          .insert(agentTeams)
          .values(newMemberships);

        console.log(`📦 [Team Transfer] Transferred ${validAgentIds.length} agents via agent_teams`);
      }

      const failedTransfers = invalidAgentIds.map(agentId => ({
        agentId,
        reason: `Agent not found in source team (teamId: ${request.fromTeamId})`
      }));

      return {
        success: failedTransfers.length === 0,
        transferredAgents: validAgentIds,
        failedTransfers
      };
    } catch (error) {
      console.error('Transfer members error:', error);
      return {
        success: false,
        transferredAgents: [],
        failedTransfers: request.agentIds.map(agentId => ({
          agentId,
          reason: `Transfer failed: ${error instanceof Error ? error.message : String(error)}`
        }))
      };
    }
  }
}