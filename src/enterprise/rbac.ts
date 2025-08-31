// 企業級權限控制系統實現
import type { Context, Next } from 'hono';
import type { Bindings, DbUser } from '../types';
import type { RBACContext } from '../types/enterprise';

// 權限定義
export interface Permission {
  id: string;
  resource: string;
  action: string;
  description: string;
}

export interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string;
  permissions: Permission[];
  level: number; // 0=admin, 1=team, 2=agent
}

// 權限檢查結果
export interface PermissionCheckResult {
  granted: boolean;
  reason?: string;
  requiredRole?: string;
  userRole?: string;
}

// 企業級權限管理器
export class EnterpriseRBACManager {
  private db: D1Database;
  private kv: KVNamespace;
  
  constructor(db: D1Database, kv: KVNamespace) {
    this.db = db;
    this.kv = kv;
  }
  
  // 檢查權限
  async checkPermission(
    user: DbUser,
    resource: string,
    action: string,
    context: Partial<RBACContext> = {}
  ): Promise<PermissionCheckResult> {
    try {
      // 快取權限檢查
      const cacheKey = `permission:${user.id}:${resource}:${action}`;
      const cached = await this.kv.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // 基本角色檢查
      const result = this.checkBasicPermission(user, resource, action);
      
      // 資源特定檢查
      if (result.granted && context.resourceId) {
        const resourceCheck = await this.checkResourceAccess(user, resource, String(context.resourceId));
        if (!resourceCheck.granted) {
          result.granted = false;
          result.reason = resourceCheck.reason || 'Access denied';
        }
      }

      // 快取結果 (30秒)
      await this.kv.put(cacheKey, JSON.stringify(result), { expirationTtl: 30 });
      
      return result;
    } catch (error) {
      console.error('Permission check error:', error);
      return { granted: false, reason: 'Permission check failed' };
    }
  }

  // 基本權限檢查
  private checkBasicPermission(user: DbUser, resource: string, action: string): PermissionCheckResult {
    const userRole = user.role?.toLowerCase() || 'agent';
    
    // Admin 有所有權限
    if (userRole === 'admin') {
      return { granted: true, userRole };
    }
    
    // Team 角色權限
    if (userRole === 'team') {
      const teamPermissions = [
        'conversation:view', 'conversation:assign', 'conversation:transfer',
        'customer:view', 'customer:edit',
        'team:view', 'team:manage_agents',
        'message:send', 'message:recall',
        'analytics:view_team'
      ];
      
      const permission = `${resource}:${action}`;
      if (teamPermissions.includes(permission)) {
        return { granted: true, userRole };
      }
    }
    
    // Agent 基本權限
    if (userRole === 'agent') {
      const agentPermissions = [
        'conversation:view', 'conversation:respond',
        'customer:view',
        'message:send', 'message:recall'
      ];
      
      const permission = `${resource}:${action}`;
      if (agentPermissions.includes(permission)) {
        return { granted: true, userRole };
      }
    }
    
    return { 
      granted: false, 
      reason: `Role '${userRole}' does not have permission '${resource}:${action}'`,
      userRole,
      requiredRole: this.getRequiredRole(resource, action)
    };
  }

  // 資源存取檢查
  private async checkResourceAccess(user: DbUser, resource: string, resourceId: string): Promise<PermissionCheckResult> {
    const userRole = user.role?.toLowerCase() || 'agent';
    
    // Admin 可存取所有資源
    if (userRole === 'admin') {
      return { granted: true };
    }
    
    // 對話資源檢查
    if (resource === 'conversation') {
      try {
        const { drizzle } = await import('drizzle-orm/d1');
        const { eq } = await import('drizzle-orm');
        const { conversations } = await import('../db/schema');
        const db = drizzle(this.db);
        
        const conversation = await db
          .select({
            assignedUserId: conversations.assignedUserId,
            assignedTeamId: conversations.assignedTeamId
          })
          .from(conversations)
          .where(eq(conversations.id, resourceId))
          .get();
        
        if (!conversation) {
          return { granted: false, reason: 'Conversation not found' };
        }
        
        // Team 可存取同團隊的對話
        if (userRole === 'team' && user.teamId && 
            conversation.assignedTeamId === user.teamId) {
          return { granted: true };
        }
        
        // Agent 只能存取指派給自己的對話
        if (userRole === 'agent' && conversation.assignedUserId === String(user.id)) {
          return { granted: true };
        }
        
        return { granted: false, reason: 'No access to this conversation' };
      } catch (error) {
        console.error('Resource access check error:', error);
        return { granted: false, reason: 'Resource access check failed' };
      }
    }
    
    return { granted: true }; // 預設允許
  }

