// File Management 認證中間件

import type { Context, Next } from 'hono';
import type { Bindings } from '../../../types';
import { unauthorizedResponse, forbiddenResponse } from '../../../utils/api-response';

/**
 * 檔案訪問權限驗證中間件
 */
export async function fileAuthMiddleware(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const user = c.get('user');

    if (!user) {
      return unauthorizedResponse(c, 'Authentication required for file operations');
    }

    // 基本權限檢查
    const hasFileAccess = checkFilePermissions(user.role, c.req.method, c.req.path);

    if (!hasFileAccess) {
      return forbiddenResponse(c, 'Insufficient permissions for file operation');
    }

    await next();

  } catch (error) {
    console.error('File auth middleware error:', error);
    return unauthorizedResponse(c, 'Authentication system error');
  }
}

/**
 * 檢查檔案權限
 */
function checkFilePermissions(userRole: string, method: string, path: string): boolean {
  const permissions = getFilePermissions(userRole);

  // 基本的 CRUD 權限檢查
  if (method === 'GET' && path.includes('/download')) {
    return permissions.includes('file:read');
  }

  if (method === 'POST' && path.includes('/upload')) {
    return permissions.includes('file:create');
  }

  if (method === 'DELETE') {
    return permissions.includes('file:delete');
  }

  if (method === 'GET' && (path.includes('/stats') || path.includes('/list'))) {
    return permissions.includes('file:read');
  }

  return permissions.includes('file:read');
}

/**
 * 獲取用戶角色的檔案權限
 */
function getFilePermissions(userRole: string): string[] {
  const rolePermissions: Record<string, string[]> = {
    admin: [
      'file:create',
      'file:read',
      'file:update',
      'file:delete',
      'file:manage'
    ],
    team: [
      'file:create',
      'file:read',
      'file:update',
      'file:delete'
    ],
    agent: [
      'file:create',
      'file:read'
    ]
  };

  return rolePermissions[userRole] || [];
}