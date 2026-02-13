// 權限管理服務
import { eq, and, isNull, or, desc, inArray } from 'drizzle-orm';
import { createDbClient } from '../db/drizzle-factory';
import { agents, conversations, agentTeams } from '../db/schema';
import type {
  // PermissionRule,
  PermissionContext,
  UserPermissionData
} from '../types/services';

export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, unknown>;
}

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
}

export class PermissionService {
  // Role hierarchy: admin > agent (simplified from 3-tier to 2-tier)
  private static roleHierarchy = {
    admin: 2,
    agent: 1
  };

  private static roles: Record<string, Role> = {
    admin: {
      id: 'admin',
      name: '系統管理員',
      permissions: [
        { resource: '*', action: '*' }
      ]
    },
    agent: {
      id: 'agent',
      name: '客服人員',
      permissions: [
        // 普通 Agent 能查看所有對話（包括未指派的）
        { resource: 'conversation', action: 'view' },
        // 但只能回覆指派給自己的對話
        { resource: 'conversation', action: 'reply', conditions: { assigned: true } },
        // 只能在指派給自己的對話中發送訊息
        { resource: 'message', action: 'send', conditions: { assigned: true } },
        { resource: 'message', action: 'recall', conditions: { own: true } },
        { resource: 'tag', action: 'add', conditions: { teamScope: true } }
      ]
    }
  };

  static async checkPermission(
    userId: string | number, // ✅ 支持字符串和數字ID
    resource: string,
    action: string,
    context?: PermissionContext,
    db?: D1Database
  ): Promise<boolean> {
    // ✅ 修正輸入驗證邏輯
    if (!userId || !resource || !action) {
      return false;
    }
    
    // 對數字ID進行額外驗證
    if (typeof userId === 'number' && userId <= 0) {
      return false;
    }

    try {
      // 從資料庫獲取用戶資訊
      const user = await this.getUserWithTeam(userId, db);
      if (!user) return false;

      const role = this.roles[user.role];
      if (!role) return false;

      // Admin has wildcard access to everything
      if (user.role === 'admin') {
        return true;
      }

      // 檢查具體權限
      const permission = role.permissions.find(p => 
        (p.resource === resource || p.resource === '*') && 
        (p.action === action || p.action === '*')
      );
      
      if (!permission) return false;

      // 檢查條件限制
      if (permission.conditions) {
        return await this.checkConditions(permission.conditions, user, context, resource, db);
      }

      return true;
    } catch (error) {
      throw error; // Re-throw database errors for proper error handling
    }
  }

  private static async checkConditions(
    conditions: Record<string, unknown>,
    user: UserPermissionData,
    context?: PermissionContext,
    resource?: string,
    db?: D1Database
  ): Promise<boolean> {
    if (!context) {
      // If conditions require context but none provided, fail
      return false;
    }

    // 團隊範圍限制
    if (conditions.teamScope && context.teamId !== user.teamId) {
      return false;
    }

    // 只能操作指派給自己團隊的對話
    // Note: Individual assignment (assignedUserId) removed - use team-based access control instead
    if (conditions.assigned) {
      if (resource === 'conversation' && context && (context as any).resourceId && db) {
        // 查詢對話的 assignedTeamId
        try {
          const drizzleDb = createDbClient(db);
          const conversation = await drizzleDb
            .select({ assignedTeamId: conversations.assignedTeamId })
            .from(conversations)
            .where(eq(conversations.id, (context as any).resourceId))
            .get();

          console.log(`🔍 Conversation team assignment check - ConversationId: ${(context as any).resourceId}, AssignedTeamId: ${conversation?.assignedTeamId}, UserTeamId: ${user.teamId}`);

          // 如果對話未指派給任何團隊，允許訪問
          if (!conversation || !conversation.assignedTeamId) {
            return true;
          }

          // 檢查是否指派給用戶的團隊
          return conversation.assignedTeamId === user.teamId;
        } catch (error) {
          console.error('Failed to check conversation team assignment:', error);
          return false;
        }
      } else {
        // 對於非對話資源，檢查 teamId
        return (context as any).teamId === user.teamId;
      }
    }

    // 只能操作自己的資源
    if (conditions.own && (context as any).ownerId !== user.id) {
      return false;
    }

    // 只能管理自己的團隊
    if (conditions.ownTeam && context.teamId !== user.teamId) {
      return false;
    }

    return true;
  }

  // Check if one role has higher or equal authority than another
  static hasRoleAuthority(userRole: string, requiredRole: string): boolean {
    const userLevel = this.roleHierarchy[userRole as keyof typeof this.roleHierarchy];
    const requiredLevel = this.roleHierarchy[requiredRole as keyof typeof this.roleHierarchy];

    // Both roles must be valid
    if (userLevel === undefined || requiredLevel === undefined) {
      return false;
    }

    return userLevel >= requiredLevel;
  }