  // 取得所需角色
  private getRequiredRole(resource: string, action: string): string {
    const adminActions = ['system:*', 'user:create', 'user:delete', 'team:create', 'team:delete'];
    const teamActions = ['team:manage', 'analytics:view_team', 'conversation:assign'];
    
    const permission = `${resource}:${action}`;
    
    if (adminActions.some(p => p === permission || p.endsWith(':*'))) {
      return 'admin';
    }
    
    if (teamActions.includes(permission)) {
      return 'team';
    }
    
    return 'agent';
  }

  // 角色管理
  async getUserRoles(userId: string): Promise<Role[]> {
    try {
      const { drizzle } = await import('drizzle-orm/d1');
      const { eq } = await import('drizzle-orm');
      const { agents } = await import('../db/schema');
      const db = drizzle(this.db);
      
      const user = await db
        .select({
          role: agents.role,
          teamId: agents.teamId
        })
        .from(agents)
        .where(eq(agents.id, userId))
        .get();
      
      if (!user) return [];
      
      const roleMap: Record<string, Role> = {
        admin: {
          id: 'admin',
          name: 'admin',
          displayName: 'Administrator',
          description: 'Full system access',
          permissions: [],
          level: 0
        },
        team: {
          id: 'team',
          name: 'team',
          displayName: 'Team Leader',
          description: 'Team management access',
          permissions: [],
          level: 1
        },
        agent: {
          id: 'agent',
          name: 'agent',
          displayName: 'Agent',
          description: 'Basic agent access',
          permissions: [],
          level: 2
        }
      };
      
      const role = user.role ? roleMap[user.role as string] : undefined;
      return role ? [role] : [];
    } catch (error) {
      console.error('Get user roles error:', error);
      return [];
    }
  }

  // 權限列表
  async getAvailablePermissions(): Promise<Permission[]> {
    return [
      { id: '1', resource: 'conversation', action: 'view', description: 'View conversations' },
      { id: '2', resource: 'conversation', action: 'assign', description: 'Assign conversations' },
      { id: '3', resource: 'conversation', action: 'transfer', description: 'Transfer conversations' },
      { id: '4', resource: 'customer', action: 'view', description: 'View customers' },
      { id: '5', resource: 'customer', action: 'edit', description: 'Edit customers' },
      { id: '6', resource: 'message', action: 'send', description: 'Send messages' },
      { id: '7', resource: 'message', action: 'recall', description: 'Recall messages' },
      { id: '8', resource: 'team', action: 'view', description: 'View teams' },
      { id: '9', resource: 'team', action: 'manage', description: 'Manage teams' },
      { id: '10', resource: 'analytics', action: 'view', description: 'View analytics' }
    ];
  }
}

// RBAC 中間件
export function rbacMiddleware(resource: string, action: string) {
  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    const user = c.get('user') as DbUser;
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const rbac = new EnterpriseRBACManager(c.env.DB, c.env.KV);
    const result = await rbac.checkPermission(user, resource, action, {
      resourceId: c.req.param('id')
    });

    if (!result.granted) {
      return c.json({ 
        error: 'Forbidden', 
        reason: result.reason,
        requiredRole: result.requiredRole,
        userRole: result.userRole
      }, 403);
    }

    return await next();
  };
}

// 權限檢查裝飾器
export function requirePermission(resource: string, action: string) {
  return rbacMiddleware(resource, action);
}