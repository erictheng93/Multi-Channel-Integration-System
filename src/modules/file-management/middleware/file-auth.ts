// File Management 認證中間件

import type { Context, Next } from 'hono';
import type { Bindings } from '@/types';
import { unauthorizedResponse, forbiddenResponse } from '@/utils/api-response';
import { PermissionService } from '@shared/services/permission-service';
import type { PermissionContext } from '@/types/services';

/**
 * 檔案訪問權限驗證中間件
 * 使用 PermissionService 進行細緻權限檢查
 */
export async function fileAuthMiddleware(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const user = c.get('user');

    if (!user) {
      return unauthorizedResponse(c, 'Authentication required for file operations');
    }

    // 確定需要檢查的操作類型
    const action = determineFileAction(c.req.method, c.req.path);

    // 構建權限上下文
    const context: PermissionContext = {
      userId: user.id,
      role: user.role,
      teamId: user.teamId ?? undefined
    };

    // 使用 PermissionService 檢查權限
    const hasPermission = await PermissionService.checkPermission(
      user.id,
      'file',
      action,
      context,
      c.env.DB
    );

    if (!hasPermission) {
      return forbiddenResponse(c, `Insufficient permissions for file ${action} operation`);
    }

    await next();

  } catch (error) {
    console.error('File auth middleware error:', error);
    return unauthorizedResponse(c, 'Authentication system error');
  }
}

/**
 * 根據 HTTP 方法和路徑確定檔案操作類型
 */
function determineFileAction(method: string, path: string): string {
  // 上傳操作
  if (method === 'POST' && !path.includes('/stats')) {
    return 'upload';
  }

  // 刪除操作
  if (method === 'DELETE') {
    return 'delete';
  }

  // 下載操作
  if (method === 'GET' && (path.includes('/download') || path.match(/\/files\/[^\/]+$/))) {
    return 'download';
  }

  // 查看操作（列表、統計等）
  return 'view';
}