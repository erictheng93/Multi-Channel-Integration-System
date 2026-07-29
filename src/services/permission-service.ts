// 權限管理服務
import { eq, and } from 'drizzle-orm';
import { createDbClient } from '../db/drizzle-factory';
import { agents, conversations } from '../db/schema';
import { getPrimaryTeamId } from '../modules/teams/services/agent-teams-service';
import { createContextLogger } from '../utils/logger';
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

const log = createContextLogger('PermissionService');

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
        // F8 fix: previously `view` had no conditions, so checkPermission
        // returned true for ANY conversation ID. Combined with handlers that
        // delegate access decisions to PermissionService (conversation-queries,
        // conversation-read, conversation-messages GET), an agent could read
        // any conversation's full message history, customer PII, and bump
        // last_read_at on any conversation system-wide — defeating the team
        // canonical team visibility rule used by conversation list queries.
        // The `assigned` condition runs the same assignedTeamId check used by
        // 'reply' and 'message.send' below, so view inherits the same team
        // semantics (unassigned conversations remain visible — shared pool).
        { resource: 'conversation', action: 'view', conditions: { assigned: true } },
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
    userId: string | number, //  支持字符串和數字ID
    resource: string,
    action: string,
    context?: PermissionContext,
    db?: D1Database
  ): Promise<boolean> {
    // 修正輸入驗證邏輯
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
    if (conditions.teamScope && context.teamId !== user.primaryTeamId) {
      return false;
    }

    // 只能操作指派給自己團隊的對話
    // Note: Individual assignment (assignedUserId) removed - use team-based access control instead
    if (conditions.assigned) {
      if (resource === 'conversation' && context.resourceId && db) {
        // 查詢對話的 assignedTeamId
        try {
          const drizzleDb = createDbClient(db);
          const conversation = await drizzleDb
            .select({ assignedTeamId: conversations.assignedTeamId })
            .from(conversations)
            .where(eq(conversations.id, String(context.resourceId)))
            .get();

          log.debug('Conversation team assignment checked', {
            conversationId: context.resourceId,
            assignedTeamId: conversation?.assignedTeamId,
            userTeamId: user.primaryTeamId
          });

          // 如果對話未指派給任何團隊，允許訪問
          if (!conversation || !conversation.assignedTeamId) {
            return true;
          }

          // 檢查是否指派給用戶的團隊
          return conversation.assignedTeamId === user.primaryTeamId;
        } catch (error) {
          log.error(
            'Failed to check conversation team assignment',
            { conversationId: context.resourceId },
            error instanceof Error ? error : new Error(String(error))
          );
          return false;
        }
      } else {
        // 對於非對話資源，檢查 teamId
        return context.teamId === user.primaryTeamId;
      }
    }

    // 只能操作自己的資源
    if (conditions.own && context.metadata?.ownerId !== user.id) {
      return false;
    }

    // 只能管理自己的團隊
    if (conditions.ownTeam && context.teamId !== user.primaryTeamId) {
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
    if (!db) {
      log.warn('No database provided; denying access');
      return null;
    }

    try {
      const drizzleDb = createDbClient(db);
      const userIdStr = typeof userId === 'string' ? userId : userId.toString();
      
      const user = await drizzleDb
        .select({
          id: agents.id,
          role: agents.role,
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

      if (!user) {
        log.debug('Active user not found', { userId: userIdStr });
        return null;
      }

      // Get primary team from agent_teams (single source of truth)
      const primaryTeamId = await getPrimaryTeamId(drizzleDb, userIdStr);

      const userData = {
        id: user.id,
        role: user.role as string,
        primaryTeamId: primaryTeamId || 0, // Default to 0 if null
        isActive: Boolean(user.isActive)
      };
      
      return userData;
    } catch (error) {
      log.error(
        'Failed to load user permission data',
        { userId: String(userId) },
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }
}
