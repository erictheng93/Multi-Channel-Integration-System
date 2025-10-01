// Customer 權限中間件
// 提供客戶操作的權限驗證和資料過濾

import { Context, Next } from 'hono';
import { eq, or, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import {
  customers
} from '@/db/schema';
import {
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse
} from '@shared/utils/api-response';
import {
  CustomerPermissions,
  CustomerAccessScope
} from '../types/customer-types';
import type { Bindings, JWTPayload } from '@/types';

// ======================== 權限檢查中間件 ========================

/**
 * 檢查用戶是否有訪問客戶數據的基本權限
 */
export const checkCustomerAccess = async (c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> => {
  try {
    const payload = c.get('jwtPayload') as JWTPayload;

    if (!payload) {
      return unauthorizedResponse(c, 'Authentication required');
    }

    // JWT payload represents active token, so user is assumed active

    // 設置用戶權限到上下文中
    const permissions = getUserPermissions(payload);
    c.set('customerPermissions', permissions);

    // 設置訪問範圍
    const accessScope = getAccessScope(payload);
    c.set('customerAccessScope', accessScope);

    await next();
  } catch (error) {
    console.error('Error in customer access check:', error);
    return forbiddenResponse(c, 'Access denied');
  }
};

/**
 * 檢查用戶是否有特定客戶的訪問權限
 */
export const checkSpecificCustomerAccess = async (c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> => {
  try {
    const customerId = c.req.param('id');
    if (!customerId) {
      return c.json({ error: 'Customer ID is required' }, 400);
    }

    const payload = c.get('jwtPayload') as JWTPayload;
    const permissions = c.get('customerPermissions') as CustomerPermissions;

    if (!permissions.canView) {
      return forbiddenResponse(c, 'Insufficient permissions to view customer data');
    }

    // Admin 用戶可以訪問所有客戶
    if (payload.role === 'admin') {
      await next();
      return;
    }

    // 非 Admin 用戶需要檢查客戶是否屬於其團隊
    const drizzleDb = drizzle(c.env.DB);
    const customer = await drizzleDb
      .select({
        id: customers.id,
        sourceTeamId: customers.sourceTeamId
      })
      .from(customers)
      .where(eq(customers.id, parseInt(customerId)))
      .get();

    if (!customer) {
      return notFoundResponse(c, 'Customer');
    }

    // 檢查客戶是否屬於用戶的團隊或無團隊歸屬
    if (customer.sourceTeamId && customer.sourceTeamId !== payload.teamId) {
      return forbiddenResponse(c, 'Access denied to this customer');
    }

    await next();
  } catch (error) {
    console.error('Error in specific customer access check:', error);
    return forbiddenResponse(c, 'Access denied');
  }
};

/**
 * 檢查客戶編輯權限
 */
export const checkCustomerEditPermission = async (c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> => {
  try {
    const permissions = c.get('customerPermissions') as CustomerPermissions;

    if (!permissions.canEdit) {
      return forbiddenResponse(c, 'Insufficient permissions to edit customer data');
    }

    await next();
  } catch (error) {
    console.error('Error in customer edit permission check:', error);
    return forbiddenResponse(c, 'Access denied');
  }
};

/**
 * 檢查客戶刪除權限
 */
export const checkCustomerDeletePermission = async (c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> => {
  try {
    const permissions = c.get('customerPermissions') as CustomerPermissions;

    if (!permissions.canDelete) {
      return forbiddenResponse(c, 'Insufficient permissions to delete customer data');
    }

    await next();
  } catch (error) {
    console.error('Error in customer delete permission check:', error);
    return forbiddenResponse(c, 'Access denied');
  }
};

/**
 * 檢查標籤管理權限
 */
export const checkTagManagementPermission = async (c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> => {
  try {
    const permissions = c.get('customerPermissions') as CustomerPermissions;

    if (!permissions.canManageTags) {
      return forbiddenResponse(c, 'Insufficient permissions to manage customer tags');
    }

    await next();
  } catch (error) {
    console.error('Error in tag management permission check:', error);
    return forbiddenResponse(c, 'Access denied');
  }
};

/**
 * 檢查統計查看權限
 */
export const checkStatsViewPermission = async (c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> => {
  try {
    const permissions = c.get('customerPermissions') as CustomerPermissions;

    if (!permissions.canViewStats) {
      return forbiddenResponse(c, 'Insufficient permissions to view customer statistics');
    }

    await next();
  } catch (error) {
    console.error('Error in stats view permission check:', error);
    return forbiddenResponse(c, 'Access denied');
  }
};

/**
 * 檢查數據導出權限
 */
export const checkExportPermission = async (c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> => {
  try {
    const permissions = c.get('customerPermissions') as CustomerPermissions;

    if (!permissions.canExport) {
      return forbiddenResponse(c, 'Insufficient permissions to export customer data');
    }

    await next();
  } catch (error) {
    console.error('Error in export permission check:', error);
    return forbiddenResponse(c, 'Access denied');
  }
};

// ======================== 數據過濾中間件 ========================

/**
 * 添加團隊範圍過濾 (用於列表查詢)
 */
export const applyTeamScopeFilter = async (c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> => {
  try {
    const payload = c.get('jwtPayload') as JWTPayload;
    const accessScope = c.get('customerAccessScope') as CustomerAccessScope;

    // Admin 用戶不需要過濾
    if (accessScope.isGlobalAccess) {
      await next();
      return;
    }

    // 添加團隊範圍過濾到查詢參數中
    const existingTeamId = c.req.query('teamId');
    if (!existingTeamId && payload.teamId) {
      // 如果查詢中沒有指定團隊ID，則自動添加用戶的團隊ID到上下文
      if (!c.req.query('teamId')) {
        (c as any).set('teamFilters', { teamId: payload.teamId.toString() });
      }
    }

    await next();
  } catch (error) {
    console.error('Error applying team scope filter:', error);
    await next(); // 繼續處理，讓後續邏輯處理錯誤
  }
};

// ======================== 輔助函數 ========================

/**
 * 根據用戶角色獲取權限
 */
function getUserPermissions(payload: JWTPayload): CustomerPermissions {
  switch (payload.role) {
    case 'admin':
      return {
        canView: true,
        canEdit: true,
        canDelete: true,
        canManageTags: true,
        canViewStats: true,
        canExport: true
      };

    case 'team':
      return {
        canView: true,
        canEdit: true,
        canDelete: false, // 團隊角色不能刪除客戶
        canManageTags: true,
        canViewStats: true,
        canExport: true
      };

    case 'agent':
    default:
      return {
        canView: true,
        canEdit: false, // 普通代理不能編輯客戶信息
        canDelete: false,
        canManageTags: false,
        canViewStats: false,
        canExport: false
      };
  }
}

/**
 * 根據用戶角色獲取訪問範圍
 */
function getAccessScope(payload: JWTPayload): CustomerAccessScope {
  return {
    teamIds: payload.role === 'admin' ? undefined : [payload.teamId].filter(Boolean),
    platforms: undefined, // 暫時不限制平台，未來可擴展
    isGlobalAccess: payload.role === 'admin'
  };
}

/**
 * 檢查用戶是否有特定操作的權限
 */
export function checkPermission(
  permissions: CustomerPermissions,
  action: keyof CustomerPermissions
): boolean {
  return permissions[action] === true;
}

/**
 * 驗證客戶歸屬權限
 */
export async function validateCustomerOwnership(
  db: D1Database,
  customerId: number,
  userPayload: JWTPayload
): Promise<boolean> {
  // Admin 用戶擁有所有客戶的訪問權
  if (userPayload.role === 'admin') {
    return true;
  }

  // 檢查客戶是否屬於用戶的團隊
  const drizzleDb = drizzle(db);
  const customer = await drizzleDb
    .select({ sourceTeamId: customers.sourceTeamId })
    .from(customers)
    .where(eq(customers.id, customerId))
    .get();

  if (!customer) {
    return false;
  }

  // 客戶無團隊歸屬或屬於用戶團隊
  return !customer.sourceTeamId || customer.sourceTeamId === userPayload.teamId;
}

/**
 * 構建團隊範圍的資料庫條件
 */
export function buildTeamScopeCondition(userPayload: JWTPayload) {
  if (userPayload.role === 'admin') {
    return undefined; // 無條件限制
  }

  if (userPayload.teamId) {
    return or(
      eq(customers.sourceTeamId, userPayload.teamId),
      sql`${customers.sourceTeamId} IS NULL`
    );
  }

  return sql`${customers.sourceTeamId} IS NULL`; // 只能看無團隊歸屬的客戶
}