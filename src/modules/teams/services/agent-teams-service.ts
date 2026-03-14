// Agent Teams Service
// 客服人員多團隊業務邏輯服務
// Supports unlimited team membership for agents

import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { agentTeams, agents, teams } from '@/db/schema';
import type { D1Database } from '@cloudflare/workers-types';
import { nowISO } from '@/utils/timestamp'

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

/**
 * Phase 2 優化: 批量將多位成員加入單一團隊的結果
 * - 一次 API 請求處理多位成員
 * - DB 查詢從 30 次減少到 2-3 次
 */
export interface BatchAddMembersResult {
  added: string[]; // 成功加入的 agentId 列表
  skipped: string[]; // 已存在於團隊的 agentId 列表
  errors: { agentId: string; error: string }[];  // 失敗的記錄
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
    const now = nowISO();

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
   * Phase 3 優化: 使用批量 DB 操作
   * - 單次查詢檢查所有現有成員資格 (N 查詢 → 1 查詢)
   * - 批量插入所有新成員資格 (N 插入 → 1 插入)
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

    if (teamIds.length === 0) {
      return result;
    }

    const now = nowISO();

    try {
      // Phase 3.1: 批量查詢現有成員資格 (N 查詢 → 1 查詢)
      const existingMemberships = await this.db
        .select({ teamId: agentTeams.teamId })
        .from(agentTeams)
        .where(and(
          eq(agentTeams.agentId, agentId),
          inArray(agentTeams.teamId, teamIds)
        ));

      const existingTeamIds = new Set(existingMemberships.map(m => m.teamId));

      // 分類：已存在 vs 需要新增
      const teamsToAdd: number[] = [];
      for (const teamId of teamIds) {
        if (existingTeamIds.has(teamId)) {
          result.skipped.push(teamId);
        } else {
          teamsToAdd.push(teamId);
        }
      }

      // Phase 3.2: 批量插入新成員資格 (N 插入 → 1 插入)
      if (teamsToAdd.length > 0) {
        const valuesToInsert = teamsToAdd.map(teamId => ({
          agentId,
          teamId,
          roleInTeam,
          isPrimary: false,
          joinedAt: now,
          createdAt: now
        }));

        await this.db
          .insert(agentTeams)
          .values(valuesToInsert);

        result.added = teamsToAdd;
      }

      console.log('[AgentTeamsService] Bulk add completed:', {
        agentId,
        requested: teamIds.length,
        added: result.added.length,
        skipped: result.skipped.length,
        dbQueries: 2 // 1 SELECT + 1 INSERT (vs 2*N before)
      });

    } catch (error) {
      // 如果批量操作失敗，記錄所有未處理的團隊為錯誤
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      for (const teamId of teamIds) {
        if (!result.skipped.includes(teamId) && !result.added.includes(teamId)) {
          result.errors.push({ teamId, error: errorMsg });
        }
      }
      console.error('[AgentTeamsService] Bulk add failed:', error);
    }

