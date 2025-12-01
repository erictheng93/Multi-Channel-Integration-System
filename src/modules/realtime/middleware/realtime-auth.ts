// Real-time 認證中間件 - 專門處理即時通訊的認證需求

import { Context, Next } from 'hono';
import type { Bindings } from '@/types';
// REMOVED: SSEAuthPayload (Phase 3 cleanup - replaced with RealtimeAuthPayload)
// import type { SSEAuthPayload } from '@modules/realtime/types';
import { verifyJWT } from '@/utils/auth';
import { unauthorizedResponse } from '@/utils/api-response';

// Real-time 認證 Payload (替代 SSEAuthPayload)
export interface RealtimeAuthPayload {
  userId: number;
  displayName: string;
  role: string;
  teamId?: number;
  conversationAccess?: number[];
}

// Real-time 認證配置
interface RealtimeAuthConfig {
  allowQueryToken: boolean;           // 允許查詢參數中的 token
  allowHeaderToken: boolean;          // 允許 Header 中的 token
  requireConversationAccess: boolean; // 需要對話訪問權限
  enableRoleValidation: boolean;      // 啟用角色驗證
  validRoles: string[];              // 有效的角色列表
}

// SECURITY: 2-tier role system configuration
const defaultConfig: RealtimeAuthConfig = {
  allowQueryToken: true,
  allowHeaderToken: true,
  requireConversationAccess: false,
  enableRoleValidation: true,
  validRoles: ['admin', 'agent']
};

// Real-time 認證中間件
export const realtimeAuth = (config: Partial<RealtimeAuthConfig> = {}) => {
  const authConfig = { ...defaultConfig, ...config };

  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    try {
      let authPayload: RealtimeAuthPayload | null = null;

      // 1. 嘗試從現有的 JWT payload 獲取
      const existingPayload = c.get('jwtPayload');
      if (existingPayload) {
        authPayload = {
          userId: Number(existingPayload.userId),
          displayName: existingPayload.displayName,
          role: existingPayload.role,
          teamId: existingPayload.teamId,
          conversationAccess: (existingPayload as any).conversationAccess || []
        };
      }

      // 2. 如果沒有現有 payload，嘗試其他方式
      if (!authPayload) {
        let token: string | null = null;

        // 從 Header 獲取 token
        if (authConfig.allowHeaderToken) {
          const authHeader = c.req.header('Authorization');
          if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
          }
        }

        // 從查詢參數獲取 token（主要用於 SSE）
        if (!token && authConfig.allowQueryToken) {
          token = c.req.query('token') ?? null;
        }

        // 驗證 token
        if (token) {
          try {
            const jwtPayload = await verifyJWT(token, c.env.JWT_SECRET);
            authPayload = {
              userId: Number(jwtPayload.userId),
              displayName: jwtPayload.displayName,
              role: jwtPayload.role,
              teamId: jwtPayload.teamId,
              conversationAccess: (jwtPayload as any).conversationAccess || []
            };

            // 將 payload 設置到 context 中
            c.set('jwtPayload', jwtPayload);
          } catch (error) {
            console.error('❌ [Realtime Auth] Token 驗證失敗:', error);
            return unauthorizedResponse(c, 'Invalid or expired token');
          }
        }
      }

      // 3. 檢查是否有認證信息
      if (!authPayload) {
        return unauthorizedResponse(c, 'Authentication required for real-time access');
      }

      // 4. 角色驗證
      if (authConfig.enableRoleValidation) {
        if (!authPayload.role || !authConfig.validRoles.includes(authPayload.role)) {
          return unauthorizedResponse(c, 'Invalid role for real-time access');
        }
      }

      // 5. 對話訪問權限檢查
      if (authConfig.requireConversationAccess) {
        const conversationId = c.req.query('conversationId') || c.req.param('conversationId');
        if (conversationId) {
          const convId = parseInt(conversationId);
          if (isNaN(convId)) {
            return unauthorizedResponse(c, 'Invalid conversation ID');
          }

          // 檢查用戶是否有權訪問此對話
          const hasAccess = await checkConversationAccess(
            authPayload.userId,
            convId,
            authPayload.role,
            authPayload.teamId,
            c.env
          );

          if (!hasAccess) {
            return unauthorizedResponse(c, 'No access to this conversation');
          }
        }
      }

      // 6. 將認證信息存儲到 context
      c.set('realtimeAuth', authPayload);

      // 7. 記錄認證成功
      console.log(`✅ [Realtime Auth] 認證成功:`, {
        userId: authPayload.userId,
        role: authPayload.role,
        teamId: authPayload.teamId,
        timestamp: new Date().toISOString()
      });

      await next();

    } catch (error) {
      console.error('❌ [Realtime Auth] 認證中間件錯誤:', error);
      return unauthorizedResponse(c, 'Authentication error');
    }
  };
};

