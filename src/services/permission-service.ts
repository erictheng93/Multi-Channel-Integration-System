// 權限管理服務
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
  // Role hierarchy: admin > team > agent
  private static roleHierarchy = {
    admin: 3,
    team: 2, 
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
    team: {
      id: 'team',
      name: '團隊負責人',
      permissions: [
        // Conversation management for team
        { resource: 'conversation', action: 'view', conditions: { teamScope: true } },
        { resource: 'conversation', action: 'assign' },
        { resource: 'conversation', action: 'transfer' },
        { resource: 'conversation', action: 'close' },
        { resource: 'conversation', action: 'reopen' },
        
        // Team management permissions
        { resource: 'team', action: 'view', conditions: { ownTeam: true } },
        { resource: 'team', action: 'manage', conditions: { ownTeam: true } },
        { resource: 'team', action: 'invite', conditions: { ownTeam: true } },
        
        // Agent management within team
        { resource: 'agent', action: 'view', conditions: { teamScope: true } },
        { resource: 'agent', action: 'invite', conditions: { ownTeam: true } },
        
        // Customer management for team
        { resource: 'customer', action: 'view', conditions: { teamScope: true } },
        { resource: 'customer', action: 'edit', conditions: { teamScope: true } },
        { resource: 'customer', action: 'tag', conditions: { teamScope: true } },
        
        // Message management for team conversations
        { resource: 'message', action: 'view', conditions: { teamScope: true } },
        { resource: 'message', action: 'send' },
        { resource: 'message', action: 'recall', conditions: { teamScope: true } },
        
        // Tag management for team
        { resource: 'tag', action: '*', conditions: { teamScope: true } },
        
        // QR Code generation
        { resource: 'qrcode', action: 'generate' },
        
        // Analytics and reporting for team
        { resource: 'analytics', action: 'view', conditions: { teamScope: true } },
        { resource: 'report', action: 'generate', conditions: { teamScope: true } }
      ]
    },
    agent: {
      id: 'agent',
      name: '客服人員',
      permissions: [
        { resource: 'conversation', action: 'view', conditions: { assigned: true } },
        { resource: 'conversation', action: 'reply' },
        { resource: 'message', action: 'send' },
        { resource: 'message', action: 'recall', conditions: { own: true } },
        { resource: 'tag', action: 'add', conditions: { teamScope: true } }
      ]
    }
  };

  static async checkPermission(
    userId: number,
    resource: string,
    action: string,
    context?: PermissionContext,
    db?: D1Database
  ): Promise<boolean> {
    // Input validation
    if (!userId || userId <= 0 || !resource || !action) {
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
        return this.checkConditions(permission.conditions, user, context);
      }

      return true;
    } catch (error) {
      throw error; // Re-throw database errors for proper error handling
    }
  }

  private static checkConditions(
    conditions: Record<string, unknown>,
    user: UserPermissionData,
    context?: PermissionContext
  ): boolean {
    if (!context) {
      // If conditions require context but none provided, fail
      return false;
    }

    // 團隊範圍限制
    if (conditions.teamScope && context.teamId !== user.teamId) {
      return false;
    }

    // 只能操作指派給自己的對話
    if (conditions.assigned && (context as any).assignedUserId !== user.id) {
      return false;
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
    const userLevel = this.roleHierarchy[userRole as keyof typeof this.roleHierarchy] || 0;
    const requiredLevel = this.roleHierarchy[requiredRole as keyof typeof this.roleHierarchy] || 0;
    return userLevel >= requiredLevel;
  }

  // Get all roles that a user can manage (lower hierarchy roles)
  static getManagedRoles(userRole: string): string[] {
    const userLevel = this.roleHierarchy[userRole as keyof typeof this.roleHierarchy] || 0;
    return Object.keys(this.roleHierarchy).filter(role => 
      this.roleHierarchy[role as keyof typeof this.roleHierarchy] < userLevel
    );
  }

  private static async getUserWithTeam(userId: number, db?: D1Database) {
    if (!db) {
      // 暫時返回模擬資料，實際使用時需要傳入 db
      return {
        id: userId,
        role: 'agent',
        team_id: 1,
        teamId: 1,
        isActive: true
      };
    }

    try {
      const user = await db
        .prepare('SELECT id, role, team_id, is_active FROM agents WHERE id = ?')
        .bind(userId.toString())
        .first<{ id: string; role: string; team_id: number | null; is_active: boolean }>();

      if (!user || !user.is_active) {
        return null;
      }

      return {
        id: parseInt(user.id),
        role: user.role,
        team_id: user.team_id,
        teamId: user.team_id,
        isActive: user.is_active
      };
    } catch (error) {
      console.error('Failed to get user:', error);
      return null;
    }
  }

  // 獲取用戶可見的對話列表
  static async getVisibleConversations(userId: number): Promise<number[]> {
    const user = await this.getUserWithTeam(userId);
    if (!user) return [];

    // Admin 可以看到所有對話
    if (user.role === 'admin') {
      // 返回所有對話 ID
      return []; // 實際實作中從資料庫查詢
    }

    // Manager 可以看到團隊內的所有對話
    if (user.role === 'team') {
      // 返回團隊內的對話 ID
      return []; // 實際實作中從資料庫查詢
    }

    // Agent 只能看到指派給自己的對話
    if (user.role === 'agent') {
      // 返回指派給該用戶的對話 ID
      return []; // 實際實作中從資料庫查詢
    }

    return [];
  }
}