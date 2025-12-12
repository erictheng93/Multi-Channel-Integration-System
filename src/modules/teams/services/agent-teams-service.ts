// Agent Teams Service
// 客服人員多團隊業務邏輯服務
// Supports unlimited team membership for agents

import { drizzle } from 'drizzle-orm/d1';
import { eq, and, sql } from 'drizzle-orm';
import { agentTeams, agents, teams } from '@/db/schema';
import type { D1Database } from '@cloudflare/workers-types';

export interface AgentTeamMembership {
  id: number;
  agentId: string;
  teamId: number;
  roleInTeam: string;
  isPrimary: boolean;
  joinedAt: string;
  createdAt: string;
  // Joined team info
  teamName?: string;
  teamDescription?: string;
  teamIsActive?: boolean;
}

export interface TeamMemberWithTeams {
  id: string;
  email: string;
  displayName: string;
  role: string;
  isActive: boolean;
  teams: AgentTeamMembership[];
  primaryTeamId?: number;
}

export interface AddToTeamRequest {
  agentId: string;
  teamId: number;
  roleInTeam?: string;
  isPrimary?: boolean;
}

export interface UpdateTeamRoleRequest {
  roleInTeam?: string;
  isPrimary?: boolean;
}

export interface BulkAddResult {
  added: number[];
  skipped: number[];
  errors: { teamId: number; error: string }[];
}

export class AgentTeamsService {
  private db: ReturnType<typeof drizzle>;

  constructor(database: D1Database) {
    this.db = drizzle(database);
  }

  /**
   * 獲取客服所屬的所有團隊
   */
  async getAgentTeams(agentId: string): Promise<AgentTeamMembership[]> {
    const memberships = await this.db
      .select({
        id: agentTeams.id,
        agentId: agentTeams.agentId,
        teamId: agentTeams.teamId,
        roleInTeam: agentTeams.roleInTeam,
        isPrimary: agentTeams.isPrimary,
        joinedAt: agentTeams.joinedAt,
        createdAt: agentTeams.createdAt,
        teamName: teams.name,
        teamDescription: teams.description,
        teamIsActive: teams.isActive
      })
      .from(agentTeams)
      .leftJoin(teams, eq(agentTeams.teamId, teams.id))
      .where(eq(agentTeams.agentId, agentId));

    return memberships.map(m => ({
      id: m.id,
      agentId: m.agentId,
      teamId: m.teamId,
      roleInTeam: m.roleInTeam || 'member',
      isPrimary: !!m.isPrimary,
      joinedAt: m.joinedAt || '',
      createdAt: m.createdAt || '',
      teamName: m.teamName || undefined,
      teamDescription: m.teamDescription || undefined,
      teamIsActive: m.teamIsActive ?? true
    }));
  }

  /**
   * 獲取特定的團隊成員關係
   */
  async getAgentTeamMembership(agentId: string, teamId: number): Promise<AgentTeamMembership | null> {
    const [membership] = await this.db
      .select({
        id: agentTeams.id,
        agentId: agentTeams.agentId,
        teamId: agentTeams.teamId,
        roleInTeam: agentTeams.roleInTeam,
        isPrimary: agentTeams.isPrimary,
        joinedAt: agentTeams.joinedAt,
        createdAt: agentTeams.createdAt
      })
      .from(agentTeams)
      .where(and(
        eq(agentTeams.agentId, agentId),
        eq(agentTeams.teamId, teamId)
      ))
      .limit(1);

    if (!membership) return null;

    return {
      id: membership.id,
      agentId: membership.agentId,
      teamId: membership.teamId,
      roleInTeam: membership.roleInTeam || 'member',
      isPrimary: !!membership.isPrimary,
      joinedAt: membership.joinedAt || '',
      createdAt: membership.createdAt || ''
    };
  }

