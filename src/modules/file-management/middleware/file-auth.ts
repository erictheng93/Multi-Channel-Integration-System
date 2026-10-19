// File Management 認證中間件

import type { Context, Next } from 'hono';
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('FileAuth')

import type { Bindings } from '@/types';
import { unauthorizedResponse, forbiddenResponse, notFoundResponse, badRequestResponse } from '@/utils/api-response';
import { createDbClient } from '@/db/drizzle-factory';
import { fileAttachments, messages } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { canConversationBeAccessedBy } from '@/services/conversation-access';
import { PermissionService } from '@/services/permission-service';
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
      teamId: user.primaryTeamId ?? undefined
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

    return await next();

  } catch (error) {
    log.error('File auth middleware error', {}, error as Error);
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

/**
 * F18: caller-supplied conversationId / messageId must belong to a conversation
 * the caller can see (own teams + unassigned pool; admin all). Returns null when
 * allowed, or a 403/404 Response. Nonexistent ids are rejected too (fail closed).
 */
export async function checkConversationBinding(
  c: Context<{ Bindings: Bindings }>,
  ids: { conversationId?: string | null; messageId?: string | null }
): Promise<Response | null> {
  const user = c.get('user');
  if (!user) {
    return unauthorizedResponse(c, 'Authentication required');
  }
  for (const v of [ids.conversationId, ids.messageId]) {
    if (v !== undefined && v !== null && typeof v !== 'string') {
      return badRequestResponse(c, 'Invalid conversationId or messageId');
    }
  }
  const principal = { userId: user.id, role: user.role, allowedTeamIds: user.allowedTeamIds };
  const conversationIds = new Set<string>();
  if (ids.conversationId) conversationIds.add(ids.conversationId);
  if (ids.messageId) {
    const db = createDbClient(c.env.DB);
    const msg = await db
      .select({ conversationId: messages.conversationId })
      .from(messages)
      .where(eq(messages.id, ids.messageId))
      .get();
    if (!msg) {
      return notFoundResponse(c, 'Message not found');
    }
    conversationIds.add(msg.conversationId);
  }
  for (const id of conversationIds) {
    if (!(await canConversationBeAccessedBy(c.env, principal, id)).allowed) {
      return forbiddenResponse(c, 'Access to this conversation is denied');
    }
  }
  return null;
}

/**
 * F16: a file may be deleted by its uploader, an admin, or someone who can
 * access the file's conversation (directly or via its message).
 */
export async function canDeleteFile(
  c: Context<{ Bindings: Bindings }>,
  fileId: string
): Promise<'ok' | 'not_found' | 'forbidden'> {
  const user = c.get('user');
  if (!user) return 'forbidden';
  const db = createDbClient(c.env.DB);
  const row = await db
    .select({
      uploadedBy: fileAttachments.uploadedBy,
      conversationId: fileAttachments.conversationId,
      messageId: fileAttachments.messageId,
    })
    .from(fileAttachments)
    .where(eq(fileAttachments.id, fileId))
    .get();
  if (!row) return 'not_found';
  if (user.role === 'admin') return 'ok';
  if (row.uploadedBy && String(row.uploadedBy) === String(user.id)) return 'ok';
  const denied = await checkConversationBinding(c, {
    conversationId: row.conversationId,
    messageId: row.messageId,
  });
  const hasBinding = !!(row.conversationId || row.messageId);
  return hasBinding && denied === null ? 'ok' : 'forbidden';
}