    return result;
  }

  /**
   * Phase 2 優化: 批量將多位成員加入單一團隊
   * - 適用於「選擇成員加入團隊」Modal 的批量操作
   * - 單次查詢檢查所有現有成員資格 (N 查詢 → 1 查詢)
   * - 批量插入所有新成員資格 (N 插入 → 1 插入)
   * - DB 查詢從 6*N 降至 2-3 次
   *
   * @param teamId 目標團隊 ID
   * @param agentIds 要加入的客服 ID 陣列
   * @param roleInTeam 團隊內角色 (預設: member)
   */
  async addMembersToTeam(
    teamId: number,
    agentIds: string[],
    roleInTeam: string = 'member'
  ): Promise<BatchAddMembersResult> {
    const result: BatchAddMembersResult = {
      added: [],
      skipped: [],
      errors: []
    };

    if (agentIds.length === 0) {
      return result;
    }

    const now = nowISO();

    try {
      // Step 1: 批量查詢現有成員資格 (N 查詢 → 1 查詢)
      const existingMemberships = await this.db
        .select({ agentId: agentTeams.agentId })
        .from(agentTeams)
        .where(and(
          eq(agentTeams.teamId, teamId),
          inArray(agentTeams.agentId, agentIds)
        ));

      const existingAgentIds = new Set(existingMemberships.map(m => m.agentId));

      // 分類：已存在 vs 需要新增
      const agentsToAdd: string[] = [];
      for (const agentId of agentIds) {
        if (existingAgentIds.has(agentId)) {
          result.skipped.push(agentId);
        } else {
          agentsToAdd.push(agentId);
        }
      }

      // Step 2: 批量插入新成員資格 (N 插入 → 1 插入)
      if (agentsToAdd.length > 0) {
        const valuesToInsert = agentsToAdd.map(agentId => ({
          agentId,
          teamId,
          roleInTeam,
          isPrimary: false,
          joinedAt: now,
          createdAt: now
        }));

        await this.db
          .insert(agentTeams)
          .values(valuesToInsert);

        result.added = agentsToAdd;
      }

      console.log('[AgentTeamsService] Batch add members to team completed:', {
        teamId,
        requested: agentIds.length,
        added: result.added.length,
        skipped: result.skipped.length,
        dbQueries: 2 // 1 SELECT + 1 INSERT (vs 6*N before)
      });

    } catch (error) {
      // 如果批量操作失敗，記錄所有未處理的成員為錯誤
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      for (const agentId of agentIds) {
        if (!result.skipped.includes(agentId) && !result.added.includes(agentId)) {
          result.errors.push({ agentId, error: errorMsg });
        }
      }
      console.error('[AgentTeamsService] Batch add members to team failed:', error);
    }

    return result;
  }

  /**
   * 批量獲取多個團隊的成員數量
   * 用於批量 WebSocket 廣播時一次獲取所有 memberCount
   */
  async getTeamMemberCounts(teamIds: number[]): Promise<Map<number, number>> {
    if (teamIds.length === 0) {
      return new Map();
    }

    const counts = await this.db
      .select({
        teamId: agentTeams.teamId,
        count: sql<number>`count(*)`
      })
      .from(agentTeams)
      .where(inArray(agentTeams.teamId, teamIds))
      .groupBy(agentTeams.teamId);

    const result = new Map<number, number>();
    for (const { teamId, count } of counts) {
      result.set(teamId, Number(count));
    }

    // 確保所有請求的 teamId 都有值（即使是 0）
    for (const teamId of teamIds) {
      if (!result.has(teamId)) {
        result.set(teamId, 0);
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

    // If this was the primary team, promote next remaining team
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

  /**
   * 獲取客服的主要團隊
   */
  async getPrimaryTeamForAgent(agentId: string): Promise<{ teamId: number; roleInTeam: string } | null> {
    const [result] = await this.db
      .select({
        teamId: agentTeams.teamId,
        roleInTeam: agentTeams.roleInTeam
      })
      .from(agentTeams)
      .where(and(
        eq(agentTeams.agentId, agentId),
        eq(agentTeams.isPrimary, true)
      ))
      .limit(1);

    if (!result) return null;
    return { teamId: result.teamId, roleInTeam: result.roleInTeam || 'member' };
  }
}

/**
 * Standalone helper for files that don't have an AgentTeamsService instance.
 * Queries agent_teams for the agent's primary team ID.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getPrimaryTeamId(db: DrizzleD1Database<any>, agentId: string): Promise<number | null> {
  const [result] = await db
    .select({ teamId: agentTeams.teamId })
    .from(agentTeams)
    .where(and(
      eq(agentTeams.agentId, agentId),
      eq(agentTeams.isPrimary, true)
    ))
    .limit(1);

  return result?.teamId ?? null;
}
