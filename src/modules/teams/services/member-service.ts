// Team Member Service
// 團隊成員業務邏輯服務

import { drizzle } from 'drizzle-orm/d1';
import { eq, and, or, desc, sql, isNull, inArray } from 'drizzle-orm';
import {
  agents,
  agentTeams,
  messages,
  delayedMessages,
  notifications,
  tags,
  customerTags,
  conversationTags,
  messageRecallLogs,
  conversationTransfers,
  fileAttachments,
  activities
} from '@/db/schema';
import { hashPassword } from '@/utils/auth';
import type { D1Database } from '@cloudflare/workers-types';
import type {
  TeamMember,
  AddTeamMemberRequest,
  UpdateMemberStatusRequest,
  UpdateMemberRoleRequest,
  UpdateMemberRequest,
  MemberListQuery,
  MemberListResponse,
  BulkDeleteResult,
  RestoreResult,
  BulkUpdateResult,
  MemberEditData,
  MemberEditResult
} from '../types/member-types';
import { AgentTeamsService } from './agent-teams-service';
import { nowISO, nowMs } from '@/utils/timestamp'

export class MemberService {
  private db: ReturnType<typeof drizzle>;

  constructor(database: D1Database) {
    this.db = drizzle(database);
  }

  /**
   * 添加團隊成員
   */
  async addMember(data: AddTeamMemberRequest, _createdBy: string): Promise<TeamMember> {
    const memberId = `agent-${nowMs()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = nowISO();

    // Hash password using bcrypt (12 rounds)
    const hashedPassword = await hashPassword(data.password);

    const [newMember] = await this.db
      .insert(agents)
      .values({
        id: memberId,
        email: data.email,
        passwordHash: hashedPassword,
        displayName: data.displayName,
        role: data.role || 'agent',
        isActive: data.isActive !== false,
        createdAt: now,
        updatedAt: now
      })
      .returning();

    // If teamId provided, create agent_teams membership (isPrimary=true)
    if (data.teamId) {
      await this.db.insert(agentTeams).values({
        agentId: memberId,
        teamId: data.teamId,
        roleInTeam: 'member',
        isPrimary: true,
        joinedAt: now
      });
    }

    return this.formatMember(newMember, data.teamId || undefined);
  }

  /**
   * 獲取成員列表
   * 自動過濾已軟刪除的成員 (deletedAt IS NULL)
   */
  async listMembers(query: MemberListQuery): Promise<MemberListResponse> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [];

    // 🔑 Filter out soft-deleted members
    conditions.push(isNull(agents.deletedAt));

    // teamId filter is handled via a subquery on agent_teams
    if (query.teamId !== undefined) {
      conditions.push(
        sql`${agents.id} IN (SELECT agent_id FROM agent_teams WHERE team_id = ${query.teamId})`
      );
    }

    if (query.role) {
      conditions.push(eq(agents.role, query.role));
    }

    if (query.status === 'active') {
      conditions.push(eq(agents.isActive, true));
    } else if (query.status === 'inactive') {
      conditions.push(eq(agents.isActive, false));
    }

    if (query.search) {
      const searchPattern = `%${query.search}%`;
      conditions.push(
        or(
          sql`${agents.displayName} LIKE ${searchPattern}`,
          sql`${agents.email} LIKE ${searchPattern}`,
          sql`${agents.id} LIKE ${searchPattern}`
        )!
      );
    }

    // Get members
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const members = await this.db
      .select()
      .from(agents)
      .where(whereClause)
      .orderBy(desc(agents.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(agents)
      .where(whereClause);

    return {
      members: members.map(m => this.formatMember(m)),
      total: Number(count),
      page,
      limit
    };
  }

  /**
   * 獲取單個成員
   * 自動過濾已軟刪除的成員
   */
  async getMember(memberId: string): Promise<TeamMember | null> {
    const [member] = await this.db
      .select()
      .from(agents)
      .where(and(
        eq(agents.id, memberId),
        isNull(agents.deletedAt)
      ))
      .limit(1);

    return member ? this.formatMember(member) : null;
  }

  /**
   * 獲取單個成員 (包含已刪除的)
   * 用於恢復操作
   */
  async getMemberIncludingDeleted(memberId: string): Promise<TeamMember | null> {
    const [member] = await this.db
      .select()
      .from(agents)
      .where(eq(agents.id, memberId))
      .limit(1);

    return member ? this.formatMember(member) : null;
  }

  /**
   * 更新成員狀態
   */
  async updateMemberStatus(
    memberId: string,
    data: UpdateMemberStatusRequest,
    _updatedBy: string
  ): Promise<TeamMember> {
    const [updated] = await this.db
      .update(agents)
      .set({
        isActive: data.isActive,
        updatedAt: nowISO()
      })
      .where(eq(agents.id, memberId))
      .returning();

    if (!updated) {
      throw new Error('Member not found');
    }

    return this.formatMember(updated);
  }

  /**
   * 更新成員角色
   */
  async updateMemberRole(
    memberId: string,
    data: UpdateMemberRoleRequest,
    _updatedBy: string
  ): Promise<TeamMember> {
    const [updated] = await this.db
      .update(agents)
      .set({
        role: data.role,
        updatedAt: nowISO()
      })
      .where(eq(agents.id, memberId))
      .returning();

    if (!updated) {
      throw new Error('Member not found');
    }

    return this.formatMember(updated);
  }

  /**
   * 更新成員信息
   */
  async updateMember(
    memberId: string,
    data: UpdateMemberRequest,
    _updatedBy: string
  ): Promise<TeamMember> {
    const updateData: any = {
      updatedAt: nowISO()
    };

    // Note: loginId doesn't exist in schema, removed from update
    // Note: teamId is managed via agent_teams, not agents table
    if (data.email) updateData.email = data.email;
    if (data.displayName) updateData.displayName = data.displayName;
    if (data.role) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const [updated] = await this.db
      .update(agents)
      .set(updateData)
      .where(eq(agents.id, memberId))
      .returning();

    if (!updated) {
      throw new Error('Member not found');
    }

    return this.formatMember(updated);
  }

  /**
   * 軟刪除成員 (Soft Delete)
   *
   * 只設定 deletedAt 時間戳，不清理外鍵關聯。
   * 這樣可以在 undo 時間窗口內 (10-30 秒) 恢復成員。
   *
   * @param memberId - 要刪除的成員 ID
   * @param deletedBy - 執行刪除的用戶 ID
   * @returns Promise<boolean> - 刪除是否成功
   */
  async deleteMember(memberId: string, _deletedBy: string): Promise<boolean> {
    const now = nowISO();

    const [updated] = await this.db
      .update(agents)
      .set({
        deletedAt: now,
        updatedAt: now
      })
      .where(and(
        eq(agents.id, memberId),
        isNull(agents.deletedAt) // 確保只刪除未被刪除的成員
      ))
      .returning();

    return !!updated;
  }

  /**
   * 批量軟刪除成員
   *
   * 🚀 Phase 2 優化: 使用批量 DB 操作
   * - 1 次批量查詢 (vs 原本 N 次)
   * - 1 次批量更新 (vs 原本 N 次)
   * - 總共 2 次 DB 查詢 (vs 原本 2*N 次)
   *
   * @param memberIds - 要刪除的成員 ID 列表 (最多 50 個)
   * @param deletedBy - 執行刪除的用戶 ID
   * @returns Promise<BulkDeleteResult> - 刪除結果，包含成功和失敗的成員
   */
  async bulkSoftDeleteMembers(
    memberIds: string[],
    _deletedBy: string
  ): Promise<BulkDeleteResult> {
    const deleted: string[] = [];
    const failed: { memberId: string; error: string }[] = [];
    const deletedMembers: TeamMember[] = [];

    // 限制批量操作數量
    const MAX_BULK_SIZE = 50;
    if (memberIds.length > MAX_BULK_SIZE) {
      return {
        deleted: [],
        failed: memberIds.map(id => ({
          memberId: id,
          error: `批量操作限制為 ${MAX_BULK_SIZE} 個成員`
        })),
        deletedMembers: []
      };
    }

    if (memberIds.length === 0) {
      return { deleted, failed, deletedMembers };
    }

    try {
      // 🚀 Step 1: 批量查詢現有成員 (N 查詢 → 1 查詢)
      const existingMembers = await this.db
        .select()
        .from(agents)
        .where(and(
          inArray(agents.id, memberIds),
          isNull(agents.deletedAt)  // 只查詢未被刪除的成員
        ));

      // 建立已存在成員的 Map (用於快速查找)
      const existingMemberMap = new Map(
        existingMembers.map(m => [m.id, m])
      );

      // 找出不存在的成員 ID
      const notFoundIds = memberIds.filter(id => !existingMemberMap.has(id));
      notFoundIds.forEach(memberId => {
        failed.push({ memberId, error: '成員不存在' });
      });

      // 取得要刪除的成員 ID 列表
      const idsToDelete = memberIds.filter(id => existingMemberMap.has(id));

      if (idsToDelete.length === 0) {
        return { deleted, failed, deletedMembers };
      }

      // 🚀 Step 2: 批量軟刪除 (N 更新 → 1 更新)
      const now = nowISO();
      await this.db
        .update(agents)
        .set({
          deletedAt: now,
          updatedAt: now
        })
        .where(inArray(agents.id, idsToDelete));

      // 記錄成功刪除的成員
      idsToDelete.forEach(memberId => {
        deleted.push(memberId);
        const member = existingMemberMap.get(memberId);
        if (member) {
          deletedMembers.push(this.formatMember(member));
        }
      });

      console.log(`📦 [Member Bulk Delete] 批量軟刪除 ${deleted.length} 位成員 (2 DB 查詢)`);

    } catch (err) {
      // 如果批量操作失敗，將所有成員標記為失敗
      const errorMsg = err instanceof Error ? err.message : '批量刪除失敗';
      memberIds.forEach(memberId => {
        if (!failed.some(f => f.memberId === memberId)) {
          failed.push({ memberId, error: errorMsg });
        }
      });
      console.error('批量軟刪除成員錯誤:', err);
    }

    return { deleted, failed, deletedMembers };
  }

  /**
   * 恢復已軟刪除的成員
   *
   * @param memberId - 要恢復的成員 ID
   * @returns Promise<TeamMember | null> - 恢復的成員，如果失敗則為 null
   */
  async restoreMember(memberId: string): Promise<TeamMember | null> {
    const now = nowISO();

    const [restored] = await this.db
      .update(agents)
      .set({
        deletedAt: null,
        updatedAt: now
      })
      .where(and(
        eq(agents.id, memberId),
        sql`${agents.deletedAt} IS NOT NULL` // 只恢復已刪除的成員
      ))
      .returning();

    return restored ? this.formatMember(restored) : null;
  }

  /**
   * 批量恢復已軟刪除的成員
   *
   * 🚀 Phase 2 優化: 使用批量 DB 操作
   * - 1 次批量查詢 (驗證已刪除的成員)
   * - 1 次批量更新 (恢復成員)
   * - 總共 2 次 DB 查詢 (vs 原本 N 次)
   *
   * @param memberIds - 要恢復的成員 ID 列表
   * @returns Promise<RestoreResult> - 恢復結果
   */
  async bulkRestoreMembers(memberIds: string[]): Promise<RestoreResult> {
    const restored: TeamMember[] = [];
    const failed: { memberId: string; error: string }[] = [];

    if (memberIds.length === 0) {
      return { restored, failed };
    }

    try {
      // 🚀 Step 1: 批量查詢已刪除的成員 (N 查詢 → 1 查詢)
      const deletedMembers = await this.db
        .select()
        .from(agents)
        .where(and(
          inArray(agents.id, memberIds),
          sql`${agents.deletedAt} IS NOT NULL`  // 只查詢已刪除的成員
        ));

      // 建立已刪除成員的 Map
      const deletedMemberMap = new Map(
        deletedMembers.map(m => [m.id, m])
      );

      // 找出不存在或未被刪除的成員 ID
      const notFoundIds = memberIds.filter(id => !deletedMemberMap.has(id));
      notFoundIds.forEach(memberId => {
        failed.push({ memberId, error: '成員不存在或未被刪除' });
      });

      // 取得要恢復的成員 ID 列表
      const idsToRestore = memberIds.filter(id => deletedMemberMap.has(id));

      if (idsToRestore.length === 0) {
        return { restored, failed };
      }

      // 🚀 Step 2: 批量恢復 (N 更新 → 1 更新)
      const now = nowISO();
      await this.db
        .update(agents)
        .set({
          deletedAt: null,
          updatedAt: now
        })
        .where(inArray(agents.id, idsToRestore));

      // 記錄成功恢復的成員
      idsToRestore.forEach(memberId => {
        const member = deletedMemberMap.get(memberId);
        if (member) {
          restored.push(this.formatMember(member));
        }
      });

      console.log(`📦 [Member Bulk Restore] 批量恢復 ${restored.length} 位成員 (2 DB 查詢)`);

    } catch (err) {
      // 如果批量操作失敗，將所有成員標記為失敗
      const errorMsg = err instanceof Error ? err.message : '批量恢復失敗';
      memberIds.forEach(memberId => {
        if (!failed.some(f => f.memberId === memberId)) {
          failed.push({ memberId, error: errorMsg });
        }
      });
      console.error('批量恢復成員錯誤:', err);
    }

    return { restored, failed };
  }

  /**
   * 批量更新成員
   *
   * 🚀 Phase 2 優化: 使用批量 DB 操作
   * - 1 次批量查詢現有成員
   * - 1 次批量更新
   * - 總共 2 次 DB 查詢 (vs 原本 N 次)
   *
   * @param memberIds - 要更新的成員 ID 列表 (最多 50 個)
   * @param updates - 要更新的欄位 (role, isActive)
   * @param updatedBy - 執行更新的用戶 ID
   * @returns Promise<BulkUpdateResult> - 更新結果
   */
  async bulkUpdateMembers(
    memberIds: string[],
    updates: { role?: 'admin' | 'agent'; isActive?: boolean },
    updatedBy: string
  ): Promise<BulkUpdateResult> {
    const updated: string[] = [];
    const failed: { memberId: string; error: string }[] = [];
    const skipped: { memberId: string; reason: string }[] = [];
    const updatedMembers: TeamMember[] = [];

    // 限制批量操作數量
    const MAX_BULK_SIZE = 50;
    if (memberIds.length > MAX_BULK_SIZE) {
      return {
        updated: [],
        failed: memberIds.map(id => ({
          memberId: id,
          error: `批量操作限制為 ${MAX_BULK_SIZE} 個成員`
        })),
        skipped: [],
        updatedMembers: []
      };
    }

    if (memberIds.length === 0) {
      return { updated, failed, skipped, updatedMembers };
    }

    // 驗證至少有一個更新欄位
    if (updates.role === undefined && updates.isActive === undefined) {
      return {
        updated: [],
        failed: memberIds.map(id => ({
          memberId: id,
          error: '至少需要一個更新欄位'
        })),
        skipped: [],
        updatedMembers: []
      };
    }

    try {
      // 🚀 Step 1: 批量查詢現有成員 (N 查詢 → 1 查詢)
      const existingMembers = await this.db
        .select()
        .from(agents)
        .where(and(
          inArray(agents.id, memberIds),
          isNull(agents.deletedAt) // 只查詢未被刪除的成員
        ));

      // 建立已存在成員的 Map (用於快速查找)
      const existingMemberMap = new Map(
        existingMembers.map(m => [m.id, m])
      );

      // 找出不存在的成員 ID
      const notFoundIds = memberIds.filter(id => !existingMemberMap.has(id));
      notFoundIds.forEach(memberId => {
        failed.push({ memberId, error: '成員不存在' });
      });

      // 過濾出可更新的成員 ID（排除不存在的和自己）
      const idsToUpdate = memberIds.filter(id => {
        if (!existingMemberMap.has(id)) {
          return false;
        }
        // 不能更新自己
        if (id === updatedBy) {
          skipped.push({ memberId: id, reason: '無法變更自己的角色或狀態' });
          return false;
        }
        return true;
      });

      if (idsToUpdate.length === 0) {
        return { updated, failed, skipped, updatedMembers };
      }

      // 🚀 Step 2: 批量更新 (N 更新 → 1 更新)
      const now = nowISO();
      const updateData: any = { updatedAt: now };
      if (updates.role !== undefined) updateData.role = updates.role;
      if (updates.isActive !== undefined) updateData.isActive = updates.isActive;

      await this.db
        .update(agents)
        .set(updateData)
        .where(inArray(agents.id, idsToUpdate));

      // 記錄成功更新的成員並返回更新後的資料
      idsToUpdate.forEach(memberId => {
        updated.push(memberId);
        const originalMember = existingMemberMap.get(memberId);
        if (originalMember) {
          // 合併更新後的資料
          const updatedMember = {
            ...originalMember,
            ...updateData
          };
          updatedMembers.push(this.formatMember(updatedMember));
        }
      });

      console.log(`📦 [Member Bulk Update] 批量更新 ${updated.length} 位成員 (2 DB 查詢)`);

    } catch (err) {
      // 如果批量操作失敗，將所有成員標記為失敗
      const errorMsg = err instanceof Error ? err.message : '批量更新失敗';
      memberIds.forEach(memberId => {
        if (!failed.some(f => f.memberId === memberId) && !skipped.some(s => s.memberId === memberId)) {
          failed.push({ memberId, error: errorMsg });
        }
      });
      console.error('批量更新成員錯誤:', err);
    }

    return { updated, failed, skipped, updatedMembers };
  }

  /**
   * 批量編輯成員 (Per-member changes)
   *
   * 🚀 優化: 支持每個成員有不同的 profile 和團隊變更
   * - 批量處理 profile 更新 (displayName, email, role)
   * - 批量處理團隊加入/離開
   * - 返回原始資料用於撤銷
   *
   * @param members 成員編輯資料列表
   * @param editedBy 執行編輯的用戶 ID
   * @param database D1 資料庫 (用於創建 AgentTeamsService)
   */
  async batchEditMembers(
    members: MemberEditData[],
    editedBy: string,
    database: D1Database
  ): Promise<{ results: MemberEditResult[]; skipped: { memberId: string; reason: string }[]; originalData: MemberEditData[] }> {
    const results: MemberEditResult[] = [];
    const skipped: { memberId: string; reason: string }[] = [];
    const originalData: MemberEditData[] = [];

    // 限制批量操作數量
    const MAX_BATCH_SIZE = 50;
    if (members.length > MAX_BATCH_SIZE) {
      return {
        results: members.map(m => ({
          memberId: m.memberId,
          success: false,
          error: `批量操作限制為 ${MAX_BATCH_SIZE} 個成員`,
          profileUpdated: false,
          teamsAdded: [],
          teamsRemoved: []
        })),
        skipped: [],
        originalData: []
      };
    }

    if (members.length === 0) {
      return { results, skipped, originalData };
    }

    // Create AgentTeamsService for team operations
    const agentTeamsService = new AgentTeamsService(database);

    // 收集所有需要處理的成員 ID
    const memberIds = members.map(m => m.memberId);

    try {
      // 🚀 Step 1: 批量查詢現有成員資料 (用於驗證和收集原始資料)
      const existingMembers = await this.db
        .select()
        .from(agents)
        .where(and(
          inArray(agents.id, memberIds),
          isNull(agents.deletedAt)
        ));

      const existingMemberMap = new Map(
        existingMembers.map(m => [m.id, m])
      );

      // 🚀 Step 2: 批量獲取所有成員的當前團隊 (用於收集原始資料)
      const allAgentTeams = await agentTeamsService.getAllAgentsWithTeams();

      // 🚀 Step 3: 處理每個成員
      for (const memberData of members) {
        const { memberId, profile, teamChanges } = memberData;

        // 跳過自己
        if (memberId === editedBy) {
          skipped.push({ memberId, reason: '無法編輯自己的帳號' });
          continue;
        }

        // 檢查成員是否存在
        const existingMember = existingMemberMap.get(memberId);
        if (!existingMember) {
          results.push({
            memberId,
            success: false,
            error: '成員不存在',
            profileUpdated: false,
            teamsAdded: [],
            teamsRemoved: []
          });
          continue;
        }

        // 收集原始資料 (用於撤銷)
        const currentTeams = allAgentTeams.get(memberId) || [];
        originalData.push({
          memberId,
          profile: {
            displayName: existingMember.displayName || undefined,
            email: existingMember.email || undefined,
            role: existingMember.role as 'admin' | 'agent'
          },
          teamChanges: {
            add: currentTeams.map(t => t.teamId),
            remove: []
          }
        });

        const result: MemberEditResult = {
          memberId,
          success: true,
          profileUpdated: false,
          teamsAdded: [],
          teamsRemoved: []
        };

        try {
          // 🚀 Step 3.1: 更新 Profile (如果有變更)
          if (profile && (profile.displayName || profile.email || profile.role)) {
            const updateData: Record<string, string> = {};

            if (profile.displayName !== undefined) {
              updateData.displayName = profile.displayName;
            }
            if (profile.email !== undefined) {
              updateData.email = profile.email;
            }
            if (profile.role !== undefined) {
              updateData.role = profile.role;
            }

            if (Object.keys(updateData).length > 0) {
              updateData.updatedAt = nowISO();

              await this.db
                .update(agents)
                .set(updateData)
                .where(eq(agents.id, memberId));

              result.profileUpdated = true;
            }
          }

          // 🚀 Step 3.2: 處理團隊變更
          if (teamChanges) {
            // 加入團隊
            if (teamChanges.add && teamChanges.add.length > 0) {
              const addResult = await agentTeamsService.addAgentToMultipleTeams(
                memberId,
                teamChanges.add,
                'member'
              );
              result.teamsAdded = addResult.added;
            }

            // 離開團隊
            if (teamChanges.remove && teamChanges.remove.length > 0) {
              for (const teamId of teamChanges.remove) {
                try {
                  await agentTeamsService.removeAgentFromTeam(memberId, teamId);
                  result.teamsRemoved.push(teamId);
                } catch (removeError) {
                  console.error(`Failed to remove member ${memberId} from team ${teamId}:`, removeError);
                }
              }
            }
          }

        } catch (memberError) {
          result.success = false;
          result.error = memberError instanceof Error ? memberError.message : '更新失敗';
        }

        results.push(result);
      }

      console.log('📦 [Member Batch Edit] 批量編輯完成:', {
        total: members.length,
        success: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        skipped: skipped.length
      });

    } catch (err) {
      // 如果批量操作失敗，將所有未處理的成員標記為失敗
      const errorMsg = err instanceof Error ? err.message : '批量編輯失敗';
      for (const memberData of members) {
        if (!results.some(r => r.memberId === memberData.memberId) &&
            !skipped.some(s => s.memberId === memberData.memberId)) {
          results.push({
            memberId: memberData.memberId,
            success: false,
            error: errorMsg,
            profileUpdated: false,
            teamsAdded: [],
            teamsRemoved: []
          });
        }
      }
      console.error('批量編輯成員錯誤:', err);
    }

    return { results, skipped, originalData };
  }

  /**
   * 硬刪除成員 (Hard Delete)
   *
   * ⚠️ 永久刪除，無法恢復！
   * 僅用於 Undo 時間窗口過期後的清理作業。
   *
   * 處理外鍵約束（依順序處理所有引用 agents 表的外鍵）：
   * 1. 刪除 notifications（用戶刪除後通知無意義）
   * 2. 將 messages.agentSenderId 設為 null（保留訊息歷史）
   * 3. 刪除 delayedMessages 中的待發訊息
   * 4. 將 messageRecallLogs.userId 設為 null（保留撤回記錄）
   * 5. 將 fileAttachments.uploadedBy 設為 null（保留附件記錄）
   * 6. 將 tags.createdBy 設為 null（保留標籤）
   * 7. 將 customerTags.assignedBy 設為 null（保留標籤關聯）
   * 8. 將 conversationTags.assignedBy 設為 null（保留標籤關聯）
   * 9. 將 conversationTransfers 相關欄位設為 null（保留轉移記錄）
   * 10. 將 activities.userId 設為 null（保留審計記錄）
   * 11. agent_teams 會自動級聯刪除（onDelete: cascade）
   * 12. task_reminders 會自動級聯刪除（onDelete: cascade）
   * 13. 最後刪除成員帳號
   */
  async hardDeleteMember(memberId: string, _deletedBy: string): Promise<boolean> {
    // Step 1: 刪除該成員的通知（用戶刪除後通知無意義）
    await this.db
      .delete(notifications)
      .where(eq(notifications.userId, memberId));

    // Step 2: 將該成員發送的訊息的 agentSenderId 設為 null（保留訊息歷史）
    await this.db
      .update(messages)
      .set({ agentSenderId: null })
      .where(eq(messages.agentSenderId, memberId));

    // Step 3: 刪除該成員的待發延遲訊息
    await this.db
      .delete(delayedMessages)
      .where(eq(delayedMessages.agentId, memberId));

    // Step 4: 將訊息撤回記錄的 userId 設為 'deleted-user'（保留撤回記錄）
    await this.db
      .update(messageRecallLogs)
      .set({ userId: 'deleted-user' })
      .where(eq(messageRecallLogs.userId, memberId));

    // Step 5: 將附件上傳者設為 null（保留附件記錄）
    await this.db
      .update(fileAttachments)
      .set({ uploadedBy: null })
      .where(eq(fileAttachments.uploadedBy, memberId));

    // Step 6: 將標籤建立者設為 'deleted-user'（保留標籤）
    await this.db
      .update(tags)
      .set({ createdBy: 'deleted-user' })
      .where(eq(tags.createdBy, memberId));

    // Step 7: 將客戶標籤指派者設為 'deleted-user'（保留標籤關聯）
    await this.db
      .update(customerTags)
      .set({ assignedBy: 'deleted-user' })
      .where(eq(customerTags.assignedBy, memberId));

    // Step 8: 將對話標籤指派者設為 'deleted-user'（保留標籤關聯）
    await this.db
      .update(conversationTags)
      .set({ assignedBy: 'deleted-user' })
      .where(eq(conversationTags.assignedBy, memberId));

    // Step 9: 將對話轉移記錄相關欄位設為 'deleted-user'（保留轉移記錄）
    // Note: fromUserId and toUserId removed - only team-based transfers are supported now
    await this.db
      .update(conversationTransfers)
      .set({ transferredBy: 'deleted-user' })
      .where(eq(conversationTransfers.transferredBy, memberId));

    // Step 10: 將活動記錄的 userId 設為 'deleted-user'（保留審計記錄）
    await this.db
      .update(activities)
      .set({ userId: 'deleted-user' })
      .where(eq(activities.userId, memberId));

    // Step 11: 刪除成員帳號
    // (agent_teams 和 task_reminders 會自動級聯刪除)
    await this.db
      .delete(agents)
      .where(eq(agents.id, memberId));

    return true;
  }

  /**
   * 檢查成員是否存在
   */
  async memberExists(email: string): Promise<boolean> {
    const [existing] = await this.db
      .select({ id: agents.id })
      .from(agents)
      .where(eq(agents.email, email))
      .limit(1);

    return !!existing;
  }

  /**
   * 格式化成員數據
   */
  private formatMember(member: any, teamIdOverride?: number): TeamMember {
    return {
      id: member.id,
      loginId: member.displayName, // Use displayName as loginId (schema doesn't have loginId field)
      email: member.email,
      name: member.displayName,
      displayName: member.displayName,
      role: member.role,
      primaryTeamId: teamIdOverride ?? null,
      group: '', // Legacy field
      isActive: member.isActive,
      status: member.isActive ? 'active' : 'inactive',
      createdAt: member.createdAt,
      lastActive: member.lastLoginAt,
      lastLoginAt: member.lastLoginAt
    };
  }
}