  /**
   * 將客服加入團隊
   */
  async addAgentToTeam(data: AddToTeamRequest): Promise<AgentTeamMembership> {
    const now = new Date().toISOString();

    // If this is set as primary, first unset any existing primary team
    if (data.isPrimary) {
      await this.db
        .update(agentTeams)
        .set({ isPrimary: false })
        .where(eq(agentTeams.agentId, data.agentId));
    }

    const [membership] = await this.db
      .insert(agentTeams)
      .values({
        agentId: data.agentId,
        teamId: data.teamId,
        roleInTeam: data.roleInTeam || 'member',
        isPrimary: data.isPrimary || false,
        joinedAt: now,
        createdAt: now
      })
      .returning();

    // Also update agents.teamId for backward compatibility (set to primary team)
    if (data.isPrimary) {
      await this.db
        .update(agents)
        .set({ teamId: data.teamId })
        .where(eq(agents.id, data.agentId));
    }

    return {
      id: membership.id,
      agentId: membership.agentId,
      teamId: membership.teamId,
      roleInTeam: membership.roleInTeam || 'member',
      isPrimary: !!membership.isPrimary,
      joinedAt: membership.joinedAt || now,
      createdAt: membership.createdAt || now
    };
  }

  /**
   * 將客服加入多個團隊
   */
  async addAgentToMultipleTeams(
    agentId: string,
    teamIds: number[],
    roleInTeam: string = 'member'
  ): Promise<BulkAddResult> {
    const result: BulkAddResult = {
      added: [],
      skipped: [],
      errors: []
    };

    const now = new Date().toISOString();

    for (const teamId of teamIds) {
      try {
        // Check if already a member
        const existing = await this.getAgentTeamMembership(agentId, teamId);
        if (existing) {
          result.skipped.push(teamId);
          continue;
        }

        // Add to team
        await this.db
          .insert(agentTeams)
          .values({
            agentId,
            teamId,
            roleInTeam,
            isPrimary: false,
            joinedAt: now,
            createdAt: now
          });

        result.added.push(teamId);
      } catch (error) {
        result.errors.push({
          teamId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return result;
  }

  /**
   * 從團隊移除客服
   */
  async removeAgentFromTeam(agentId: string, teamId: number): Promise<void> {
    // Check if this is the primary team
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

    // If this was the primary team, clear agents.teamId
    if (membership?.isPrimary) {
      await this.db
        .update(agents)
        .set({ teamId: null })
        .where(eq(agents.id, agentId));

      // Try to set another team as primary
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

        // Update agents.teamId for backward compatibility
        await this.db
          .update(agents)
          .set({ teamId: nextTeam.teamId })
          .where(eq(agents.id, agentId));
      }
    }
  }

  /**
   * 更新客服在團隊中的角色
   */
  async updateAgentTeamRole(
    agentId: string,
    teamId: number,
    data: UpdateTeamRoleRequest
  ): Promise<AgentTeamMembership> {
    const updateData: any = {};

    if (data.roleInTeam !== undefined) {
      updateData.roleInTeam = data.roleInTeam;
    }

    if (data.isPrimary !== undefined) {
      updateData.isPrimary = data.isPrimary;

      // If setting as primary, unset other teams first
      if (data.isPrimary) {
        await this.db
          .update(agentTeams)
          .set({ isPrimary: false })
          .where(eq(agentTeams.agentId, agentId));

        // Update agents.teamId for backward compatibility
        await this.db
          .update(agents)
          .set({ teamId })
          .where(eq(agents.id, agentId));
      }
    }

    const [updated] = await this.db
      .update(agentTeams)
      .set(updateData)
      .where(and(
        eq(agentTeams.agentId, agentId),
        eq(agentTeams.teamId, teamId)
      ))
      .returning();

    if (!updated) {
      throw new Error('Membership not found');
    }

    return {
      id: updated.id,
      agentId: updated.agentId,
      teamId: updated.teamId,
      roleInTeam: updated.roleInTeam || 'member',
      isPrimary: !!updated.isPrimary,
      joinedAt: updated.joinedAt || '',
      createdAt: updated.createdAt || ''
    };
  }

  /**
   * 設定主要團隊
   */
  async setPrimaryTeam(agentId: string, teamId: number): Promise<void> {
    // Check if membership exists
    const membership = await this.getAgentTeamMembership(agentId, teamId);
    if (!membership) {
      throw new Error('Agent is not a member of this team');
    }

    // Unset all other primary flags
    await this.db
      .update(agentTeams)
      .set({ isPrimary: false })
      .where(eq(agentTeams.agentId, agentId));

    // Set this team as primary
    await this.db
      .update(agentTeams)
      .set({ isPrimary: true })
      .where(and(
        eq(agentTeams.agentId, agentId),
        eq(agentTeams.teamId, teamId)
      ));

    // Update agents.teamId for backward compatibility
    await this.db
      .update(agents)
      .set({ teamId })
      .where(eq(agents.id, agentId));
  }

  /**
   * 獲取團隊的所有成員（包含多團隊資訊）
   */
  async getTeamMembers(teamId: number): Promise<TeamMemberWithTeams[]> {
    // Get all members of this team
    const memberships = await this.db
      .select({
        membershipId: agentTeams.id,
        agentId: agentTeams.agentId,
        roleInTeam: agentTeams.roleInTeam,
        isPrimary: agentTeams.isPrimary,
        joinedAt: agentTeams.joinedAt,
        // Agent info
        email: agents.email,
        displayName: agents.displayName,
        role: agents.role,
        isActive: agents.isActive
      })
      .from(agentTeams)
      .leftJoin(agents, eq(agentTeams.agentId, agents.id))
      .where(eq(agentTeams.teamId, teamId));

    // Get all teams for each member
    const memberMap = new Map<string, TeamMemberWithTeams>();

    for (const m of memberships) {
      if (!m.agentId) continue;

      if (!memberMap.has(m.agentId)) {
        // Get all teams for this agent
        const allTeams = await this.getAgentTeams(m.agentId);
        const primaryTeam = allTeams.find(t => t.isPrimary);

        memberMap.set(m.agentId, {
          id: m.agentId,
          email: m.email || '',
          displayName: m.displayName || '',
          role: m.role || 'agent',
          isActive: m.isActive ?? true,
          teams: allTeams,
          primaryTeamId: primaryTeam?.teamId
        });
      }
    }

    return Array.from(memberMap.values());
  }

  /**
   * 獲取所有客服的團隊資訊（批量查詢）
   */
  async getAllAgentsWithTeams(): Promise<Map<string, AgentTeamMembership[]>> {
    const allMemberships = await this.db
      .select({
        id: agentTeams.id,
        agentId: agentTeams.agentId,
        teamId: agentTeams.teamId,
        roleInTeam: agentTeams.roleInTeam,
        isPrimary: agentTeams.isPrimary,
        joinedAt: agentTeams.joinedAt,
        createdAt: agentTeams.createdAt,
        teamName: teams.name,
        teamDescription: teams.description,
        teamIsActive: teams.isActive
      })
      .from(agentTeams)
      .leftJoin(teams, eq(agentTeams.teamId, teams.id));

    const result = new Map<string, AgentTeamMembership[]>();

    for (const m of allMemberships) {
      const membership: AgentTeamMembership = {
        id: m.id,
        agentId: m.agentId,
        teamId: m.teamId,
        roleInTeam: m.roleInTeam || 'member',
        isPrimary: !!m.isPrimary,
        joinedAt: m.joinedAt || '',
        createdAt: m.createdAt || '',
        teamName: m.teamName || undefined,
        teamDescription: m.teamDescription || undefined,
        teamIsActive: m.teamIsActive ?? true
      };

      if (!result.has(m.agentId)) {
        result.set(m.agentId, []);
      }
      result.get(m.agentId)!.push(membership);
    }

    return result;
  }

  /**
   * 獲取團隊成員數量
   */
  async getTeamMemberCount(teamId: number): Promise<number> {
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(agentTeams)
      .where(eq(agentTeams.teamId, teamId));

    return Number(count);
  }
}
