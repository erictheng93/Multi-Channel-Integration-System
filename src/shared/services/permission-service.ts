// 權限管理服務
import { eq, and, isNull, or, desc } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { agents, conversations } from '@shared/database/schema';
import type {
  // PermissionRule,
  PermissionContext,
  UserPermissionData
} from '../../types/services';

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
        { resource: 'message', action: 'send' }, // Team Leader 可以發送訊息到任何對話
        { resource: 'message', action: 'recall', conditions: { teamScope: true } },
        
        // Tag management for team
        { resource: 'tag', action: '*', conditions: { teamScope: true } },
        
        // QR Code generation
        { resource: 'qrcode', action: 'generate' },
        
        // Analytics and reporting for team
        { resource: 'analytics', action: 'view', conditions: { teamScope: true } },
        { resource: 'analytics', action: 'export', conditions: { teamScope: true } },
        { resource: 'analytics', action: 'query' }, // Custom queries allowed

        // Reports management for team
        { resource: 'report', action: 'create', conditions: { teamScope: true } },
        { resource: 'report', action: 'read', conditions: { teamScope: true } },
        { resource: 'report', action: 'delete', conditions: { own: true } }, // Only own reports
        { resource: 'report', action: 'export', conditions: { teamScope: true } },
        { resource: 'report', action: 'schedule', conditions: { teamScope: true } },

        // File management for team
        { resource: 'file', action: 'upload' }, // Can upload files
        { resource: 'file', action: 'download', conditions: { teamScope: true } },
        { resource: 'file', action: 'delete', conditions: { own: true } }, // Only own files
        { resource: 'file', action: 'view', conditions: { teamScope: true } }
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
        { resource: 'tag', action: 'add', conditions: { teamScope: true } },

        // Analytics - read only for own data
        { resource: 'analytics', action: 'view', conditions: { own: true } },

        // Reports - can view own reports only
        { resource: 'report', action: 'read', conditions: { own: true } },

        // File management - limited to own files
        { resource: 'file', action: 'upload' }, // Can upload files in conversations
        { resource: 'file', action: 'download', conditions: { own: true } },
        { resource: 'file', action: 'view', conditions: { own: true } },
        { resource: 'file', action: 'delete', conditions: { own: true } }
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

    // 只能操作指派給自己的對話
    if (conditions.assigned) {
      if (resource === 'conversation' && context && (context as any).resourceId && db) {
        // 查詢對話的assignedUserId
        try {
          const drizzleDb = drizzle(db);
          const conversation = await drizzleDb
            .select({ assignedUserId: conversations.assignedUserId })
            .from(conversations)
            .where(eq(conversations.id, (context as any).resourceId))
            .get();
          
          console.log(`🔍 Conversation assignment check - ConversationId: ${(context as any).resourceId}, AssignedUserId: ${conversation?.assignedUserId}, UserId: ${user.id}`);
          
          // 如果對話未指派給任何人，允許訪問
          if (!conversation || !conversation.assignedUserId) {
            return true;
          }
          
          // 檢查是否指派給當前用戶
          const userIdStr = typeof user.id === 'string' ? user.id : user.id.toString();
          return conversation.assignedUserId === userIdStr;
        } catch (error) {
          console.error('Failed to check conversation assignment:', error);
          return false;
        }
      } else {
        // 對於非對話資源，直接檢查assignedUserId
        return (context as any).assignedUserId === user.id;
      }
    }

    // 只能操作自己的資源
    if (conditions.own) {
      // 如果沒有提供 ownerId，說明這是 middleware 層的基本權限檢查
      // 實際的所有權驗證應該在 handler 層進行（當有 resourceId 時）
      if ((context as any).ownerId === undefined) {
        // Middleware 層：允許通過，讓 handler 層驗證
        return true;
      }

      // Handler 層：有 ownerId，進行實際的所有權檢查
      if ((context as any).ownerId !== user.id) {
        return false;
      }
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
      console.log('⚠️  No database provided, returning mock data');
      // 暫時返回模擬資料，實際使用時需要傳入 db
      return {
        id: typeof userId === 'string' ? parseInt(userId) : userId,
        role: 'agent',
        teamId: 1,
        isActive: true
      };
    }

    try {
      const drizzleDb = drizzle(db);
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
        const drizzleDb = drizzle(database);
        const result = await drizzleDb
          .select({ id: conversations.id })
          .from(conversations)
          .orderBy(desc(conversations.updatedAt));
        return result.map(row => row.id);
      }

      // Manager 可以看到團隊內的所有對話
      if (user.role === 'team' && user.teamId) {
        const drizzleDb = drizzle(database);
        const result = await drizzleDb
          .select({ id: conversations.id })
          .from(conversations)
          .where(
            or(
              // 未指派 (搶單池) - 兩個欄位都必須是 NULL
              and(
                isNull(conversations.assignedTeamId),
                isNull(conversations.assignedUserId)
              ),
              // 指派給本團隊 (直接檢查 assignedTeamId，不依賴 JOIN)
              eq(conversations.assignedTeamId, user.teamId)
            )
          )
          .orderBy(desc(conversations.updatedAt));
        return result.map(row => row.id);
      }

      // Agent 可以看到：1) 搶單池 2) 指派給自己 3) 本團隊對話(如果有團隊)
      if (user.role === 'agent') {
        const userIdStr = typeof userId === 'string' ? userId : userId.toString();
        console.log(`🔍 Agent ${userIdStr} (role: ${user.role}, teamId: ${user.teamId}) searching for conversations`);

        const drizzleDb = drizzle(database);

        // 建立查詢條件
        const conditions = [
          // 條件1: 未指派 (搶單池) - 兩個欄位都必須是 NULL
          and(
            isNull(conversations.assignedTeamId),
            isNull(conversations.assignedUserId)
          ),
          // 條件2: 指派給我個人
          eq(conversations.assignedUserId, userIdStr)
        ];

        // 條件3: 如果我有團隊，可以看團隊對話
        if (user.teamId) {
          conditions.push(
            eq(conversations.assignedTeamId, user.teamId)
          );
        }

        const result = await drizzleDb
          .select({ id: conversations.id })
          .from(conversations)
          .where(or(...conditions))
          .orderBy(desc(conversations.updatedAt));

        console.log(`📋 Found ${result.length} conversations for agent ${userIdStr}:`, result.map(r => r.id));
        return result.map(row => row.id);
      }

      return [];
    } catch (error) {
      console.error('Error in getVisibleConversations:', error);
      return [];
    }
  }
}