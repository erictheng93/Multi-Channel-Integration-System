// Messaging 模組權限控制中間件
// Message access control and permission middleware

import { Context, Next } from 'hono';
import type { Bindings, JWTPayload } from '../../../types';
import {
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse
} from '../../../shared/utils/api-response';
import { MessageCrudService } from '@modules/messaging/services/message-crud';
import type { MessageAccessScope, MessagePermissions, SenderType } from '@modules/messaging/types/message-types';

// ======================== 基礎權限檢查 ========================

/**
 * 檢查用戶是否有訊息模組的基本存取權限
 */
export async function checkMessageAccess(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const userPayload = c.get('user') as unknown as JWTPayload;

    if (!userPayload) {
      return unauthorizedResponse(c, 'Authentication required for message access');
    }

    // 檢查用戶角色是否有訊息權限
    const allowedRoles = ['admin', 'team', 'agent'];
    if (!allowedRoles.includes(userPayload.role)) {
      return forbiddenResponse(c, 'Insufficient permissions for message access');
    }

    // 將用戶權限資訊存入 context
    (c as any).set('messagePermissions', await getMessagePermissions(userPayload));
    (c as any).set('messageAccessScope', await getMessageAccessScope(userPayload));

    await next();
  } catch (error) {
    console.error('Error in message access check:', error);
    return c.json({
      success: false,
      error: 'Permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

/**
 * 檢查特定訊息的存取權限
 */
export async function checkSpecificMessageAccess(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const messageId = c.req.param('id');
    const userPayload = c.get('user') as unknown as JWTPayload;
    const accessScope = (c as any).get('messageAccessScope') as MessageAccessScope;

    if (!messageId) {
      return c.json({
        success: false,
        error: 'Message ID is required',
        timestamp: new Date().toISOString()
      }, 400);
    }

    // 如果有全域存取權限，直接通過
    if (accessScope.isGlobalAccess) {
      await next();
      return;
    }

    // 檢查訊息是否存在以及用戶是否有權限存取
    const messageService = new MessageCrudService(c.env.DB);
    const message = await messageService.findById(messageId);

    if (!message) {
      return notFoundResponse(c, 'Message');
    }

    // 檢查對話權限
    if (accessScope.conversationIds && !accessScope.conversationIds.includes(message.conversationId)) {
      return forbiddenResponse(c, 'No permission to access this message');
    }

    await next();
  } catch (error) {
    console.error('Error in specific message access check:', error);
    return c.json({
      success: false,
      error: 'Message permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

// ======================== 功能權限檢查 ========================

/**
 * 檢查訊息發送權限
 */
export async function checkMessageSendPermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const permissions = (c as any).get('messagePermissions') as MessagePermissions;

    if (!permissions.canSend) {
      return forbiddenResponse(c, 'No permission to send messages');
    }

    await next();
  } catch (error) {
    console.error('Error in message send permission check:', error);
    return c.json({
      success: false,
      error: 'Send permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

/**
 * 檢查訊息召回權限
 */
export async function checkMessageRecallPermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const permissions = (c as any).get('messagePermissions') as MessagePermissions;

    if (!permissions.canRecall) {
      return forbiddenResponse(c, 'No permission to recall messages');
    }

    await next();
  } catch (error) {
    console.error('Error in message recall permission check:', error);
    return c.json({
      success: false,
      error: 'Recall permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

/**
 * 檢查延遲發送權限
 */
export async function checkDelayedSendPermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const permissions = (c as any).get('messagePermissions') as MessagePermissions;

    if (!permissions.canSendDelayed) {
      return forbiddenResponse(c, 'No permission to send delayed messages');
    }

    await next();
  } catch (error) {
    console.error('Error in delayed send permission check:', error);
    return c.json({
      success: false,
      error: 'Delayed send permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

/**
 * 檢查批量操作權限
 */
export async function checkBatchOperationPermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const permissions = (c as any).get('messagePermissions') as MessagePermissions;

    if (!permissions.canBatchOperation) {
      return forbiddenResponse(c, 'No permission for batch operations');
    }

    await next();
  } catch (error) {
    console.error('Error in batch operation permission check:', error);
    return c.json({
      success: false,
      error: 'Batch operation permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

/**
 * 檢查統計檢視權限
 */
export async function checkStatsViewPermission(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const permissions = (c as any).get('messagePermissions') as MessagePermissions;

    if (!permissions.canAccessStats) {
      return forbiddenResponse(c, 'No permission to view message statistics');
    }

    await next();
  } catch (error) {
    console.error('Error in stats view permission check:', error);
    return c.json({
      success: false,
      error: 'Stats view permission check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

// ======================== 資料過濾中間件 ========================

/**
 * 根據團隊權限範圍過濾訊息查詢
 */
export async function applyMessageScopeFilter(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const accessScope = (c as any).get('messageAccessScope') as MessageAccessScope;

    // 如果沒有全域權限，設定範圍限制
    if (!accessScope.isGlobalAccess) {
      // 設定對話ID限制
      if (accessScope.conversationIds && accessScope.conversationIds.length > 0) {
        (c as any).set('conversationFilter', accessScope.conversationIds);
      }

      // 設定平台限制
      if (accessScope.platforms && accessScope.platforms.length > 0) {
        (c as any).set('platformFilter', accessScope.platforms);
      }
    }

    await next();
  } catch (error) {
    console.error('Error applying message scope filter:', error);
    return c.json({
      success: false,
      error: 'Scope filter application failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

// ======================== 權限計算函數 ========================

/**
 * 根據用戶資訊計算訊息權限
 */
async function getMessagePermissions(userPayload: JWTPayload): Promise<MessagePermissions> {
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

    case 'team':
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
async function getMessageAccessScope(userPayload: JWTPayload): Promise<MessageAccessScope> {
  // Admin 有全域存取權限
  if (userPayload.role === 'admin') {
    return {
      isGlobalAccess: true,
    };
  }

  // Team 角色有團隊範圍的存取權限
  if (userPayload.role === 'team' && userPayload.teamId) {
    // TODO: 從資料庫取得團隊的對話清單
    return {
      teamIds: [userPayload.teamId],
      isGlobalAccess: false,
    };
  }

  // Agent 角色只能存取指派給自己的對話
  if (userPayload.role === 'agent' && userPayload.teamId) {
    // TODO: 從資料庫取得代理人的對話清單
    return {
      teamIds: [userPayload.teamId],
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
    const userPayload = c.get('user') as unknown as JWTPayload;
    const body = await c.req.json().catch(() => ({}));

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

    await next();
  } catch (error) {
    console.error('Error validating message sender:', error);
    return c.json({
      success: false,
      error: 'Sender validation failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
}