  // Get all roles that a user can manage (lower hierarchy roles)
  static getManagedRoles(userRole: string): string[] {
    const userLevel = this.roleHierarchy[userRole as keyof typeof this.roleHierarchy] || 0;
    return Object.keys(this.roleHierarchy).filter(role => 
      this.roleHierarchy[role as keyof typeof this.roleHierarchy] < userLevel
    );
  }

  private static async getUserWithTeam(userId: string | number, db?: D1Database): Promise<UserPermissionData | null> {
    console.log(`🔍 getUserWithTeam called with userId: ${userId} (type: ${typeof userId}), db: ${db ? 'available' : 'not available'}`);
    
    if (!db) {
      console.error('❌ [PermissionService] No database provided - denying access (fail-closed)');
      return null;
    }

    try {
      const drizzleDb = createDbClient(db);
      const userIdStr = typeof userId === 'string' ? userId : userId.toString();
      
      console.log(`📋 Querying agents table for id: "${userIdStr}"`);
      
      const user = await drizzleDb
        .select({
          id: agents.id,
          role: agents.role,
          teamId: agents.teamId,
          isActive: agents.isActive
        })
        .from(agents)
        .where(
          and(
            eq(agents.id, userIdStr),
            eq(agents.isActive, true)
          )
        )
        .get();

      console.log(`👤 Database query result:`, user);

      if (!user) {
        console.log('❌ No user found in database');
        return null;
      }

      const userData = {
        id: parseInt(user.id), // 轉換為數字以符合 UserPermissionData 類型
        role: user.role as string,
        teamId: user.teamId || 0, // Default to 0 if null
        isActive: Boolean(user.isActive)
      };
      
      console.log(`✅ Returning user data:`, userData);
      return userData;
    } catch (error) {
      console.error('Failed to get user:', error);
      return null;
    }
  }

  // 獲取用戶可見的對話列表
  static async getVisibleConversations(userId: string | number, db?: D1Database): Promise<string[]> {
    console.log(`🔍 getVisibleConversations called with userId: ${userId} (type: ${typeof userId})`);
    const user = await this.getUserWithTeam(userId, db);
    console.log(`👤 getUserWithTeam returned:`, user);
    if (!user) {
      console.log('❌ No user found, returning empty array');
      return [];
    }

    try {
      const database = db;
      if (!database) {
        console.error('Database not available in getVisibleConversations');
        return [];
      }

      // Admin 可以看到所有對話
      if (user.role === 'admin') {
        const drizzleDb = createDbClient(database);
        const result = await drizzleDb
          .select({ id: conversations.id })
          .from(conversations)
          .orderBy(desc(conversations.updatedAt));
        return result.map(row => row.id);
      }

      // Note: 'team' role has been removed from the system (simplified to 2-tier: admin/agent)

      // Agent 可以看到：1) 搶單池 2) 指派給自己 3) 所屬團隊的對話（支援多團隊）
      if (user.role === 'agent') {
        const userIdStr = typeof userId === 'string' ? userId : userId.toString();
        const drizzleDb = createDbClient(database);

        // 🆕 從 agent_teams 表獲取用戶所屬的所有團隊 ID
        const teamMemberships = await drizzleDb
          .select({ teamId: agentTeams.teamId })
          .from(agentTeams)
          .where(eq(agentTeams.agentId, userIdStr));

        const userTeamIds = teamMemberships.map(m => m.teamId);
        console.log(`🔍 Agent ${userIdStr} belongs to teams: [${userTeamIds.join(', ')}]`);

        // 建立查詢條件
        // Note: Individual assignment (assignedUserId) removed - only team-based access control
        const conditions = [
          // 條件1: 未指派 (搶單池) - 所有客服都可見
          isNull(conversations.assignedTeamId)
        ];

        // 條件2: 指派給我所屬的任一團隊（多團隊支援）
        if (userTeamIds.length > 0) {
          conditions.push(
            inArray(conversations.assignedTeamId, userTeamIds)
          );
        }

        const result = await drizzleDb
          .select({ id: conversations.id })
          .from(conversations)
          .where(or(...conditions))
          .orderBy(desc(conversations.updatedAt));

        console.log(`📋 Found ${result.length} conversations for agent ${userIdStr}`);
        return result.map(row => row.id);
      }

      return [];
    } catch (error) {
      console.error('Error in getVisibleConversations:', error);
      return [];
    }
  }
}