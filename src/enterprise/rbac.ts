// 企業級權限控制系統實現
import type { Context, Next } from 'hono';
import type { Bindings, DbUser } from '../types';
import type {
  RBACContext
} from '../types/enterprise';

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
  permissions: Permission[];
  isSystem: boolean;
}

// 權限檢查結果
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  context?: RBACContext;
}

// 企業級權限管理器
export class EnterpriseRBACManager {
  private db: D1Database;
  private kv: KVNamespace;
  
  constructor(db: D1Database, kv: KVNamespace) {
    this.db = db;
    this.kv = kv;
  }
  
  // 檢查用戶權限
  async checkPermission(
    userId: number,
    resource: string,
    action: string,
    context: RBACContext = {} as RBACContext
  ): Promise<PermissionCheckResult> {
    try {
      // 從緩存獲取用戶權限
      const userPermissions = await this.getUserPermissions(userId);
      
      // 檢查直接權限
      const directPermission = userPermissions.find(p => 
        p.resource === resource && p.action === action
      );
      
      if (directPermission) {
        return { allowed: true };
      }
      
      // 檢查通配符權限
      const wildcardPermission = userPermissions.find(p => 
        (p.resource === '*' || p.resource === resource) && 
        (p.action === '*' || p.action === action)
      );
      
      if (wildcardPermission) {
        return { allowed: true };
      }
      
      // 檢查上下文相關權限
      const contextResult = await this.checkContextualPermission(
        userId, resource, action, context
      );
      
      if (contextResult.allowed) {
        return contextResult;
      }
      
      return {
        allowed: false,
        reason: `User ${userId} does not have permission for ${resource}:${action}`
      };
      
    } catch (error) {
      return {
        allowed: false,
        reason: `Permission check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  // 獲取用戶所有權限
  private async getUserPermissions(userId: number): Promise<Permission[]> {
    const cacheKey = `user_permissions:${userId}`;
    
    // 嘗試從緩存獲取
    const cached = await this.kv.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // 從資料庫查詢
    const permissions = await this.db.prepare(`
      SELECT DISTINCT p.id, p.resource, p.action, p.description
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = ? 
        AND ur.is_active = 1 
        AND (ur.expires_at IS NULL OR ur.expires_at > datetime('now'))
        AND rp.granted = 1
    `).bind(userId).all();
    
    const permissionList = permissions.results.map(p => ({
      id: p.id as string,
      resource: p.resource as string,
      action: p.action as string,
      description: p.description as string
    }));
    
    // 緩存結果（5分鐘）
    await this.kv.put(cacheKey, JSON.stringify(permissionList), {
      expirationTtl: 5 * 60
    });
    
    return permissionList;
  }
  
  // 檢查上下文相關權限
  private async checkContextualPermission(
    userId: number,
    resource: string,
    _action: string,
    context: any
  ): Promise<PermissionCheckResult> {
    // 檢查資源所有權
    if (resource === 'conversation' && context.conversationId) {
      const conversation = await this.db.prepare(`
        SELECT assigned_user_id, assigned_team_id 
        FROM conversations 
        WHERE id = ?
      `).bind(context.conversationId).first();
      
      if (conversation?.assigned_user_id === userId) {
        return { allowed: true, reason: 'Resource owner' };
      }
      
      // 檢查團隊權限
      const user = await this.db.prepare(`
        SELECT team_id, role FROM users WHERE id = ?
      `).bind(userId).first();
      
      if (user?.team_id === conversation?.assigned_team_id) {
        return { allowed: true, reason: 'Team member' };
      }
    }
    
    // 檢查時間限制
    if (context.timeRestriction) {
      const currentHour = new Date().getHours();
      if (currentHour < context.timeRestriction.start || 
          currentHour > context.timeRestriction.end) {
        return { 
          allowed: false, 
          reason: 'Outside allowed time window' 
        };
      }
    }
    
    return { allowed: false };
  }
  
  // 分配角色給用戶
  async assignRole(
    userId: number,
    roleId: string,
    grantedBy: number,
    expiresAt?: Date
  ): Promise<void> {
    await this.db.prepare(`
      INSERT OR REPLACE INTO user_roles 
      (user_id, role_id, granted_by, granted_at, expires_at, is_active)
      VALUES (?, ?, ?, datetime('now'), ?, 1)
    `).bind(
      userId,
      roleId,
      grantedBy,
      expiresAt ? expiresAt.toISOString() : null
    ).run();
    
    // 清除用戶權限緩存
    await this.kv.delete(`user_permissions:${userId}`);
  }
  
  // 撤銷用戶角色
  async revokeRole(userId: number, roleId: string): Promise<void> {
    await this.db.prepare(`
      UPDATE user_roles 
      SET is_active = 0 
      WHERE user_id = ? AND role_id = ?
    `).bind(userId, roleId).run();
    
    // 清除用戶權限緩存
    await this.kv.delete(`user_permissions:${userId}`);
  }
  
  // 創建自定義角色
  async createRole(
    roleData: {
      name: string;
      displayName: string;
      permissions: string[];
    },
    _createdBy: number
  ): Promise<Role> {
    const roleId = crypto.randomUUID();
    
    // 創建角色
    await this.db.prepare(`
      INSERT INTO roles (id, name, display_name, is_system, created_at)
      VALUES (?, ?, ?, 0, datetime('now'))
    `).bind(roleId, roleData.name, roleData.displayName).run();
    
    // 分配權限
    for (const permissionId of roleData.permissions) {
      await this.db.prepare(`
        INSERT INTO role_permissions (role_id, permission_id, granted)
        VALUES (?, ?, 1)
      `).bind(roleId, permissionId).run();
    }
    
    return {
      id: roleId,
      name: roleData.name,
      displayName: roleData.displayName,
      permissions: await this.getRolePermissions(roleId),
      isSystem: false
    };
  }
  
  // 獲取角色權限
  private async getRolePermissions(roleId: string): Promise<Permission[]> {
    const permissions = await this.db.prepare(`
      SELECT p.id, p.resource, p.action, p.description
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ? AND rp.granted = 1
    `).bind(roleId).all();
    
    return permissions.results.map(p => ({
      id: p.id as string,
      resource: p.resource as string,
      action: p.action as string,
      description: p.description as string
    }));
  }
}

// 權限中間件
export function requirePermission(resource: string, action: string) {
  return async (c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> => {
    const user = c.get('user') as DbUser;
    
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }
    
    const rbac = new EnterpriseRBACManager(c.env.DB, c.env.KV);
    const result = await rbac.checkPermission(
      typeof user.id === 'string' ? parseInt(user.id, 10) : user.id,
      resource,
      action,
      {
        userId: typeof user.id === 'string' ? parseInt(user.id, 10) : user.id,
        action,
        resource,
        conversationId: parseInt(c.req.param('id') || '0'),
        metadata: {
          clientIP: c.req.header('CF-Connecting-IP'),
          userAgent: c.req.header('User-Agent')
        }
      }
    );
    
    if (!result.allowed) {
      return c.json({
        error: 'Insufficient permissions',
        reason: result.reason,
        required: `${resource}:${action}`
      }, 403);
    }
    
    await next();
  };
}

// 預定義權限
export const PERMISSIONS = {
  // 用戶管理
  USER_CREATE: { resource: 'user', action: 'create' },
  USER_READ: { resource: 'user', action: 'read' },
  USER_UPDATE: { resource: 'user', action: 'update' },
  USER_DELETE: { resource: 'user', action: 'delete' },
  
  // 對話管理
  CONVERSATION_VIEW_ALL: { resource: 'conversation', action: 'view_all' },
  CONVERSATION_VIEW_TEAM: { resource: 'conversation', action: 'view_team' },
  CONVERSATION_VIEW_OWN: { resource: 'conversation', action: 'view_own' },
  CONVERSATION_ASSIGN: { resource: 'conversation', action: 'assign' },
  CONVERSATION_TRANSFER: { resource: 'conversation', action: 'transfer' },
  CONVERSATION_CLOSE: { resource: 'conversation', action: 'close' },
  
  // 訊息管理
  MESSAGE_SEND: { resource: 'message', action: 'send' },
  MESSAGE_EDIT: { resource: 'message', action: 'edit' },
  MESSAGE_DELETE: { resource: 'message', action: 'delete' },
  MESSAGE_RECALL: { resource: 'message', action: 'recall' },
  
  // 系統管理
  SYSTEM_SETTINGS: { resource: 'system', action: 'settings' },
  SYSTEM_LOGS: { resource: 'system', action: 'logs' },
  SYSTEM_ANALYTICS: { resource: 'system', action: 'analytics' },
  
  // 超級權限
  ALL: { resource: '*', action: '*' }
} as const;

// 預定義角色
export const ROLES = {
  SUPER_ADMIN: {
    name: 'super_admin',
    displayName: '超級管理員',
    permissions: [PERMISSIONS.ALL]
  },
  ADMIN: {
    name: 'admin',
    displayName: '管理員',
    permissions: [
      PERMISSIONS.USER_CREATE,
      PERMISSIONS.USER_READ,
      PERMISSIONS.USER_UPDATE,
      PERMISSIONS.CONVERSATION_VIEW_ALL,
      PERMISSIONS.CONVERSATION_ASSIGN,
      PERMISSIONS.CONVERSATION_TRANSFER,
      PERMISSIONS.SYSTEM_SETTINGS,
      PERMISSIONS.SYSTEM_ANALYTICS
    ]
  },
  TEAM_LEAD: {
    name: 'team_lead',
    displayName: '團隊主管',
    permissions: [
      PERMISSIONS.USER_READ,
      PERMISSIONS.CONVERSATION_VIEW_TEAM,
      PERMISSIONS.CONVERSATION_ASSIGN,
      PERMISSIONS.MESSAGE_SEND,
      PERMISSIONS.MESSAGE_EDIT
    ]
  },
  AGENT: {
    name: 'agent',
    displayName: '客服人員',
    permissions: [
      PERMISSIONS.CONVERSATION_VIEW_OWN,
      PERMISSIONS.CONVERSATION_CLOSE,
      PERMISSIONS.MESSAGE_SEND,
      PERMISSIONS.MESSAGE_EDIT
    ]
  }
} as const;