// Messaging 模組權限控制中間件
// Message access control and permission middleware

import { Context, Next } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, inArray } from 'drizzle-orm';
import type { Bindings, DbUser, JWTPayload } from '@/types';
import {
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse
} from '@/utils/api-response';
import { MessageCrudService } from '@modules/messaging/services/message-crud';
import type { MessageAccessScope, MessagePermissions, SenderType } from '@modules/messaging/types/message-types';
import { agentTeams, conversations } from '@/db/schema';
import { nowISO } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('MessageAuth');

/** Extended Hono context variables for message auth middleware */
interface MessageAuthVariables {
  messagePermissions: MessagePermissions
  messageAccessScope: MessageAccessScope
  conversationFilter: string[]
  platformFilter: string[]
  user: JWTPayload
}

type MessageAuthContext = Context<{ Bindings: Bindings; Variables: MessageAuthVariables }>

type MessageAuthUser = Pick<JWTPayload, 'role' | 'primaryTeamId' | 'allowedTeamIds'> & {
  userId: string | number
}

/** Safely cast a base Hono context to our extended context (middleware enriches variables at runtime) */
function authCtx(c: Context<{ Bindings: Bindings }>): MessageAuthContext {
  return c as unknown as MessageAuthContext;
}

function getAuthenticatedMessageUser(c: Context<{ Bindings: Bindings }>): MessageAuthUser | null {
  const user = c.get('user' as never) as (DbUser | JWTPayload | undefined);
  const jwtPayload = c.get('jwtPayload' as never) as (JWTPayload | undefined);
  const source = user || jwtPayload;

  if (!source) {
    return null;
  }

  const userId = 'userId' in source ? source.userId : source.id;

  if (userId === undefined || userId === null) {
    return null;
  }

  return {
    userId,
    role: source.role,
    primaryTeamId: source.primaryTeamId ?? undefined,
    allowedTeamIds: source.allowedTeamIds,
  };
}

// ======================== 基礎權限檢查 ========================

/**
 * 檢查用戶是否有訊息模組的基本存取權限
 */
export async function checkMessageAccess(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const userPayload = getAuthenticatedMessageUser(c);

    if (!userPayload) {
      return unauthorizedResponse(c, 'Authentication required for message access');
    }

    // SECURITY: Check user role has message permissions (2-tier system)
    const allowedRoles = ['admin', 'agent'];
    if (!allowedRoles.includes(userPayload.role)) {
      return forbiddenResponse(c, 'Insufficient permissions for message access');
    }

    // 將用戶權限資訊存入 context
    authCtx(c).set('messagePermissions', await getMessagePermissions(userPayload));
    authCtx(c).set('messageAccessScope', await getMessageAccessScope(userPayload, c.env.DB));

    return await next();
  } catch (error) {
    log.error('Error in message access check:', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: nowISO()
    }, 500);
  }
}

/**
 * 檢查特定訊息的存取權限
 */
export async function checkSpecificMessageAccess(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const messageId = c.req.param('id');
    const accessScope = authCtx(c).get('messageAccessScope');

    if (!messageId) {
      return c.json({
        success: false,
        error: 'Message ID is required',
        timestamp: nowISO()
      }, 400);
    }

    // 如果有全域存取權限，直接通過
    if (accessScope.isGlobalAccess) {
      return await next();
    }

    // 檢查訊息是否存在以及用戶是否有權限存取
    const messageService = new MessageCrudService(c.env.DB);
    const message = await messageService.findById(messageId);

    if (!message) {
      return notFoundResponse(c, 'Message');
    }

    // 檢查對話權限
    if (!accessScope.conversationIds?.includes(message.conversationId)) {
      return forbiddenResponse(c, 'No permission to access this message');
    }

    return await next();
  } catch (error) {
    log.error('Error in specific message access check:', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: 'Message permission check failed',
      timestamp: nowISO()
    }, 500);
  }
}

// ======================== 功能權限檢查 ========================

/**
 * 檢查訊息發送權限
 */
export async function checkMessageSendPermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const permissions = authCtx(c).get('messagePermissions');

    if (!permissions.canSend) {
      return forbiddenResponse(c, 'No permission to send messages');
    }

    return await next();
  } catch (error) {
    log.error('Error in message send permission check:', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: 'Send permission check failed',
      timestamp: nowISO()
    }, 500);
  }
}

/**
 * 檢查訊息召回權限
 */
export async function checkMessageRecallPermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const permissions = authCtx(c).get('messagePermissions');

    if (!permissions.canRecall) {
      return forbiddenResponse(c, 'No permission to recall messages');
    }

    return await next();
  } catch (error) {
    log.error('Error in message recall permission check:', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: 'Recall permission check failed',
      timestamp: nowISO()
    }, 500);
  }
}

/**
 * 檢查延遲發送權限
 */
export async function checkDelayedSendPermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const permissions = authCtx(c).get('messagePermissions');

    if (!permissions.canSendDelayed) {
      return forbiddenResponse(c, 'No permission to send delayed messages');
    }

    return await next();
  } catch (error) {
    log.error('Error in delayed send permission check:', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: 'Delayed send permission check failed',
      timestamp: nowISO()
    }, 500);
  }
}

