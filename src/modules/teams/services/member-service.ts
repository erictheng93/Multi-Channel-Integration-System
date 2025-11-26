// Team Member Service
// 團隊成員業務邏輯服務

import { createDbClient } from '@/db/drizzle-factory';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, or, desc, sql, ne } from 'drizzle-orm';
import { agents } from '@/db/schema';
import { hashPassword } from '@/utils/auth';
import type { D1Database } from '@cloudflare/workers-types';
import type {
  TeamMember,
  AddTeamMemberRequest,
  UpdateMemberStatusRequest,
  UpdateMemberRoleRequest,
  UpdateMemberRequest,
  MemberListQuery,
  MemberListResponse
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
   */
  async listMembers(query: MemberListQuery): Promise<MemberListResponse> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [];

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
      .orderBy(desc(agents.lastLoginAt), desc(agents.createdAt))
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
   */
  async getMember(memberId: string): Promise<TeamMember | null> {
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
   * 刪除成員
   */
  async deleteMember(memberId: string, deletedBy: string): Promise<boolean> {
    const result = await this.db
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
