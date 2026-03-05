// 對話指派處理器
// Handles: POST /:id/assign, POST /:id/unassign, POST /:id/transfer

import { Hono } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import { globalErrorHandler } from '@/core/error-handler';
import { eq } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { conversations, customers, teams, conversationTransfers } from '@/db/schema';
import type { Bindings } from '@/types';
import type { NewConversationTransfer } from '../types/conversation-types';
import { PermissionService } from '@shared/services/permission-service';
import { jwtAuth } from '@/middleware/auth';
import { WebSocketBroadcastService } from '@/services/websocket-broadcast-service';
import { createContextLogger } from '@/utils/logger';
import { nowISO } from '@/utils/timestamp'

const log = createContextLogger('ConversationAssignmentHandler');

const conversationAssignmentHandler = new Hono<{ Bindings: Bindings }>();

// 指派對話到團隊 (僅支援團隊指派，個人指派已移除)
conversationAssignmentHandler.post('/:id/assign', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const conversationId = c.req.param('id')!;
    const { teamId, reason } = await c.req.json();
    // Note: userId removed - only team assignment is supported now

    // 檢查權限
    const hasPermission = await PermissionService.checkPermission(
      user.id,
      'conversation',
      'assign',
      undefined, // context
      c.env.DB   // 傳入資料庫以正確檢查用戶角色
    );

    if (!hasPermission) {
      return c.json({ error: 'Permission denied' }, HTTP_STATUS.FORBIDDEN);
    }

    // Validate teamId is provided
    if (!teamId) {
      return c.json({ error: 'Team ID is required for assignment' }, HTTP_STATUS.BAD_REQUEST);
    }

    // 更新對話指派
    const drizzleDb = createDbClient(c.env.DB);
    const timestamp = nowISO();

    log.info('Assign API updating conversation', {
      conversationId,
      teamId,
      status: 'assigned'
    });

    await drizzleDb
      .update(conversations)
      .set({
        assignedTeamId: teamId,
        status: 'assigned',
        updatedAt: timestamp
      })
      .where(eq(conversations.id, conversationId));

    log.debug('Assign API database UPDATE completed');

    // 記錄轉移歷史 (使用 Drizzle ORM)
    if (reason) {
      const transferRecord: NewConversationTransfer = {
        conversationId,
        toTeamId: teamId,
        transferReason: reason,
        transferredBy: String(user.id),
        createdAt: timestamp
      };

      await drizzleDb.insert(conversationTransfers).values(transferRecord);
    }

    // 🚀 WebSocket Broadcasting: Conversation Assignment
    // Query team name for real-time UI updates
    try {
      let assignedTeamName: string | null = null;

      // Query team name
      const teamInfo = await drizzleDb
        .select({ name: teams.name })
        .from(teams)
        .where(eq(teams.id, teamId))
        .get();
      assignedTeamName = teamInfo?.name || null;

      const broadcastService = new WebSocketBroadcastService(c.env);
      await broadcastService.broadcastConversationEvent({
        type: 'conversation_assigned',
        conversationId,
        userId: String(user.id),
        data: {
          assignedTeamId: teamId,
          // Note: assignedUserId removed - only team assignment
          assignedTeamName,
          assignedBy: {
            id: user.id,
            name: user.displayName,
            role: user.role
          },
          reason,
          timestamp
        },
        priority: 'normal'
      });
      log.debug('WebSocket conversation assignment broadcasted', { assignedTeamName });
    } catch (broadcastError) {
      log.warn('WebSocket: Assignment broadcast failed, continuing with fallback', { error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError) });
    }

    // Note: Individual agent notifications removed - only team assignment is supported now

    // 🔧 FIX: 获取并返回完整的对话对象
    log.debug('Assign API fetching updated conversation with JOIN', {
      conversationId,
      expectedTeamId: teamId
    });

    const [updatedConversation] = await drizzleDb
      .select()
      .from(conversations)
      .leftJoin(teams, eq(conversations.assignedTeamId, teams.id))
      .leftJoin(customers, eq(conversations.customerId, customers.id))  // 🔧 FIX: Add customer JOIN
      .where(eq(conversations.id, conversationId))
      .limit(1);

    log.debug('Assign API JOIN query result', {
      hasResult: !!updatedConversation,
      hasConversation: !!updatedConversation?.conversations,
      hasTeam: !!updatedConversation?.teams,
      hasCustomer: !!updatedConversation?.customers,
      conversationId: updatedConversation?.conversations?.id,
      assignedTeamIdInDB: updatedConversation?.conversations?.assignedTeamId,
      teamId: updatedConversation?.teams?.id,
      teamName: updatedConversation?.teams?.name,
      customerId: updatedConversation?.customers?.id,
      customerName: updatedConversation?.customers?.displayName  // 🔧 FIX: Use displayName
    });

    if (!updatedConversation) {
      log.error('Assign API: Failed to retrieve updated conversation');
      return c.json({
        success: false,
        error: 'Failed to retrieve updated conversation'
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    // 构建返回对象，確保 customer 對象包含 name 字段
    const conversationData: any = {
      ...updatedConversation.conversations,
      assignedTeam: updatedConversation.teams || undefined,
      customer: updatedConversation.customers ? {
        ...updatedConversation.customers,
        name: updatedConversation.customers.displayName  // 🔧 FIX: 添加 name 字段以匹配前端類型定義
      } : undefined
    };

    log.info('Assign API conversation assigned successfully', {
      id: conversationId,
      status: conversationData.status,
      assignedTeamId: conversationData.assignedTeamId,
      hasAssignedTeam: !!conversationData.assignedTeam,
      assignedTeamName: conversationData.assignedTeam?.name,
      hasCustomer: !!conversationData.customer,
      customerName: conversationData.customer?.displayName  // 🔧 FIX: Use displayName
    });

    return c.json({
      success: true,
      message: 'Conversation assigned successfully',
      data: conversationData,
      timestamp: nowISO()
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// 取消指派對話
conversationAssignmentHandler.post('/:id/unassign', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const conversationId = c.req.param('id')!;
    const { reason } = await c.req.json().catch(() => ({}));

    // 檢查權限（需要 assign 權限才能取消指派）
    const hasPermission = await PermissionService.checkPermission(
      user.id,
      'conversation',
      'assign',
      undefined,
      c.env.DB
    );

    if (!hasPermission) {
      return c.json({ error: 'Permission denied' }, HTTP_STATUS.FORBIDDEN);
    }

    const drizzleDb = createDbClient(c.env.DB);

    // 檢查對話是否存在
    const [conversation] = await drizzleDb
      .select()
      .from(conversations)
      .leftJoin(teams, eq(conversations.assignedTeamId, teams.id))
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!conversation || !conversation.conversations) {
      return c.json({ error: 'Conversation not found' }, HTTP_STATUS.NOT_FOUND);
    }

    // 檢查對話是否已指派 (只檢查團隊指派)
    const conv = conversation.conversations;
    if (!conv.assignedTeamId) {
      return c.json({ error: 'Conversation is not assigned' }, HTTP_STATUS.BAD_REQUEST);
    }

    // 記錄取消指派前的狀態 (只記錄團隊)
    const previousAssignment = {
      teamId: conv.assignedTeamId,
      teamName: conversation.teams?.name
    };

    log.info('Unassign API unassigning conversation', {
      conversationId,
      previousAssignment,
      unassignedBy: user.displayName || user.id
    });

    // 取消指派：清除 teamId 和 userId，將狀態改回 'open'
    const timestamp = nowISO();

    try {
      // 使用原始 SQL 执行 UPDATE（避免 Drizzle ORM 的 NULL 处理问题）
      // Note: assigned_user_id removed - only team assignment is supported now
      await c.env.DB.prepare(
        `UPDATE conversations
         SET assigned_team_id = NULL,
             status = ?,
             updated_at = ?
         WHERE id = ?`
      ).bind('active', timestamp, conversationId).run();

      log.debug('Unassign API database UPDATE completed');
    } catch (dbError) {
      log.error('Unassign API: Database UPDATE failed', {
        error: dbError instanceof Error ? dbError.message : String(dbError),
        conversationId
      });
      throw dbError;
    }

    // 記錄取消指派歷史 (只記錄團隊)
    if (reason) {
      const transferRecord: NewConversationTransfer = {
        conversationId,
        fromTeamId: previousAssignment.teamId || null,
        toTeamId: null,
        transferReason: reason || '取消指派',
        transferredBy: String(user.id),
        createdAt: timestamp
      };

      await drizzleDb.insert(conversationTransfers).values(transferRecord);
    }

    // 🚀 WebSocket Broadcasting: Conversation Unassignment
    try {
      const broadcastService = new WebSocketBroadcastService(c.env);
      await broadcastService.broadcastConversationEvent({
        type: 'conversation_unassigned',
        conversationId,
        userId: String(user.id),
        data: {
          previousTeamId: previousAssignment.teamId,
          previousTeamName: previousAssignment.teamName,
          // Note: previousUserId removed - only team assignment is supported now
          unassignedBy: {
            id: user.id,
            name: user.displayName,
            role: user.role
          },
          reason: reason || '取消指派',
          timestamp
        },
        priority: 'high'
      });
      log.debug('WebSocket conversation unassignment broadcasted');
    } catch (broadcastError) {
      log.warn('WebSocket: Unassignment broadcast failed, continuing', { error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError) });
    }

    // 獲取並返回更新後的完整對話對象
    const [updatedConversation] = await drizzleDb
      .select()
      .from(conversations)
      .leftJoin(teams, eq(conversations.assignedTeamId, teams.id))
      .leftJoin(customers, eq(conversations.customerId, customers.id))
      .where(eq(conversations.id, conversationId))
      .limit(1);

    const conversationData: any = {
      ...updatedConversation?.conversations,
      assignedTeam: updatedConversation?.teams || undefined,
      customer: updatedConversation?.customers ? {
        id: updatedConversation.customers.id,
        name: updatedConversation.customers.displayName, // 🔧 FIX: 添加 name 字段以匹配前端類型定義
        displayName: updatedConversation.customers.displayName, // 保留向後兼容
        platformUserId: updatedConversation.customers.platformUserId,
        platform: updatedConversation.customers.platform,
        avatarUrl: updatedConversation.customers.avatarUrl,
        createdAt: updatedConversation.customers.createdAt
      } : undefined
    };

    log.info('Unassign API conversation unassigned successfully');

    return c.json({
      success: true,
      message: 'Conversation unassigned successfully',
      data: conversationData,
      timestamp: nowISO()
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// 轉移對話 (僅支援團隊間轉移，個人轉移已移除)
conversationAssignmentHandler.post('/:id/transfer', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const conversationId = c.req.param('id')!;
    const { fromTeamId, toTeamId, reason } = await c.req.json();
    // Note: fromUserId and toUserId removed - only team-based transfer is supported now

    // 檢查權限：使用 JWT 中的角色直接判斷（更可靠）
    // 管理員可以轉指派任何對話，普通客服需要額外檢查
    const userRole = user.role;

    if (userRole !== 'admin') {
      // 非管理員：檢查是否有權限操作此對話
      const hasPermission = await PermissionService.checkPermission(
        user.id,
        'conversation',
        'assign',  // 使用 assign 權限，因為 transfer 本質上是一種特殊的 assign
        undefined,
        c.env.DB
      );

      if (!hasPermission) {
        return c.json({ error: 'Permission denied' }, HTTP_STATUS.FORBIDDEN);
      }
    }

    // Validate toTeamId is provided
    if (!toTeamId) {
      return c.json({ error: 'Target team ID is required for transfer' }, HTTP_STATUS.BAD_REQUEST);
    }

    // Admin 直接通過權限檢查

    // 更新對話指派
    const drizzleDb = createDbClient(c.env.DB);
    const timestamp = nowISO();

    await drizzleDb
      .update(conversations)
      .set({
        assignedTeamId: toTeamId,
        status: 'active',
        updatedAt: timestamp
      })
      .where(eq(conversations.id, conversationId));

    // 記錄轉移歷史 (使用 Drizzle ORM) - 只記錄團隊
    const transferRecord: NewConversationTransfer = {
      conversationId,
      fromTeamId: fromTeamId || null,
      toTeamId: toTeamId,
      transferReason: reason,
      transferredBy: String(user.id),
      createdAt: timestamp
    };

    await drizzleDb.insert(conversationTransfers).values(transferRecord);

    // 🚀 WebSocket Broadcasting: Dual-Team Conversation Transfer
    // Uses new broadcastConversationTransferred() for proper team-scoped notifications
    try {
      const broadcastService = new WebSocketBroadcastService(c.env);

      // 📦 Fetch conversation details for broadcast payload (team-based only)
      const conversationDetails = await drizzleDb
        .select({
          id: conversations.id,
          customerId: conversations.customerId,
          customerName: customers.displayName,
          platform: customers.platform,  // platform is from customers table
          status: conversations.status,
          lastMessageAt: conversations.lastMessageAt
          // Note: assignedUserId/assignedAgentName removed - only team assignment is supported
        })
        .from(conversations)
        .leftJoin(customers, eq(conversations.customerId, customers.id))
        .where(eq(conversations.id, conversationId))
        .get();

      // 📦 Fetch team names for broadcast
      const fromTeamInfo = fromTeamId ? await drizzleDb
        .select({ name: teams.name })
        .from(teams)
        .where(eq(teams.id, fromTeamId))
        .get() : null;

      const toTeamInfo = toTeamId ? await drizzleDb
        .select({ name: teams.name })
        .from(teams)
        .where(eq(teams.id, toTeamId))
        .get() : null;

      // 🆕 Use new dual-team broadcast method
      const broadcastResults = await broadcastService.broadcastConversationTransferred({
        conversationId,
        fromTeamId: fromTeamId || null,
        toTeamId: toTeamId,
        fromTeamName: fromTeamInfo?.name,
        toTeamName: toTeamInfo?.name,
        conversation: {
          id: conversationId,
          customerId: conversationDetails?.customerId || undefined,
          customerName: conversationDetails?.customerName || '未知客戶',
          platform: conversationDetails?.platform || undefined,
          status: conversationDetails?.status || 'active',
          lastMessage: conversationDetails?.lastMessageAt ? {
            content: undefined,  // Content not needed for transfer notification
            timestamp: new Date(conversationDetails.lastMessageAt).getTime()
          } : undefined,
          unreadCount: 0,  // Will be recalculated by the receiving team
          // Note: assignedAgent/assignedAgentId removed - only team assignment is supported
          // Include target team info
          assignedTeamId: toTeamId,
          assignedTeam: toTeamId ? {
            id: toTeamId,
            name: toTeamInfo?.name || `Team ${toTeamId}`
          } : undefined
        },
        transferredBy: {
          id: String(user.id),
          name: user.displayName || 'Unknown'
        },
        reason
      });

      log.debug('WebSocket dual-team transfer broadcasted', {
        conversationId,
        fromTeamId,
        toTeamId,
        results: broadcastResults
      });
    } catch (broadcastError) {
      log.warn('WebSocket: Transfer broadcast failed, continuing', {
        error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError)
      });
    }

    // Note: Individual agent notifications removed - only team-based transfer is supported now
    // Team members will receive notifications via WebSocket broadcast

    return c.json({
      success: true,
      message: 'Conversation transferred successfully',
      timestamp: nowISO()
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

export default conversationAssignmentHandler;