/**
 * 檢查批量操作權限
 */
export async function checkBatchOperationPermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const permissions = authCtx(c).get('messagePermissions');

    if (!permissions.canBatchOperation) {
      return forbiddenResponse(c, 'No permission for batch operations');
    }

    return await next();
  } catch (error) {
    log.error('Error in batch operation permission check:', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: 'Batch operation permission check failed',
      timestamp: nowISO()
    }, 500);
  }
}

/**
 * 檢查統計檢視權限
 */
export async function checkStatsViewPermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const permissions = authCtx(c).get('messagePermissions');

    if (!permissions.canAccessStats) {
      return forbiddenResponse(c, 'No permission to view message statistics');
    }

    return await next();
  } catch (error) {
    log.error('Error in stats view permission check:', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: 'Stats view permission check failed',
      timestamp: nowISO()
    }, 500);
  }
}

// ======================== 資料過濾中間件 ========================

/**
 * 根據團隊權限範圍過濾訊息查詢
 */
export async function applyMessageScopeFilter(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const accessScope = authCtx(c).get('messageAccessScope');

    // 如果沒有全域權限，設定範圍限制
    if (!accessScope.isGlobalAccess) {
      // 設定對話ID限制
      if (accessScope.conversationIds && accessScope.conversationIds.length > 0) {
        authCtx(c).set('conversationFilter', accessScope.conversationIds);
      }

      // 設定平台限制
      if (accessScope.platforms && accessScope.platforms.length > 0) {
        authCtx(c).set('platformFilter', accessScope.platforms);
      }
    }

    return await next();
  } catch (error) {
    log.error('Error applying message scope filter:', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: 'Scope filter application failed',
      timestamp: nowISO()
    }, 500);
  }
}

// ======================== 權限計算函數 ========================

/**
 * 根據用戶資訊計算訊息權限
 */
async function getMessagePermissions(userPayload: MessageAuthUser): Promise<MessagePermissions> {
  // 根據角色設定基礎權限
  const basePermissions: MessagePermissions = {
    canSend: false,
    canRecall: false,
    canViewHistory: false,
    canSendDelayed: false,
    canBatchOperation: false,
    canAccessStats: false,
  };

  switch (userPayload.role) {
    case 'admin':
      return {
        canSend: true,
        canRecall: true,
        canViewHistory: true,
        canSendDelayed: true,
        canBatchOperation: true,
        canAccessStats: true,
      };

    case 'agent':
      return {
        canSend: true,
        canRecall: true,
        canViewHistory: true,
        canSendDelayed: false,
        canBatchOperation: false,
        canAccessStats: false,
      };

    default:
      return basePermissions;
  }
}

/**
 * 根據用戶資訊計算訊息存取範圍
 */
async function getMessageAccessScope(userPayload: MessageAuthUser, database: D1Database): Promise<MessageAccessScope> {
  // Admin 有全域存取權限
  if (userPayload.role === 'admin') {
    return {
      isGlobalAccess: true,
    };
  }

  // Agent 角色只能存取指派給自己的對話
  if (userPayload.role === 'agent') {
    const db = drizzle(database);
    const userId = userPayload.userId.toString();
    const memberships = await db
      .select({ teamId: agentTeams.teamId })
      .from(agentTeams)
      .where(eq(agentTeams.agentId, userId))
      .all();

    const teamIds = Array.from(new Set([
      ...memberships.map((membership) => membership.teamId),
      ...(userPayload.allowedTeamIds ?? []),
      ...(userPayload.primaryTeamId ? [userPayload.primaryTeamId] : []),
    ]));

    if (teamIds.length === 0) {
      return {
        conversationIds: [],
        teamIds: [],
        isGlobalAccess: false,
      };
    }

    const visibleConversations = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(inArray(conversations.assignedTeamId, teamIds))
      .all();

    return {
      conversationIds: visibleConversations.map((conversation) => conversation.id),
      teamIds,
      isGlobalAccess: false,
    };
  }

  // 預設無存取權限
  return {
    isGlobalAccess: false,
  };
}

// ======================== 發送者驗證 ========================

/**
 * 驗證發送者權限和身份
 */
export async function validateMessageSender(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const userPayload = getAuthenticatedMessageUser(c);
    const body = await c.req.json().catch(() => ({}));

    if (!userPayload) {
      return unauthorizedResponse(c, 'Authentication required for message sending');
    }

    // 驗證發送者類型
    const senderType: SenderType = body.senderType || 'agent';

    if (senderType === 'agent' && !body.agentSenderId) {
      body.agentSenderId = userPayload.userId.toString();
    }

    // 驗證發送者權限
    if (senderType === 'system' && userPayload.role !== 'admin') {
      return forbiddenResponse(c, 'Only administrators can send system messages');
    }

    // 重新設定請求 body
    c.req.raw = new Request(c.req.raw, {
      ...c.req.raw,
      body: JSON.stringify(body)
    });

    return await next();
  } catch (error) {
    log.error('Error validating message sender:', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: 'Sender validation failed',
      timestamp: nowISO()
    }, 500);
  }
}
