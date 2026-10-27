// Agent Teams Service
// 客服人員多團隊業務邏輯服務
// Supports unlimited team membership for agents

import { drizzle } from 'drizzle-orm/d1';
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('AgentTeamsService')

import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { agentTeams, agents, teams } from '@/db/schema';
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { nowISO } from '@/utils/timestamp'
import type { Bindings, DbUser, TeamRoleInTeam } from '@/types';
import { TEAM_ROLE_HIERARCHY, getUserTeamRole } from '@/utils/auth';
import { revalidateWebSocketAccess } from '@/services/websocket-access-revocation';

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

export function isTeamRole(role: unknown): role is TeamRoleInTeam {
  return typeof role === 'string' && Object.prototype.hasOwnProperty.call(TEAM_ROLE_HIERARCHY, role);
}

/**
 * Shared rank rule for every membership mutation (role change, removal, primary change).
 * Returns an error message when `caller` may not act on `targetAgentId`, whose current role in
 * the team is `targetCurrentRole`; null when allowed.
 *
 * Rule: admin is unrestricted. Any other caller must belong to the team and may only act on a
 * member of STRICTLY LOWER rank (member < lead < supervisor). Acting on yourself is refused
 * unless `allowSelf` is set (removal / primary change: leaving or re-pointing your own default
 * team is harmless; promoting or demoting yourself is not).
 * A missing `targetCurrentRole` means the target holds no role yet (e.g. being added).
 */
export function checkTeamMemberManagement(
  caller: DbUser,
  teamId: number,
  targetAgentId: string | null,
  targetCurrentRole?: string | null,
  opts: { allowSelf?: boolean } = {}
): string | null {
  if (caller.role === 'admin') return null;
  const callerRole = getUserTeamRole(caller, teamId);
  if (!callerRole) return 'Not a member of this team';
  const callerLevel = TEAM_ROLE_HIERARCHY[callerRole];
  if (targetAgentId !== null && String(caller.id) === targetAgentId) {
    return opts.allowSelf ? null : 'Cannot change your own team role';
  }
  if (targetCurrentRole && (!isTeamRole(targetCurrentRole) || TEAM_ROLE_HIERARCHY[targetCurrentRole] >= callerLevel)) {
    return 'Cannot modify a member at or above your own team role';
  }
  return null;
}

/**
 * Team-role ceiling (F26). Returns an error message when `caller` may not set `newRole`
 * on `targetAgentId` (whose current role in the team is `targetCurrentRole`, if any).
 * Non-admins may only assign roles strictly below their own, on top of checkTeamMemberManagement.
 */
export function checkTeamRoleAssignment(
  caller: DbUser,
  teamId: number,
  newRole: unknown,
  targetAgentId: string | null,
  targetCurrentRole?: string | null
): string | null {
  if (!isTeamRole(newRole)) return 'Invalid roleInTeam';
  if (caller.role === 'admin') return null;
  const callerRole = getUserTeamRole(caller, teamId);
  if (!callerRole) return 'Not a member of this team';
  if (TEAM_ROLE_HIERARCHY[newRole] >= TEAM_ROLE_HIERARCHY[callerRole]) return 'Cannot assign a team role at or above your own';
  return checkTeamMemberManagement(caller, teamId, targetAgentId, targetCurrentRole);
}

export interface MembershipMutationDenial {
  status: 403 | 404;
  error: string;
}

/**
 * Async guard for handlers: loads the targets' current roles in `teamId` and applies
 * checkTeamMemberManagement to each. Any denied target denies the whole request.
 * Non-admin callers get 404 for a target that is not in the team; admins skip the lookup.
 */
export async function authorizeMembershipMutation(
  service: AgentTeamsService,
  caller: DbUser,
  teamId: number,
  targetAgentIds: string[],
  opts: { allowSelf?: boolean } = {}
): Promise<MembershipMutationDenial | null> {
  if (caller.role === 'admin') return null;
  const roles = await service.getMemberRoles(teamId, targetAgentIds);
  for (const id of targetAgentIds) {
    const role = roles.get(id);
    if (!role) return { status: 404, error: 'Target is not a member of this team' };
    const denied = checkTeamMemberManagement(caller, teamId, id, role, opts);
    if (denied) return { status: 403, error: denied };
  }
  return null;
}

export class AgentTeamsService {
  private db: ReturnType<typeof drizzle>;

  constructor(private d1: D1Database, private env?: Bindings) {
    this.db = drizzle(d1);
  }

  /** Current team role of each given agent in `teamId` (agents outside the team are absent). */
  async getMemberRoles(teamId: number, agentIds: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (agentIds.length === 0) return result;
    const rows = await this.db
      .select({ agentId: agentTeams.agentId, roleInTeam: agentTeams.roleInTeam })
      .from(agentTeams)
      .where(and(eq(agentTeams.teamId, teamId), inArray(agentTeams.agentId, agentIds)));
    for (const r of rows) result.set(r.agentId, r.roleInTeam || 'member');
    return result;
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

      log.info('Bulk add completed:', {
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
      log.error('Bulk add failed', {}, error as Error);
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

      log.info('Batch add members to team completed:', {
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
      log.error('Batch add members to team failed', {}, error as Error);
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

    await revalidateWebSocketAccess(this.env, 'user', agentId);

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
    if (data.roleInTeam !== undefined && !isTeamRole(data.roleInTeam)) throw new Error('Invalid roleInTeam');

    // Verify membership BEFORE any write: nothing outside this team may be touched.
    const existing = await this.getAgentTeamMembership(agentId, teamId);
    if (!existing) throw new Error('Membership not found');
    if (data.roleInTeam === undefined && data.isPrimary === undefined) return existing;

    // Scoped writes in one D1 batch (atomic): clear the agent's other primaries only when
    // this team becomes primary, then update this membership row.
    const stmts: D1PreparedStatement[] = [];
    if (data.isPrimary) {
      stmts.push(this.d1.prepare('UPDATE agent_teams SET is_primary = 0 WHERE agent_id = ?').bind(agentId));
    }
    const sets: string[] = [];
    const binds: (string | number)[] = [];
    if (data.roleInTeam !== undefined) { sets.push('role_in_team = ?'); binds.push(data.roleInTeam); }
    if (data.isPrimary !== undefined) { sets.push('is_primary = ?'); binds.push(data.isPrimary ? 1 : 0); }
    stmts.push(
      this.d1.prepare(`UPDATE agent_teams SET ${sets.join(', ')} WHERE agent_id = ? AND team_id = ?`)
        .bind(...binds, agentId, teamId)
    );
    await this.d1.batch(stmts);

    const updated = await this.getAgentTeamMembership(agentId, teamId);
    if (!updated) throw new Error('Membership not found');
    return updated;
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

    // Unset the agent's other primaries and set this one, atomically
    await this.d1.batch([
      this.d1.prepare('UPDATE agent_teams SET is_primary = 0 WHERE agent_id = ?').bind(agentId),
      this.d1.prepare('UPDATE agent_teams SET is_primary = 1 WHERE agent_id = ? AND team_id = ?').bind(agentId, teamId)
    ]);
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
export async function getPrimaryTeamId(db: DrizzleD1Database<Record<string, unknown>>, agentId: string): Promise<number | null> {
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
