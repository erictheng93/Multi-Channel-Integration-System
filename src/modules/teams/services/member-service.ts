// Team Member Service
// 團隊成員業務邏輯服務

import { createDbClient } from '@/db/drizzle-factory';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, or, desc, sql, ne, isNull } from 'drizzle-orm';
import {
  agents,
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
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import type {
  TeamMember,
  AddTeamMemberRequest,
  UpdateMemberStatusRequest,
  UpdateMemberRoleRequest,
  UpdateMemberRequest,
  MemberListQuery,
  MemberListResponse,
  BulkDeleteResult,
  RestoreResult
} from '../types/member-types';

export class MemberService {
  private db: ReturnType<typeof drizzle>;

  constructor(database: D1Database) {
    this.db = drizzle(database);
  }

  /**
   * 添加團隊成員
   */
  async addMember(data: AddTeamMemberRequest, createdBy: string): Promise<TeamMember> {
    const memberId = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
        teamId: data.teamId || null,
        isActive: data.isActive !== false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .returning();

    return this.formatMember(newMember);
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

    if (query.teamId !== undefined) {
      conditions.push(eq(agents.teamId, query.teamId));
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
    updatedBy: string
  ): Promise<TeamMember> {
    const [updated] = await this.db
      .update(agents)
      .set({
        isActive: data.isActive,
        updatedAt: new Date().toISOString()
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
    updatedBy: string
  ): Promise<TeamMember> {
    const [updated] = await this.db
      .update(agents)
      .set({
        role: data.role,
        updatedAt: new Date().toISOString()
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
    updatedBy: string
  ): Promise<TeamMember> {
    const updateData: any = {
      updatedAt: new Date().toISOString()
    };

    // Note: loginId doesn't exist in schema, removed from update
    if (data.email) updateData.email = data.email;
    if (data.displayName) updateData.displayName = data.displayName;
    if (data.role) updateData.role = data.role;
    if (data.teamId !== undefined) updateData.teamId = data.teamId;
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
  async deleteMember(memberId: string, deletedBy: string): Promise<boolean> {
    const now = new Date().toISOString();

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
   * @param memberIds - 要刪除的成員 ID 列表 (最多 50 個)
   * @param deletedBy - 執行刪除的用戶 ID
   * @returns Promise<BulkDeleteResult> - 刪除結果，包含成功和失敗的成員
   */
  async bulkSoftDeleteMembers(
    memberIds: string[],
    deletedBy: string
  ): Promise<BulkDeleteResult> {
    const deleted: string[] = [];
    const failed: { memberId: string; error: string }[] = [];

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

    // 獲取要刪除的成員信息（用於恢復）
    const deletedMembers: TeamMember[] = [];

    for (const memberId of memberIds) {
      try {
        // 先獲取成員信息
        const member = await this.getMember(memberId);
        if (!member) {
          failed.push({ memberId, error: '成員不存在' });
          continue;
        }

        // 執行軟刪除
        const success = await this.deleteMember(memberId, deletedBy);

        if (success) {
          deleted.push(memberId);
          deletedMembers.push(member);
        } else {
          failed.push({ memberId, error: '刪除失敗' });
        }
      } catch (err) {
        failed.push({
          memberId,
          error: err instanceof Error ? err.message : '未知錯誤'
        });
      }
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
    const now = new Date().toISOString();

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
   * @param memberIds - 要恢復的成員 ID 列表
   * @returns Promise<RestoreResult> - 恢復結果
   */
  async bulkRestoreMembers(memberIds: string[]): Promise<RestoreResult> {
    const restored: TeamMember[] = [];
    const failed: { memberId: string; error: string }[] = [];

    for (const memberId of memberIds) {
      try {
        const member = await this.restoreMember(memberId);
        if (member) {
          restored.push(member);
        } else {
          failed.push({ memberId, error: '成員不存在或未被刪除' });
        }
      } catch (err) {
        failed.push({
          memberId,
          error: err instanceof Error ? err.message : '未知錯誤'
        });
      }
    }

    return { restored, failed };
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
  async hardDeleteMember(memberId: string, deletedBy: string): Promise<boolean> {
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
  private formatMember(member: any): TeamMember {
    return {
      id: member.id,
      loginId: member.displayName, // Use displayName as loginId (schema doesn't have loginId field)
      email: member.email,
      name: member.displayName,
      displayName: member.displayName,
      role: member.role,
      teamId: member.teamId,
      group: '', // Legacy field
      isActive: member.isActive,
      status: member.isActive ? 'active' : 'inactive',
      createdAt: member.createdAt,
      lastActive: member.lastLoginAt,
      lastLoginAt: member.lastLoginAt
    };
  }
}
