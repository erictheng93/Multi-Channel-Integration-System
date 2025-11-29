// Team Service
// 團隊服務層

import { createDbClient } from '@/db/drizzle-factory';
import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, desc, and, count, or, like, sql, inArray } from 'drizzle-orm';
import { teams, agents, conversations, messages } from '@/db/schema';
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
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

    // Get member count
    const memberCountResult = await this.db
      .select({ memberCount: count() })
      .from(agents)
      .where(eq(agents.teamId, id));
    const memberCount = memberCountResult[0]?.memberCount || 0;

    // Get active members count
    const activeMembersResult = await this.db
      .select({ activeMembers: count() })
      .from(agents)
      .where(and(eq(agents.teamId, id), eq(agents.isActive, true)));
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
      updatedAt: new Date().toISOString()
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

  // Delete team (soft delete - marks as inactive)
  async deleteTeam(id: number): Promise<boolean> {
    try {
      // Soft delete: mark team as inactive instead of deleting
      await this.db
        .update(teams)
        .set({
          isActive: false,
          updatedAt: new Date().toISOString()
        })
        .where(eq(teams.id, id));

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
    const teamList = await this.db
      .select({
        team: teams,
        memberCount: sql<number>`COALESCE(COUNT(DISTINCT ${agents.id}), 0)`,
        activeMembers: sql<number>`COALESCE(SUM(CASE WHEN ${agents.isActive} = 1 THEN 1 ELSE 0 END), 0)`,
        conversationCount: sql<number>`COALESCE(COUNT(DISTINCT ${conversations.id}), 0)`
      })
      .from(teams)
      .leftJoin(agents, eq(teams.id, agents.teamId))
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

  // Add member to team
  async addMember(teamId: number, request: TeamMemberAddRequest): Promise<TeamMember> {
    await this.db
      .update(agents)
      .set({
        teamId,
        updatedAt: new Date().toISOString()
      })
      .where(eq(agents.id, request.agentId));

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
      name: agent.displayName, // ✅ Map displayName to name
      displayName: agent.displayName,
      loginId: agent.email || agent.id, // ✅ Add loginId
      email: agent.email,
      role: agent.role,
      status: agent.isActive ? 'active' : 'inactive', // ✅ Add status
      isActive: agent.isActive,
      lastActive: agent.lastActive,
      joinedAt: agent.updatedAt,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt || agent.createdAt
    };
  }

  // Remove member from team
  async removeMember(teamId: number, agentId: string): Promise<boolean> {
    try {
      await this.db
        .update(agents)
        .set({
          teamId: null,
          updatedAt: new Date().toISOString()
        })
        .where(and(eq(agents.id, agentId), eq(agents.teamId, teamId)));

      return true;
    } catch (error) {
      console.error('Remove team member error:', error);
      return false;
    }
  }

  // Update team member
  async updateMember(teamId: number, agentId: string, request: TeamMemberUpdateRequest): Promise<TeamMember> {
    const updateData: any = {
      updatedAt: new Date().toISOString()
    };

    if (request.role) updateData.role = request.role;
    if (typeof request.isActive === 'boolean') updateData.isActive = request.isActive;

    await this.db
      .update(agents)
      .set(updateData)
      .where(and(eq(agents.id, agentId), eq(agents.teamId, teamId)));

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
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt || agent.createdAt
    };
  }

  // Get team members
  async getMembers(teamId: number): Promise<TeamMember[]> {
    const members = await this.db
      .select()
      .from(agents)
      .where(eq(agents.teamId, teamId))
      .orderBy(agents.displayName);

    return members.map(agent => ({
      id: agent.id,
      name: agent.displayName, // ✅ Map displayName to name for frontend compatibility
      displayName: agent.displayName, // Keep for backward compatibility
      loginId: agent.email || agent.id, // ✅ Add loginId field (fallback to id if no email)
      email: agent.email,
      role: agent.role,
      status: agent.isActive ? 'active' : 'inactive', // ✅ Add status field for frontend
      isActive: agent.isActive,
      lastActive: agent.lastActive,
      joinedAt: agent.createdAt,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt || agent.createdAt
    }));
  }

  // Generate QR Code
  async generateQRCode(teamId: number): Promise<TeamQRCodeResponse> {
    const qrCode = crypto.randomUUID(); // Simple QR code generation

    await this.db
      .update(teams)
      .set({
        qrCode,
        updatedAt: new Date().toISOString()
      })
      .where(eq(teams.id, teamId));

    return {
      teamId,
      qrCode,
      generatedAt: new Date().toISOString(),
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
      generatedAt: team.updatedAt || new Date().toISOString(),
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
        to: params?.dateTo || new Date().toISOString()
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

  // Transfer members between teams
  // ✅ 優化版本：使用 inArray 批量更新（單條 SQL 語句）
  async transferMembers(request: TeamTransferRequest): Promise<TeamTransferResponse> {
    try {
      // 先驗證哪些 agents 屬於來源團隊
      const validAgents = await this.db
        .select({ id: agents.id })
        .from(agents)
        .where(
          and(
            inArray(agents.id, request.agentIds),
            eq(agents.teamId, request.fromTeamId)
          )
        );

      const validAgentIds = validAgents.map(a => a.id);
      const invalidAgentIds = request.agentIds.filter(id => !validAgentIds.includes(id));

      // 批量更新有效的 agents
      if (validAgentIds.length > 0) {
        await this.db
          .update(agents)
          .set({
            teamId: request.toTeamId,
            updatedAt: new Date().toISOString()
          })
          .where(inArray(agents.id, validAgentIds));

        console.log(`📦 [Team Transfer] Transferred ${validAgentIds.length} agents using batch update`);
      }

      // 構建失敗列表（不屬於來源團隊的 agents）
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
      // 如果批量操作失敗，所有都標記為失敗
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