// 檢查對話訪問權限
async function checkConversationAccess(
  userId: number,
  conversationId: number,
  userRole: string,
  teamId?: number,
  env?: Bindings
): Promise<boolean> {
  if (!env?.DB) {
    console.warn('⚠️ [Realtime Auth] 資料庫不可用，跳過權限檢查');
    return true; // 如果資料庫不可用，允許訪問
  }

  try {
    // Admin 可以訪問所有對話
    if (userRole === 'admin') {
      return true;
    }

    // 查詢對話信息
    const conversation = await env.DB.prepare(`
      SELECT
        c.id,
        c.assigned_user_id,
        c.assigned_team_id,
        c.customer_id,
        cu.platform
      FROM conversations c
      JOIN customers cu ON c.customer_id = cu.id
      WHERE c.id = ?
    `).bind(conversationId).first();

    if (!conversation) {
      console.warn(`⚠️ [Realtime Auth] 對話不存在: ${conversationId}`);
      return false;
    }

    // 檢查直接分配
    if (conversation.assigned_user_id === userId) {
      return true;
    }

    // 檢查團隊分配
    if (teamId && conversation.assigned_team_id === teamId) {
      return true;
    }

    // Team 角色可以訪問未分配的對話
    if (userRole === 'team' && !conversation.assigned_user_id && !conversation.assigned_team_id) {
      return true;
    }

    // 檢查是否是團隊成員
    if (teamId) {
      const teamMember = await env.DB.prepare(`
        SELECT 1 FROM team_members
        WHERE team_id = ? AND user_id = ? AND status = 'active'
      `).bind(teamId, userId).first();

      if (teamMember && conversation.assigned_team_id === teamId) {
        return true;
      }
    }

    console.warn(`⚠️ [Realtime Auth] 用戶無權訪問對話:`, {
      userId,
      conversationId,
      userRole,
      teamId,
      assignedUserId: conversation.assigned_user_id,
      assignedTeamId: conversation.assigned_team_id
    });

    return false;

  } catch (error) {
    console.error('❌ [Realtime Auth] 權限檢查失敗:', error);
    return false; // 安全考慮，檢查失敗時拒絕訪問
  }
}

// SECURITY: SSE auth - 2-tier role system
export const sseAuth = realtimeAuth({
  allowQueryToken: true,
  allowHeaderToken: true,
  requireConversationAccess: true,
  enableRoleValidation: true,
  validRoles: ['admin', 'agent']
});

// SECURITY: Event send auth - 2-tier role system
export const eventSendAuth = realtimeAuth({
  allowQueryToken: false,
  allowHeaderToken: true,
  requireConversationAccess: false,
  enableRoleValidation: true,
  validRoles: ['admin', 'agent']
});

// SECURITY: Management auth - admin only
export const managementAuth = realtimeAuth({
  allowQueryToken: false,
  allowHeaderToken: true,
  requireConversationAccess: false,
  enableRoleValidation: true,
  validRoles: ['admin']
});

// 從 context 獲取 Real-time 認證信息的便利函數
export function getRealtimeAuth(c: Context): RealtimeAuthPayload | null {
  return c.get('realtimeAuth') || null;
}

// 檢查用戶是否有特定權限
export function hasRealtimePermission(
  auth: RealtimeAuthPayload,
  permission: 'read' | 'write' | 'manage' | 'admin'
): boolean {
  switch (permission) {
    case 'read':
      return ['admin', 'agent'].includes(auth.role || '');
    case 'write':
      return ['admin', 'agent'].includes(auth.role || '');
    case 'manage':
      return auth.role === 'admin';
    case 'admin':
      return auth.role === 'admin';
    default:
      return false;
  }
}